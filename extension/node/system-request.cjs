'use strict';
const cp=require('child_process'),path=require('path');
function systemRequest(config){
  const child=cp.spawn('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'system-request.ps1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  let cancel;
  const promise=new Promise((resolve,reject)=>{
    let done=false,size=0,chunks=[];
    const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(value);};
    cancel=error=>{child.kill();finish(error||new Error('任务已停止。'));};
    // Existing callers did not have a proxy-mode field. Preserve their
    // previous local/direct behavior; licensing now always passes a mode.
    const mode=config.networkMode||'direct';
    const timer=setTimeout(()=>cancel(new Error('授权网络请求超时（'+mode+'）。请运行“检测网络”，或切换直连 / 系统代理 / 手动代理。')),config.timeout);
    child.on('error',e=>finish(e));child.stdin.on('error',e=>finish(e));
    child.stderr.on('data',()=>{});
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>64*1024*1024){cancel(new Error('接口返回过大。'));return;}chunks.push(chunk);});
    child.on('close',()=>{if(done)return;try{const result=JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/,''));if(result.error){const e=new Error(result.error);e.diagnostic=result;throw e;}finish(null,result);}catch(e){finish(e);}});
    // Secrets only travel through stdin, never command-line arguments or files.
    child.stdin.end(JSON.stringify(config));
  });
  return {promise,destroy:error=>cancel(error)};
}
module.exports={systemRequest};
