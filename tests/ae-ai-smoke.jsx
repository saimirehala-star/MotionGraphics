app.exitAfterLaunchAndEval=true;app.exitCode=91;
(function(){
 var root=File($.fileName).parent.parent,report={version:app.version,passed:[],failed:[]},comp=null;
 function assert(v,s){if(!v)throw new Error(s);}
 function check(name,fn){try{fn();report.passed.push(name);}catch(e){report.failed.push({name:name,message:e.message||String(e),line:e.line||0});}}
 try{
  assert(app.project&&!app.project.file&&app.project.numItems===0,'Refusing nonempty project');
  $.evalFile(File(root.fsName+'/extension/host/main.jsx'));
  comp=app.project.items.addComp('MG AI TEST',320,240,1,3,25);comp.openInViewer();
  var begun=MG2023Host.run({action:'aiBegin',data:{}},comp),token=begun.data.token,created;
  function run(a,args){return MG2023Host.run({action:a,data:{token:token,args:args}},comp);}
  check('independent text creation and stable IDs',function(){created=run('aiEdit',{operations:[{op:'addText',name:'AI TITLE',text:'童话岛'}]});assert(created.ok,created.message);assert(created.data.completed[0].id===comp.layer(1).id,'wrong layer ID');});
  var id=comp.layer(1).id;
  check('keyframes, expression and native effect readback',function(){var r=run('aiEdit',{operations:[{op:'property',layerId:id,propertyPath:['ADBE Transform Group','ADBE Opacity'],keys:[{time:0,value:0},{time:1,value:100}]},{op:'property',layerId:id,propertyPath:['ADBE Transform Group','ADBE Scale'],expression:'[100,100]+[Math.sin(time*3)*5,Math.sin(time*3)*5]'}, {op:'addEffect',layerId:id,matchName:'ADBE Slider Control'}]});assert(r.ok,r.message);var p=run('aiRead',{query:'properties',layerId:id,propertyPath:['ADBE Transform Group','ADBE Opacity']});assert(p.data.numKeys===2,'keyframes missing');assert(comp.layer(1).property('ADBE Effect Parade').numProperties===1,'effect missing');});
  check('plugin preset integration',function(){var r=run('aiPlugin',{action:'apply',layerIds:[id],data:{id:'in-fade',markerTiming:true,reuseExisting:true}});assert(r.ok,JSON.stringify(r));});
  check('partial failure preserves honest completion count',function(){var r=run('aiEdit',{operations:[{op:'rename',layerId:id,name:'RENAMED'},{op:'rename',layerId:9999999,name:'invalid'}]});assert(!r.ok&&r.data.partial&&r.data.completed.length===1,'partial result not reported');});
  check('raw JSX denied without approval',function(){var rejected=false;try{run('aiScript',{code:'comp.name="UNAPPROVED";'});}catch(e){rejected=true;}assert(rejected&&comp.name==='MG AI TEST','unapproved script ran');});
  check('text values serialize through real CEP dispatch',function(){var r=JSON.parse(MG2023Host.dispatch(JSON.stringify({action:'aiRead',data:{token:token,args:{query:'properties',layerId:id,propertyPath:['ADBE Text Properties','ADBE Text Document']}}})));assert(r.ok&&r.data.value.text.length>0,'text document missing');});
  check('approved JSX executes and reports result',function(){var r=MG2023Host.run({action:'aiScript',data:{token:token,approved:true,args:{code:'comp.comment="AI TEST"; return {changed:comp.comment};'}}},comp);assert(r.ok&&r.data.result.changed==='AI TEST','approved script failed');});
  check('comp switch and expired tokens rejected',function(){var other=app.project.items.addComp('OTHER',64,64,1,1,25);other.openInViewer();var rejected=false;try{run('aiEdit',{operations:[{op:'rename',layerId:id,name:'WRONG'}]});}catch(e){rejected=true;}assert(rejected,'comp switch not rejected');other.remove();comp.openInViewer();MG2023Host.run({action:'aiEnd',data:{token:token}},comp);rejected=false;try{run('aiRead',{query:'context'});}catch(e){rejected=true;}assert(rejected,'expired token accepted');});
  check('create composition without an active target',function(){while(app.project.numItems)app.project.item(1).remove();var b=MG2023Host.run({action:'aiBegin',data:{}},null);var r=MG2023Host.run({action:'aiEdit',data:{token:b.data.token,args:{operations:[{op:'createComp',name:'FROM EMPTY',width:64,height:64,duration:1,frameRate:25}]}}},null);assert(r.ok&&r.data.context.comp.name==='FROM EMPTY','create comp failed');});
 }catch(e){report.failed.push({name:'setup',message:e.message||String(e),line:e.line||0});}
 try{if(app.project)app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);}catch(_){}
 var f=File(root.fsName+'/test-results/ae-ai-smoke.json');f.encoding='UTF-8';f.open('w');f.write(JSON.stringify(report,null,2));f.close();app.exitCode=report.failed.length?92:0;
}());
