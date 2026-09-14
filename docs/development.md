# Working with the source

This guide is for contributors editing the publication. To read or use its worksheets, visit the [online playbook](https://playbook.kabakoo.africa/).

## Build and preview

Install Git, [Quarto 1.10.18](https://quarto.org/docs/get-started/), and Python 3.10 or newer. The fonts, images, chapter source, and reader scripts are included.

```sh
git clone https://github.com/Kabakoo/ai-for-livelihoods-playbook.git
cd ai-for-livelihoods-playbook
python3 scripts/build.py
python3 -m http.server 8774 --bind 127.0.0.1 --directory _site
```

Open <http://localhost:8774/> to preview your changes. Stop the preview server with Ctrl+C.

If Quarto is not on your `PATH`, set `QUARTO_BIN` to the full path of its executable before running the build. Quarto 1.10.18 is the tested version; verify newer versions because the build adapts Quarto’s browser-storage behavior.

## Find the source to edit

| Location | Contents |
| --- | --- |
| `chapters/` | The ten chapter manuscripts. |
| Root `.qmd` files | Opening, field notes, resources, sources, and edition information. |
| `assets/` | Styles, reader scripts, images, and editable drawings. |
| `_quarto.yml` | Book structure and rendering settings. |
| `scripts/` | Build and verification scripts. |

`_render/` and `_site/` are generated output and are ignored by Git. Edit the source files, rebuild, and review the preview. Check the [asset terms](assets.md) before changing or reusing images.

## Verify a change

`python3 scripts/build.py` renders the publication and checks all 16 pages, including links, search, citation, and metadata. To repeat those checks on an existing build, run:

```sh
python3 scripts/check.py
```

For changes to layout, navigation, or working tools, follow the [browser-check instructions](browser-checks.md). They cover page widths, keyboard navigation, access without JavaScript, and reader notes when browser storage is unavailable.

GitHub runs the build checks for commits and pull requests. These checks do not deploy the website. Describe the reader-facing change and relevant verification in your pull request; see [Contributing](../CONTRIBUTING.md).

## Publish an adapted edition

If you publish an adaptation at another address, set `PLAYBOOK_URL` and `book.site-url` in `_quarto.yml` to that edition’s full base URL. Update `CITATION.cff` and the citation in `versions.qmd` to describe your edition. Keep attribution links to [Kabakoo Academies](https://www.kabakoo.africa/) and the [original playbook](https://playbook.kabakoo.africa/), and review the [reuse terms](assets.md).
