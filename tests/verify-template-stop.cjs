const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('assert');
const control=require('../extension/node/template-control.cjs');
(async()=>{
 const id='tpl-cancel-test-'+Date.now(),root=path.join(os.tmpdir(),'MotionGraphicsTemplateJobs'),stage=path.join(root,id),ready=path.join(stage,'started');fs.mkdirSync(stage,{recursive:true});
 const slash=p=>p.replace(/\\/g,'/');
 const launch=path.join(stage,'launch.jsx');fs.writeFileSync(launch,'app.exitAfterLaunchAndEval=false; if(app.project.file||app.project.numItems)throw new Error("not empty"); var f=File('+JSON.stringify(slash(ready))+');f.open("w");f.write("ready");f.close();$.sleep(40000);','utf8');
 const child=cp.spawn('D:/Software/AE2023/Adobe After Effects 2023/Support Files/AfterFX.com',['-noui','-m','-r',launch],{windowsHide:true,stdio:'ignore'});
 let exited=false;child.on('exit',()=>exited=true);
 const report={id};
 try{
  await new Promise(r=>setTimeout(r,3000));assert(!exited,'worker exited before termination');report.scriptStarted=fs.existsSync(ready);
  report.process=cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Get-CimInstance Win32_Process -Filter "ProcessId='+child.pid+'" | Select-Object Name,CommandLine | ConvertTo-Json -Compress'],{encoding:'utf8',windowsHide:true});
  report.result=await control.terminate({id,staging:stage,workerPid:process.pid});
  assert(report.result.stopped.includes(child.pid),'exact test AE was not stopped');
  assert(fs.existsSync(stage+'.cancelled'),'no cancellation marker');
  const end=Date.now()+5000;while(!exited&&Date.now()<end)await new Promise(r=>setTimeout(r,100));assert(exited,'test AE still alive');
  report.repeated=await control.terminate({id,staging:stage,workerPid:process.pid});assert.equal(report.repeated.stopped.length,0,'stale PID used');
  assert.throws(()=>control.paths({id,staging:path.join(os.tmpdir(),id)}));
  report.ok=true;
 }catch(e){report.error=e.message;process.exitCode=1;}finally{if(!exited)child.kill();fs.writeFileSync(path.join(__dirname,'../test-results/template-stop.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
})();
