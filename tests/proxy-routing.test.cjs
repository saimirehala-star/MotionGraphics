const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('http'),net=require('net');
const {ThirdPartyClient}=require(process.env.MG_PACKAGED_TEST?'../dist/cep/MotionGraphicsUserPresets/node/third-party-client.cjs':'../extension/node/third-party-client.cjs');
async function fixture(t,mode){
 let hits=0,connects=0;const sockets=new Set();
 const handler=(req,res)=>{hits++;assert.equal(req.headers.authorization,'Bearer test-only');let b='';req.on('data',c=>b+=c);req.on('end',()=>{if(mode==='reset'){req.socket.destroy();return;}res.end(JSON.stringify({status:'completed',output:hits===1?[{type:'function_call',call_id:'one',name:'ae_read',arguments:'{"query":"context"}'}]:[{type:'message',content:[{type:'output_text',text:'完成'}]}]}));});};
 const fs=require('fs'),path=require('path');
 const origin=mode==='tls'?require('https').createServer({key:fs.readFileSync(path.join(__dirname,'fixtures/proxy-test-key.pem')),cert:fs.readFileSync(path.join(__dirname,'fixtures/proxy-test-cert.pem'))},handler):http.createServer(handler);
 await new Promise(r=>origin.listen(0,'127.0.0.1',r));
 const proxy=http.createServer();proxy.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
 proxy.on('connect',(req,socket,head)=>{connects++;assert.equal(req.headers.authorization,undefined);
 if(mode==='reject'){socket.end('HTTP/1.1 407 Proxy Authentication Required\r\n\r\n');return;}
 if(mode==='stall')return;
 const upstream=net.connect(origin.address().port,'127.0.0.1',()=>{socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);});sockets.add(upstream);upstream.on('error',()=>socket.destroy());socket.on('close',()=>upstream.destroy());
 });await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
 const c=new ThirdPartyClient({baseURL:(mode==='tls'?'https://localhost:':'http://127.0.0.1:')+origin.address().port,protocol:'responses',model:'test',key:'test-only',proxy:'http://127.0.0.1:'+proxy.address().port});
 c.postSystem=()=>{throw Error('unexpected system fallback');};t.after(()=>{c.close();for(const s of sockets)s.destroy();origin.close();proxy.close();});
 return {c,counts:()=>({hits,connects})};
}
test('explicit proxy retained; two-round tool conversation uses CONNECT for every request',async t=>{
 const {c,counts}=await fixture(t);let done,calls=0;c.on('done',v=>done=v);c.toolHandler=async()=>{calls++;return {ok:true};};await c.start('检查',{},'test');assert.equal(done.status,'completed');assert.equal(calls,1);assert.deepEqual(counts(),{hits:2,connects:2});
});
test('proxy rejection never sends key or falls back',async t=>{const {c,counts}=await fixture(t,'reject');await assert.rejects(c.post({}),/407/);assert.deepEqual(counts(),{hits:0,connects:1});});
test('timeout cancels stalled CONNECT',async t=>{const {c}=await fixture(t,'stall');c.timeout=100;await assert.rejects(c.post({}),/超时/);});
test('stop cancels stalled CONNECT',async t=>{const {c}=await fixture(t,'stall');const run=c.post({});setTimeout(()=>c.stop(),50);await assert.rejects(run,/停止/);});
test('socket hang up reports stage and does not retry POST',async t=>{const {c,counts}=await fixture(t,'reset');await assert.rejects(c.post({}),/ECONNRESET，阶段/);assert.equal(counts().hits,1);});
test('reject unsupported proxy schemes and credentials',()=>{for(const proxy of ['socks5://127.0.0.1:7890','http://u:p@localhost:7890'])assert.throws(()=>new ThirdPartyClient({baseURL:'https://example.com',protocol:'responses',model:'test',key:'test',proxy}));});
test('HTTPS through CONNECT validates the origin certificate',async t=>{const {c,counts}=await fixture(t,'tls');if(process.env.NODE_EXTRA_CA_CERTS){await c.post({});assert.equal(counts().hits,1);}else{await assert.rejects(c.post({}),/TLS/);assert.equal(counts().hits,0);}});
test('normalize proxy short forms, preserve full URL, give field-specific errors',()=>{
 const config={baseURL:'https://example.com/v1',protocol:'responses',model:'test',key:'test'};
 for(const proxy of ['7890','127.0.0.1:7890','http://127.0.0.1:7890']){const c=new ThirdPartyClient({...config,proxy});assert.equal(c.proxy,'http://127.0.0.1:7890/');assert.equal(c.proxyHost,'127.0.0.1:7890');}
 for(const proxy of ['http://','端口7890','99999'])assert.throws(()=>new ThirdPartyClient({...config,proxy}),/代理地址无效/);
 assert.throws(()=>new ThirdPartyClient({...config,baseURL:''}),/接口地址无效/);
});
