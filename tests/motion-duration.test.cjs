const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../extension/host/main.jsx'),'utf8');
const snippet=source.slice(source.indexOf('    function requestedDuration('),source.indexOf('    function snapshotMarkers('));
test('front duration defaults, frame alignment, custom loop range, and limits',()=>{
 const c={MGCatalog:{defaults:()=>({duration:0.6})},fail:s=>{throw Error(s);}};vm.runInNewContext(snippet,c);const comp={frameDuration:1/30},preset={id:'in',category:'in',defaults:{duration:0.8}};
 assert.equal(c.requestedDuration({},preset,comp),null);assert.equal(c.requestedDuration({durationMode:'default'},preset,comp),0.8);
 assert.equal(c.requestedDuration({durationMode:'custom',durationSeconds:0.01},preset,comp),1/30);
 assert.equal(c.requestedDuration({durationMode:'custom',durationSeconds:2.01},preset,comp),2);
 assert.equal(c.requestedDuration({durationMode:'default'},{category:'loop'},comp),1);
 assert.equal(c.requestedDuration({durationMode:'default'},{category:'loop',user:true,defaults:{duration:3}},comp),3);
 assert.throws(()=>c.requestedDuration({durationMode:'custom',durationSeconds:0},preset,comp),/时长/);
 assert.throws(()=>c.requestedDuration({durationMode:'custom',durationSeconds:Infinity},preset,comp),/时长/);
});
