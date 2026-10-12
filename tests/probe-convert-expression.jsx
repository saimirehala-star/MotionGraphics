// Safe command probe in a fresh empty AE instance.
(function () {
    var root = $.getenv('MG_JSX_TEST_ROOT'); $.evalFile(File(root + '/extension/vendor/json2.js'));
    var report = { safeInstance: false, version: app.version, ids: {}, before: 0, after: 0, expression: '', error: null };
    try {
        if (!app.project || app.project.numItems !== 0 || app.project.file) { throw new Error('Probe instance is not empty.'); }
        report.safeInstance = true; var c = app.project.items.addComp('MG CONVERT PROBE', 320, 180, 1, 2, 30), l = c.layers.addShape(), p = l.transform.scale;
        p.expression = 'value*Math.min(1,time)'; report.before = p.numKeys; report.expression = p.expression;
        report.ids.english = app.findMenuCommandId('Convert Expression to Keyframes'); report.ids.chinese = app.findMenuCommandId('将表达式转换为关键帧');
        c.openInViewer(); l.selected = true; p.selected = true; app.executeCommand(2639); report.after = p.numKeys; report.expressionAfter = p.expression;
    } catch (e) { report.error = { message: e.message || String(e), line: e.line, file: e.fileName }; }
    finally { var f = File(root + '/test-results/convert-expression-probe.json'); f.encoding = 'UTF-8'; if (f.open('w')) { f.write(JSON.stringify(report, null, 2)); f.close(); } try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch (ignored) {} app.exitAfterLaunchAndEval = true; app.exitCode = report.error ? 1 : 0; }
}());
