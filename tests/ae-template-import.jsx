// Stage 2: import the finished package in another isolated project and verify reuse and dependencies.
app.exitCode = 72;
app.exitAfterLaunchAndEval = true;
(function () {
    var root = File($.fileName).parent.parent, prepareFile = File(root.fsName + '/test-results/ae-template-prepare.json'), reportFile = File(root.fsName + '/test-results/ae-template-e2e.json');
    $.evalFile(File(root.fsName + '/extension/vendor/json2.js'));
    var report = { version: app.version, safeInstance: false, passed: [], failed: [] };
    function assert(value, message) { if (!value) { throw new Error(message || 'assertion failed'); } }
    function near(a, b, tolerance, message) { assert(Math.abs(a - b) <= tolerance, (message || 'values differ') + ': ' + a + ' / ' + b); }
    function readJSON(file) { file.encoding = 'UTF-8'; assert(file.exists && file.open('r'), 'cannot read ' + file.fsName); var data = JSON.parse(file.read()); file.close(); return data; }
    function writeJSON(file, data) { file.encoding = 'UTF-8'; assert(file.open('w'), 'cannot write ' + file.fsName); file.write(JSON.stringify(data, null, 2)); file.close(); }
    function countFiles(folder) { var entries = folder.getFiles(), total = 0, i; for (i = 0; i < entries.length; i++) { total += entries[i] instanceof Folder ? countFiles(entries[i]) : 1; } return total; }
    function removeTree(folder) { if (!folder.exists) { return; } var entries = folder.getFiles(), i; for (i = 0; i < entries.length; i++) { if (entries[i] instanceof Folder) { removeTree(entries[i]); } else { entries[i].remove(); } } folder.remove(); }
    var prepare = null;
    try {
        assert(app.project && app.project.numItems === 0 && !app.project.file, 'Refusing nonempty project'); report.safeInstance = true;
        prepare = readJSON(prepareFile); assert(!prepare.failed.length && prepare.job && prepare.library, 'prepare stage failed');
        $.global.MotionGraphicsTemplateRoot = prepare.library; $.evalFile(File(root.fsName + '/extension/host/main.jsx'));
        var completedJob = MG2023Host.run({ action: 'templateJobStatus', data: { id: prepare.job.id } }, null); assert(completedJob.ok && completedJob.data.state === 'done' && completedJob.data.progress === 100, JSON.stringify(completedJob));
        var acknowledged = MG2023Host.run({ action: 'ackTemplateJob', data: { id: prepare.job.id } }, null); assert(acknowledged.ok && !File(prepare.job.statusFile).exists, JSON.stringify(acknowledged));
        var listed = MG2023Host.run({ action: 'listTemplates', data: {} }, null); assert(listed.ok && listed.data.templates.length === 1, JSON.stringify(listed));
        assert(listed.data.categories.length === 1 && listed.data.categories[0].name === '标题包装' && listed.data.categories[0].count === 1, 'template category index mismatch');
        var record = listed.data.templates[0], folder = Folder(record.folder), resources = Folder(folder.fsName + '/Resources'), manifest = readJSON(File(folder.fsName + '/manifest.json'));
        assert(record.id === prepare.job.id && record.name === '测试合成模版' && record.category === '标题包装' && manifest.category === '标题包装', 'template manifest identity mismatch');
        assert(File(folder.fsName + '/template.aep').exists && File(folder.fsName + '/manifest.json').exists && File(folder.fsName + '/ready').exists, 'completed package files missing');
        assert(File(folder.fsName + '/preview.png').exists, 'static preview missing');
        assert(manifest.previewFallback === false && Math.abs(manifest.previewTime - manifest.requestedPreviewTime) < .001, 'visible requested preview frame was unnecessarily replaced');
        assert(!File(folder.fsName + '/source.aep').exists && !File(folder.fsName + '/job.json').exists && !File(folder.fsName + '/launch.jsx').exists, 'private source project leaked into final package');
        assert(resources.exists && countFiles(resources) >= 4 && Number(record.resourceCount) >= 4, 'collected resources missing');
        report.passed.push('ready package contains reduced project, preview, and collected resources');

        var target = app.project.items.addComp('MG IMPORT TARGET', 1280, 720, 1, 10, 25); target.time = 2.4; target.openInViewer();
        var first = MG2023Host.run({ action: 'importTemplate', data: { id: record.id } }, target); assert(first.ok && !first.data.reused, JSON.stringify(first));
        assert(target.numLayers === 1 && target.layer(1).source instanceof CompItem, 'main comp was not added as a precomp layer'); near(target.layer(1).startTime, 2.4, .001, 'template layer start time');
        var importedMain = target.layer(1).source, tag = '[MotionGraphicsTemplate:' + record.id + ']'; assert(String(importedMain.comment || '').indexOf(tag) >= 0, 'imported main comp tag missing');
        var itemCount = app.project.numItems, foundNested = false, foundExpressionDependency = false, foundUnused = false, foundSequence = false, allFootageInsidePackage = true;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i); if (item.name === 'MG NESTED') { foundNested = true; } if (item.name === 'MG EXPR DEP') { foundExpressionDependency = true; }
            if (item.name.indexOf('MG UNUSED') >= 0) { foundUnused = true; }
            if (item instanceof FootageItem && item.name === 'MG USED SEQUENCE' && !item.mainSource.isStill && item.duration > .05) { foundSequence = true; }
            if (item instanceof FootageItem && item.file && item.file.fsName.indexOf(resources.fsName) !== 0) { allFootageInsidePackage = false; }
        }
        assert(foundNested && foundExpressionDependency, 'nested or expression dependency missing'); assert(foundSequence, 'image sequence was not preserved as a sequence'); assert(!foundUnused, 'unrelated project item was retained'); assert(allFootageInsidePackage, 'imported footage points outside template package');
        report.passed.push('import retains used and literal expression dependencies while removing unrelated items');

        target.time = 4.1; var secondTime = target.time, second = MG2023Host.run({ action: 'importTemplate', data: { id: record.id } }, target);
        assert(second.ok && second.data.reused && app.project.numItems === itemCount && target.numLayers === 2, JSON.stringify(second)); near(target.layer(1).startTime, secondTime, .001, 'reused layer start time');
        report.passed.push('second click reuses imported template and adds another layer at the playhead');
        report.template = record; report.imports = { first: first.data, second: second.data, projectItemCount: itemCount, resourceFiles: countFiles(resources) }; app.exitCode = 0;
    } catch (error) { report.failed.push({ name: 'import', message: error.message || String(error), line: error.line || 0, file: error.fileName || '' }); }
    try { if (app.project) { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } } catch (ignored) { /* exit */ }
    if (!report.failed.length && prepare && prepare.runtime) {
        try {
            var testRoot = Folder(root.fsName + '/test-results'), runtime = Folder(prepare.runtime), expectedPrefix = testRoot.fsName.toLowerCase() + '\\';
            assert(runtime.fsName.toLowerCase().indexOf(expectedPrefix) === 0 && runtime.name === 'template-runtime', 'unsafe runtime cleanup path');
            removeTree(runtime); assert(!runtime.exists, 'template runtime cleanup failed'); if (prepareFile.exists) { prepareFile.remove(); } report.cleanedRuntime = true;
        } catch (cleanupError) { report.failed.push({ name: 'cleanup', message: cleanupError.message || String(cleanupError), line: cleanupError.line || 0 }); }
    }
    writeJSON(reportFile, report);
}());
