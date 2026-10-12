// Non-rendering bridge smoke test for the integrated pre-render feature.
app.exitCode = 81;
app.exitAfterLaunchAndEval = true;
(function () {
    var root = File($.fileName).parent.parent, report = { version: app.version, safeInstance: false, passed: [], failed: [] }, comp;
    function assert(value, message) { if (!value) { throw new Error(message || 'assertion failed'); } }
    function near(a, b, tolerance) { assert(Math.abs(a - b) <= (tolerance || .001), a + ' != ' + b); }
    function check(name, fn) { try { fn(); report.passed.push(name); } catch (error) { report.failed.push({ name: name, message: error.message || String(error), line: error.line || 0 }); } }
    try {
        assert(app.project && app.project.numItems === 0 && !app.project.file, 'Refusing nonempty project'); report.safeInstance = true;
        $.evalFile(File(root.fsName + '/extension/host/main.jsx'));
        assert(MG2023Host && MG2023Host.version === '2.2.0', 'host version mismatch');
        comp = app.project.items.addComp('MG PRERENDER BRIDGE TEST ONLY', 640, 480, 1, 6, 30);
        comp.displayStartTime = 100; comp.time = 1;
        var layer = comp.layers.addSolid([.4, .2, .8], 'TARGET', 160, 120, 1, 6); layer.inPoint = 0; layer.outPoint = 6; layer.selected = true; comp.openInViewer();
        var status, refreshed;
        check('status reads composition state without touching the render queue', function () {
            var before = app.project.renderQueue.numItems;
            status = MG2023Host.run({ action: 'prerenderStatus', data: {} }, comp);
            assert(status.ok && status.data.comp === comp.name && status.data.templates.length === 0, JSON.stringify(status));
            assert(app.project.renderQueue.numItems === before, 'status changed render queue');
        });
        check('explicit template refresh removes its temporary item and restores the viewer', function () {
            var before = app.project.renderQueue.numItems, previousViewer = null;
            try { previousViewer = app.activeViewer; } catch (ignoredViewer) { previousViewer = null; }
            refreshed = MG2023Host.run({ action: 'prerenderTemplates', data: {} }, comp);
            assert(refreshed.ok && refreshed.data.templates.length > 0, JSON.stringify(refreshed));
            assert(app.project.renderQueue.numItems === before, 'temporary render queue item remains');
            if (previousViewer && app.activeViewer) { assert(String(app.activeViewer.type) === String(previousViewer.type), 'active viewer type was not restored'); }
        });
        check('range marker uses internal composition time', function () {
            var result = MG2023Host.run({ action: 'prerenderCreateRange', data: { scope: 0, range: 0, resultMode: 0, templateName: refreshed.data.templates[0], outputFolder: Folder.temp.fsName } }, comp);
            assert(result.ok && comp.markerProperty.numKeys === 1, JSON.stringify(result));
            near(comp.markerProperty.keyTime(1), 1); near(comp.markerProperty.keyValue(1).duration, 1);
        });
        check('preflight accepts the managed range and reports zero-based time', function () {
            var result = MG2023Host.run({ action: 'prerenderPreflight', data: { scope: 0, range: 3, resultMode: 1, templateName: refreshed.data.templates[0], outputFolder: Folder.temp.fsName } }, comp);
            assert(result.ok && result.data.targetCount === 1, JSON.stringify(result)); near(result.data.start, 1); near(result.data.duration, 1);
        });
    } catch (error) { report.failed.push({ name: 'setup', message: error.message || String(error), line: error.line || 0 }); }
    try { if (comp) { comp.remove(); } } catch (cleanupError) { report.failed.push({ name: 'cleanup', message: cleanupError.message || String(cleanupError), line: cleanupError.line || 0 }); }
    var reportFile = File(root.fsName + '/test-results/ae-prerender-smoke.json'); reportFile.encoding = 'UTF-8'; reportFile.lineFeed = 'Unix';
    if (reportFile.open('w')) { reportFile.write(JSON.stringify(report, null, 2)); reportFile.close(); }
    app.exitCode = report.failed.length ? 82 : 0;
}());
