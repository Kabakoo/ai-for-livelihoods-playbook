// Run against an analytics-enabled build and an isolated Chromium CDP session.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = path.resolve(process.env.PLAYBOOK_SITE_DIR || path.join(root, '_site'));
const reportDir = path.resolve(process.env.PLAYBOOK_QA_DIR || path.join(root, '.work/analytics-checks'));
const cdp = process.env.PLAYBOOK_CDP_URL || 'http://127.0.0.1:9235';
const home = await fs.readFile(path.join(site, 'index.html'), 'utf8');
const id = home.match(/data-measurement-id="(G-[A-Z0-9]+)"/)?.[1];
const origin = home.match(/data-origin="([^"]+)"/)?.[1];
if (!id || !origin) throw new Error('Build with PLAYBOOK_GA4_ID before running this check.');
const googleTag = process.env.PLAYBOOK_GA_TAG_FILE
  ? await fs.readFile(process.env.PLAYBOOK_GA_TAG_FILE, 'utf8')
  : await (await fetch('https://www.googletagmanager.com/gtag/js?id=' + id)).text();
const calls = [], errors = [], checks = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => {if (!condition) throw new Error(message); checks.push(message);};
const until = async (condition, label, timeout = 12000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {if (await condition()) return; await sleep(100);}
  throw new Error('Timed out: ' + label);
};
async function connect() {
  const target = await (await fetch(cdp + '/json/new?about:blank', {method: 'PUT'})).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, {once: true}));
  let sequence = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const handler = pending.get(message.id); pending.delete(message.id);
      if (message.error) handler.reject(new Error(JSON.stringify(message.error))); else handler.resolve(message.result);
    } else listeners.get(message.method)?.(message.params);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, {resolve, reject}); ws.send(JSON.stringify({id, method, params}));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true, userGesture: true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  return {send, evaluate, listeners, close: async () => {await send('Page.close'); ws.close();}};
}
const browser = await connect();
const {send, evaluate, listeners} = browser;
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg'};
listeners.set('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
listeners.set('Fetch.requestPaused', async event => {
  const request = event.request, url = new URL(request.url);
  try {
    if (url.origin === origin) {
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = path.resolve(site, '.' + relative);
      if (!file.startsWith(site + path.sep)) throw new Error('Invalid fixture path');
      const content = await fs.readFile(file);
      await send('Fetch.fulfillRequest', {requestId: event.requestId, responseCode: 200,
        responseHeaders: [{name: 'Content-Type', value: mime[path.extname(file)] || 'application/octet-stream'}], body: content.toString('base64')});
    } else if (/google(?:-analytics|tagmanager)?\.com$/.test(url.hostname) || url.hostname.endsWith('.google.com')) {
      calls.push({url: request.url, body: request.postData || ''});
      const isTag = url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtag/js';
      await send('Fetch.fulfillRequest', {requestId: event.requestId, responseCode: isTag ? 200 : 204,
        responseHeaders: [{name: 'Content-Type', value: isTag ? 'text/javascript' : 'text/plain'}, {name: 'Access-Control-Allow-Origin', value: '*'}],
        ...(isTag ? {body: Buffer.from(googleTag).toString('base64')} : {})});
    } else await send('Fetch.continueRequest', {requestId: event.requestId});
  } catch (error) {
    errors.push(String(error));
    await send('Fetch.failRequest', {requestId: event.requestId, errorReason: 'Failed'});
  }
});
const navigate = async suffix => {
  await send('Page.navigate', {url: origin + suffix});
  const destination = new URL(origin + suffix);
  await until(() => evaluate(`location.origin === ${JSON.stringify(destination.origin)} && location.pathname === ${JSON.stringify(destination.pathname)} && document.readyState === 'complete' && !!document.querySelector('main.content')`), suffix);
  await sleep(250);
};
const events = () => calls.filter(call => call.url.includes('/g/collect')).flatMap(call => {
  const base = new URL(call.url).searchParams;
  return (call.body ? call.body.split(/\r?\n/) : ['']).map(line => {
    const data = new URLSearchParams(base);
    for (const [key, value] of new URLSearchParams(line)) data.set(key, value);
    return Object.fromEntries(data);
  });
});
const count = name => events().filter(event => event.en === name).length;
await fs.mkdir(reportDir, {recursive: true});
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setCacheDisabled', {cacheDisabled: true});
  await send('Fetch.enable', {patterns: [{urlPattern: '*'}]});
  await send('Storage.clearDataForOrigin', {origin, storageTypes: 'all'});
  await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
  await navigate('/?q=PRIVATE_SEARCH_SENTINEL&utm_source=partner&utm_medium=email');
  await until(() => count('page_view') === 1, 'automatic page view');
  await sleep(800);
  assert(count('page_view') === 1, 'One automatic page view per page');
  assert(events().every(event => !event.dl?.includes('?') && event.tid === id), 'Correct destination and clean page URLs');
  assert(events().every(event => event.gcs === 'G101' && event.npa === '1'), 'Analytics is active with advertising disabled');
  for (const width of [320, 390, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', {width, height: 844, deviceScaleFactor: 1, mobile: width < 500});
    assert(await evaluate("document.documentElement.scrollWidth <= innerWidth"), 'Page fits ' + width);
    if ([390, 1440].includes(width)) {
      const screenshot = await send('Page.captureScreenshot', {format: 'png'});
      await fs.writeFile(path.join(reportDir, 'page-' + width + '.png'), Buffer.from(screenshot.data, 'base64'));
    }
  }
  await evaluate("document.querySelector('[data-route=build]').click()");
  await until(() => count('playbook_route_build') === 1, 'reading route');
  assert(true, 'Reading route event is collected automatically');
  await navigate('/resources.html?q=PRIVATE_SEARCH_SENTINEL');
  await until(() => count('page_view') === 2, 'resources page view');
  assert(true, 'Subsequent pages collect automatically');
  await send('Browser.grantPermissions', {origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite']});
  await send('Page.bringToFront');
  const privateNote = 'PRIVATE_NOTE_SENTINEL analytics-private@example.test +49123456789';
  const toolIds = await evaluate("[...document.querySelectorAll('[data-workpad]')].map(form => form.dataset.workpad)");
  for (const tool of toolIds) {
    await evaluate(`{const form=document.querySelector('[data-workpad=${tool}]');const field=form.querySelector('textarea');field.value=${JSON.stringify(privateNote)};field.dispatchEvent(new Event('input',{bubbles:true}));form.querySelector('[data-save]').click();form.querySelector('[data-copy]').click();}`);
    await until(() => count('playbook_tool_copy_' + tool) === 1, 'clipboard event ' + tool);
  }
  assert(toolIds.every(tool => count('playbook_tool_start_' + tool) === 1 && count('playbook_tool_save_' + tool) === 1 && count('playbook_tool_copy_' + tool) === 1), 'All ten tools report successful actions');
  await evaluate("navigator.clipboard.writeText=async()=>{throw new Error('Clipboard blocked for QA')};document.querySelector('[data-copy]').click()");
  await sleep(500);
  assert(count('playbook_tool_copy_problem') === 1, 'Failed clipboard operation is not counted');
  await evaluate("window.__originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('Storage blocked for QA')};document.querySelector('[data-save]').click();Storage.prototype.setItem=window.__originalSetItem");
  await sleep(500);
  assert(count('playbook_tool_save_problem') === 1, 'Failed save is not counted');
  const payload = calls.map(call => decodeURIComponent(call.url + '&' + call.body)).join('\n');
  const hashedEmail = crypto.createHash('sha256').update('analytics-private@example.test').digest('hex');
  assert(!/PRIVATE_NOTE_SENTINEL|PRIVATE_SEARCH_SENTINEL|analytics-private|49123456789/.test(payload) && !payload.includes(hashedEmail), 'Neither notes, contact details nor search text enter Google requests');
  assert(!events().some(event => Object.entries(event).some(([key, value]) => key.includes('user_data') && value !== '')), 'No user-provided data values in event payloads (the explicit null may serialize as an empty field)');
  await navigate('/chapters/01-problem-framing.html');
  await send('Page.bringToFront');
  await evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
  await until(() => count('playbook_scroll_90') >= 1, 'chapter scroll');
  assert([25, 50, 75, 90].every(depth => count('playbook_scroll_' + depth) === 1), 'Chapter depth thresholds fire once');
  await until(() => count('playbook_read_30s') === 1, 'focused reading time', 40000);
  assert(true, 'Focused chapter time is measured');
  const block = await send('Page.addScriptToEvaluateOnNewDocument', {source: "Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage unavailable for QA')}})"});
  const beforeBlockedStorage = count('page_view');
  await navigate('/resources.html');
  await until(() => count('page_view') > beforeBlockedStorage, 'page view without browser storage');
  assert(true, 'Unavailable browser storage does not block measurement');
  await send('Page.removeScriptToEvaluateOnNewDocument', {identifier: block.identifier});
  const previewStart = calls.length;
  await send('Page.navigate', {url: 'http://127.0.0.1:8774/'});
  await until(() => evaluate("location.hostname === '127.0.0.1' && document.readyState === 'complete'"), 'local preview');
  // The previous production page may send its final engagement event on unload.
  assert(!calls.slice(previewStart).some(call => call.url.includes('/gtag/js')) &&
    !events().some(event => event.dl?.startsWith('http://127.0.0.1:8774')) &&
    await evaluate("!document.querySelector('script[src*=\"googletagmanager.com\"]')"),
    'Local preview never activates the production tracker');
  assert(errors.length === 0, 'No browser runtime errors: ' + errors.join('\n'));
  await fs.writeFile(path.join(reportDir, 'results.json'), JSON.stringify({passed: true, checks, events: events(), requests: calls}, null, 2));
  console.log('Passed ' + checks.length + ' analytics checks. Collection requests were intercepted, not sent to Google.');
} catch (error) {
  const state = await evaluate("({url:location.href,ready:document.readyState,body:document.body?.innerText.slice(0,500)})").catch(() => null);
  await fs.writeFile(path.join(reportDir, 'failure.json'), JSON.stringify({error: String(error), state, errors, checks, requests: calls}, null, 2));
  throw error;
} finally {await browser.close();}
