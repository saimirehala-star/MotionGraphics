const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('features reach AE without activation state or network',async()=>{
 const window={__adobe_cep__:{getSystemPath(){return 'E:/extension';},evalScript(script,callback){callback(JSON.stringify({ok:true}));}}};const ctx={window,Promise};vm.runInNewContext(fs.readFileSync('extension/js/bridge.js','utf8'),ctx);
 for(const action of ['apply','listTemplates','captureUserPreset','listExpressions','prerenderStatus','aiBegin','compositionExtract'])assert.equal((await ctx.MGBridge.call(action,{})).ok,true);
});
test('activation modules, UI and assets restrictions removed',()=>{
 for(const name of ['extension/js/license.js','extension/node/license.cjs','extension/node/license-config.cjs'])assert.equal(fs.existsSync(name),false);
 for(const name of ['extension/index.html','extension/js/bridge.js','extension/js/assets.js','extension/css/panel.css'])assert.doesNotMatch(fs.readFileSync(name,'utf8'),/MGLicense|license-gate|license-logout|license-config|workers\.dev/);
 assert.match(fs.readFileSync('LICENSE','utf8'),/GNU GENERAL PUBLIC LICENSE/);
});
