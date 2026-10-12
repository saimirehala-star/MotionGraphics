const {test}=require('node:test');
const assert=require('node:assert/strict');
const {AIClient,tools}=require('../extension/node/ai-client.cjs');
test('app-server stream parser handles split unicode JSON lines and RPC errors',async()=>{
 const c=new AIClient({home:__dirname}),writes=[];
 c.child={stdin:{writable:true,write:s=>writes.push(JSON.parse(s))}};
 const request=c.rpc('account/read',{}),id=writes[0].id;
 const line=JSON.stringify({id,result:{account:{email:'测试'}}})+'\n';c.receive(line.slice(0,10));c.receive(line.slice(10));
 assert.equal((await request).account.email,'测试');
 const bad=c.rpc('model/list',{});c.receive(JSON.stringify({id:writes[1].id,error:{message:'denied'}})+'\n');await assert.rejects(bad,/denied/);
});
test('duplicate, interrupted and foreign tool calls never perform a second edit',async()=>{
 const c=new AIClient({home:__dirname});let calls=0;const responses=[];c.child={stdin:{writable:true,write:s=>responses.push(JSON.parse(s))}};
 c.running=true;c.threadId='test-thread';c.toolHandler=async()=>{calls++;return {ok:true};};
 const msg={id:9,method:'item/tool/call',params:{threadId:'test-thread',tool:'ae_edit',arguments:{operations:[]},callId:'once'}};
 await c.serverRequest(msg);await c.serverRequest(msg);assert.equal(calls,1);assert.equal(responses[1].result.success,false);
 c.stopped=true;await c.serverRequest({...msg,params:{...msg.params,callId:'second'}});assert.equal(calls,1);
 c.stopped=false;await c.serverRequest({...msg,params:{...msg.params,callId:'third',threadId:'other'}});assert.equal(calls,1);
});
test('non-AE server requests fail closed and tool errors are returned to model',async()=>{
 const c=new AIClient({home:__dirname}),responses=[];c.child={stdin:{writable:true,write:s=>responses.push(JSON.parse(s))}};
 await c.serverRequest({id:1,method:'item/commandExecution/requestApproval',params:{}});assert.equal(responses[0].error.code,-32601);
 c.running=true;c.threadId='t';c.toolHandler=async()=>{throw new Error('layer disappeared');};
 await c.serverRequest({id:2,method:'item/tool/call',params:{tool:'ae_edit',threadId:'t',callId:'x'}});
 assert.equal(responses[1].result.success,false);assert.match(responses[1].result.contentItems[0].text,/layer disappeared/);
 assert.deepEqual(tools.map(t=>t.name),['ae_read','ae_edit','ae_plugin','ae_script']);
});
