app.exitAfterLaunchAndEval = true;
app.exitCode = 1;
(function () {
 var root=File($.fileName).parent.parent, report={passed:[],failed:[],names:[]}, comp=null, item=null;
 try {
  if (!app.project || app.project.numItems || app.project.file) { throw new Error('Refusing nonempty project'); }
  $.evalFile(File(root.fsName+'/extension/vendor/json2.js'));
  var file=File(root.fsName+'/extension/host/prerender.jsx'); file.open('r'); var code=file.read(); file.close();
  var start=code.indexOf('    function resolveOutputTemplate('), end=code.indexOf('    function outputTemplates(',start);
  function trimString(value) { return String(value).replace(/^\s+|\s+$/g,''); }
  $.evalFile(File(root.fsName+'/test-results/template-resolver-test.jsx'));
  comp=app.project.items.addComp('MG TEMPLATE NAME TEST',64,64,1,1,25);
  item=app.project.renderQueue.items.add(comp);
  var names=item.outputModule(1).templates;
  for(var i=0;i<names.length;i++) {
   var name=String(names[i]); report.names.push({name:name,hasEdgeWhitespace:name!==trimString(name)});
   try { item.outputModule(1).applyTemplate(resolveOutputTemplate(names,name)); report.passed.push(name); }
   catch(e) { report.failed.push(String(e)); }
  }
  if(resolveOutputTemplate(['  example  '],'example')!=='  example  ') throw new Error('legacy cache resolution failed');
  var rejected=false; try {resolveOutputTemplate(names,'MG_NONEXISTENT_TEMPLATE_97134');}catch(e){rejected=true;}
  if(!rejected) throw new Error('missing template accepted');
  report.legacyCacheResolved=true; report.missingTemplateRejected=true;
 } catch(e) {report.failed.push(String(e));}
 if(item) item.remove(); if(comp) comp.remove();
 var out=File(root.fsName+'/test-results/ae-output-template-names.json'); out.encoding='UTF-8'; out.open('w');out.write(JSON.stringify(report,null,2));out.close();
 app.exitCode=report.failed.length?1:0;
}());
