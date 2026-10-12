const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {ThirdPartyClient,endpoint}=require('../extension/node/third-party-client.cjs');
async function fixture(t,protocol,handler){
 const requests=[];const server=http.createServer((req,res)=>{let body='';req.on('data',x=>body+=x);req.on('end',()=>{requests.push({path:req.url,auth:req.headers.authorization,body:JSON.parse(body)});handler(requests.length,JSON.parse(body),res);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const client=new ThirdPartyClient({baseURL:'http://127.0.0.1:'+server.address().port+'/v1',key:'unit-test-secret',model:'test-model',protocol});
 t.after(()=>{client.close();server.close();});return {client,requests};
}
function send(res,body,status=200){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));}
function result(protocol,calls,text){return protocol==='chat'?{choices:[{finish_reason:calls.length?'tool_calls':'stop',message:{role:'assistant',content:text||null,tool_calls:calls.map(c=>({id:c.id,type:'function',function:{name:c.name,arguments:JSON.stringify(c.args)}}))}}]}:{status:'completed',output:calls.map(c=>({type:'function_call',call_id:c.id,name:c.name,arguments:JSON.stringify(c.args)})).concat(text?[{type:'message',role:'assistant',content:[{type:'output_text',text}]}]:[])};}
test('endpoint normalization preserves custom paths and rejects unsafe/auth-bearing URLs',()=>{
 assert.equal(endpoint('https://example.com','chat'),'https://example.com/v1/chat/completions');
 assert.equal(endpoint('https://example.com/api/v1/','responses'),'https://example.com/api/v1/responses');
 assert.equal(endpoint('https://example.com/v1/responses','responses'),'https://example.com/v1/responses');
 for(const u of ['http://example.com/v1','https://user:pass@example.com','https://example.com?key=bad','file:///tmp'])assert.throws(()=>endpoint(u,'chat'));
 assert.throws(()=>endpoint('https://example.com/v1/responses','chat'));
});
for(const protocol of ['chat','responses']){
 test(protocol+' HTTP conversation executes bounded AE tools and returns result to provider',async t=>{
   const {client,requests}=await fixture(t,protocol,(n,b,res)=>send(res,n===1?result(protocol,[{id:'call-1',name:'ae_read',args:{query:'context'}}]):result(protocol,[],'已检查')));
   let calls=0,done;client.toolHandler=async(name,args)=>{assert.equal(name,'ae_read');assert.equal(args.query,'context');calls++;return {ok:true,data:{name:'合成'}};};client.on('done',x=>done=x);
   await client.start('检查',{},'test-model');assert.equal(done.status,'completed');assert.equal(calls,1);assert.equal(requests.length,2);assert.equal(requests[0].auth,'Bearer unit-test-secret');
   const history=protocol==='chat'?requests[1].body.messages:requests[1].body.input;
   assert(history.some(x=>protocol==='chat'?x.role==='tool'&&x.tool_call_id==='call-1':x.type==='function_call_output'&&x.call_id==='call-1'));
   assert.equal(requests[0].body.stream,false);assert.equal(requests[0].body.tools.length,4);
 });
 test(protocol+' test connection only exposes inert probe, never AE tools',async t=>{
   const {client,requests}=await fixture(t,protocol,(n,b,res)=>send(res,result(protocol,[{id:'test-1',name:'mg_connection_probe',args:{ok:true}}])));
   client.toolHandler=()=>assert.fail('AE called during connection test');assert((await client.test()).ok);assert.equal(requests[0].body.tools.length,1);assert(!JSON.stringify(requests[0].body).includes('selectedLayerIds'));
 });
}
test('401 redacts secret and never retries',async t=>{
 const {client,requests}=await fixture(t,'chat',(n,b,res)=>send(res,{error:{message:'bad unit-test-secret'}},401));let done;client.on('done',x=>done=x);
 await client.start('hello',{},'test-model');assert.equal(done.status,'failed');assert(!done.error.message.includes('unit-test-secret'));assert.equal(requests.length,1);assert.equal(client.history.length,0);
});
test('unknown second tool rejects whole batch before any edit',async t=>{
 const {client}=await fixture(t,'chat',(n,b,res)=>send(res,result('chat',[{id:'1',name:'ae_edit',args:{operations:[]}},{id:'2',name:'shell',args:{}}])));
 let calls=0,done;client.toolHandler=()=>{calls++;};client.on('done',x=>done=x);await client.start('hello',{},'test-model');assert.equal(calls,0);assert.equal(done.status,'failed');
});
test('duplicate call on next round does not repeat AE edit',async t=>{
 const {client}=await fixture(t,'responses',(n,b,res)=>send(res,result('responses',[{id:'same',name:'ae_edit',args:{operations:[]}}])));
 let calls=0,done;client.toolHandler=async()=>{calls++;return {ok:true};};client.on('done',x=>done=x);await client.start('hello',{},'test-model');assert.equal(calls,1);assert.equal(done.status,'failed');
});
test('stop aborts in-flight request and performs no tools',async t=>{
 let received;const started=new Promise(r=>received=r);
 const {client}=await fixture(t,'chat',()=>received());let calls=0,done;client.toolHandler=()=>calls++;client.on('done',x=>done=x);
 const run=client.start('hello',{},'test-model');await started;await client.stop();await run;assert.equal(done.status,'interrupted');assert.equal(calls,0);
});
test('redirects are not followed with credentials',async t=>{
 const {client,requests}=await fixture(t,'chat',(n,b,res)=>{res.writeHead(302,{Location:'http://127.0.0.1:1/steal'});res.end();});
 let done;client.on('done',x=>done=x);await client.start('hello',{},'test-model');assert.equal(done.status,'failed');assert.equal(requests.length,1);
});
