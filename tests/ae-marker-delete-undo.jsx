// Run ONLY as AfterFX.com -m -r in a fresh empty instance. Real Undo requires separate idle tasks.
(function () {
    if (!app.project || app.project.numItems !== 0 || app.project.file) { return; }
    var root = $.getenv('MG_JSX_TEST_ROOT');
    $.evalFile(File(root + '/extension/vendor/json2.js'));
    $.evalFile(File(root + '/test-results/jsx-standalone/MotionGraphics.jsx'));
    if (MotionGraphicsJSX.session) { MotionGraphicsJSX.session.root.close(); }
    var s = { root: root, host: MotionGraphicsJSX.host, bundle: MotionGraphicsJSX, step: 0, comp: null, ui: null,
        report: { version: app.version, safeInstance: true, passed: [], failed: [] } };
    $.global.MGDeleteUndoTest = s;
    s.assert = function (v, m) { if (!v) { throw new Error(m || 'assertion failed'); } };
    s.state = function () { var t = s.layer.comment, a = t.lastIndexOf('\n[MotionGraphics:1]\n'); if (a < 0) { return { slots: {} }; } a += 20; return JSON.parse(t.substring(a, t.indexOf('\n[/MotionGraphics]', a))); };
    s.y = function () { var p = s.layer.transform.position, v = p.valueAtTime(1, false); s.assert(!p.expressionError, p.expressionError); return v[1]; };
    s.near = function (a, b) { s.assert(Math.abs(a - b) < .001, a + ' != ' + b); };
    s.save = function () { var content = JSON.stringify(s.report, null, 2), f = File(s.root + '/test-results/ae-marker-delete-undo.json'); f.encoding = 'UTF-8'; if (f.open('w')) { f.write(content); f.close(); } };
    s.finish = function () {
        s.save();
        if (s.ui) { s.ui.root.close(); }
        if (app.project && !app.project.file && app.project.numItems === 1 && s.comp && app.project.item(1).id === s.comp.id) {
            app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); app.quit();
        }
    };
    s.tick = function () {
        var delay = 1100;
        try {
            if (s.step === 0) {
                s.comp = app.project.items.addComp('MG UNDO TEST ONLY', 640, 480, 1, 8, 30);
                s.layer = s.comp.layers.addShape(); s.layer.inPoint = 1; s.layer.outPoint = 7; s.layer.selected = true; s.comp.time = 1.3; s.comp.openInViewer(); s.baseY = s.layer.transform.position.valueAtTime(1, true)[1];
                s.assert(s.host.run({ action: 'apply', data: { id: 'in-right-smear', markerTiming: true } }, s.comp).ok);
                s.assert(s.host.run({ action: 'apply', data: { id: 'loop-breathe', markerTiming: true } }, s.comp).ok);
                s.ui = s.bundle.create(null, function (r) { return s.host.run(r, s.comp); }); s.ui.root.show(); s.bundle.watch(s.ui);
                s.near(s.y(), s.baseY + 1208); s.assert(s.layer.effect('MG / IN 22 / Motion Blur')); s.report.passed.push('separate isolated native project and real palette watcher started');
            } else if (s.step === 1) {
                app.beginUndoGroup('MG TEST manual range deletion');
                try { s.layer.marker.removeKey(1); } finally { app.endUndoGroup(); }
                s.near(s.y(), s.baseY); s.report.passed.push('manual marker deletion stops effect before cleanup'); delay = 3500;
            } else if (s.step === 2) {
                s.assert(!s.state().slots['in'] && s.state().slots.loop, 'watcher did not clean only entrance');
                s.assert(!s.layer.effect('MG / 入场动画 / 时长 秒') && !s.layer.effect('MG / IN 22 / Motion Blur') && s.layer.marker.numKeys === 1);
                s.report.passed.push('real scheduled panel watcher cleans deleted effect without a button');
                s.ui.stopWatching();
            } else if (s.step === 3) { app.executeCommand(16); }
            else if (s.step === 4) {
                s.assert(s.state().slots['in'] && s.layer.effect('MG / 入场动画 / 时长 秒') && s.layer.effect('MG / IN 22 / Motion Blur'), 'first Undo did not restore cleanup');
                s.assert(s.layer.marker.numKeys === 1, 'first Undo should not restore manual marker'); s.near(s.y(), s.baseY);
                s.report.passed.push('first native Undo restores metadata and controls while the missing effect stays neutral');
                s.bundle.watch(s.ui); delay = 3500;
            } else if (s.step === 5) {
                s.assert(s.state().slots['in'] && s.layer.marker.numKeys === 1, 'watcher deleted the undone state again');
                s.report.passed.push('watcher does not re-delete after Undo across several idle polls'); s.ui.stopWatching();
            } else if (s.step === 6) { app.executeCommand(16); }
            else if (s.step === 7) {
                s.assert(s.layer.marker.numKeys === 2 && s.state().slots['in'] && s.state().slots.loop && s.layer.effect('MG / IN 22 / Motion Blur'), 'second Undo did not restore marker'); s.near(s.y(), s.baseY + 1208);
                s.report.passed.push('second native Undo restores the original marker and evaluated animation');
                s.bundle.watch(s.ui); delay = 2200;
            } else if (s.step === 8) {
                app.beginUndoGroup('MG TEST delete restored marker again');
                try { s.layer.marker.removeKey(1); } finally { app.endUndoGroup(); } delay = 3500;
            } else if (s.step === 9) {
                s.assert(!s.state().slots['in'] && s.state().slots.loop && !s.layer.effect('MG / IN 22 / Motion Blur'), 'fresh deletion after restore should clean again');
                s.report.passed.push('restored marker can be deleted again and is cleaned normally'); s.finish(); return;
            }
            s.save(); s.step++; app.scheduleTask('$.global.MGDeleteUndoTest.tick();', delay, false);
        } catch (e) { s.report.failed.push({ step: s.step, message: e.message, line: e.line }); s.finish(); }
    };
    app.exitAfterLaunchAndEval = false;
    app.scheduleTask('$.global.MGDeleteUndoTest.tick();', 300, false);
}());
