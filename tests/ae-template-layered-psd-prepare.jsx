// Stage 1: prepare a template job containing repeated sublayer references to one layered PSD.
app.exitCode = 73;
app.exitAfterLaunchAndEval = true;
(function () {
    var root = File($.fileName).parent.parent, reportFile = File(root.fsName + '/test-results/ae-template-layered-psd-prepare.json');
    $.evalFile(File(root.fsName + '/extension/vendor/json2.js'));
    var report = { version: app.version, safeInstance: false, passed: [], failed: [], footage: [], psdLayers: [] };
    function assert(value, message) { if (!value) { throw new Error(message || 'assertion failed'); } }
    function writeJSON(file, data) { file.encoding = 'UTF-8'; assert(file.open('w'), 'cannot write ' + file.fsName); file.write(JSON.stringify(data, null, 2)); file.close(); }
    function removeTree(folder) { if (!folder.exists) { return; } var entries = folder.getFiles(), i; for (i = 0; i < entries.length; i++) { if (entries[i] instanceof Folder) { removeTree(entries[i]); } else { entries[i].remove(); } } folder.remove(); }
    function sortRecords(records) { records.sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : (a.width - b.width || a.height - b.height)); }); }
    try {
        assert(app.project && app.project.numItems === 0 && !app.project.file, 'Refusing nonempty project'); report.safeInstance = true;
        var testResults = Folder(root.fsName + '/test-results'), runtime = Folder(testResults.fsName + '/layered-psd-runtime'); removeTree(runtime); assert(runtime.create(), 'cannot create runtime');
        removeTree(Folder(testResults.fsName + '/aepx-probe')); var oldProbe = File(testResults.fsName + '/sequence-probe.aepx'); if (oldProbe.exists) { oldProbe.remove(); }
        var library = Folder(runtime.fsName + '/library'); assert(library.create(), 'cannot create library');
        var fixturePath = $.getenv('MG_LAYERED_PSD') || 'E:/project/video/260828_童话岛_插件测试/AE/Test/(素材)/进度条.aep/进度条 个图层/进度条.psd';
        var sourcePsd = File(fixturePath); assert(sourcePsd.exists, 'layered PSD fixture is unavailable');
        var options = new ImportOptions(sourcePsd); assert(options.canImportAs(ImportAsType.COMP_CROPPED_LAYERS), 'PSD cannot import as cropped layers'); options.importAs = ImportAsType.COMP_CROPPED_LAYERS;
        var psdComp = app.project.importFile(options); assert(psdComp instanceof CompItem, 'PSD import did not create a composition'); psdComp.name = 'MG PSD SOURCE COMP';
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof FootageItem && item.file && item.file.fsName.toLowerCase() === sourcePsd.fsName.toLowerCase()) { report.footage.push({ name: item.name, width: item.width, height: item.height }); }
        }
        assert(report.footage.length > 1, 'layered PSD did not create multiple footage items'); sortRecords(report.footage);
        for (i = 1; i <= psdComp.numLayers; i++) {
            var psdLayer = psdComp.layer(i), psdSource = psdLayer.source;
            report.psdLayers.push({ name: psdLayer.name, sourceName: psdSource ? psdSource.name : '', width: psdSource ? psdSource.width : 0, height: psdSource ? psdSource.height : 0 });
        }
        var main = app.project.items.addComp('MG LAYERED PSD MAIN', psdComp.width, psdComp.height, 1, 4, 25), nestedLayer = main.layers.add(psdComp), position = nestedLayer.transform.position;
        nestedLayer.name = 'NESTED PSD RELATION'; position.setValueAtTime(0, [main.width * .45, main.height * .5]); position.setValueAtTime(1, [main.width * .5, main.height * .5]);
        main.time = .5; main.openInViewer();
        var sourceProject = File(runtime.fsName + '/source-project.aep'); app.project.save(sourceProject); assert(sourceProject.exists, 'source project was not saved');
        $.global.MotionGraphicsTemplateRoot = library.fsName; $.evalFile(File(root.fsName + '/extension/host/main.jsx')); assert(MG2023Host && MG2023Host.version === '2.2.0', 'host version mismatch');
        var started = MG2023Host.run({ action: 'beginTemplateSave', data: { name: '分层 PSD 模版测试', description: '验证去重、预合成关系和关键帧' } }, main);
        assert(started.ok && started.data && started.data.id && File(started.data.launchFile).exists, JSON.stringify(started));
        report.passed.push('layered PSD template job prepared'); report.job = started.data; report.runtime = runtime.fsName; report.library = library.fsName; report.sourceProject = sourceProject.fsName; report.sourcePsd = sourcePsd.fsName; report.sourcePsdBytes = sourcePsd.length; report.psdCompLayerCount = psdComp.numLayers;
        app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); app.exitCode = 0;
    } catch (error) {
        report.failed.push({ name: 'prepare', message: error.message || String(error), line: error.line || 0, file: error.fileName || '' });
        try { if (app.project) { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } } catch (ignored) {}
    }
    writeJSON(reportFile, report);
}());
