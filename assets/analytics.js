// Analytics are activated only by an explicitly configured production build.
(() => {
  'use strict';
  const script = document.currentScript;
  const id = script?.dataset.measurementId;
  if (!/^G-[A-Z0-9]+$/.test(id || '') || location.origin !== script.dataset.origin) return;
  const lifetime = 180 * 24 * 60 * 60;
  const cookiePrefix = 'kabakoo_playbook';
  // Never include search text, arbitrary URL parameters, fragments, or referrer paths.
  const pageUrl = new URL(location.pathname, location.origin).href;
  let referrer = '';
  try { referrer = new URL(document.referrer).origin + '/'; } catch {}
  const campaigns = {};
  const query = new URLSearchParams(location.search);
  for (const [parameter, field] of Object.entries({utm_source: 'campaign_source', utm_medium: 'campaign_medium', utm_campaign: 'campaign_name'})) {
    const value = query.get(parameter);
    if (value && /^[a-zA-Z0-9_-]{1,80}$/.test(value)) campaigns[field] = value;
  }
  const common = {send_to: id, content_group: 'Playbook', page_location: pageUrl,
                  page_referrer: referrer, page_title: document.title, user_data: null};
  const tag = function () { window.dataLayer.push(arguments); };
  const send = (name, parameters = {}) => tag('event', name, {...common, ...parameters});

  const initialize = () => {
    const main = document.querySelector('main.content');
    if (!main) return;
    window.dataLayer = window.dataLayer || [];
    tag('consent', 'default', {analytics_storage: 'granted', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied'});
    tag('set', 'user_data', null);
    tag('set', 'ads_data_redaction', true);
    tag('set', 'url_passthrough', false);
    tag('js', new Date());
    tag('config', id, {...common, ...campaigns, send_page_view: false,
      allow_google_signals: false, allow_ad_personalization_signals: false,
      cookie_domain: location.hostname, cookie_prefix: cookiePrefix,
      cookie_expires: lifetime, cookie_update: false, cookie_flags: 'SameSite=Lax;Secure'});
    const loader = document.createElement('script');
    loader.async = true;
    loader.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.append(loader);
    send('page_view');
    addEventListener('pageshow', event => { if (event.persisted) send('page_view'); });

    const toolIds = new Set(['problem', 'change', 'readiness', 'sequence', 'architecture', 'mentor', 'onboarding', 'continuation', 'peers', 'experiments']);
    // Only fixed identifiers enter analytics; textarea values are never read.
    const started = new WeakSet();
    main.addEventListener('input', event => {
      const form = event.target.closest('[data-workpad]');
      if (form && toolIds.has(form.dataset.workpad) && !started.has(form)) {
        started.add(form);
        send('playbook_tool_start_' + form.dataset.workpad);
      }
    });
    document.addEventListener('kabakoo:tool', event => {
      const {action, tool} = event.detail || {};
      if (['save', 'copy'].includes(action) && toolIds.has(tool)) send('playbook_tool_' + action + '_' + tool);
    });
    document.addEventListener('click', event => {
      const route = event.target.closest('[data-route]')?.dataset.route;
      if (['all', 'purpose', 'build', 'evaluate'].includes(route)) send('playbook_route_' + route);
      const link = event.target.closest('a[href]');
      if (!link) return;
      let url;
      try { url = new URL(link.href); } catch { return; }
      if (url.hostname === 'www.kabakoo.africa' || url.hostname === 'kabakoo.africa') send('playbook_kabakoo_visit');
    });
    if (!/^\/chapters\/\d{2}-[a-z-]+\.html$/.test(location.pathname)) return;
    const depths = new Set();
    let scrollQueued = false;
    const measureScroll = () => {
      scrollQueued = false;
      if (document.visibilityState !== 'visible') return;
      const box = main.getBoundingClientRect();
      const depth = Math.max(0, Math.min(100, (innerHeight - box.top) / Math.max(1, main.offsetHeight) * 100));
      for (const threshold of [25, 50, 75, 90]) {
        if (depth >= threshold && !depths.has(threshold)) {
          depths.add(threshold);
          send('playbook_scroll_' + threshold, {percent_scrolled: threshold});
        }
      }
    };
    addEventListener('scroll', () => {
      if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(measureScroll); }
    }, {passive: true});
    let elapsed = 0, last = performance.now();
    const durations = new Set();
    setInterval(() => {
      const now = performance.now(), delta = Math.min(2000, Math.max(0, now - last));
      last = now;
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
      elapsed += delta;
      for (const seconds of [30, 60, 180]) {
        if (elapsed >= seconds * 1000 && !durations.has(seconds)) {
          durations.add(seconds);
          send('playbook_read_' + seconds + 's');
        }
      }
    }, 1000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once: true});
  else initialize();
})();
