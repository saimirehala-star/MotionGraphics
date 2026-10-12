'use strict';
const http=require('http'),https=require('https'),tls=require('tls'),net=require('net');
const {URL}=require('url');
function proxyURL(value){
 let text=String(value||'').trim(),p;
 if(/^\d+$/.test(text))text='http://127.0.0.1:'+text;
 else if(/^(?:localhost|[a-z0-9.-]+|\[[a-f0-9:]+\]):\d+$/i.test(text))text='http://'+text;
 try{p=new URL(text);}catch(_){throw new Error('本地 HTTP 代理地址无效。请填写 http://127.0.0.1:7890、127.0.0.1:7890 或实际端口号；留空使用系统代理。');}
 if(p.protocol!=='http:'||p.username||p.password||p.search||p.hash||p.pathname!=='/')throw new Error('请填写 HTTP 代理地址，例如 http://127.0.0.1:7890；使用 VPN 的 HTTP 或 Mixed 端口，不是 SOCKS 端口。');
 return p;
}
function proxyAgent(value,secure){
 const p=proxyURL(value),agent=secure?new https.Agent({keepAlive:false}):new http.Agent({keepAlive:false}),pending=new Set();
 agent.phase='连接 HTTP 代理';
 const destroy=agent.destroy.bind(agent);
 agent.destroy=function(){for(const item of pending)item.destroy();pending.clear();destroy();};
 agent.createConnection=function(options,callback){
   const host=options.hostname||options.host,authority=(host.includes(':')?'['+host+']':host)+':'+options.port;
   const connect=http.request({hostname:p.hostname.replace(/^\[|\]$/g,''),port:p.port||80,method:'CONNECT',path:authority,headers:{Host:authority},agent:false});
   pending.add(connect);let completed=false;
   const done=(err,socket)=>{if(completed)return;completed=true;pending.delete(connect);callback(err,socket);};
   connect.on('error',e=>done(new Error('HTTP 代理连接失败（'+(e.code||'连接中断')+'），请检查 '+p.host+' 的 HTTP/Mixed 端口。')));
   connect.on('connect',(res,socket,head)=>{
     agent.phase='建立 CONNECT 隧道';
     pending.add(socket);
     if(res.statusCode!==200){socket.destroy();done(new Error('HTTP 代理 CONNECT 返回 '+res.statusCode+'；未发送 API Key。'));return;}
     if(head.length)socket.unshift(head);
     if(!secure){done(null,socket);return;}
     agent.phase='TLS 握手';
     const secured=tls.connect({socket,servername:net.isIP(host)?undefined:host,rejectUnauthorized:true});pending.add(secured);
     secured.once('error',e=>done(new Error('代理隧道 TLS 验证失败：'+(e.code||'连接中断'))));
     secured.once('close',()=>{if(!completed)done(new Error('代理隧道在 TLS 握手完成前关闭（ECONNRESET）；请检查 VPN 节点与服务商连通性。'));});
     secured.once('secureConnect',()=>{agent.phase='等待服务商响应';done(null,secured);});
   });
   connect.end();
 };
 return agent;
}
module.exports={proxyURL,proxyAgent};
