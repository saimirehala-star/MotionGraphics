// Stage 2: verify the real offset-timecode composition produces a visible current-frame preview.
app.exitCode = 83; app.exitAfterLaunchAndEval = true;
(function () {
    var root = File($.fileName).parent.parent, prepareFile = File(root.fsName + '/test-results/ae-template-display-time-prepare.json'), reportFile = File(root.fsName + '/test-results/ae-template-display-time.json');
    $.evalFile(File(root.fsName + '/extension/vendor/json2.js'));
    var report = { version: app.version, safeInstance: false, passed: [], failed: [] }, prepare = null;
    function assert(value, message) { if (!value) { throw new Error(message || 'assertion failed'); } }
    function readJSON(file) { file.encoding = 'UTF-8'; assert(file.exists && file.open('r'), 'cannot read ' + file.fsName); var data = JSON.parse(file.read()); file.close(); return data; }
    function writeJSON(file, data) { file.encoding = 'UTF-8'; assert(file.open('w'), 'cannot write ' + file.fsName); file.write(JSON.stringify(data, null, 2)); file.close(); }
    function removeTree(folder) { if (!folder.exists) { return; } var entries = folder.getFiles(), i; for (i = 0; i < entries.length; i++) { if (entries[i] instanceof Folder) { removeTree(entries[i]); } else { entries[i].remove(); } } folder.remove(); }
    try {
        assert(app.project && app.project.numItems === 0 && !app.project.file, 'Refusing nonempty project'); report.safeInstance = true; prepare = readJSON(prepareFile); assert(!prepare.failed.length && prepare.job, 'prepare stage failed');
        $.global.MotionGraphicsTemplateRoot = prepare.library; $.evalFile(File(root.fsName + '/extension/host/main.jsx')); var status = MG2023Host.run({ action: 'templateJobStatus', data: { id: prepare.job.id } }, null); assert(status.ok && status.data.state === 'done', JSON.stringify(status));
        var folder = Folder(prepare.library + '/' + prepare.job.id), manifest = readJSON(File(folder.fsName + '/manifest.json')), preview = File(folder.fsName + '/preview.png'); assert(preview.exists && preview.length > 1000 && manifest.preview === 'preview.png', 'visible preview missing');
        assert(manifest.previewFallback === false, 'visible current frame was replaced'); assert(Math.abs(manifest.requestedPreviewTime - prepare.internalTime) < .001 && Math.abs(manifest.previewTime - prepare.internalTime) < .001, 'internal preview time changed');
        assert(Math.abs(manifest.displayStartTime - prepare.displayStartTime) < .001 && Math.abs(manifest.previewDisplayTime - prepare.displayedTime) < .001, 'display timecode metadata mismatch');
        var footage = app.project.importFile(new ImportOptions(preview)), check = app.project.items.addComp('MG DISPLAY TIME PREVIEW VERIFY', footage.width, footage.height, 1, 1, 1); check.layers.add(footage); var controller = check.layers.addNull(), slider = controller.property('ADBE Effect Parade').addProperty('ADBE Slider Control').property(1); slider.expression = 'thisComp.layer(2).sampleImage([' + String(footage.width * .5) + ',' + String(footage.height * .5) + '],[' + String(footage.width * .5) + ',' + String(footage.height * .5) + '],true,0)[3]'; var alpha = Number(slider.value); assert(!slider.expressionError && alpha > .001, 'current-frame preview is transparent');
        report.passed.push('offset display timecode renders the visible internal current frame'); report.preview = { internalTime: manifest.previewTime, displayStartTime: manifest.displayStartTime, displayedTime: manifest.previewDisplayTime, bytes: preview.length, averageAlpha: alpha, warnings: manifest.warnings };
        MG2023Host.run({ action: 'ackTemplateJob', data: { id: prepare.job.id } }, null); app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); app.exitCode = 0;
    } catch (error) { report.failed.push({ name: 'verify', message: error.message || String(error), line: error.line || 0, file: error.fileName || '' }); try { if (app.project) { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } } catch (ignored) {} }
    if (!report.failed.length && prepare && prepare.runtime) { try { var results = Folder(root.fsName + '/test-results'), runtime = Folder(prepare.runtime), prefix = results.fsName.toLowerCase() + '\\'; assert(runtime.name === 'display-time-runtime' && runtime.fsName.toLowerCase().indexOf(prefix) === 0, 'unsafe runtime cleanup'); removeTree(runtime); if (prepareFile.exists) { prepareFile.remove(); } report.cleanedRuntime = true; } catch (cleanupError) { report.failed.push({ name: 'cleanup', message: cleanupError.message || String(cleanupError), line: cleanupError.line || 0 }); } }
    writeJSON(reportFile, report);
}());

