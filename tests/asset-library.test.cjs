'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),p=fs.promises,path=require('path'),os=require('os'),cp=require('child_process');
const {createLibrary}=require('../extension/node/asset-library.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mg-assets-')),bin=path.resolve(__dirname,'../extension/vendor/media');
const lib=createLibrary({root:path.join(tmp,'library'),home:path.join(tmp,'prefs'),bin});
const run=args=>cp.execFileSync(path.join(bin,'ffmpeg.exe'),['-nostdin','-y','-v','error',...args],{windowsHide:true});
function psd(file){const header=Buffer.alloc(26);header.write('8BPS');header.writeUInt16BE(1,4);header.writeUInt16BE(3,12);header.writeUInt32BE(8,14);header.writeUInt32BE(8,18);header.writeUInt16BE(8,22);header.writeUInt16BE(3,24);fs.writeFileSync(file,Buffer.concat([header,Buffer.alloc(14),Buffer.alloc(64,255),Buffer.alloc(128)]));}
test.before(()=>{fs.mkdirSync(path.join(tmp,'input'));run(['-f','lavfi','-i','color=red:s=72x128','-frames:v','1',path.join(tmp,'input/frame_0001.png')]);run(['-f','lavfi','-i','color=blue:s=72x128','-frames:v','1',path.join(tmp,'input/frame_0002.png')]);});
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
test('portrait preview preserves the full aspect ratio; regroup/rename/removal keep source paths',async()=>{
 const g=await lib.addGroup('贴纸');const d=await lib.importOne({file:path.join(tmp,'input/frame_0001.png'),name:'竖图',group:g.id},{},()=>{});assert.deepEqual(d.warnings,[]);assert.equal(d.width,72);assert.equal(d.height,128);
 const original=(await lib.prepare(d.id)).path;await lib.move(d.id,'default');await lib.rename(d.id,'重命名');assert.equal((await lib.prepare(d.id)).path,original);assert.ok(fs.existsSync(original));
 await assert.rejects(lib.importOne({file:path.join(tmp,'input/frame_0001.png'),group:'default'},{}),/已存在/);
 await lib.remove(d.id);assert.equal((await lib.list()).items.length,0);assert.ok(fs.existsSync(original));
});
test('sequence imports all numbered frames with explicit frame rate and animated preview',async()=>{
 const d=await lib.importOne({file:path.join(tmp,'input/frame_0002.png'),name:'序列',group:'default',sequence:true,fps:24},{});assert.deepEqual(d.warnings,[]);assert.equal(d.frameCount,2);assert.equal(d.duration,2/24);assert.equal(d.preview,'preview.webm');const ready=await lib.prepare(d.id);assert.equal(ready.fps,24);assert.ok(fs.existsSync(ready.path));assert.ok(fs.existsSync(path.join(path.dirname(ready.path),'frame_00000001.png')));
});
test('missing sequence frames are rejected before publishing an item',async()=>{
 const seq=path.join(tmp,'broken');await p.mkdir(seq);await p.copyFile(path.join(tmp,'input/frame_0001.png'),path.join(seq,'s_001.png'));await p.copyFile(path.join(tmp,'input/frame_0002.png'),path.join(seq,'s_003.png'));await assert.rejects(lib.sequence(path.join(seq,'s_001.png'),25),/缺帧/);
});
test('GIF, TIFF, JPG, PSD and video previews decode actual files; MKV converts for AE',async()=>{
 for(const ext of ['gif','tiff','jpg','mp4','mov','avi','mkv','wmv','psd']){
  const file=path.join(tmp,'input','sample.'+ext);if(ext==='psd')psd(file);else run(['-f','lavfi','-i','testsrc2=s=80x48:r=5','-t','0.4',...(['tiff','jpg'].includes(ext)?['-frames:v','1']:[]),file]);
  const d=await lib.importOne({file,name:ext,group:'default'},{});assert.deepEqual(d.warnings,[],ext);assert.ok(d.poster,ext);if(d.dynamic)assert.ok(d.preview,ext);if(ext==='mkv'){const ready=await lib.prepare(d.id,false,{});assert.match(ready.path,/compatible\.mov$/);assert.ok(fs.existsSync(ready.path));}
 }
});
test('cancel removes unfinished staging and does not publish partial records',async()=>{
 const before=(await lib.list()).items.length,job={};await assert.rejects(lib.importOne({file:path.join(tmp,'input/frame_0002.png'),group:'default'},job,()=>lib.cancel(job)),/取消/);assert.equal((await lib.list()).items.length,before);assert.equal((await p.readdir(path.join(lib.root(),'items'))).filter(n=>n.startsWith('.import-')).length,0);
});
test('shared readers see categories; invalid group/path cannot escape the library; switching roots preserves old files',async()=>{
 const other=createLibrary({root:lib.root(),home:path.join(tmp,'other'),bin});const g=await other.addGroup('共享');assert.ok((await lib.groups()).some(x=>x.id===g.id));await other.renameGroup(g.id,'共享更新');assert.ok((await lib.groups()).some(x=>x.name==='共享更新'));assert.throws(()=>lib.assetFolder('../escape'),/编号/);const old=lib.root();await lib.setRoot(path.join(tmp,'new'));assert.equal((await lib.list()).items.length,0);assert.ok(fs.existsSync(path.join(old,'items')));
});
