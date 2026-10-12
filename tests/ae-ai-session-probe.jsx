app.exitAfterLaunchAndEval=false;
(function(){
 var root=File($.fileName).parent.parent;
 if(!app.project||app.project.file||app.project.numItems)throw new Error('Refusing nonempty project');
 $.evalFile(File(root.fsName+'/extension/host/main.jsx'));
 var c=app.project.items.addComp('SESSION PROBE',64,64,1,1,25);c.openInViewer();
 $.global.MGSessionProbe={root:root.fsName,project:app.project,comp:c,begin:JSON.parse(MG2023Host.dispatch('{"action":"aiBegin","data":{}}'))};
 $.global.MGSessionProbeFinish=function(){
   var s=$.global.MGSessionProbe;
   var result={projectIdentity:app.project===s.project,compIdentity:app.project.activeItem===s.comp,compValid:isValid(s.comp),rootFolderIdentity:app.project.rootFolder===s.project.rootFolder};
   result.read=JSON.parse(MG2023Host.dispatch(JSON.stringify({action:'aiRead',data:{token:s.begin.data.token,args:{query:'context'}}})));
   var f=File(s.root+'/test-results/ae-ai-session-probe.json');f.encoding='UTF-8';f.open('w');f.write(JSON.stringify(result,null,2));f.close();
   app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);app.quit();
 };
 app.scheduleTask('$.global.MGSessionProbeFinish()',750,false);
}());
