app.exitAfterLaunchAndEval=false;
(function(){
 var root=File($.fileName).parent.parent;
 if(!app.project||app.project.file||app.project.numItems)throw new Error('Refusing nonempty project');
 $.evalFile(File(root.fsName+'/extension/vendor/json2.js'));
 var report={aeVersion:app.version,passed:[],failed:[]},steps=[],index=0,token,comp,host,layerId;
 var reportPath=root.fsName+'/test-results/ae-ai-session-regression.json';
 function saveReport(){var output=File(reportPath);output.encoding='UTF-8';output.open('w');output.write(JSON.stringify(report,null,2));output.close();}
 saveReport();
 var file=File(root.fsName+'/extension/js/bridge.js');file.encoding='UTF-8';file.open('r');var source=file.read();file.close();
 var start=source.indexOf('var script='),end=source.indexOf('nativeBridge.evalScript',start);
 var makeScript=new Function('extensionPath','item',source.substring(start,end)+'return script;');
 // Each call evaluates the exact shipped CEP payload, from a fresh scope.
 function evaluate(code){return eval(code);}
 function call(action,data){return JSON.parse(evaluate(makeScript(root.fsName+'/extension',{payload:{action:action,data:data||{}}})));}
 function assert(v,s){if(!v)throw new Error(s);}
 function check(name,fn){steps.push({name:name,run:fn});}
 comp=app.project.items.addComp('AI SESSION REGRESSION',64,64,1,2,25);comp.openInViewer();
 check('first CEP payload exports persistent host',function(){var r=call('aiBegin');assert(r.ok,JSON.stringify(r));token=r.data.token;host=$.global.MG2023Host;assert(host&&host.version==='2.3.1','host not exported');});
 check('later CEP payload retains turn and host',function(){var r=call('aiRead',{token:token,args:{query:'context'}});assert(r.ok,JSON.stringify(r));assert($.global.MG2023Host===host,'host was reloaded');assert(r.data.comp.id===comp.id,'target changed');});
 check('later payload can independently edit AE',function(){var r=call('aiEdit',{token:token,args:{operations:[{op:'addText',text:'Session retained'}]}});assert(r.ok,JSON.stringify(r));layerId=r.data.completed[0].id;});
 check('readback on another payload finds prior edit',function(){var r=call('aiRead',{token:token,args:{query:'properties',layerId:layerId,propertyPath:['ADBE Text Properties','ADBE Text Document']}});assert(r.ok&&r.data.value.text==='Session retained',JSON.stringify(r));});
 check('template library query survives separate payload',function(){var dir=Folder(root.fsName+'/test-results/session-template-library');dir.create();$.global.MotionGraphicsTemplateRoot=dir.fsName;var r=call('aiRead',{token:token,args:{query:'templates'}});assert(r.ok&&r.data.items instanceof Array,JSON.stringify(r));});
 check('incorrect token is still rejected',function(){var r=call('aiRead',{token:'invalid',args:{query:'context'}});assert(!r.ok&&r.message.indexOf('AI_SESSION_EXPIRED')>=0,'incorrect token accepted');});
 check('switching composition still blocks edits',function(){var other=app.project.items.addComp('OTHER',64,64,1,1,25);other.openInViewer();var r=call('aiEdit',{token:token,args:{operations:[{op:'rename',layerId:layerId,name:'WRONG'}]}});assert(!r.ok&&comp.layer(1).name!=='WRONG','wrong comp modified');other.remove();comp.openInViewer();});
 check('end turn is preserved across calls',function(){var r=call('aiEnd',{token:token});assert(r.ok,JSON.stringify(r));});
 check('completed task rejects further requests',function(){var r=call('aiRead',{token:token,args:{query:'context'}});assert(!r.ok&&r.message.indexOf('AI_SESSION_MISSING')>=0,'ended task accepted');});
 check('next turn can start normally',function(){var r=call('aiBegin');assert(r.ok,JSON.stringify(r));token=r.data.token;});
 check('next turn survives another invocation',function(){var r=call('aiRead',{token:token,args:{query:'context'}});assert(r.ok,JSON.stringify(r));});
 $.global.MGSessionRegressionNext=function(){
   var step=steps[index++];
   try{step.run();report.passed.push(step.name);}catch(e){report.failed.push({name:step.name,message:String(e),line:e.line});}
   saveReport();
   if(index<steps.length){app.scheduleTask('$.global.MGSessionRegressionNext()',120,false);return;}
   report.complete=true;saveReport();
   app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);app.quit();
 };
 app.scheduleTask('$.global.MGSessionRegressionNext()',120,false);
}());
