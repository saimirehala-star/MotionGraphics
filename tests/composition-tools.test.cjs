const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../extension/host/composition-tools.jsx'),'utf8');
function setup(){
 let next=1;const items=[];
 function MarkerValue(comment){this.comment=comment;this.duration=0;this.parameters={};this.label=0;this.getParameters=()=>({...this.parameters});this.setParameters=p=>{this.parameters={...p};};}
 const clone=v=>{const n=new MarkerValue(v.comment);n.duration=v.duration;n.label=v.label;n.setParameters(v.getParameters());return n;};
 function track(entries=[]){const data=entries;return {get numKeys(){return data.length;},keyTime:i=>data[i-1].time,keyValue:i=>clone(data[i-1].value),removeKey:i=>data.splice(i-1,1),setValueAtTime:(time,value)=>{const i=data.findIndex(x=>Math.abs(x.time-time)<1e-8);if(i>=0)data.splice(i,1);data.push({time,value:clone(value)});data.sort((a,b)=>a.time-b.time);}};}
 function Layer(src,expr=''){this.source=src;this.name='Layer';this.id=next++;this.locked=false;this.properties=expr?[{propertyType:1,canSetExpression:true,expression:expr,expressionEnabled:true,expressionError:''}]:[];this.numProperties=this.properties.length;this.property=i=>this.properties[i-1];this.replaceSource=s=>{this.source=s;};}
 function CompItem(name,layers=[]){this.name=name;this.id=next++;this.layersArray=layers;this.selected=false;items.push(this);this.layer=i=>this.layersArray[i-1];Object.defineProperty(this,'numLayers',{get:()=>this.layersArray.length});this.duplicate=()=>new CompItem(this.name+' 2',this.layersArray.map(l=>new Layer(l.source,l.properties.length?l.properties[0].expression:'')));this.remove=()=>items.splice(items.indexOf(this),1);}
 function FootageItem(){}function SolidSource(){}
 const app={project:{selection:[],get numItems(){return items.length;},item:i=>items[i-1],items:{addFolder:name=>{const f={name,remove:()=>items.splice(items.indexOf(f),1)};items.push(f);return f;}}},beginUndoGroup:()=>{},endUndoGroup:()=>{}};
 const context={CompItem,FootageItem,SolidSource,MarkerValue,PropertyType:{PROPERTY:1},app,JSON,Math};vm.runInNewContext(source,context);
 return {api:context.MGCompositionTools,CompItem,Layer,MarkerValue,track,items,app};
}
test('marker extraction maps range/time stretch and reverse, clips to layer bounds',()=>{
 const s=setup(),comp=new s.CompItem('Source'),v=new s.MarkerValue('Range');v.duration=2;v.label=4;comp.markerProperty=s.track([{time:1,value:v}]);
 const layer={id:10,source:comp,startTime:10,stretch:200,inPoint:13,outPoint:20};let plan=s.api.markerPlan(layer);assert.equal(plan[0].time,13);assert.equal(plan[0].value.duration,3);assert.equal(plan[0].value.label,4);
 layer.stretch=-100;layer.inPoint=0;plan=s.api.markerPlan(layer);assert.equal(plan[0].time,7);assert.equal(plan[0].value.duration,2);
});
test('repeated marker extraction updates owned markers and preserves manual/UI markers at collisions',()=>{
 const s=setup(),inner=new s.CompItem('Inner'),outer=new s.CompItem('Outer');const a=new s.MarkerValue('A'),b=new s.MarkerValue('B'),manual=new s.MarkerValue('UI range');manual.setParameters({MotionGraphicsTiming:'existing'});
 inner.markerProperty=s.track([{time:0,value:a},{time:1,value:b}]);const markers=s.track([{time:2,value:manual}]);const layer={id:77,name:'Inner layer',source:inner,startTime:2,stretch:100,inPoint:2,outPoint:8,property:()=>markers};outer.selectedLayers=[layer];
 const first=s.api.run('compositionMarkers',{},outer);assert.equal(first.skipped.length,1);assert.equal(markers.numKeys,2);assert.equal(markers.keyValue(1).getParameters().MotionGraphicsTiming,'existing');
 layer.id=88;s.api.run('compositionMarkers',{},outer);assert.equal(markers.numKeys,2);
 inner.markerProperty=s.track([]);s.api.run('compositionMarkers',{},outer);assert.equal(markers.numKeys,1);assert.equal(markers.keyValue(1).comment,'UI range');
 layer.timeRemapEnabled=true;assert.throws(()=>s.api.run('compositionMarkers',{},outer),/时间重映射/);assert.equal(markers.numKeys,1);
});
test('deep copy makes separate root graphs, reuses internal shared child, and remaps expression-only dependencies',()=>{
 const s=setup(),controller=new s.CompItem('控制器'),child=new s.CompItem('Shared'),root=new s.CompItem('Root',[new s.Layer(child,'comp("控制器").layer(1).transform.position'),new s.Layer(child)]),second=new s.CompItem('Second',[new s.Layer(child)]);
 s.app.project.selection=[root,second];const r=s.api.run('compositionDetach',{},null);assert.equal(r.ok,true);
 const outputs=s.items.filter(x=>x instanceof s.CompItem&&x.selected);assert.equal(outputs.length,2);assert.notEqual(outputs[0].layer(1).source,child);assert.equal(outputs[0].layer(1).source,outputs[0].layer(2).source);assert.notEqual(outputs[0].layer(1).source,outputs[1].layer(1).source);
 assert.match(outputs[0].layer(1).properties[0].expression,/控制器 · 副本/);assert.equal(root.layer(1).properties[0].expression,'comp("控制器").layer(1).transform.position');assert.equal(root.layer(1).source,child);
});
test('ambiguous and dynamic expression dependencies fail before any duplicate is created',()=>{
 const s=setup(),root=new s.CompItem('Root',[new s.Layer(null,'comp("prefix"+index).width')]);s.app.project.selection=[root];const n=s.items.length;assert.throws(()=>s.api.run('compositionDetach',{},null),/动态合成名称/);assert.equal(s.items.length,n);
 const a=new s.CompItem('Same'),b=new s.CompItem('Same');root.layer(1).properties[0].expression='comp("Same").width';assert.throws(()=>s.api.run('compositionDetach',{},null),/重名/);
});
