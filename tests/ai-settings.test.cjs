const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const panel=fs.readFileSync(path.join(__dirname,'../extension/js/ai-panel.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../extension/index.html'),'utf8');
test('Codex-only AI settings do not expose removed third-party API controls',()=>{
 assert.match(html,/id=\"ai-provider\"[^>]*>[\s\S]*Codex/);
 assert.doesNotMatch(html,/ai-third-|ai-api-key|ai-api-login|使用 API Key/);
 assert.doesNotMatch(panel,/ai-third-|ai-api-key|ai-api-login|ThirdPartyClient/);
 assert.match(panel,/localStorage\.setItem\('mg-ai-codex-path'/);
});
