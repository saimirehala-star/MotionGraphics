// Stage 1: create an isolated source project and ask the host to prepare a template worker job.
app.exitCode = 71;
app.exitAfterLaunchAndEval = true;
(function () {
    var root = File($.fileName).parent.parent, reportFile = File(root.fsName + '/test-results/ae-template-prepare.json');
    $.evalFile(File(root.fsName + '/extension/vendor/json2.js'));
    var report = { version: app.version, safeInstance: false, passed: [], failed: [] };
    function assert(value, message) { if (!value) { throw new Error(message || 'assertion failed'); } }
    function writeJSON(file, data) { file.encoding = 'UTF-8'; assert(file.open('w'), 'cannot write ' + file.fsName); file.write(JSON.stringify(data, null, 2)); file.close(); }
    function removeTree(folder) {
        if (!folder.exists) { return; } var entries = folder.getFiles(), i;
        for (i = 0; i < entries.length; i++) { if (entries[i] instanceof Folder) { removeTree(entries[i]); } else { entries[i].remove(); } }
        folder.remove();
    }
    function importStill(file, name) { var item = app.project.importFile(new ImportOptions(file)); item.name = name; return item; }
    function importSequence(file, name) { var options = new ImportOptions(file); options.sequence = true; var item = app.project.importFile(options); item.name = name; return item; }
    function waitForFile(file, timeout) { var until = new Date().getTime() + timeout; while (new Date().getTime() < until) { if (file.exists && file.length > 0) { return true; } $.sleep(100); } return file.exists && file.length > 0; }
    try {
        assert(app.project && app.project.numItems === 0 && !app.project.file, 'Refusing nonempty project'); report.safeInstance = true;
        var runtime = Folder(root.fsName + '/test-results/template-runtime'); removeTree(runtime); assert(runtime.create(), 'cannot create runtime');
        var assets = Folder(runtime.fsName + '/assets'), library = Folder(runtime.fsName + '/library'); assert(assets.create() && library.create(), 'cannot create test folders');

        var generator = app.project.items.addComp('MG PNG GENERATOR', 320, 180, 1, 1, 25); generator.layers.addSolid([.24, .52, .92], 'BLUE', 320, 180, 1, 1);
        var sourcePng = File(assets.fsName + '/source.png'); generator.saveFrameToPng(0, sourcePng); assert(waitForFile(sourcePng, 10000), 'saveFrameToPng did not create source asset');
        for (var frame = 1; frame <= 3; frame++) { var frameFile = File(assets.fsName + '/sequence_000' + frame + '.png'); assert(sourcePng.copy(frameFile.fsName), 'cannot create sequence frame ' + frame); }
        var unusedPng = File(assets.fsName + '/unused.png'); assert(sourcePng.copy(unusedPng.fsName), 'cannot create unused file'); generator.remove();

        var still = importStill(sourcePng, 'MG USED STILL');
        var sequence = importSequence(File(assets.fsName + '/sequence_0001.png'), 'MG USED SEQUENCE');
        var unusedFootage = importStill(unusedPng, 'MG UNUSED FOOTAGE');
        var nested = app.project.items.addComp('MG NESTED', 320, 180, 1, 3, 25); nested.layers.addSolid([.95, .42, .18], 'NESTED SOLID', 120, 80, 1, 3);
        var expressionDependency = app.project.items.addComp('MG EXPR DEP', 320, 180, 1, 3, 25); expressionDependency.layers.addSolid([.4, .9, .55], 'EXPR SOLID', 80, 80, 1, 3);
        var unusedComp = app.project.items.addComp('MG UNUSED COMP', 320, 180, 1, 3, 25); unusedComp.layers.add(unusedFootage);
        var main = app.project.items.addComp('MG TEMPLATE MAIN', 640, 360, 1, 4, 25);
        main.layers.add(still); main.layers.add(sequence); main.layers.add(nested);
        var expressionLayer = main.layers.addSolid([1, 1, 1], 'EXPRESSION LINK', 40, 40, 1, 4);
        expressionLayer.transform.opacity.expression = 'comp("MG EXPR DEP").layer(1).transform.opacity';
        main.time = 1.2; main.openInViewer();

        var sourceProject = File(runtime.fsName + '/source-project.aep'); app.project.save(sourceProject); assert(sourceProject.exists, 'source project was not saved');
        $.global.MotionGraphicsTemplateRoot = library.fsName; $.evalFile(File(root.fsName + '/extension/host/main.jsx'));
        assert(MG2023Host && MG2023Host.version === '2.2.0', 'host version mismatch');
        var started = MG2023Host.run({ action: 'beginTemplateSave', data: { name: '测试合成模版', category: '标题包装', description: '静帧、嵌套合成、表达式依赖与图片序列' } }, main);
        assert(started.ok && started.data && started.data.id && File(started.data.launchFile).exists, JSON.stringify(started));
        report.passed.push('isolated source project and template job prepared'); report.job = started.data; report.runtime = runtime.fsName; report.library = library.fsName; report.sourceProject = sourceProject.fsName;
        app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); app.exitCode = 0;
    } catch (error) {
        report.failed.push({ name: 'prepare', message: error.message || String(error), line: error.line || 0, file: error.fileName || '' });
        try { if (app.project) { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } } catch (ignored) { /* exit */ }
    }
    writeJSON(reportFile, report);
}());
