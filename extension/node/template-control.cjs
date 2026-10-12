'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
function paths(job){
 if(!job||!/^tpl-[a-z0-9-]{6,80}$/.test(job.id))throw new Error('无效模版任务 ID。');
 const root=path.join(os.tmpdir(),'MotionGraphicsTemplateJobs');fs.mkdirSync(root,{recursive:true});
 const staging=job.staging||(job.windowPidFile?job.windowPidFile.replace(/\.window-pids$/,''):path.join(root,job.id));
 const full=path.resolve(staging),canonical=p=>fs.realpathSync(p).toLowerCase();
 if(path.basename(full)!==job.id||canonical(path.dirname(full))!==canonical(root))throw new Error('任务临时路径不在本机模版目录内，未终止任何进程。');
 return {staging:full,launch:path.join(full,'launch.jsx'),cancel:full+'.cancelled',pidFile:full+'.window-pids'};
}
async function terminate(job){
 const p=paths(job);
 // Local tombstone survives AE/panel restarts; no shared-drive I/O required.
 fs.writeFileSync(p.cancel,JSON.stringify({id:job.id,cancelledAt:Date.now()}),'utf8');
 return new Promise((resolve,reject)=>{
  cp.execFile('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-File',path.resolve(__dirname,'../host/template-stop.ps1'),'-LaunchFile',p.launch,'-PidFile',p.pidFile],{windowsHide:true,timeout:20000,encoding:'utf8'},(e,stdout)=>{
   if(e){reject(new Error('已写入终止标记，但未能确认后台进程已退出。任务记录已保留。'));return;}
   try{resolve(JSON.parse(stdout.replace(/^\uFEFF/,'')));}catch(_){reject(new Error('已写入终止标记，但后台进程检查结果无法读取。'));}
  });
 });
}
module.exports={paths,terminate};
