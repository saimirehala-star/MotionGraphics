const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {systemRequest}=require('../extension/node/system-request.cjs');
test('Windows transport preserves JSON and auth, refuses redirects and supports cancellation',{skip:process.platform!=='win32'},async()=>{
 let received,redirected=0;
 const server=http.createServer((req,res)=>{let body='';req.on('data',c=>body+=c);req.on('end',()=>{
   if(req.url==='/wait')return;
   if(req.url==='/redirect'){res.writeHead(302,{Location:'/leak'});res.end('{}');return;}
   if(req.url==='/leak')redirected++;
   received={key:req.headers.authorization,body:JSON.parse(body)};res.setHeader('Content-Type','application/json');res.end(JSON.stringify({text:'中文响应'}));
 });});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const config={url:'http://127.0.0.1:'+server.address().port,key:'test-secret',body:JSON.stringify({text:'中文请求'}),timeout:15000};
 try{
   const response=await systemRequest(config).promise;assert.equal(response.status,200);assert.equal(JSON.parse(response.body).text,'中文响应');assert.deepEqual(received,{key:'Bearer test-secret',body:{text:'中文请求'}});
   assert.equal((await systemRequest({...config,url:config.url+'/redirect'}).promise).status,302);assert.equal(redirected,0);
   const pending=systemRequest({...config,url:config.url+'/wait'});setTimeout(()=>pending.destroy(new Error('cancelled')),200);await assert.rejects(pending.promise,/cancelled/);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
