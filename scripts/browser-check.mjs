// Node 22+, a Chromium debugging endpoint on port 9235, and the live preview on 8774.
import fs from 'node:fs/promises';
const cdpUrl = process.env.PLAYBOOK_CDP_URL || 'http://127.0.0.1:9235';
const baseUrl = new URL(process.env.PLAYBOOK_BASE_URL || 'http://127.0.0.1:8774/');
const qaDir = process.env.PLAYBOOK_QA_DIR || '.work/browser-checks';
const tab = await (await fetch(cdpUrl+'/json/new?about:blank', {method:'PUT'})).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, {once:true}));
let sequence = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if(m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
  else if(m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  else if(m.method === 'Network.responseReceived' && m.params.response.status >= 400) errors.push(`${m.params.response.status} ${m.params.response.url}`);
});
const send = (method,params={}) => new Promise((resolve,reject) => {const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => (await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
await fs.mkdir(qaDir,{recursive:true});
const navigate = async path => {
  const url=new URL(path.replace(/^\/playbook\/?/, ''), baseUrl).href;
  await send('Page.navigate',{url});
  let ready=false;
  for(let attempt=0;attempt<100;attempt++){
    try {ready=await evaluate(`location.href===${JSON.stringify(url)} && document.readyState==='complete' && !!document.querySelector('main.content')`);} catch {}
    if(ready)break;await new Promise(r=>setTimeout(r,100));
  }
  if(!ready)throw new Error('Navigation did not settle: '+path);
  await evaluate("[...(document.images||[])].forEach(i=>i.loading='eager');document.fonts.ready.then(()=>true)");
  await new Promise(r=>setTimeout(r,150));
};
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const results=[];
const shot=async name=>{const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(qaDir+'/' +name+'.png',Buffer.from(s.data,'base64'));};
try {
 if(process.argv.includes('--interactions')) {
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
  await navigate('/playbook/');
  await evaluate("document.querySelector('[data-route=build]').click()");
  assert(await evaluate("[...document.querySelectorAll('.chapter-card')].filter(x=>!x.hidden).length===5"),'Reading route');
  await evaluate("document.querySelector('.quarto-btn-toggle').click()");
  await new Promise(r=>setTimeout(r,350));
  assert(await evaluate("document.querySelector('.quarto-btn-toggle').getAttribute('aria-expanded')==='true'"),'Mobile menu');
  const chapterLink=await evaluate("(()=>{const a=document.querySelector('#quarto-sidebar a[href*=\"07-onboarding\"]');return {href:a.href,target:a.target};})()");
  assert(!chapterLink.target || chapterLink.target==='_self','Mobile chapter stays in current tab');
  await evaluate("document.querySelector('#quarto-sidebar a[href*=\"07-onboarding\"]').click()");
  for(let attempt=0;attempt<100;attempt++){
    if(await evaluate("location.pathname.includes('07-onboarding') && document.readyState==='complete'"))break;
    await new Promise(r=>setTimeout(r,100));
  }
  assert((await evaluate('location.pathname')).includes('07-onboarding'),'Mobile chapter destination');
  await navigate('/playbook/');await evaluate('window.quartoOpenSearch()');await new Promise(r=>setTimeout(r,250));await evaluate("document.querySelector('.aa-Input').focus()");await send('Input.insertText',{text:'HAKILI'});await new Promise(r=>setTimeout(r,750));
  assert(await evaluate("[...document.querySelectorAll('.aa-Panel a[href]')].some(x=>x.href.includes('05-architecture'))"),'Search architecture');
  await navigate('/playbook/chapters/02-theory-of-change.html');
  for(let i=0;i<4;i++){await evaluate(`document.querySelectorAll('[data-deck=levels] .explorer-controls button')[${i}].click()`);assert(await evaluate(`document.querySelectorAll('[data-deck=levels] [data-panel]')[${i}].hidden===false`),'Level panel '+i);}
  await navigate('/playbook/chapters/02-theory-of-change.html#levels-3');assert(await evaluate("!document.getElementById('levels-3').hidden"),'Deep-linked hidden panel');
  for(const [chapter,selector] of [['02-theory-of-change','.zoom-diagram'],['09-peer-learning','.zoom-diagram'],['05-architecture','.wide-diagram .zoom-diagram']]){
    await navigate('/playbook/chapters/'+chapter+'.html');
    await send('Page.bringToFront');
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    assert(await evaluate("document.querySelector('dialog').open && document.querySelector('dialog').classList.contains('diagram-dialog') && !document.querySelector('dialog img').src.includes('-mobile.svg')"),'Full-size diagram '+chapter);
    await evaluate("document.querySelector('dialog img').decode().then(()=>true)");
    // decode() can resolve before the load handler applies the natural-width floor.
    for(let attempt=0;attempt<40;attempt++){
      if(await evaluate("parseFloat(document.querySelector('dialog img').style.minWidth)>=Math.max(780,document.querySelector('dialog img').naturalWidth)"))break;
      await new Promise(r=>setTimeout(r,25));
    }
    assert(await evaluate("document.querySelector('.dialog-image').scrollWidth>document.querySelector('.dialog-image').clientWidth && document.querySelector('dialog img').getBoundingClientRect().width>=Math.max(780,document.querySelector('dialog img').naturalWidth)"),'Diagram labels retain reading scale');
    await evaluate("document.querySelector('.dialog-image').focus()");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    await new Promise(r=>setTimeout(r,200));
    assert(await evaluate("document.querySelector('.dialog-image').scrollLeft>0"),'Keyboard diagram scroll '+chapter);
    await shot('390-diagram-'+chapter);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    assert(await evaluate("!document.querySelector('dialog').open && document.activeElement.classList.contains('zoom-diagram')"),'Diagram Escape and focus restoration');
  }
  for(const [chapter,deck,count,lastId] of [['03-readiness','attendance',3,'attendance-3'],['06-ai-mentors','mentor-failures',4,'mentor-failure-4']]){
    await navigate('/playbook/chapters/'+chapter+'.html');
    for(let i=0;i<count;i++){
      await evaluate(`document.querySelectorAll('[data-deck="${deck}"] .explorer-controls button')[${i}].click()`);
      assert(await evaluate(`document.querySelectorAll('[data-deck="${deck}"] [data-panel]')[${i}].hidden===false && [...document.querySelectorAll('[data-deck="${deck}"] [data-panel]')].filter(p=>!p.hidden).length===1`),deck+' panel '+i);
    }
    await navigate('/playbook/chapters/'+chapter+'.html#'+lastId);
    assert(await evaluate(`!document.getElementById('${lastId}').hidden`),deck+' deep link');
    await evaluate(`document.querySelector('[data-deck="${deck}"]').scrollIntoView({block:'start'})`);await shot('390-'+deck);
  }
  await navigate('/playbook/field-notes.html');
  for(let i=0;i<9;i++){await evaluate(`document.querySelectorAll('[data-deck=gallery] .explorer-controls button')[${i}].click()`);assert(await evaluate(`document.querySelectorAll('[data-deck=gallery] [data-panel]')[${i}].hidden===false`),'Gallery panel '+i);}
  await evaluate("document.querySelector('[data-deck=gallery] [data-panel]:not([hidden]) .zoom-screen').click()");assert(await evaluate("document.querySelector('dialog').open"),'Screen dialog opens');
  assert(await evaluate("!document.querySelector('dialog').classList.contains('diagram-dialog') && !document.querySelector('.dialog-image').hasAttribute('tabindex')"),'Screenshot dialog resets diagram controls');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await new Promise(r=>setTimeout(r,100));
  assert(await evaluate("!document.querySelector('dialog').open && document.activeElement.classList.contains('zoom-screen')"),'Escape and focus restoration');
  await navigate('/playbook/chapters/05-architecture.html');
  for(const name of ['duplicate','timeout','stale','closed','scope']){await evaluate(`document.querySelector('#trace-case').value='${name}';document.querySelector('#trace-case').dispatchEvent(new Event('change'))`);assert(await evaluate("document.querySelector('#trace-result li').textContent.length>10"),'Failure trace '+name);}
  assert(await evaluate("document.querySelector('#trace-result').textContent.includes('ownership or membership') && document.querySelector('#trace-result li').textContent.startsWith('Reject group-scoped')"),'Conversation authorization case');
  await shot('390-architecture-interaction');
  await navigate('/playbook/chapters/08-continuation.html');
  for(let i=0;i<6;i++){await evaluate(`document.querySelectorAll('[data-deck=continuation] .explorer-controls button')[${i}].click()`);assert(await evaluate(`document.querySelectorAll('[data-deck=continuation] [data-panel]')[${i}].hidden===false`),'Continuation scenario '+i);}
  await navigate('/playbook/chapters/08-continuation.html#return-time');assert(await evaluate("!document.querySelector('#return-time').hidden"),'Continuation deep link');
  await navigate('/playbook/chapters/09-peer-learning.html');
  for(const [weight,group,score] of [[0,'C',95],[50,'B',67.5],[100,'A',90]]){
    await evaluate(`{const r=document.querySelector('#match-weight');r.value=${weight};r.dispatchEvent(new Event('input'));}`);
    assert(await evaluate(`document.querySelector('#match-result').textContent.startsWith('Group ${group} ') && Number(document.querySelector('[data-candidate=${group}] [data-score]').textContent)===${score}`),'Matching weight '+weight);
  }
  await evaluate("document.querySelector('#match-weight').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});assert(await evaluate("document.querySelector('#match-weight').value==='90'"),'Keyboard matching control');
  assert(await evaluate("document.querySelector('#matching-lab .table-responsive').scrollWidth<=document.querySelector('#matching-lab .table-responsive').clientWidth"),'Matching comparison fits phone');
  const branches=[['declined'],['expired'],['learner','learnerDeclined'],['learner','connected','confirmed'],['learner','connected','unresolved'],['learner','connected','unknown']];
  for(const branch of branches){await evaluate("document.querySelector('#support-reset').click()");for(const state of branch){await evaluate(`document.querySelector('[data-next=${state}]').click()`);assert(await evaluate(`document.querySelector('#support-lab').dataset.state==='${state}' && document.activeElement.matches('#support-state h3')`),'Peer support '+state);}}
  await evaluate("document.querySelector('#support-lab').scrollIntoView({block:'start'})");await shot('390-peer-support');
  await navigate('/playbook/chapters/10-experiments.html');
  for(let i=0;i<3;i++){await evaluate(`document.querySelectorAll('[data-deck=denominators] .explorer-controls button')[${i}].click()`);assert(await evaluate(`!document.querySelectorAll('[data-deck=denominators] [data-panel]')[${i}].hidden`),'Denominator panel '+i);}
  await evaluate("document.querySelector('[data-deck=denominators]').scrollIntoView({block:'start'})");await shot('390-denominators');
  await navigate('/playbook/');assert(await evaluate("document.querySelector('#resume-reading a').getAttribute('href').includes('10-experiments')"),'Resume chapter 10');
  await navigate('/playbook/coming-next.html');assert(await evaluate("document.querySelectorAll('.coming-chapters article').length===5 && [...document.querySelectorAll('.coming-chapters a[href^=\"mailto:\"]')].every((a,i)=>a.getAttribute('href').startsWith('mailto:akwaba@kabakoo.africa?subject=') && decodeURIComponent(a.getAttribute('href')).endsWith('Chapter '+(11+i)))"),'Early-access email links');
  await navigate('/playbook/resources.html');
  const ids=await evaluate("[...document.querySelectorAll('[data-workpad]')].map(f=>f.dataset.workpad)");assert(ids.length===10,'Ten workpads');
  for(const id of ids){await evaluate(`{const f=document.querySelector('[data-workpad=${id}]');f.querySelector('textarea').value='QA ${id} <script>plain text</script>';f.querySelector('[data-save]').click();}`);}
  await navigate('/playbook/resources.html');
  assert(await evaluate("[...document.querySelectorAll('[data-workpad]')].every(f=>f.querySelector('textarea').value.startsWith('QA '+f.dataset.workpad))"),'All ten tools persist');
  await send('Browser.grantPermissions',{permissions:['clipboardReadWrite','clipboardSanitizedWrite'],origin:baseUrl.origin});
  await send('Page.bringToFront');await evaluate("document.querySelector('[data-workpad=problem] [data-copy]').click()");await new Promise(r=>setTimeout(r,150));
  assert(await evaluate("navigator.clipboard.readText().then(t=>t.includes('QA problem')&&t.includes('Frame the problem'))"),'Copy notes');
  await evaluate("document.querySelector('[data-workpad=problem] [data-clear]').click()");assert(await evaluate("document.querySelector('#problem-work').value.startsWith('QA')"),'Clear requires second click');
  await evaluate("document.querySelector('[data-workpad=problem] [data-clear]').click()");assert(await evaluate("document.querySelector('#problem-work').value==='' && document.querySelector('#change-activity').value.startsWith('QA')"),'Clear scoped to one tool');
  await navigate('/playbook/resources.html');assert(await evaluate("document.querySelector('#problem-work').value===''") ,'Clear persists');
  // Remove QA values without disturbing other origin data.
  await evaluate("Object.keys(localStorage).filter(k=>k.startsWith('kabakoo-playbook:notes:')).forEach(k=>localStorage.removeItem(k))");
  const block=await send('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage unavailable for test')}})"});
  await navigate('/playbook/resources.html');await evaluate("document.querySelector('[data-save]').click()");assert(await evaluate("document.querySelector('.workpad-status').textContent.includes('could not save')"),'Storage failure is honest');await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:block.identifier});
  await navigate('/playbook/');assert(await evaluate("!document.querySelector('#resume-reading').hidden"),'Resume link');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert(await evaluate("getComputedStyle(document.querySelector('.chapter-card')).transitionDuration==='0s'"),'Reduced motion');
  assert(errors.length===0,errors.join('\n'));results.push({suite:'interactions',passed:true,diagramViews:3,workpads:10,galleryPanels:9,levels:4,attendancePanels:3,mentorFailurePanels:4,failureCases:5,continuationCases:6,matchingWeights:3,supportBranches:6,denominators:3,earlyAccessLinks:5});
 } else if(process.argv.includes('--no-js')) {
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  for(const path of ['/playbook/','/playbook/field-notes.html','/playbook/chapters/02-theory-of-change.html','/playbook/chapters/03-readiness.html','/playbook/chapters/06-ai-mentors.html','/playbook/resources.html','/playbook/chapters/08-continuation.html','/playbook/chapters/09-peer-learning.html','/playbook/chapters/10-experiments.html','/playbook/coming-next.html']){
    await navigate(path);const r=await evaluate("({headings:document.querySelectorAll('h1').length,panels:[...document.querySelectorAll('[data-panel]')].map(p=>({hidden:p.hidden,height:p.getBoundingClientRect().height})),text:document.querySelector('main').innerText.length})");assert(r.headings===1&&r.text>1200&&r.panels.every(p=>!p.hidden&&p.height>0),'No-JS content '+path);results.push({path,...r});
  }
  await send('Emulation.setScriptExecutionDisabled',{value:false});
 } else {
  const sitemap=await (await fetch(new URL('sitemap.xml',baseUrl))).text();
  const paths=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>new URL(m[1]).pathname);
  assert(paths.length===16,'The sitemap must list all 16 published pages');
  for(const width of [1440,768,390,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:width<500});
    for(const path of paths){
      errors.length=0;await navigate(path);await evaluate("Promise.all([...document.images].map(i=>i.decode().catch(()=>null))).then(()=>true)");
      const m=await evaluate(`({h1:document.querySelectorAll('h1').length,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,brokenImages:[...document.images].filter(i=>i.getAttribute('src')&&(!i.complete||i.naturalWidth===0)).map(i=>i.src),font:document.fonts.check('16px Lato'),headingFont:document.fonts.check('16px Rubik'),language:document.documentElement.lang,matchingFits:!document.querySelector('#matching-lab')||document.querySelector('#matching-lab .table-responsive').scrollWidth<=document.querySelector('#matching-lab .table-responsive').clientWidth,mobileDiagramsCorrect:[...document.querySelectorAll('.v5-process-figure img')].every(i=>i.currentSrc.includes('-mobile.svg')===(innerWidth<=520))})`);
      const r={path,width,...m,errors:[...errors]};results.push(r);
      if([1440,390].includes(width)&&['/','/field-notes.html','/resources.html'].includes(path))await shot(width+'-'+path.replaceAll('/','_'));
    }
  }
  const failures=results.filter(r=>r.h1!==1||r.scrollWidth>r.width||r.brokenImages.length||r.errors.length||!r.font||!r.headingFont||r.language!=='en-US'||!r.matchingFits||!r.mobileDiagramsCorrect);
  await fs.writeFile(qaDir+'/browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(failures,null,2));assert(!failures.length,'Layout or runtime check failed');
 }
 await fs.writeFile(qaDir+'/' +(process.argv.includes('--interactions')?'interaction-results':process.argv.includes('--no-js')?'no-js-results':'browser-results')+'.json',JSON.stringify(results,null,2));
 console.log('Passed '+results.length+' checks.');
} finally {await send('Page.close');ws.close();}
