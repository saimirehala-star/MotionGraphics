// Stage 2: confirm the worker rejected the transparent current frame and stored a visible fallback.
app.exitCode = 76;
app.exitAfterLaunchAndEval = true;
(function () {
    var root = File($.fileName).parent.parent, prepareFile = File(root.fsName + '/test-results/ae-template-preview-fallback-prepare.json'), reportFile = File(root.fsName + '/test-results/ae-template-preview-fallback.json');
    $.evalFile(File(root.fsName + '/extension/vendor/json2.js'));
    var report = { version: app.version, safeInstance: false, passed: [], failed: [] }, prepare = null;
    function assert(value, message) { if (!value) { throw new Error(message || 'assertion failed'); } }
    function readJSON(file) { file.encoding = 'UTF-8'; assert(file.exists && file.open('r'), 'cannot read ' + file.fsName); var data = JSON.parse(file.read()); file.close(); return data; }
    function writeJSON(file, data) { file.encoding = 'UTF-8'; assert(file.open('w'), 'cannot write ' + file.fsName); file.write(JSON.stringify(data, null, 2)); file.close(); }
    function removeTree(folder) { if (!folder.exists) { return; } var entries = folder.getFiles(), i; for (i = 0; i < entries.length; i++) { if (entries[i] instanceof Folder) { removeTree(entries[i]); } else { entries[i].remove(); } } folder.remove(); }
    try {
        assert(app.project && app.project.numItems === 0 && !app.project.file, 'Refusing nonempty project'); report.safeInstance = true;
        prepare = readJSON(prepareFile); assert(!prepare.failed.length && prepare.job && prepare.library, 'prepare stage failed');
        $.global.MotionGraphicsTemplateRoot = prepare.library; $.evalFile(File(root.fsName + '/extension/host/main.jsx'));
        var status = MG2023Host.run({ action: 'templateJobStatus', data: { id: prepare.job.id } }, null); assert(status.ok && status.data.state === 'done', JSON.stringify(status));
        var folder = Folder(prepare.library + '/' + prepare.job.id), manifest = readJSON(File(folder.fsName + '/manifest.json')), preview = File(folder.fsName + '/preview.png');
        assert(manifest.preview === 'preview.png' && preview.exists && preview.length > 0, 'visible fallback preview missing');
        assert(manifest.previewFallback === true, 'transparent current frame was accepted');
        assert(Math.abs(manifest.requestedPreviewTime - prepare.requestedPreviewTime) < .001, 'requested preview time changed');
        assert(manifest.previewTime < prepare.visibleOutPoint, 'fallback time is outside visible layer range');
        var footage = app.project.importFile(new ImportOptions(preview)), check = app.project.items.addComp('MG PREVIEW VERIFY', footage.width, footage.height, 1, 1, 1); check.layers.add(footage);
        var controller = check.layers.addNull(), slider = controller.property('ADBE Effect Parade').addProperty('ADBE Slider Control').property(1); slider.expression = 'thisComp.layer(2).sampleImage([' + String(footage.width * .5) + ',' + String(footage.height * .5) + '],[' + String(footage.width * .5) + ',' + String(footage.height * .5) + '],true,0)[3]';
        var averageAlpha = Number(slider.value); assert(!slider.expressionError && averageAlpha > .001, 'saved fallback preview is fully transparent');
        report.passed.push('transparent current frame is replaced with a visible fallback frame'); report.preview = { requestedTime: manifest.requestedPreviewTime, selectedTime: manifest.previewTime, bytes: preview.length, averageAlpha: averageAlpha, warnings: manifest.warnings };
        MG2023Host.run({ action: 'ackTemplateJob', data: { id: prepare.job.id } }, null); app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); app.exitCode = 0;
    } catch (error) { report.failed.push({ name: 'verify', message: error.message || String(error), line: error.line || 0, file: error.fileName || '' }); try { if (app.project) { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } } catch (ignored) {} }
    if (!report.failed.length && prepare && prepare.runtime) {
        try { var testRoot = Folder(root.fsName + '/test-results'), runtime = Folder(prepare.runtime), prefix = testRoot.fsName.toLowerCase() + '\\'; assert(runtime.name === 'preview-fallback-runtime' && runtime.fsName.toLowerCase().indexOf(prefix) === 0, 'unsafe runtime cleanup path'); removeTree(runtime); if (prepareFile.exists) { prepareFile.remove(); } report.cleanedRuntime = true; }
        catch (cleanupError) { report.failed.push({ name: 'cleanup', message: cleanupError.message || String(cleanupError), line: cleanupError.line || 0 }); }
    }
    writeJSON(reportFile, report);
}());
