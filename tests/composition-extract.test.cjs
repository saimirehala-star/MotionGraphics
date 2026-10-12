const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(){
 let next=1,throwMatte=false;
 const property=value=>({value,numKeys:0,expressionEnabled:false,propertyType:1,setValue(v){this.value=v;}});
 function AVLayer(comp,name,source){
  this.comp=comp;this.name=name;this.source=source;this.id=next++;this.enabled=true;this.locked=false;this.stretch=100;this.startTime=0;this.inPoint=0;this.outPoint=10;this.blendingMode=0;this.hasVideo=true;this.audioEnabled=true;this.parent=null;this.numProperties=0;
  this.t={'ADBE Anchor Point':property([0,0]),'ADBE Position':property([20,30]),'ADBE Scale':property([100,100]),'ADBE Rotate Z':property(0),'ADBE Opacity':property(100)};
  Object.defineProperty(this,'index',{get:()=>this.comp.a.indexOf(this)+1});
  this.property=n=>n==='ADBE Transform Group'?{numProperties:5,property:x=>typeof x==='number'?Object.values(this.t)[x-1]:this.t[x]}:n==='ADBE Layer Styles'?null:n==='ADBE Root Vectors Group'?{addProperty:()=>({property:()=>property([0,0])})}:{numProperties:0};
  this.setParentWithJump=p=>{this.parent=p;};this.setTrackMatte=m=>{if(throwMatte)throw Error('matte failed');this.trackMatteLayer=m;};
  this.moveBefore=other=>{this.comp.a.splice(this.comp.a.indexOf(this),1);this.comp.a.splice(this.comp.a.indexOf(other),0,this);};this.remove=()=>this.comp.a.splice(this.comp.a.indexOf(this),1);
  this.copyToComp=target=>{const n=new AVLayer(target,this.name,this.source);n.startTime=this.startTime;n.inPoint=this.inPoint;n.outPoint=this.outPoint;target.a.unshift(n);};
 }
 function CompItem(name){this.name=name;this.a=[];this.duration=10;this.frameRate=30;this.pixelAspect=1;this.motionBlur=false;this.shutterAngle=180;this.shutterPhase=-90;Object.defineProperty(this,'numLayers',{get:()=>this.a.length});this.layer=i=>this.a[i-1];this.layers={addNull:()=>{const n=new AVLayer(this,'Null');n.nullLayer=true;this.a.unshift(n);return n;},addShape:()=>{const n=new AVLayer(this,'Matte');this.a.unshift(n);return n;}};}
 const context={AVLayer,CompItem,PropertyType:{PROPERTY:1},PropertyValueType:{LAYER_INDEX:77},TrackMatteType:{ALPHA:1},BlendingMode:{NORMAL:0},app:{beginUndoGroup(){},endUndoGroup(){}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/host/composition-tools.jsx'),'utf8'),context);
 const source=new CompItem('source'),main=new CompItem('main');const a=new AVLayer(source,'A'),b=new AVLayer(source,'B');b.parent=a;source.a=[a,b];const outer=new AVLayer(main,'outer',source);outer.startTime=2;outer.inPoint=3;outer.outPoint=7;main.a=[outer];main.selectedLayers=[outer];
 return {api:context.MGCompositionTools,main,source,outer,failMatte:()=>{throwMatte=true;}};
}

test('simple extraction copies only source layers, preserves order/time/parent, and can remove outer',()=>{
 const f=fixture();f.failMatte();const r=f.api.run('compositionExtract',{keepBackup:false},f.main);
 assert.equal(r.ok,true);assert.equal(f.main.numLayers,2);assert.equal(f.source.numLayers,2);
 const a=f.main.a.find(x=>x.name==='A'),b=f.main.a.find(x=>x.name==='B');
 assert.ok(a.index<b.index);assert.equal(b.parent,a);assert.equal(a.parent,null);
 assert.equal(a.startTime,2);assert.equal(a.inPoint,3);assert.equal(a.outPoint,7);assert.equal(a.trackMatteLayer,undefined);
});
test('default backup never writes solo and creates no helper layers',()=>{
 const f=fixture();Object.defineProperty(f.outer,'solo',{get(){return false},set(){throw Error('solo prohibited')}});
 assert.equal(f.api.run('compositionExtract',{},f.main).ok,true);
 assert.equal(f.main.numLayers,3);assert.equal(f.outer.enabled,false);assert.equal(f.outer.locked,true);
});
test('copy failure removes partial results and retains original',()=>{
 const f=fixture();f.source.layer(1).copyToComp=()=>{throw Error('copy failed')};
 assert.throws(()=>f.api.run('compositionExtract',{},f.main),/copy failed/);
 assert.deepEqual(f.main.a,[f.outer]);assert.equal(f.outer.enabled,true);assert.equal(f.outer.locked,false);
});
for(const kind of ['Camera','Light'])test(kind+' copied without AV operations',()=>{
 const f=fixture(),src=f.source.layer(1),copy=src.copyToComp;src.name=kind;Object.setPrototypeOf(src,{});
 src.copyToComp=target=>{copy(target);const dst=target.layer(1);Object.setPrototypeOf(dst,{});Object.defineProperty(dst,'setTrackMatte',{get(){throw Error('matte prohibited')}});Object.defineProperty(dst,'solo',{set(){throw Error('solo prohibited')}});};
 assert.equal(f.api.run('compositionExtract',{},f.main).ok,true);assert.equal(f.main.numLayers,3);assert.ok(f.main.a.find(x=>x.name===kind));
});
