const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os');
const {AIClient}=require('../extension/node/ai-client.cjs');
test('custom Codex provider is treated as configured without ChatGPT account',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'mg-provider-'));
 fs.writeFileSync(path.join(home,'config.toml'),'model_provider = "custom"\nmodel = "gpt-5.6-sol"\n[model_providers.custom]\nname="APINebula"\nbase_url="https://apinebula.ai/v1"\nwire_api="responses"\nexperimental_bearer_token="redacted-test"\n');
 const c=new AIClient({home}),p=c.configuredProvider();assert.equal(p.id,'custom');assert.equal(p.baseUrl,'https://apinebula.ai/v1');assert.equal(p.configured,true);assert.equal(c.configuredModel(),'gpt-5.6-sol');
});
