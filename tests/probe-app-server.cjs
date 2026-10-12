const fs=require('fs'),path=require('path');
const {AIClient,discover}=require('../extension/node/ai-client.cjs');
const root=path.resolve(__dirname,'..');
const client=new AIClient({home:path.join(root,'test-results','ai-isolated-profile')});
(async()=>{
 const report={};
 try{
  report.executableFound=!!discover();const account=await client.connect();report.connected=true;report.loggedIn=!!account.account;
  const list=await client.models();report.models=list.map(m=>m.model||m.id);
  const thread=await client.rpc('thread/start',{model:'gpt-6-astra',cwd:client.work,environments:[],ephemeral:true,sandbox:'read-only',approvalPolicy:'untrusted',dynamicTools:require('../extension/node/ai-client.cjs').tools});
  report.dynamicToolsAccepted=!!thread.thread.id;
 }catch(e){report.error=e.message;process.exitCode=1;}finally{client.close();fs.writeFileSync(path.join(root,'test-results','ai-app-server.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})();
