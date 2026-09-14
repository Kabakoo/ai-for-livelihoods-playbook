"""Apply the publication's new-tab policy to static page links."""
from html import escape
from html.parser import HTMLParser
import re
from urllib.parse import urljoin, urlsplit


def is_external_link(href, page_url, publication_url):
    """Only web destinations outside this publication need a separate tab."""
    destination = urlsplit(urljoin(page_url, href))
    publication = urlsplit(publication_url)
    inside = (destination.scheme == publication.scheme
              and destination.netloc == publication.netloc
              and (destination.path == publication.path.rstrip('/')
                   or destination.path.startswith(publication.path)))
    return destination.scheme in ('http', 'https') and not inside


def prepare_links(html, page_url, publication_url):
    offsets = [0]
    for line in html.splitlines(keepends=True):
        offsets.append(offsets[-1] + len(line))
    replacements = []

    class Links(HTMLParser):
        def handle_starttag(self, tag, attributes):
            a = dict(attributes)
            if tag != 'a' or 'href' not in a:
                return
            raw = self.get_starttag_text()
            updated = re.sub(r'''\s+(?:target|rel)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)''', '', raw, flags=re.I)
            external = is_external_link(a['href'], page_url, publication_url)
            rel = [value for value in a.get('rel', '').split()
                   if value not in ('noopener', 'noreferrer')]
            if external:
                rel.extend(['noopener', 'noreferrer'])
                updated = updated[:-1] + ' target="_blank">'
            if rel:
                value = escape(' '.join(dict.fromkeys(rel)), quote=True)
                updated = updated[:-1] + f' rel="{value}">'
            line, column = self.getpos()
            start = offsets[line - 1] + column
            replacements.append((start, start + len(raw), updated))

    Links().feed(html)
    for start, end, updated in reversed(replacements):
        html = html[:start] + updated + html[end:]
    return html
