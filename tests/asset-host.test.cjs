const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('AE import keeps target composition and current time, applies sequence fps, and closes undo group',()=>{
 let imported,layer,ended=0;
 function CompItem(){this.time=1.25;this.duration=10;this.layers={add:item=>(layer={source:item})};this.openInViewer=()=>{};}
 function FootageItem(){this.mainSource={isStill:false};}
 function ImportOptions(file){this.file=file;this.canImportAs=()=>true;}
 const c={CompItem,FootageItem,ImportOptions,ImportAsType:{FOOTAGE:1,COMP_CROPPED_LAYERS:2},File:x=>({exists:true,fsName:x}),app:{project:{numItems:0,importFile:o=>{imported=o;return new FootageItem();}},beginUndoGroup:()=>{},endUndoGroup:()=>ended++}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/host/assets.jsx'),'utf8'),c);const comp=new CompItem();
 assert.equal(c.MGAssetHost.run('assetAdd',{path:'X:/s_0000.png',name:'sequence',sequence:true,fps:24},comp).ok,true);assert.equal(imported.sequence,true);assert.equal(layer.source.mainSource.conformFrameRate,24);assert.equal(layer.startTime,1.25);assert.equal(ended,1);
 assert.throws(()=>c.MGAssetHost.run('assetAdd',{path:'X:/a.png'},null),/打开/);
 comp.id=17;assert.equal(c.MGAssetHost.run('assetTarget',{},comp).data.compId,17);
 assert.throws(()=>c.MGAssetHost.run('assetAdd',{path:'X:/a.png',targetCompId:18},comp),/已切换/);
 c.MGAssetHost.run('assetAdd',{path:'X:/a.psd',psd:true,psdMode:'layers'},comp);assert.equal(imported.importAs,2);
});
