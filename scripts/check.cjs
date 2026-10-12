const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const assetFiles=['extension/host/compatibility.jsx','extension/js/assets.js','extension/node/asset-library.cjs','extension/host/assets.jsx','extension/host/composition-tools.jsx'];
for (const relative of assetFiles) new vm.Script(fs.readFileSync(path.join(root,relative),'utf8'),{filename:relative});
const required = [
  'extension/css/ai.css','extension/js/ai-panel.js','extension/node/system-request.cjs','extension/node/system-request.ps1','extension/node/ai-client.cjs','extension/node/third-party-client.cjs','extension/node/template-control.cjs','extension/host/ai.jsx',
  'extension/CSXS/manifest.xml','extension/index.html','extension/css/panel.css','extension/js/reference-presets.js','extension/js/catalog.js',
  'extension/js/motion.js','extension/js/icons.js','extension/js/preview.js','extension/js/bridge.js','extension/js/panel.js',
  'extension/host/main.jsx','extension/host/templates.jsx','extension/host/template-worker.jsx','extension/host/template-window-monitor.ps1','extension/host/expressions.jsx','extension/host/prerender.jsx','extension/vendor/json2.js','install.ps1','README.md',
  'scriptui/panel.jsx','scriptui/launch.jsx','scriptui/README.md','scripts/build-jsx.cjs','tests/ae-user-presets.jsx','tests/ae-template-prepare.jsx','tests/ae-template-import.jsx',
  'tests/ae-template-layered-psd-prepare.jsx','tests/ae-template-layered-psd-import.jsx',
  'tests/ae-template-preview-fallback-prepare.jsx','tests/ae-template-preview-fallback-verify.jsx',
  'tests/ae-template-display-time-prepare.jsx','tests/ae-template-display-time-verify.jsx'
];
let failures = [];
for (const relative of required) if (!fs.existsSync(path.join(root,relative))) failures.push(`missing: ${relative}`);
for (const relative of ['extension/js/ai-panel.js','extension/node/ai-client.cjs','extension/node/third-party-client.cjs','extension/node/template-control.cjs','extension/host/ai.jsx','extension/js/reference-presets.js','extension/js/catalog.js','extension/js/motion.js','extension/js/icons.js','extension/js/preview.js','extension/js/bridge.js','extension/js/panel.js','extension/host/main.jsx','extension/host/templates.jsx','extension/host/template-worker.jsx','extension/host/expressions.jsx','extension/host/prerender.jsx','scriptui/panel.jsx','scriptui/launch.jsx']) {
  try { new vm.Script(fs.readFileSync(path.join(root,relative),'utf8'),{filename:relative}); } catch (error) { failures.push(`${relative}: ${error.message}`); }
}
const manifest = fs.readFileSync(path.join(root,'extension/CSXS/manifest.xml'),'utf8');
if (!manifest.includes('Host Name="AEFT" Version="[23.0,26.99]"')) failures.push('manifest does not target AE 2023–2026');
if (!manifest.includes('ExtensionBundleVersion="2.8.0"')) failures.push('manifest version is not 2.8.0');
if (!manifest.includes('ExtensionBundleId="com.motiongraphics.panel.userpresets"')) failures.push('manifest does not use an isolated extension id');
if (!manifest.includes('<Menu>Motion Graphics · Team Templates</Menu>')) failures.push('manifest does not use the team template menu name');
if (!manifest.includes('--enable-nodejs') || !manifest.includes('--mixed-context')) failures.push('CEP Node background process flags missing');
const catalog = require(path.join(root,'extension/js/catalog.js'));
if (catalog.presets.length !== 95) failures.push(`expected 95 presets/tools, found ${catalog.presets.length}`);
if (new Set(catalog.presets.map(p=>p.id)).size !== catalog.presets.length) failures.push('duplicate preset ids');
for (const preset of catalog.presets) if (!catalog.category(preset.category)) failures.push(`unknown category: ${preset.id}`);
const html = fs.readFileSync(path.join(root,'extension/index.html'),'utf8');
const panel = fs.readFileSync(path.join(root,'extension/js/panel.js'),'utf8');
const css = fs.readFileSync(path.join(root,'extension/css/panel.css'),'utf8');
const assetCss=fs.readFileSync(path.join(root,'extension/css/assets.css'),'utf8');
for (const id of ['asset-workspace','asset-grid','asset-import-form','asset-groups','asset-search','asset-cancel-job']) {
 if (!html.includes('id="'+id+'"')) failures.push('asset UI missing: '+id);
}
if (!html.includes('data-panel="assets"') || !assetCss.includes('object-fit:contain')) failures.push('asset tab or full-frame preview missing');
for (const name of ['ffmpeg.exe','ffprobe.exe','COPYING-GPLv3.txt']) if (!fs.existsSync(path.join(root,'extension/vendor/media',name))) failures.push('media runtime missing: '+name);
for (const token of ['data-panel="ai"','id="ai-workspace"','id="ai-approval"','data-panel="ui"','data-panel="tools"','data-panel="prerender"','data-panel="templates"','id="categories"','id="presets"','id="stagger-options"','id="remove-keyloop"','id="upgrade"','id="save-current"','id="save-modal"','id="save-form"','id="user-library-actions"','id="applied-bar"','id="applied-chips"','id="applied-scope"','id="template-workspace"','id="template-categories"','id="templates"','id="template-save-category"','id="template-save-modal"','id="template-save-form"','id="template-job"','id="show-template-worker"','id="expression-edit-modal"','id="expression-view-modal"','id="prerender-workspace"','id="prerender-panel"']) {
  if (!html.includes(token)) failures.push(`CEP UI missing: ${token}`);
}
for (const removed of ['应用到选中图层','结果详情','当前图层','id="parameters"','id="apply"','id="read"','移除本类动效']) {
  if (html.includes(removed)) failures.push(`removed CEP UI returned: ${removed}`);
}
for (const behavior of ['markerTiming: true','reuseExisting: true',"MGBridge.call('syncDeletedMarkers', { force: true })","MGBridge.call('appliedSummary')","data-applied-goto","data-applied-remove","await refreshApplied()","execute('remove', { category: 'keyloop' })","execute('remove', { category: category, allowEmpty: true })","cards.unshift({ clear: true","MGBridge.call('listUserPresets')","execute('captureUserPreset'","execute('deleteUserPreset'","execute('exportUserPreset'"]) {
  if (!panel.includes(behavior)) failures.push(`CEP behavior missing: ${behavior}`);
}
for (const behavior of ["MGBridge.call('listTemplates')","execute('beginTemplateSave'","execute('importTemplate'","MGBridge.call('templateJobStatus'","childProcess.spawn","startTemplateWindowMonitor","showTemplateWorker","changePanel('templates')","renderTemplateCategories"]) {
  if (!panel.includes(behavior)) failures.push(`template UI behavior missing: ${behavior}`);
}
if (!panel.includes("name: '团队预设'") || !panel.includes('await loadUserPresets(false)')) failures.push('team library UI or focus refresh missing');
if (catalog.category('prerender')) failures.push('pre-render still appears as an efficiency-tool subcategory');
if (!panel.includes("panel === 'prerender'") || !panel.includes("$('prerender-workspace').hidden = panel !== 'prerender'")) failures.push('top-level pre-render workspace switching missing');
if (!css.includes('aspect-ratio:1')) failures.push('CEP cards are not constrained to squares');
if (!css.includes('.clear-preset-card')) failures.push('clear category card style missing');
if (!css.includes('.applied-bar') || !css.includes('.applied-remove')) failures.push('applied motion chip style missing');
if (!css.includes('.template-grid') || !css.includes('.template-card') || !css.includes('.template-job')) failures.push('template library styles missing');
if (!css.includes('object-fit:contain') || !css.includes('object-position:center')) failures.push('template thumbnails do not display the full frame');
if (!css.includes('.expression-code-block') || !css.includes('.prerender-panel')) failures.push('expression or pre-render styles missing');
for (const polling of ['setInterval(', 'function pollHost', 'pollTick']) if (panel.includes(polling)) failures.push(`idle polling returned: ${polling}`);
if (panel.includes('Atomics.wait')) failures.push('CEP-incompatible Atomics.wait returned');
if (!panel.includes('return new Promise(function (resolve)') || !panel.includes('setTimeout(check, 25)') || !panel.includes('await waitForWindowMonitorReady')) failures.push('non-blocking template monitor readiness check missing');
const host = fs.readFileSync(path.join(root,'extension/host/main.jsx'),'utf8');
for (const action of ['captureUserPreset','listUserPresets','deleteUserPreset','exportUserPreset','revealUserPresetFolder','appliedSummary']) if (!host.includes("action === '" + action + "'")) failures.push(`host action missing: ${action}`);
if (!host.includes("syncDeletedMarkers(comp, data.force === true)")) failures.push('forced focus cleanup missing');
if (!host.includes("TEAM_USER_PRESET_ROOT = 'Y:/项目素材/童话岛/Plug/MotionGraphics/动效预设'")) failures.push('team preset root mismatch');
if (host.includes("Folder.userData.fsName + '/MotionGraphics/UserPresetsV1'")) failures.push('local personal preset fallback returned');
const templateHost = fs.readFileSync(path.join(root,'extension/host/templates.jsx'),'utf8');
const templateWorker = fs.readFileSync(path.join(root,'extension/host/template-worker.jsx'),'utf8');
const expressionHost = fs.readFileSync(path.join(root,'extension/host/expressions.jsx'),'utf8');
const prerenderHost = fs.readFileSync(path.join(root,'extension/host/prerender.jsx'),'utf8');
for (const action of ['listTemplates','beginTemplateSave','templateJobStatus','ackTemplateJob','cancelTemplateJob','importTemplate','revealTemplateFolder']) if (!templateHost.includes("action === '" + action + "'")) failures.push(`template host action missing: ${action}`);
if (!templateHost.includes("TEAM_TEMPLATE_ROOT = 'Y:/项目素材/童话岛/Plug/MotionGraphics/合成模版'")) failures.push('team template root mismatch');
for (const behavior of ['reduceProject(keep)','saveFrameToPng','working.aepx','portable.aepx','rebaseAepx','duplicateReferencesRemoved','verifyRelink(resources)','template.aep','manifest.json',"File(destination.fsName + '/ready')"]) if (!templateWorker.includes(behavior)) failures.push(`template worker behavior missing: ${behavior}`);
for (const behavior of ['previewHasVisiblePixels','pngImageData','renderBlankPreview','mostActiveLayerTime','previewFallback','requestedPreviewTime']) if (!templateWorker.includes(behavior)) failures.push(`visible preview fallback missing: ${behavior}`);
if (!templateHost.includes('Math.max(0, Math.min(comp.time, comp.duration - comp.frameDuration))')) failures.push('host preview time is not zero-based');
if (!templateWorker.includes('var start = 0, end = comp.duration - comp.frameDuration')) failures.push('worker preview candidates are not zero-based');
if (!templateHost.includes('Folder.temp.fsName') || !templateHost.includes('MotionGraphicsTemplateJobs')) failures.push('template preparation is not staged locally');
if (!templateHost.includes("category: cleanCategory(data.category)") || !templateHost.includes('categories: categoryList')) failures.push('template category metadata missing');
if (!templateHost.includes("windowMonitor: windowMonitor.exists ? windowMonitor.fsName : ''")) failures.push('template window monitor is not returned to the CEP panel');
const templateWindowMonitor = fs.readFileSync(path.join(root,'extension/host/template-window-monitor.ps1'),'utf8');
if (!templateWindowMonitor.includes("[ValidateSet('Monitor', 'Show')]") || !templateWindowMonitor.includes('[MGTemplateWindow]::Set($targetPid, 0)') || !templateWindowMonitor.includes('$ExpectedPidFile')) failures.push('background AE window monitor is incomplete');
if (!panel.includes("'-File', monitorScript") || !panel.includes('windowMonitor: job.windowMonitor') || !panel.includes("fs.writeFileSync(expectedPidFile, String(child.pid), 'ascii')")) failures.push('CEP does not launch the packaged AE window monitor for its exact worker PID');
if (!panel.includes("['-noui', '-m', '-r', job.launchFile]")) failures.push('template worker is not launched in AE no-UI mode');
if (!templateWorker.includes('removeTree(Folder(job.staging))')) failures.push('template worker does not clean local staging');
if (/\bitem\.replace\s*\(|replaceWithSequence|setProxyWithSequence/.test(templateWorker)) failures.push('destructive footage replacement returned to template worker');
for (const action of ['listExpressions','saveExpression','deleteExpression','revealExpressionFolder']) if (!expressionHost.includes("action === '" + action + "'")) failures.push(`expression host action missing: ${action}`);
if (!expressionHost.includes("TEAM_ROOT = 'Y:/项目素材/童话岛/Plug/MotionGraphics/表达式库'")) failures.push('team expression root mismatch');
for (const action of ['prerenderStatus','prerenderTemplates','prerenderPreflight','prerenderRender','prerenderMode','prerenderUpdate','prerenderReturnCache']) if (!prerenderHost.includes(action)) failures.push(`pre-render host action missing: ${action}`);
const bridgeStatusSource = prerenderHost.slice(prerenderHost.indexOf('function bridgeStatus()'), prerenderHost.indexOf('function bridgeTemplates()'));
if (bridgeStatusSource.includes('outputTemplates(')) failures.push('pre-render status still touches the render queue');
if (!prerenderHost.includes('previousViewer.setActive()') || !panel.includes("execute('prerenderTemplates'") || !panel.includes('PRERENDER_TEMPLATE_CACHE')) failures.push('explicit output-template refresh, viewer restore, or template cache missing');
if (!panel.includes("now - state.lastCheck < 1500") || !panel.includes("state.panel === 'prerender'") || !panel.includes("state.category === 'expressions'")) failures.push('on-demand focus refresh optimization missing');
if (!fs.readFileSync(path.join(root,'extension/js/preview.js'),'utf8').includes('function schedule()')) failures.push('demand-driven preview scheduler missing');
const sampleUser = {id:'user-check-123456',category:'in',name:'Check',en:'USER CHECK',desc:'check',fields:['duration'],defaults:{duration:1},type:'ui',version:1,user:true,template:{duration:1,channels:{position:{keys:[{t:0,v:[1,0]},{t:1,v:[0,0]}]}}}};
if (catalog.registerUser([sampleUser]) !== 1 || catalog.find(sampleUser.id) !== sampleUser) failures.push('user preset registration failed');
catalog.registerUser([]);
if (catalog.presets.length !== 95) failures.push('user preset reset changed built-ins');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Structure OK · ${catalog.presets.filter(p=>p.type==='ui').length} UI presets · ${catalog.presets.filter(p=>p.type==='tools').length} tool actions`);
