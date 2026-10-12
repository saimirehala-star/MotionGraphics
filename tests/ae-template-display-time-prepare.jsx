// Stage 1: reproduce a real composition whose displayed timecode starts at 4:05 while AE's internal time starts at zero.
app.exitCode = 82; app.exitAfterLaunchAndEval = true;
(function () {
    var root = File($.fileName).parent.parent, reportFile = File(root.fsName + '/test-results/ae-template-display-time-prepare.json');
    $.evalFile(File(root.fsName + '/extension/vendor/json2.js'));
    var report = { version: app.version, safeInstance: false, passed: [], failed: [] };
    function assert(value, message) { if (!value) { throw new Error(message || 'assertion failed'); } }
    function readJSON(file) { file.encoding = 'UTF-8'; assert(file.exists && file.open('r'), 'cannot read ' + file.fsName); var data = JSON.parse(file.read()); file.close(); return data; }
    function writeJSON(file, data) { file.encoding = 'UTF-8'; assert(file.open('w'), 'cannot write ' + file.fsName); file.write(JSON.stringify(data, null, 2)); file.close(); }
    function removeTree(folder) { if (!folder.exists) { return; } var entries = folder.getFiles(), i; for (i = 0; i < entries.length; i++) { if (entries[i] instanceof Folder) { removeTree(entries[i]); } else { entries[i].remove(); } } folder.remove(); }
    function findComp(name) { for (var i = 1; i <= app.project.numItems; i++) { var item = app.project.item(i); if (item instanceof CompItem && item.name === name) { return item; } } return null; }
    function activeLayers(comp, time) { var count = 0; for (var i = 1; i <= comp.numLayers; i++) { var layer = comp.layer(i); if (layer.enabled && layer.hasVideo && !layer.nullLayer && time >= layer.inPoint && time < layer.outPoint) { count++; } } return count; }
    try {
        assert(app.project && app.project.numItems === 0 && !app.project.file, 'Refusing nonempty project'); report.safeInstance = true;
        var results = Folder(root.fsName + '/test-results'), diagnostics = results.getFiles('inspect-*'), d; for (d = 0; d < diagnostics.length; d++) { if (diagnostics[d] instanceof File) { diagnostics[d].remove(); } }
        var sourceInspection = File(results.fsName + '/preview-project-inspection.json'); if (sourceInspection.exists) { sourceInspection.remove(); }
        var runtime = Folder(results.fsName + '/display-time-runtime'); removeTree(runtime); assert(runtime.create(), 'cannot create runtime'); var library = Folder(runtime.fsName + '/library'); assert(library.create(), 'cannot create library');
        var sourcePath = $.getenv('MG_DISPLAY_TIME_AEP') || 'E:/project/video/260828_童话岛_插件测试/AE/测试3.aep', source = File(sourcePath), localProject = File(runtime.fsName + '/source-project.aep'); assert(source.exists && source.copy(localProject.fsName), 'cannot copy display-time project fixture');
        app.beginSuppressDialogs(); app.open(localProject); var comp = findComp('选择'); assert(comp, 'composition 选择 missing'); assert(comp.displayStartTime > comp.duration, 'fixture does not use an offset display timecode');
        var currentTime = comp.time, activeCount = activeLayers(comp, currentTime); assert(currentTime >= 0 && currentTime < comp.duration && activeCount > 0, 'saved current time has no active layers'); comp.openInViewer();
        $.global.MotionGraphicsTemplateRoot = library.fsName; $.evalFile(File(root.fsName + '/extension/host/main.jsx')); assert(MG2023Host && MG2023Host.version === '2.2.0', 'host version mismatch');
        var started = MG2023Host.run({ action: 'beginTemplateSave', data: { name: '显示时间码预览测试', description: '验证显示起始时间不参与内部取帧' } }, comp); assert(started.ok && started.data && started.data.id, JSON.stringify(started));
        var job = readJSON(File(started.data.staging + '/job.json')); assert(Math.abs(job.previewTime - currentTime) < .001, 'host confused display timecode with internal composition time');
        report.passed.push('host preserves zero-based AE composition time'); report.job = started.data; report.runtime = runtime.fsName; report.library = library.fsName; report.internalTime = currentTime; report.displayStartTime = comp.displayStartTime; report.displayedTime = currentTime + comp.displayStartTime; report.activeLayerCount = activeCount;
        app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); app.endSuppressDialogs(false); app.exitCode = 0;
    } catch (error) { report.failed.push({ name: 'prepare', message: error.message || String(error), line: error.line || 0, file: error.fileName || '' }); try { app.endSuppressDialogs(false); } catch (ignoredSuppress) {} try { if (app.project) { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } } catch (ignoredClose) {} }
    writeJSON(reportFile, report);
}());
