# Browser verification

Follow the [source setup guide](development.md) and build first with `python3 scripts/build.py`. Browser checks require Node.js 22 or newer and Chromium or Chrome with a local debugging endpoint. Use a temporary browser profile dedicated to these checks.

In separate terminals, from the repository root:

```sh
python3 -m http.server 8774 --bind 127.0.0.1 --directory _site
```

```sh
mkdir -p .work
chromium --headless --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9235 --user-data-dir="$PWD/.work/chromium" about:blank
```

Use your installed Chromium/Chrome executable name if it differs. Then run:

```sh
node scripts/browser-check.mjs
node scripts/browser-check.mjs --interactions
node scripts/browser-check.mjs --no-js
node scripts/public-links-check.mjs
```

The first script checks all 16 pages at four widths, then optionally checks the reader tools or access without JavaScript. The interaction checks cover reading routes, mobile navigation, search, interactive panels, diagram dialogs, all ten working tools, and unavailable browser storage. The public-link checks exercise current-tab navigation and isolated new tabs for external references and Kabakoo’s main website.

Checks save results and screenshots under `.work/browser-checks/`. `PLAYBOOK_BASE_URL`, `PLAYBOOK_QA_DIR`, and `PLAYBOOK_CDP_URL` override the preview URL, report directory, and browser debugging endpoint. The public-link checks visit external reference pages and therefore need network access. Close the temporary browser and preview server afterward.
