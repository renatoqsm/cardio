const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('lib/app-entry.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} }; new Function('exports','module',source)(mod.exports,mod);
let checks=0;const check=(value,label)=>{assert(value,label);checks++;console.log('PASS:',label)};
for (const [label, pathname, standalone, ios, expected] of [
 ['Regular browser opens presentation','/',false,false,null],
 ['Old Android installation opens application','/',true,false,'/app?utm_source=test#example'],
 ['Old iOS installation opens application','/',false,true,'/app?utm_source=test#example'],
 ['New application URL does not redirect again','/app',true,false,null],
]) {
 let target=null; const document={documentElement:{dataset:{}}};
 vm.runInNewContext(mod.exports.appEntryBootstrap,{location:{pathname,search:'?utm_source=test',hash:'#example',replace:value=>target=value},matchMedia:()=>({matches:standalone}),navigator:{standalone:ios},document});
 check(target===expected,label);if(expected)check(document.documentElement.dataset.appEntry==='redirect','Presentation hidden before installed-app navigation');
}
(async()=>{const base=process.env.SMOKE_URL||'http://localhost:3000';for(const query of ['join=ABC12345','challengeId=challenge&recordId=record','checkout=success&challengeId=challenge']){const r=await fetch(base+'/?'+query,{redirect:'manual'});const target=new URL(r.headers.get('location'),base);check(r.status===307&&target.pathname==='/app'&&target.search==='?'+query,'Legacy entry forwards all parameters: '+query.split('=')[0])}const site=await(await fetch(base)).text(),app=await(await fetch(base+'/app')).text();check(site.includes('Como instalar')&&site.includes('og:title'),'Public page includes installation guide and share metadata');check(app.includes('noindex')&&app.includes('Preparando seu espaço'),'Application has its own entry and stays out of search results');console.log(`${checks} app entry checks passed.`)})().catch(e=>{console.error(e.message);process.exitCode=1});
