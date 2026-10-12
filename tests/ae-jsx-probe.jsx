// Run with run-jsx-tests.jsx in a NEW empty instance: AfterFX.com -m -r <bootstrap>.
// Do not use -noui: ScriptUI classes require the UI runtime.
(function () {
    var projectRoot = File($.fileName).parent.parent;
    $.evalFile(File(projectRoot.fsName + '/extension/vendor/json2.js'));
    var result = { version: app.version, passed: [], failed: [], bounds: {}, safeInstance: false };
    function assert(value, message) { if (!value) { throw new Error(message || 'assertion failed'); } }
    function near(a, b) { assert(Math.abs(a - b) < .01, a + ' != ' + b); }
    function check(name, fn) { try { fn(); result.passed.push(name); } catch (e) { result.failed.push({ name: name, message: e.message, line: e.line }); } }
    function choose(c, layers) { for (var i = 1; i <= c.numLayers; i++) { c.layer(i).selected = false; } for (i = 0; i < layers.length; i++) { layers[i].selected = true; } }
    var actualAlert = alert, startupAlerts = [], ui = null, testComp = null;
    try {
        assert(app.project && app.project.numItems === 0 && !app.project.file, 'Not an empty isolated instance; refusing project changes.');
        result.safeInstance = true;
        alert = function (message) { startupAlerts.push(String(message)); };
        $.evalFile(File(projectRoot.fsName + '/tests/fixtures/MotionGraphics-1.1.0.jsx'));
        $.global.MGLegacyTimingHost = MotionGraphicsJSX.host;
        if (MotionGraphicsJSX.session) { MotionGraphicsJSX.session.root.close(); }
        $.evalFile(File(projectRoot.fsName + '/tests/fixtures/MotionGraphics-1.2.0.jsx'));
        $.global.MGLegacyLayerTimingHost = MotionGraphicsJSX.host;
        if (MotionGraphicsJSX.session) { MotionGraphicsJSX.session.root.close(); }
        $.evalFile(File(projectRoot.fsName + '/test-results/jsx-standalone/MotionGraphics.jsx'));
        alert = actualAlert;
        check('single-file launcher creates a native palette', function () {
            assert(!startupAlerts.length, startupAlerts.join('\n'));
            assert(MotionGraphicsJSX.session && MotionGraphicsJSX.session.root instanceof Window, 'No native palette');
            assert(MotionGraphicsJSX.session.modes.ui.menu.items.length === 4);
            assert(MotionGraphicsJSX.session.modes.tools.menu.items.length === 5);
        });
        if (MotionGraphicsJSX.session) { MotionGraphicsJSX.session.root.close(); }
        $.global.MGInspectionBundle = MotionGraphicsJSX;
        var timingTest = File(projectRoot.fsName + '/tests/ae-layer-timing.jsx'); timingTest.encoding = 'UTF-8';
        assert(timingTest.open('r'), 'Cannot read timing tests'); var timingCode = timingTest.read(); timingTest.close(); eval(timingCode);
        var deleteTest = File(projectRoot.fsName + '/tests/ae-marker-delete.jsx'); deleteTest.encoding = 'UTF-8';
        assert(deleteTest.open('r'), 'Cannot read deletion tests'); var deleteCode = deleteTest.read(); deleteTest.close(); eval(deleteCode);
        $.evalFile(File(projectRoot.fsName + '/tests/ae-inspector.jsx'));
        $.global.MGInspectionBundle = null;
        $.global.MGSmokeBundle = MotionGraphicsJSX;
        $.evalFile(File(projectRoot.fsName + '/tests/ae-smoke.jsx'));
        $.global.MGSmokeBundle = null;
        var compactTest = File(projectRoot.fsName + '/tests/ae-compact-ui.jsx'); compactTest.encoding = 'UTF-8';
        assert(compactTest.open('r'), 'Cannot read compact UI tests'); var compactCode = compactTest.read(); compactTest.close(); eval(compactCode);
    } catch (e) { result.failed.push({ name: 'setup', message: e.message, detail: e.toString(), line: e.line, file: e.fileName }); }
    finally {
        alert = actualAlert;
        if (ui) { ui.root.close(); }
        if (testComp) { testComp.remove(); }
    }
    var output = File(projectRoot.fsName + '/test-results/ae-jsx-ui.json'); output.encoding = 'UTF-8';
    if (output.open('w')) { output.write(JSON.stringify(result, null, 2)); output.close(); }
    if (result.safeInstance) { app.exitAfterLaunchAndEval = true; app.exitCode = result.failed.length ? 1 : 0; }
}());
