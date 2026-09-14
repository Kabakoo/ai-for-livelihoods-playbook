"""Prepare Quarto output while preserving the published edition's behavior."""
import json
import os
from pathlib import Path
import re
import shutil
from html.parser import HTMLParser
import xml.etree.ElementTree as ET
from public_links import prepare_links

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "_render"
TARGET = ROOT / "_site"
BASE = os.environ.get("PLAYBOOK_URL", "https://playbook.kabakoo.africa/").rstrip("/") + "/"


class Title(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.active = False
        self.title = ""
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        if tag == "title":
            self.active = True

    def handle_endtag(self, tag):
        if tag == "title":
            self.active = False

    def handle_data(self, data):
        if self.active:
            self.title += data


def main():
    assert (SOURCE / "index.html").is_file(), "Render with scripts/build.py first."
    if TARGET.exists():
        shutil.rmtree(TARGET)
    TARGET.mkdir()
    # Publish only known rendered pages and runtime resources.
    for source in [*SOURCE.glob("*.html"), SOURCE / "search.json", SOURCE / "CITATION.cff",
                   SOURCE / "LICENSE-CONTENT.txt"]:
        shutil.copy2(source, TARGET / source.name)
    for name in ["chapters", "assets", "site_libs"]:
        shutil.copytree(SOURCE / name, TARGET / name)
    for name in ["runtime-head.html", "publication.scss", "orientation.scss",
                 "publication.js.html", "public-links.js.html"]:
        (TARGET / "assets" / name).unlink(missing_ok=True)
    shutil.copytree(ROOT / "licenses", TARGET / "licenses")
    shutil.copy2(ROOT / "LICENSE", TARGET / "LICENSE-CODE.txt")

    # Quarto UI preferences are optional when storage is blocked. Reader notes
    # keep their separate checks and never claim unsaved notes were persisted.
    for relative in ["quarto-html/quarto.js", "quarto-html/tabsets/tabsets.js", "quarto-nav/quarto-nav.js"]:
        library = TARGET / "site_libs" / relative
        text = library.read_text()
        assert "localStorage" in text, f"Review storage adaptation for updated Quarto: {relative}"
        text = text.replace("window.localStorage", "window.kabakooUiStorage")
        text = re.sub(r"(?<![\w.])localStorage\.", "window.kabakooUiStorage.", text)
        library.write_text(text)

    date = re.search(r"^date-released:\s*(\S+)", (ROOT / "CITATION.cff").read_text(), re.M)[1]
    urls = []
    for page in sorted(TARGET.rglob("*.html")):
        relative = page.relative_to(TARGET).as_posix()
        url = BASE + ("" if relative == "index.html" else relative)
        text = page.read_text()
        home_href = "../" * (len(page.relative_to(TARGET).parts) - 1) + "index.html"
        text, count = re.subn(r'(<div class="sidebar-title[^"]*">\s*<a href=")[^"]*(")',
                             lambda m: m[1] + home_href + m[2], text)
        assert count == 1, f"Missing playbook title link: {relative}"
        text = re.sub(r'<pre(?![^>]*tabindex)', '<pre tabindex="0" role="region" aria-label="Scrollable code example"', text)
        text = re.sub(r'(<meta (?:property="og:image"|name="twitter:image") content=")[^"]*(">)',
                      lambda m: m[1] + BASE + "assets/social-preview.png" + m[2], text)
        text = re.sub(r'<link\b[^>]*rel="canonical"[^>]*>\s*', '', text)
        text = re.sub(r'<meta\b[^>]*property="og:url"[^>]*>\s*', '', text)
        schema = {"@context": "https://schema.org", "@type": "Book" if relative == "index.html" else "WebPage",
                  "name": Title(text).title.split(" – ")[0], "url": url, "inLanguage": "en-US",
                  "author": {"@type": "Organization", "name": "Kabakoo Academies", "url": "https://www.kabakoo.africa/"},
                  "datePublished": date, "license": "https://creativecommons.org/licenses/by-sa/4.0/"}
        metadata = (f'<meta property="og:url" content="{url}">\n'
                    f'<link rel="canonical" href="{url}">\n'
                    '<script type="application/ld+json">' + json.dumps(schema, ensure_ascii=False) + '</script>\n')
        text = text.replace('</head>', metadata + '</head>')
        page.write_text(prepare_links(text, url, BASE))
        urls.append(url)

    ns = "http://www.sitemaps.org/schemas/sitemap/0.9"
    ET.register_namespace("", ns)
    sitemap = ET.Element(f"{{{ns}}}urlset")
    for url in sorted(urls):
        entry = ET.SubElement(sitemap, f"{{{ns}}}url")
        ET.SubElement(entry, f"{{{ns}}}loc").text = url
        ET.SubElement(entry, f"{{{ns}}}lastmod").text = date
    ET.ElementTree(sitemap).write(TARGET / "sitemap.xml", encoding="utf-8", xml_declaration=True)
    (TARGET / "robots.txt").write_text("User-agent: *\nAllow: /\nSitemap: " + BASE + "sitemap.xml\n")
    (TARGET / "_redirects").write_text('/playbook / 302!\n/playbook/* /:splat 302!\n' +
        ''.join(f'/building-ai-for-livelihoods-v{v}.pdf / 302!\n' for v in range(1, 8)) +
        '/building-ai-for-livelihoods.pdf / 302!\n/The-KH-WLS-Playbook.pdf / 302!\n')
    print(f"Prepared {len(urls)} pages in {TARGET}.")


if __name__ == "__main__":
    main()
