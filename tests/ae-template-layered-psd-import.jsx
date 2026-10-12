// Stage 2: import the layered PSD package and compare its internal graph with the source project.
app.exitCode = 74;
app.exitAfterLaunchAndEval = true;
(function () {
    var root = File($.fileName).parent.parent, prepareFile = File(root.fsName + '/test-results/ae-template-layered-psd-prepare.json'), reportFile = File(root.fsName + '/test-results/ae-template-layered-psd.json');
    $.evalFile(File(root.fsName + '/extension/vendor/json2.js'));
    var report = { version: app.version, safeInstance: false, passed: [], failed: [] }, prepare = null;
    function assert(value, message) { if (!value) { throw new Error(message || 'assertion failed'); } }
    function readJSON(file) { file.encoding = 'UTF-8'; assert(file.exists && file.open('r'), 'cannot read ' + file.fsName); var data = JSON.parse(file.read()); file.close(); return data; }
    function writeJSON(file, data) { file.encoding = 'UTF-8'; assert(file.open('w'), 'cannot write ' + file.fsName); file.write(JSON.stringify(data, null, 2)); file.close(); }
    function removeTree(folder) { if (!folder.exists) { return; } var entries = folder.getFiles(), i; for (i = 0; i < entries.length; i++) { if (entries[i] instanceof Folder) { removeTree(entries[i]); } else { entries[i].remove(); } } folder.remove(); }
    function countFiles(folder) { var entries = folder.getFiles(), total = 0, i; for (i = 0; i < entries.length; i++) { total += entries[i] instanceof Folder ? countFiles(entries[i]) : 1; } return total; }
    function sortRecords(records) { records.sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : (a.width - b.width || a.height - b.height)); }); }
    function recordsEqual(a, b) { if (a.length !== b.length) { return false; } for (var i = 0; i < a.length; i++) { if (a[i].name !== b[i].name || a[i].width !== b[i].width || a[i].height !== b[i].height) { return false; } } return true; }
    try {
        assert(app.project && app.project.numItems === 0 && !app.project.file, 'Refusing nonempty project'); report.safeInstance = true;
        prepare = readJSON(prepareFile); assert(!prepare.failed.length && prepare.job && prepare.library, 'prepare stage failed');
        $.global.MotionGraphicsTemplateRoot = prepare.library; $.evalFile(File(root.fsName + '/extension/host/main.jsx'));
        var status = MG2023Host.run({ action: 'templateJobStatus', data: { id: prepare.job.id } }, null); assert(status.ok && status.data.state === 'done', JSON.stringify(status));
        MG2023Host.run({ action: 'ackTemplateJob', data: { id: prepare.job.id } }, null);
        var listed = MG2023Host.run({ action: 'listTemplates', data: {} }, null); assert(listed.ok && listed.data.templates.length === 1, JSON.stringify(listed));
        var record = listed.data.templates[0], folder = Folder(record.folder), resources = Folder(folder.fsName + '/Resources'), manifest = readJSON(File(folder.fsName + '/manifest.json'));
        assert(File(folder.fsName + '/preview.png').exists && File(folder.fsName + '/preview.png').length > 0, 'static preview missing');
        assert(manifest.previewFallback === false && Math.abs(manifest.previewTime - manifest.requestedPreviewTime) < .001, 'visible PSD preview frame was unnecessarily replaced');
        assert(countFiles(resources) === 1 && manifest.resourceCount === 1, 'layered PSD was copied more than once');
        assert(manifest.resourceBytes === prepare.sourcePsdBytes, 'copied byte count does not match one PSD file');
        assert(manifest.sourceItemCount === prepare.footage.length && manifest.uniqueAssetCount === 1, 'PSD references were not deduplicated');
        assert(manifest.duplicateReferencesRemoved === prepare.footage.length - 1 && manifest.rebasedReferenceCount >= prepare.footage.length, 'PSD reference accounting mismatch');
        report.passed.push('one physical PSD copy serves every imported PSD sublayer');

        var target = app.project.items.addComp('MG PSD IMPORT TARGET', 1920, 1080, 1, 8, 25); target.time = 1.5; target.openInViewer();
        var imported = MG2023Host.run({ action: 'importTemplate', data: { id: record.id } }, target); assert(imported.ok && !imported.data.reused, JSON.stringify(imported));
        var importedMain = target.layer(1).source; assert(importedMain instanceof CompItem && importedMain.name === 'MG LAYERED PSD MAIN', 'main composition relationship changed');
        var nestedLayer = importedMain.layer(1); assert(nestedLayer && nestedLayer.source instanceof CompItem && nestedLayer.source.name === 'MG PSD SOURCE COMP', 'nested PSD composition relationship changed');
        assert(nestedLayer.transform.position.numKeys === 2, 'nested composition animation keyframes changed');
        var importedPsdComp = nestedLayer.source; assert(importedPsdComp.numLayers === prepare.psdCompLayerCount, 'PSD composition layer count changed');
        for (var layerIndex = 1; layerIndex <= importedPsdComp.numLayers; layerIndex++) {
            var actualLayer = importedPsdComp.layer(layerIndex), expectedLayer = prepare.psdLayers[layerIndex - 1], actualSource = actualLayer.source;
            assert(actualLayer.name === expectedLayer.name && actualSource && actualSource.name === expectedLayer.sourceName && actualSource.width === expectedLayer.width && actualSource.height === expectedLayer.height, 'PSD layer identity changed at layer ' + layerIndex);
        }
        var importedFootage = [], allInside = true;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof FootageItem && item.file) {
                if (item.file.fsName.toLowerCase().indexOf(resources.fsName.toLowerCase() + '\\') !== 0) { allInside = false; }
                importedFootage.push({ name: item.name, width: item.width, height: item.height });
            }
        }
        sortRecords(importedFootage); assert(allInside, 'imported PSD points outside the template package'); assert(recordsEqual(importedFootage, prepare.footage), 'PSD sublayer names or dimensions changed');
        report.passed.push('PSD sublayer identities, dimensions, precomp graph, and keyframes are preserved');
        report.template = { id: record.id, resourceCount: manifest.resourceCount, sourceItemCount: manifest.sourceItemCount, duplicateReferencesRemoved: manifest.duplicateReferencesRemoved, rebasedReferenceCount: manifest.rebasedReferenceCount, previewBytes: File(folder.fsName + '/preview.png').length };
        app.exitCode = 0;
    } catch (error) { report.failed.push({ name: 'import', message: error.message || String(error), line: error.line || 0, file: error.fileName || '' }); }
    try { if (app.project) { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } } catch (ignored) {}
    if (!report.failed.length && prepare && prepare.runtime) {
        try {
            var testRoot = Folder(root.fsName + '/test-results'), runtime = Folder(prepare.runtime), prefix = testRoot.fsName.toLowerCase() + '\\';
            assert(runtime.name === 'layered-psd-runtime' && runtime.fsName.toLowerCase().indexOf(prefix) === 0, 'unsafe runtime cleanup path'); removeTree(runtime); assert(!runtime.exists, 'runtime cleanup failed'); if (prepareFile.exists) { prepareFile.remove(); } report.cleanedRuntime = true;
        } catch (cleanupError) { report.failed.push({ name: 'cleanup', message: cleanupError.message || String(cleanupError), line: cleanupError.line || 0 }); }
    }
    writeJSON(reportFile, report);
}());
