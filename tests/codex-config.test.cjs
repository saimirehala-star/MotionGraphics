const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os');
const {AIClient}=require('../extension/node/ai-client.cjs');
test('official Codex client reuses configured home and model',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'mg-codex-config-'));
 fs.writeFileSync(path.join(home,'config.toml'),'model = "gpt-5.6-sol"\n[model_providers.custom]\nbase_url = "https://example.invalid/v1"\n');
 const c=new AIClient({home});assert.equal(c.home,home);assert.equal(c.configuredModel(),'gpt-5.6-sol');
});
