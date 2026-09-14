// Node 22+, Chromium debugging on 9235; accepts hosted or file-based previews.
import fs from 'node:fs/promises';
const cdpUrl = process.env.PLAYBOOK_CDP_URL || 'http://127.0.0.1:9235';
const baseUrl = new URL(process.env.PLAYBOOK_BASE_URL || 'http://127.0.0.1:8774/');
const qaDir = process.env.PLAYBOOK_QA_DIR || '.work/browser-checks/links';
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
const targets=async()=>await (await fetch(cdpUrl+'/json/list')).json();
const activate=async(selector,method)=>{
 await send('Page.bringToFront');
 if(method==='mouse'){
  const rect=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+Math.min(r.height/2,12)};})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...rect});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...rect});
 }else{
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 }
};
const focusLink=selector=>evaluate(`(()=>{const a=document.querySelector(${JSON.stringify(selector)});a.scrollIntoView({block:'center'});a.focus();return {href:a.href,target:a.target,rel:a.rel};})()`);
const clickInCurrentTab=async(selector,method='keyboard',expected)=>{
 const before=await targets(), info=await focusLink(selector);
 assert(!info.target || info.target==='_self','Current-tab attributes '+selector);
 if(expected)assert(info.href===new URL(expected,baseUrl).href,'Destination '+selector+' '+info.href);
 const destination=new URL(info.href);
 // Quarto consumes the search query to highlight results, then removes it.
 if(selector.startsWith('.aa-Panel'))destination.searchParams.delete('q');
 await activate(selector,method);
 let ready=false;
 for(let i=0;i<100;i++){
  try{ready=await evaluate(`location.href===${JSON.stringify(destination.href)} && document.readyState==='complete' && !!document.querySelector('main.content')`);}catch{}
  if(ready)break;await new Promise(r=>setTimeout(r,100));
 }
 assert(ready,'Current-tab navigation '+selector+' expected '+info.href+'; actual '+await evaluate('location.href'));
 assert(!(await targets()).some(t=>t.type==='page'&&!before.some(b=>b.id===t.id)),'No extra tab '+selector);
 results.push({selector,href:info.href,currentTab:true});
};
const clickInNewTab=async(selector,method='keyboard')=>{
 const before=await targets(),oldUrl=await evaluate('location.href');
 const info=await focusLink(selector);
 assert(info.target==='_blank'&&info.rel.includes('noopener')&&info.rel.includes('noreferrer'),'Link attributes '+selector);
 if(selector==='.sidebar-logo-link')assert(info.href==='https://www.kabakoo.africa/','Kabakoo logo destination');
 await activate(selector,method);
 let child;
 for(let i=0;i<150;i++){
  child=(await targets()).find(t=>!before.some(b=>b.id===t.id)&&t.type==='page'&&t.url===info.href);
  if(child)break;await new Promise(r=>setTimeout(r,100));
 }
 assert(!!child,'New target '+selector+' '+info.href);
 assert(await evaluate('location.href')===oldUrl,'Original page retained '+selector);
 const childWs=new WebSocket(child.webSocketDebuggerUrl);await new Promise(r=>childWs.addEventListener('open',r,{once:true}));
 const opener=await new Promise(resolve=>{childWs.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id===1)resolve(m.result?.result?.value);});childWs.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:'window.opener === null',returnByValue:true}}));});
 assert(opener===true,'Opener isolated '+selector);childWs.close();await fetch(cdpUrl+'/json/close/'+child.id);
 results.push({selector,href:info.href,newTab:true,originalPageRetained:true,openerIsolated:true});
};
try{
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await navigate('index.html');await clickInCurrentTab('.chapter-card');
 await clickInCurrentTab('.sidebar-title a','keyboard','index.html');
 await clickInNewTab('.sidebar-logo-link');
 await navigate('chapters/01-problem-framing.html');await clickInNewTab('.sidebar-logo-link');
 await clickInCurrentTab('.sidebar-title a','keyboard','index.html');
 await clickInCurrentTab('#orientation-experience a[href*=sources]');
 await navigate('sources.html#s42');await clickInNewTab('#s42 a[href*="kabakoo.notion.site"]');
 await navigate('field-notes.html#maimouna');await clickInNewTab('#maimouna a[href*="substack.com"]');
 await navigate('chapters/05-architecture.html');await navigate('index.html');await clickInCurrentTab('#resume-reading a');
 await clickInCurrentTab('.page-navigation .nav-page-next a','mouse');
 await clickInCurrentTab('.page-navigation .nav-page-previous a','mouse');
 if(baseUrl.protocol!=='file:'){
  await navigate('index.html');await evaluate('window.quartoOpenSearch()');await new Promise(r=>setTimeout(r,250));
  await evaluate("document.querySelector('.aa-Input').focus()");await send('Input.insertText',{text:'HAKILI'});await new Promise(r=>setTimeout(r,800));
  await clickInCurrentTab('.aa-Panel a[href*="05-architecture"]','mouse');
 }
 await send('Emulation.setScriptExecutionDisabled',{value:true});
 await navigate('index.html');await clickInCurrentTab('.chapter-card');
 await clickInNewTab('.sidebar-logo-link');
 await clickInCurrentTab('.sidebar-title a','keyboard','index.html');
 await send('Emulation.setScriptExecutionDisabled',{value:false});
 await navigate('sources.html');
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
  for(const [url,selector,label] of [['index.html#orientation','#orientation','opening'],['sources.html#s40','#s40','service-source'],['sources.html#s41','#s41','learner-source'],['sources.html#s42','#s42','impact-source']]){
   await navigate(url);await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start'})`);await shot(width+'-'+label);
  }
 }
 await fs.writeFile(qaDir+'/navigation-results.json',JSON.stringify({base:baseUrl.href,results},null,2));
 console.log(results.length+' navigation cases passed: internal links stay in the current tab; external references and the Kabakoo logo open isolated new tabs.');
}finally{await fetch(cdpUrl+'/json/close/'+tab.id);ws.close();}
