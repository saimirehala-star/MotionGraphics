app.exitAfterLaunchAndEval=false;
(function(){
 var root=File($.fileName).parent.parent;
 try {
 $.evalFile(File(root.fsName+'/extension/vendor/json2.js'));
 if(!app.project||app.project.file||app.project.numItems)throw new Error('Refusing nonempty project');
 var c=app.project.items.addComp('BRIDGE PROBE',64,64,1,1,25);c.openInViewer();
 $.global.MGBridgeProbe={root:root.fsName};
 var file=File(root.fsName+'/extension/js/bridge.js');file.encoding='UTF-8';file.open('r');var bridge=file.read();file.close();
 // Evaluate the actual CEP bridge in a browser-like context; its evalScript
 // callback is deliberately delayed into a separate AE task.
 $.global.MGProbeRun=function(code){return eval(code);};
 $.global.MGProbePending=null;
 $.global.MGProbeFlush=function(){var p=$.global.MGProbePending;$.global.MGProbePending=null;p.callback($.global.MGProbeRun(p.code));};
 // ES3 AE cannot run the browser Promise-based bridge itself. Use its exact
 // generated evalScript payload instead, dispatched on distinct host tasks.
 $.global.MGBridgeProbe.code='(function(){if(typeof MG2023Host==="undefined"){$.evalFile(File('+JSON.stringify(root.fsName+'/extension/host/main.jsx')+'));}return MG2023Host.dispatch(REQUEST);}())';
 $.global.MGProbeCall=function(request){return JSON.parse($.global.MGProbeRun($.global.MGBridgeProbe.code.replace('REQUEST',JSON.stringify(JSON.stringify(request)))));};
 $.global.MGBridgeProbe.begin=$.global.MGProbeCall({action:'aiBegin',data:{}});
 $.global.MGBridgeProbeFinish=function(){
   var s=$.global.MGBridgeProbe;
   var result={globalHost:typeof $.global.MG2023Host,begin:s.begin};
   result.read=$.global.MGProbeCall({action:'aiRead',data:{token:s.begin.data.token,args:{query:'context'}}});
   var f=File(s.root+'/test-results/ae-ai-bridge-probe.json');f.encoding='UTF-8';f.open('w');f.write(JSON.stringify(result,null,2));f.close();
   app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);app.quit();
 };
 app.scheduleTask('$.global.MGBridgeProbeFinish()',750,false);
 }catch(e){var f=File(root.fsName+'/test-results/ae-ai-bridge-probe.json');f.open('w');f.write('SETUP ERROR '+e.toString()+' line '+e.line);f.close();app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);app.quit();}
}());
