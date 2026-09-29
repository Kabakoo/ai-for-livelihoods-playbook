"""Check the live publication, indexing, links, search and distribution."""
from pathlib import Path
from html.parser import HTMLParser
import json
import os
import xml.etree.ElementTree as ET
import re
from urllib.parse import parse_qs, unquote, urljoin, urlsplit
from public_links import is_external_link

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / '_site'
BASE = os.environ.get('PLAYBOOK_URL', 'https://playbook.kabakoo.africa/').rstrip('/') + '/'
BASE_HOST = urlsplit(BASE).netloc
ANALYTICS_ID = os.environ.get('PLAYBOOK_GA4_ID', '').strip()

class Page(HTMLParser):
    def __init__(self, text, url):
        super().__init__()
        self.ids = set()
        self.links = []
        self.feedback = []
        self.canonicals = []
        self.robots = []
        self.link_policy_errors = []
        self.url = url
        self.logos = []
        self.feed(text)

    def handle_starttag(self, tag, attributes):
        a = dict(attributes)
        if tag == 'a':
            href = a.get('href', '')
            if urlsplit(href).hostname in {'app.notion.com', 'notion.so', 'www.notion.so'}:
                self.link_policy_errors.append(href)
            external = is_external_link(href, self.url, BASE)
            if external and (a.get('target') != '_blank' or not {'noopener', 'noreferrer'} <= set(a.get('rel', '').split())):
                self.link_policy_errors.append(href)
            if not external and a.get('target') not in (None, '', '_self'):
                self.link_policy_errors.append('Internal link leaves current tab: ' + href)
            if 'sidebar-logo-link' in a.get('class', '').split():
                self.logos.append(href)
        if 'id' in a:
            self.ids.add(a['id'])
        for key in ['href', 'src']:
            if a.get(key):
                self.links.append(a[key])
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonicals.append(a['href'])
        if tag == 'meta' and a.get('name') == 'robots':
            self.robots.append(a.get('content'))
        if tag == 'a' and 'feedback' in a.get('href', '').lower() and a.get('href', '').startswith('mailto:'):
            self.feedback.append(a['href'])

pages = {p: Page(p.read_text(), BASE + p.relative_to(SITE).as_posix()) for p in SITE.rglob('*.html')}
assert len(pages) == 16
for path, page in pages.items():
    assert not page.link_policy_errors, (path, page.link_policy_errors)
    relative = path.relative_to(SITE).as_posix()
    url = BASE + ('' if relative == 'index.html' else relative)
    text = path.read_text()
    analytics_tags = re.findall(r'<script\b[^>]*data-measurement-id="([^"]+)"[^>]*>', text)
    assert analytics_tags == ([ANALYTICS_ID] if ANALYTICS_ID else []), ('Analytics configuration', relative)
    if ANALYTICS_ID:
        assert 'data-origin="' + urlsplit(BASE).scheme + '://' + BASE_HOST + '"' in text, relative
        assert 'googletagmanager.com/gtag' not in text, 'Google must load through the origin-checked analytics module'
    assert page.logos == ['https://www.kabakoo.africa/'], relative
    title = re.search(r'<div class="sidebar-title[^"]*">\s*<a href="([^"]*)"', text)
    assert title and urljoin(url, title[1]) == BASE + 'index.html', relative
    assert page.canonicals == [url], (relative, page.canonicals)
    assert not page.robots, relative
    assert not page.feedback, relative
    assert 'noindex' not in text.lower(), relative
    assert re.search(r'<a class="nav-link" href="mailto:akwaba@kabakoo.africa">\s*<p>Contact</p>', text), relative
    assert 'https://www.kabakoo.africa/playbook/' not in text, relative
    assert 'review-notice' not in text and 'Share feedback' not in text and 'Review edition.' not in text
    assert '<meta property="og:image" content="' + BASE + 'assets/social-preview.png">' in text
    assert '<script type="application/ld+json">' in text, relative
    for schema in re.findall(r'<script type="application/ld\+json">(.*?)</script>', text, re.S):
        value = json.loads(schema)
        assert value['url'] == url, relative
        assert value['author']['name'] == 'Kabakoo Academies', relative
        assert value['author']['url'] == 'https://www.kabakoo.africa/', relative
    for link in page.links:
        dest = urlsplit(urljoin(url, link))
        if dest.netloc != BASE_HOST:
            continue
        target = SITE / unquote(dest.path.removeprefix(urlsplit(BASE).path))
        if target.is_dir():
            target /= 'index.html'
        assert target.is_file(), (relative, link)
        if dest.fragment and target in pages:
            assert unquote(dest.fragment) in pages[target].ids, (relative, link)

for item in json.loads((SITE / 'search.json').read_text()):
    dest = urlsplit(urljoin(BASE, item['href']))
    target = SITE / unquote(dest.path.removeprefix(urlsplit(BASE).path))
    assert target in pages, item['href']
    assert not dest.fragment or unquote(dest.fragment) in pages[target].ids, item['href']

files = [p for p in SITE.rglob('*') if p.is_file()]
for p in files:
    assert p.suffix not in {'.pdf', '.qmd', '.py', '.scss', '.mjs', '.sh', '.toml'}, p
    assert not any(part.startswith('.') for part in p.relative_to(SITE).parts), p
assert not (SITE / '_headers').exists() or 'noindex' not in (SITE / '_headers').read_text().lower()
assert (SITE / 'robots.txt').read_text() == 'User-agent: *\nAllow: /\nSitemap: ' + BASE + 'sitemap.xml\n'
assert 'version: "2026.09-v7"' in (SITE / 'CITATION.cff').read_text()
assert 'Web edition 7' in (SITE / 'versions.html').read_text()
assert '/playbook/* /:splat 302!' in (SITE / '_redirects').read_text()
ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
urls = [n.text for n in ET.parse(SITE / 'sitemap.xml').findall('s:url/s:loc', ns)]
expected = sorted(BASE + ('' if p.name == 'index.html' else p.relative_to(SITE).as_posix()) for p in pages)
assert sorted(urls) == expected, 'Sitemap must list exactly the published page canonicals'
assert f'url: "{BASE}"' in (SITE / 'CITATION.cff').read_text(), 'Citation URL differs from reading address'
for name in ['licenses/Lato-OFL.txt', 'licenses/Rubik-OFL.txt', 'LICENSE-CODE.txt']:
    assert (SITE / name).is_file(), name
result = {'pages': len(pages), 'feedback_links': sum(len(p.feedback) for p in pages.values()),
          'files': len(files), 'passed': True}
(ROOT / '.work').mkdir(exist_ok=True)
(ROOT / '.work/static-results.json').write_text(json.dumps(result, indent=2) + '\n')
print(f'{len(pages)} live pages: URLs, search, fragments, metadata, indexing, no review invitations, and distribution pass.')
