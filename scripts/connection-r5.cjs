const fs=require('fs'),p='extension/node/third-party-client.cjs';let s=fs.readFileSync(p,'utf8');
s=s.replace("let settled=false,req;","let settled=false,req,phase='建立连接';");
s=s.replace("if(settled)return;settled=true;clearTimeout(timer);", "if(settled)return;settled=true;if(err&&(err.code==='ECONNRESET'||err.message==='socket hang up'))err=new Error('连接被代理或服务商中途关闭（ECONNRESET，阶段：'+(phase==='接收响应'?phase:agent?agent.phase:phase)+'）。未自动重试；已执行的 AE 操作不会撤销，请检查工程后再继续。');clearTimeout(timer);");
s=s.replace("let chunks=[],size=0;","phase='接收响应';let chunks=[],size=0;");
s=s.replace("new Error('接口连接中断。')","new Error('服务商响应接收中断；未自动重试，已执行的 AE 操作保留。')");
fs.writeFileSync(p,s);
fs.appendFileSync('extension/css/ai.css','\n.ai-heading-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:auto}.ai-heading{gap:12px;flex-wrap:wrap}.ai-connection-actions{align-items:center!important}.ai-connection-actions button{height:31px;margin:0;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}\n');
