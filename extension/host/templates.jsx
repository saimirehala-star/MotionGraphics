/* Motion Graphics composition template library for AE 2023. */
var MGTemplateHost = (function () {
    var TEMPLATE_SCHEMA = 2;
    var TEMPLATE_PREFIX = 'tpl-';
    var TEAM_TEMPLATE_ROOT = 'Y:/项目素材/童话岛/Plug/MotionGraphics/合成模版';
    var TEMPLATE_TAG = '[MotionGraphicsTemplate:';

    function fail(message) { throw new Error(message); }
    function validId(id) { return typeof id === 'string' && /^tpl-[a-z0-9-]{6,80}$/.test(id); }
    function cleanText(value, fallback, max) {
        var text = String(value === undefined || value === null ? '' : value).replace(/[\r\n\t]/g, ' ').replace(/^\s+|\s+$/g, '');
        if (!text) { text = fallback; } return text.substring(0, max);
    }
    function cleanCategory(value) { return cleanText(value, '未分类', 32).replace(/[\\\/:*?"<>|]/g, '·'); }
    function readText(file) {
        if (!file.exists) { fail('文件不存在：' + file.fsName); }
        file.encoding = 'UTF-8'; if (!file.open('r')) { fail('无法读取文件：' + file.error); }
        var text = file.read(); file.close(); return text;
    }
    function writeText(file, text) {
        file.encoding = 'UTF-8'; file.lineFeed = 'Unix'; if (!file.open('w')) { fail('无法写入文件：' + file.fsName + ' · ' + file.error); }
        var ok = file.write(text); file.close(); if (!ok) { fail('写入文件失败：' + file.fsName); }
    }
    function readJSON(file) { try { return JSON.parse(readText(file)); } catch (error) { fail('JSON 文件损坏：' + file.name + ' · ' + (error.message || error)); } }
    function writeJSON(file, data) { writeText(file, JSON.stringify(data, null, 2)); }
    function ensureFolder(folder, label) {
        if (!folder.exists && !folder.create()) { fail('无法创建' + label + '：' + folder.fsName); }
        return folder;
    }
    function setRoot(data) { if (data && data.folder !== undefined) { var value = String(data.folder || '').replace(/^\s+|\s+$/g, ''); if (value) { var probe = Folder(value); $.global.MotionGraphicsTemplateRoot = value; } } }
    function chooseRoot() { var selected = Folder.selectDialog('选择模板保存目录'); if (!selected) { return { ok:true, message:'已取消选择模板目录。', data:{cancelled:true} }; } $.global.MotionGraphicsTemplateRoot = selected.fsName; return { ok:true, message:'模板目录已设置。', data:{folder:selected.fsName} }; }
    function templateRoot() {
        var override = $.global.MotionGraphicsTemplateRoot;
        var folder = Folder(override ? override : TEAM_TEMPLATE_ROOT);
        if (!folder.exists) {
            if (!folder.parent.exists) { fail('团队模版目录的上级路径不可访问：' + folder.parent.fsName + '。请确认绿联云已连接并映射为 Y: 盘。'); }
            if (!folder.create()) { fail('无法创建团队模版目录：' + folder.fsName); }
        }
        return folder;
    }
    function jobsRoot(root) { return ensureFolder(Folder(root.fsName + '/.jobs'), '模版任务目录'); }
    function templateFolder(id) {
        if (!validId(id)) { fail('模版 ID 无效。'); }
        return Folder(templateRoot().fsName + '/' + id);
    }
    function manifestRecord(folder) {
        var ready = File(folder.fsName + '/ready'), project = File(folder.fsName + '/template.aep'), manifestFile = File(folder.fsName + '/manifest.json');
        if (!ready.exists || !project.exists || !manifestFile.exists) { fail('模版文件不完整。'); }
        var data = readJSON(manifestFile);
        if ((Number(data.schemaVersion) !== 1 && Number(data.schemaVersion) !== TEMPLATE_SCHEMA) || !validId(data.id) || data.id !== folder.name) { fail('模版清单格式无效。'); }
        var previewName = String(data.preview || ''), previewFile = previewName ? File(folder.fsName + '/' + previewName) : null;
        return {
            schemaVersion: Number(data.schemaVersion), id: data.id, name: cleanText(data.name, '未命名模版', 64), category: cleanCategory(data.category), description: cleanText(data.description, '', 200),
            createdAt: String(data.createdAt || ''), createdAtEpoch: Number(data.createdAtEpoch || 0), aeVersion: String(data.aeVersion || ''), mainCompName: String(data.mainCompName || ''),
            width: Number(data.width || 0), height: Number(data.height || 0), duration: Number(data.duration || 0), frameRate: Number(data.frameRate || 0),
            resourceCount: Number(data.resourceCount || 0), resourceBytes: Number(data.resourceBytes || 0), warnings: data.warnings instanceof Array ? data.warnings : [],
            preview: previewFile && previewFile.exists ? previewFile.fsName : '', project: project.fsName, folder: folder.fsName
        };
    }
    function listTemplates() {
        var root = templateRoot(), entries = root.getFiles(), templates = [], skipped = [], categories = {}, categoryList = [], i, item, name;
        for (i = 0; i < entries.length; i++) {
            if (!(entries[i] instanceof Folder) || !validId(entries[i].name)) { continue; }
            if (!File(entries[i].fsName + '/ready').exists) { continue; }
            try { item = manifestRecord(entries[i]); templates.push(item); categories[item.category] = Number(categories[item.category] || 0) + 1; }
            catch (error) { skipped.push(entries[i].name + '：' + (error.message || error)); }
        }
        templates.sort(function (a, b) { return b.createdAtEpoch - a.createdAtEpoch || (a.name < b.name ? -1 : 1); });
        for (name in categories) { if (categories.hasOwnProperty(name)) { categoryList.push({ name: name, count: categories[name] }); } }
        categoryList.sort(function (a, b) { if (a.name === '未分类') { return 1; } if (b.name === '未分类') { return -1; } return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); });
        return { ok: true, message: templates.length ? '已读取 ' + templates.length + ' 个合成模版。' : '团队目录还没有合成模版。', data: { templates: templates, categories: categoryList, skipped: skipped, folder: root.fsName } };
    }
    function afterEffectsCommand() {
        return MGCompatibility.command();
    }
    function safeRemoveFile(file) { try { if (file.exists) { file.remove(); } } catch (ignored) { /* Keep the original failure. */ } }
    function removeTree(folder) { if (!folder || !folder.exists) { return; } var entries = folder.getFiles(), i; for (i = 0; i < entries.length; i++) { if (entries[i] instanceof Folder) { removeTree(entries[i]); } else { entries[i].remove(); } } folder.remove(); }
    function localJobsRoot() { return ensureFolder(Folder(Folder.temp.fsName + '/MotionGraphicsTemplateJobs'), '本地模版任务目录'); }
    function beginSave(comp, data) {
        if (!comp || !(comp instanceof CompItem)) { fail('请先打开要保存的合成。'); }
        if (!app.project.file) { fail('当前工程还没有保存。请先保存工程，再保存合成模版。'); }
        var savedCurrent = false;
        if (app.project.dirty) { app.project.save(); savedCurrent = true; }
        if (app.project.dirty) { fail('当前工程未能保存，请先手动保存后重试。'); }
        var root = templateRoot(), jobs = jobsRoot(root), id = TEMPLATE_PREFIX + new Date().getTime().toString(36) + '-' + Math.floor(Math.random() * 2147483647).toString(36);
        var destination = Folder(root.fsName + '/' + id); if (destination.exists) { fail('团队模版目录出现 ID 冲突，请重试。'); }
        var staging = Folder(localJobsRoot().fsName + '/' + id); if (staging.exists || !staging.create()) { fail('无法创建本地模版任务目录。'); }
        var source = File(staging.fsName + '/source.aep'), launch = File(staging.fsName + '/launch.jsx'), jobFile = File(staging.fsName + '/job.json'), statusFile = File(jobs.fsName + '/' + id + '.json');
        try {
            if (!app.project.file.copy(source.fsName)) { fail('无法复制当前工程：' + app.project.file.error); }
            var worker = File(MGRoot.fsName + '/host/template-worker.jsx'); if (!worker.exists) { fail('合成模版工作脚本缺失。'); }
            var previewTime = Math.max(0, Math.min(comp.time, comp.duration - comp.frameDuration));
            var job = {
                sourceAEVersion: app.version, schemaVersion: TEMPLATE_SCHEMA, id: id, name: cleanText(data.name, comp.name, 64), category: cleanCategory(data.category), description: cleanText(data.description, '', 200),
                root: root.fsName, staging: staging.fsName, destination: destination.fsName, sourceProject: source.fsName, statusFile: statusFile.fsName,
                compId: comp.id, compName: comp.name, previewTime: previewTime, previewDisplayTime: previewTime + comp.displayStartTime, worker: worker.fsName, createdAt: new Date().toUTCString(), createdAtEpoch: new Date().getTime()
            };
            writeJSON(jobFile, job);
            writeJSON(statusFile, { schemaVersion: TEMPLATE_SCHEMA, id: id, state: 'queued', progress: 3, message: '正在启动独立 AE 工作进程…' });
            writeText(launch, 'app.exitCode = 90;\napp.exitAfterLaunchAndEval = true;\n$.global.MGTemplateJobFile = ' + JSON.stringify(jobFile.fsName) + ';\n$.evalFile(File(' + JSON.stringify(worker.fsName) + '));\n');
            var windowMonitor = File(MGRoot.fsName + '/host/template-window-monitor.ps1');
            return { ok: true, message: '已创建本地模版任务。' + (savedCurrent ? '当前工程已先保存。' : ''), data: { id: id, command: afterEffectsCommand().fsName, launchFile: launch.fsName, statusFile: statusFile.fsName, staging: staging.fsName, windowMonitor: windowMonitor.exists ? windowMonitor.fsName : '', savedCurrentProject: savedCurrent } };
        } catch (error) {
            safeRemoveFile(source); safeRemoveFile(launch); safeRemoveFile(jobFile); safeRemoveFile(statusFile); try { staging.remove(); } catch (ignored) { /* Best effort. */ }
            throw error;
        }
    }
    function jobStatus(data) {
        var id = String(data.id || ''); if (!validId(id)) { fail('模版任务 ID 无效。'); }
        var file = File(jobsRoot(templateRoot()).fsName + '/' + id + '.json'); if (!file.exists) { return { ok: true, message: '正在等待后台工作进程…', data: { id: id, state: 'queued', progress: 2 } }; }
        var status = readJSON(file); return { ok: status.state !== 'error', message: status.message || '', data: status };
    }
    function acknowledgeJob(data) {
        var id = String(data.id || ''); if (!validId(id)) { fail('模版任务 ID 无效。'); }
        var file = File(jobsRoot(templateRoot()).fsName + '/' + id + '.json'); if (file.exists) { file.remove(); }
        return { ok: true, message: '模版任务已结束。', data: { id: id } };
    }
    function cancelJob(data) {
        var id = String(data.id || ''); if (!validId(id)) { fail('模版任务 ID 无效。'); }
        var folder = templateFolder(id); if (File(folder.fsName + '/ready').exists) { fail('已完成的合成模版不能作为临时任务清理。'); }
        if (folder.exists) { removeTree(folder); }
        var base = localJobsRoot(), staging = Folder(base.fsName + '/' + id);
        if (staging.exists) {
            if (staging.name !== id || staging.parent.fsName.toLowerCase() !== base.fsName.toLowerCase()) { fail('本地模版任务路径无效。'); }
            removeTree(staging);
        }
        var statusFile = File(jobsRoot(templateRoot()).fsName + '/' + id + '.json'); if (statusFile.exists) { statusFile.remove(); }
        return { ok: true, message: '未启动的模版任务已清理。', data: { id: id } };
    }
    function findImportedTemplate(id) {
        var tag = TEMPLATE_TAG + id + ']', i, item;
        for (i = 1; i <= app.project.numItems; i++) { item = app.project.item(i); if (item instanceof CompItem && String(item.comment || '').indexOf(tag) >= 0) { return item; } }
        return null;
    }
    function importTemplate(comp, data) {
        if (!comp || !(comp instanceof CompItem)) { fail('请先打开要放入模版的目标合成。'); }
        var id = String(data.id || ''), folder = templateFolder(id), record = manifestRecord(folder), mainComp = findImportedTemplate(id), reused = !!mainComp, importedRoot = null, i, before = {}, item, namedFallback = null, tag = TEMPLATE_TAG + id + ']';
        if (!mainComp) { MGCompatibility.checkTemplate(record.aeVersion, app.version); }
        app.beginUndoGroup('Motion Graphics · 导入合成模版');
        try {
            if (!mainComp) {
                for (i = 1; i <= app.project.numItems; i++) { before[app.project.item(i).id] = true; }
                importedRoot = app.project.importFile(new ImportOptions(File(record.project)));
                for (i = 1; i <= app.project.numItems; i++) {
                    item = app.project.item(i);
                    if (!before[item.id] && item instanceof CompItem) {
                        if (String(item.comment || '').indexOf(tag) >= 0) { mainComp = item; break; }
                        if (!namedFallback && item.name === record.mainCompName) { namedFallback = item; }
                    }
                }
                if (!mainComp) { mainComp = namedFallback; }
                if (!mainComp) { fail('模版工程已导入，但没有找到主合成：' + record.mainCompName); }
                mainComp.comment = String(mainComp.comment || '') + '\n' + TEMPLATE_TAG + id + ']';
            }
            var layer = comp.layers.add(mainComp); layer.startTime = comp.time; layer.name = record.name;
            return { ok: true, message: (reused ? '已复用工程中的模版并添加到当前合成。' : '已导入模版并添加到当前合成。'), data: { id: id, compName: mainComp.name, layerName: layer.name, reused: reused } };
        } finally { app.endUndoGroup(); }
    }
    function revealRoot() {
        var folder = templateRoot(); if (!folder.execute()) { fail('无法打开团队模版目录。'); }
        return { ok: true, message: '已打开团队模版目录。', data: { folder: folder.fsName } };
    }
    function handles(action) { return action === 'listTemplates' || action === 'beginTemplateSave' || action === 'templateJobStatus' || action === 'ackTemplateJob' || action === 'cancelTemplateJob' || action === 'importTemplate' || action === 'revealTemplateFolder' || action === 'chooseTemplateFolder'; }
    function run(action, data, comp) {
        if (action === 'chooseTemplateFolder') { return chooseRoot(); }
        setRoot(data);
        if (action === 'listTemplates') { return listTemplates(); }
        if (action === 'beginTemplateSave') { return beginSave(comp, data || {}); }
        if (action === 'templateJobStatus') { return jobStatus(data || {}); }
        if (action === 'ackTemplateJob') { return acknowledgeJob(data || {}); }
        if (action === 'cancelTemplateJob') { return cancelJob(data || {}); }
        if (action === 'importTemplate') { return importTemplate(comp, data || {}); }
        if (action === 'revealTemplateFolder') { return revealRoot(); }
        fail('未知的合成模版操作。');
    }
    return { handles: handles, run: run, root: templateRoot, version: '1.2.0' };
}());
