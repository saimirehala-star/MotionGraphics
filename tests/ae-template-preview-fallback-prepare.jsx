// Stage 1: create a composition whose current time is an empty frame after all visible layers.
app.exitCode = 75;
app.exitAfterLaunchAndEval = true;
(function () {
    var root = File($.fileName).parent.parent, reportFile = File(root.fsName + '/test-results/ae-template-preview-fallback-prepare.json');
    $.evalFile(File(root.fsName + '/extension/vendor/json2.js'));
    var report = { version: app.version, safeInstance: false, passed: [], failed: [] };
    function assert(value, message) { if (!value) { throw new Error(message || 'assertion failed'); } }
    function readJSON(file) { file.encoding = 'UTF-8'; assert(file.exists && file.open('r'), 'cannot read ' + file.fsName); var data = JSON.parse(file.read()); file.close(); return data; }
    function writeJSON(file, data) { file.encoding = 'UTF-8'; assert(file.open('w'), 'cannot write ' + file.fsName); file.write(JSON.stringify(data, null, 2)); file.close(); }
    function removeTree(folder) { if (!folder.exists) { return; } var entries = folder.getFiles(), i; for (i = 0; i < entries.length; i++) { if (entries[i] instanceof Folder) { removeTree(entries[i]); } else { entries[i].remove(); } } folder.remove(); }
    try {
        assert(app.project && app.project.numItems === 0 && !app.project.file, 'Refusing nonempty project'); report.safeInstance = true;
        var runtime = Folder(root.fsName + '/test-results/preview-fallback-runtime'); removeTree(runtime); assert(runtime.create(), 'cannot create runtime');
        var library = Folder(runtime.fsName + '/library'); assert(library.create(), 'cannot create library');
        var main = app.project.items.addComp('MG PREVIEW FALLBACK', 720, 1280, 1, 4, 30); main.bgColor = [.31, .09, .47]; var solid = main.layers.addSolid([.18, .62, .94], 'VISIBLE ONLY AT START', 300, 300, 1, 4);
        solid.position.setValue([360, 640]); solid.outPoint = 1.5; main.time = main.duration - main.frameDuration; main.openInViewer();
        var sourceProject = File(runtime.fsName + '/source-project.aep'); app.project.save(sourceProject); assert(sourceProject.exists, 'source project was not saved');
        $.global.MotionGraphicsTemplateRoot = library.fsName; $.evalFile(File(root.fsName + '/extension/host/main.jsx')); assert(MG2023Host && MG2023Host.version === '2.2.0', 'host version mismatch');
        var started = MG2023Host.run({ action: 'beginTemplateSave', data: { name: '透明帧回退测试', description: '当前时间头位于空帧' } }, main); assert(started.ok && started.data && started.data.id, JSON.stringify(started));
        var job = readJSON(File(started.data.staging + '/job.json')); assert(job.previewTime > solid.outPoint, 'test current time is not an empty frame');
        report.passed.push('empty current-frame template job prepared'); report.job = started.data; report.runtime = runtime.fsName; report.library = library.fsName; report.requestedPreviewTime = job.previewTime; report.visibleOutPoint = solid.outPoint;
        app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); app.exitCode = 0;
    } catch (error) {
        report.failed.push({ name: 'prepare', message: error.message || String(error), line: error.line || 0, file: error.fileName || '' });
        try { if (app.project) { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } } catch (ignored) {}
    }
    writeJSON(reportFile, report);
}());
