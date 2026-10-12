// Native deletion tests, invoked only from the guarded empty-instance runner.
(function () {
    var root = File($.fileName).parent.parent, bundle = $.global.MGInspectionBundle, host = bundle.host;
    var report = { version: app.version, passed: [], failed: [], safeInstance: false };
    function assert(v, m) { if (!v) { throw new Error(m || 'assertion failed'); } }
    function near(a, b) { assert(Math.abs(a - b) < .001, a + ' != ' + b); }
    function state(l) { var t = l.comment, a = t.lastIndexOf('\n[MotionGraphics:1]\n'); if (a < 0) { return { slots: {} }; } a += 20; return JSON.parse(t.substring(a, t.indexOf('\n[/MotionGraphics]', a))); }
    function apply(c, id) { var r = host.run({ action: 'apply', data: { id: id, markerTiming: true } }, c); assert(r.ok, JSON.stringify(r)); }
    function remove(l, category) { var key = state(l).slots[category].timing.key; for (var i = l.marker.numKeys; i >= 1; i--) { if (l.marker.keyValue(i).getParameters().MotionGraphicsTiming === key) { l.marker.removeKey(i); } } }
    function sync(c) { return host.run({ action: 'syncDeletedMarkers' }, c); }
    function clean(c) { sync(c); $.sleep(950); return sync(c); }
    function value(l, name, time) { var p = l.transform.property(name), v = p.valueAtTime(time, false); assert(!p.expressionError, p.expressionError); return v; }
    function nativeProp(group, matchName) { for (var i = 1; i <= group.numProperties; i++) { var p = group.property(i); if (p.matchName === matchName) { return p; } if (p.propertyType !== PropertyType.PROPERTY) { var nested = nativeProp(p, matchName); if (nested) { return nested; } } } return null; }
    function check(name, fn) {
        var c;
        try { c = app.project.items.addComp('MG DELETE TEST ONLY', 640, 480, 1, 8, 30); var l = c.layers.addShape(); l.name = 'Card'; l.selected = true; l.inPoint = 1; l.outPoint = 7; c.time = 2; fn(c, l); report.passed.push(name); }
        catch (e) { report.failed.push({ name: name, message: e.message, line: e.line }); }
        finally { if (c) { c.remove(); } }
    }
    try {
        assert(app.project && app.project.numItems === 0 && !app.project.file, 'Refusing nonempty project'); report.safeInstance = true;
        check('all 80 deleted presets immediately return to keyed base values with panel closed', function (c, l) {
            var names = ['ADBE Position', 'ADBE Scale', 'ADBE Rotate Z', 'ADBE Opacity'], i, j, k, p, actual, expected;
            l.transform.opacity.setValueAtTime(0, 30); l.transform.opacity.setValueAtTime(8, 90);
            for (i = 0; i < bundle.catalog.presets.length; i++) {
                p = bundle.catalog.presets[i]; if (p.type !== 'ui') { continue; } try { apply(c, p.id); } catch (applyError) { throw new Error(p.id + ': ' + applyError.message); } remove(l, p.category);
                for (j = 0; j < names.length; j++) {
                    actual = value(l, names[j], 1.25); expected = l.transform.property(names[j]).valueAtTime(1.25, true);
                    if (typeof actual === 'number') { near(actual, expected); } else { for (k = 0; k < actual.length; k++) { near(actual[k], expected[k]); } }
                }
                host.run({ action: 'remove', data: { category: p.category } }, c);
            }
            assert(l.transform.opacity.numKeys === 2);
        });
        check('deleted exit range neutralizes and cleans only its native effects', function (c, l) {
            apply(c, 'in-ref-converge'); apply(c, 'out-ref-stretch-blur'); var range = state(l).slots.out.timing;
            var glow = l.effect('MG / OUT 09 / Glow'), radial = l.effect('MG / OUT 09 / Radial Blur'); assert(glow && radial && l.effect('MG / IN 10 / Motion Blur'));
            remove(l, 'out'); near(nativeProp(glow, 'ADBE Glo2-0002').valueAtTime(7, false), 0); near(nativeProp(radial, 'ADBE Radial Blur-0001').valueAtTime(7, false), 0);
            var result = clean(c); assert(result.count === 1 && !l.effect('MG / OUT 09 / Glow') && !l.effect('MG / OUT 09 / Radial Blur'));
            assert(l.effect('MG / IN 10 / Motion Blur') && state(l).slots['in'] && !state(l).slots.out);
        });
        check('deleted dissipate range cleans editable Fold Position controls', function (c, l) {
            apply(c, 'out-ref-dissipate'); assert(l.effect('MG / OUT 23 / Fold Start') && l.effect('MG / OUT 23 / Fold End') && l.effect('MG / OUT 23 / Page Turn'));
            remove(l, 'out'); var result = clean(c); assert(result.count === 1 && !state(l).slots.out);
            assert(!l.effect('MG / OUT 23 / Fold Start') && !l.effect('MG / OUT 23 / Fold End') && !l.effect('MG / OUT 23 / Page Turn') && !l.effect('MG / OUT 23 / Turbulence'));
        });
        check('both expression engines disable missing ranges immediately', function (c, l) {
            var before = app.project.expressionEngine, engines = ['extendscript', 'javascript-1.0'];
            try { for (var i = 0; i < engines.length; i++) { app.project.expressionEngine = engines[i]; apply(c, 'in-fade'); remove(l, 'in'); near(value(l, 'ADBE Opacity', 1.3), 100); host.run({ action: 'remove', data: { category: 'in' } }, c); } }
            finally { app.project.expressionEngine = before; }
        });
        check('cleanup removes one module while preserving another on the same property and user content', function (c, l) {
            l.comment = 'User note'; l.transform.opacity.setValueAtTime(0, 60); l.transform.opacity.setValueAtTime(8, 80);
            l.effect.addProperty('ADBE Slider Control').name = 'User slider'; l.marker.setValueAtTime(5, new MarkerValue('User beat'));
            apply(c, 'in-fade'); apply(c, 'loop-blink'); remove(l, 'in'); var before = value(l, 'ADBE Opacity', 1.3); var r = clean(c);
            assert(r.count === 1, JSON.stringify(r)); assert(!state(l).slots['in'] && state(l).slots.loop); assert(!l.effect('MG / 入场动画 / 时长 秒') && l.effect('User slider'));
            near(value(l, 'ADBE Opacity', 1.3), before); assert(l.transform.opacity.numKeys === 2 && l.marker.numKeys === 2 && l.comment.indexOf('User note') === 0);
            remove(l, 'loop'); r = clean(c); assert(r.count === 1 && l.comment === 'User note' && l.transform.opacity.expression === '' && l.marker.numKeys === 1 && l.effect.numProperties === 1);
        });
        check('deleting the right-smear range removes only its owned native blur', function (c, l) {
            l.effect.addProperty('CC Force Motion Blur'); apply(c, 'in-right-smear');
            assert(l.effect('CC Force Motion Blur') && l.effect('MG / IN 22 / Motion Blur')); remove(l, 'in'); var r = clean(c);
            assert(r.count === 1 && !state(l).slots['in']); assert(l.effect('CC Force Motion Blur') && !l.effect('MG / IN 22 / Motion Blur'));
        });
        check('cleanup scans unselected layers and can remove several categories together', function (c, l) {
            apply(c, 'in-slide'); apply(c, 'loop-breathe'); remove(l, 'in'); remove(l, 'loop'); l.selected = false;
            var r = clean(c); assert(r.count === 2 && l.effect.numProperties === 0 && l.comment === '' && !l.selected);
        });
        check('temporary marker removal during movement does not delete a restored range', function (c, l) {
            apply(c, 'in-fade'); var v = l.marker.keyValue(1); remove(l, 'in'); assert(sync(c).count === 0);
            l.marker.setValueAtTime(3, v); $.sleep(950); assert(sync(c).count === 0 && state(l).slots['in']); near(value(l, 'ADBE Opacity', 3.3), 87.5);
        });
        check('zero duration and duplicate identities remain repairable and never auto-delete', function (c, l) {
            apply(c, 'in-fade'); var v = l.marker.keyValue(1); v.duration = 0; l.marker.setValueAtKey(1, v); assert(clean(c).count === 0 && state(l).slots['in']);
            v.duration = .6; l.marker.setValueAtKey(1, v); l.marker.setValueAtTime(3, v); assert(clean(c).count === 0 && state(l).slots['in']); near(value(l, 'ADBE Opacity', 1.3), 87.5);
        });
        check('real 1.2.0 missing markers keep fallback until explicit deletion opt-in', function (c, l) {
            var old = $.global.MGLegacyLayerTimingHost;
            assert(old.run({ action: 'apply', data: { id: 'in-fade', markerTiming: true } }, c).ok);
            remove(l, 'in'); assert(clean(c).count === 0 && state(l).slots['in']); near(value(l, 'ADBE Opacity', 1.3), 87.5);
            assert(host.run({ action: 'enableTiming', data: { category: 'in' } }, c).ok); assert(state(l).slots['in'].timing.removeOnDelete);
            remove(l, 'in'); near(value(l, 'ADBE Opacity', 1.3), 100); assert(clean(c).count === 1);
        });
        check('old valid source ranges upgrade without moving their marker', function (c, l) {
            var old = $.global.MGLegacyLayerTimingHost; assert(old.run({ action: 'apply', data: { id: 'in-fade', markerTiming: true } }, c).ok);
            var v = l.marker.keyValue(1); l.marker.removeKey(1); l.marker.setValueAtTime(3, v);
            assert(host.run({ action: 'enableTiming', data: { category: 'in' } }, c).ok); near(l.marker.keyTime(1), 3); assert(state(l).slots['in'].timing.removeOnDelete);
        });
        check('copies remove independently although their marker identifiers initially match', function (c, l) {
            apply(c, 'in-fade'); var dup = l.duplicate(); remove(dup, 'in'); assert(clean(c).count === 1 && state(l).slots['in'] && !state(dup).slots['in']); near(value(l, 'ADBE Opacity', 1.3), 87.5);
        });
        check('locked layers and foreign expressions prevent physical cleanup', function (c, l) {
            apply(c, 'in-fade'); remove(l, 'in'); l.locked = true; var r = clean(c); assert(r.count === 0 && r.skipped.length && state(l).slots['in']);
            l.locked = false; l.transform.opacity.expression = 'value*0.5'; r = sync(c); assert(r.count === 0 && r.skipped.length && l.transform.opacity.expression === 'value*0.5');
        });
        check('conflicting effect names are not deleted', function (c, l) {
            apply(c, 'in-fade'); remove(l, 'in'); l.effect('MG / 入场动画 / 时长 秒').remove(); l.effect.addProperty('ADBE Angle Control').name = 'MG / 入场动画 / 时长 秒';
            var r = clean(c); assert(r.count === 0 && r.skipped.length && l.effect('MG / 入场动画 / 时长 秒').matchName === 'ADBE Angle Control' && state(l).slots['in']);
        });
        check('cleanup preserves a manually disabled shared expression', function (c, l) {
            apply(c, 'in-fade'); apply(c, 'loop-blink'); l.transform.opacity.expressionEnabled = false; remove(l, 'in');
            assert(clean(c).count === 1 && !l.transform.opacity.expressionEnabled && l.transform.opacity.expression.length > 0 && state(l).slots.loop);
        });
        check('reapply immediately after deletion creates a new independent range', function (c, l) {
            apply(c, 'in-fade'); var key = state(l).slots['in'].timing.key; remove(l, 'in'); sync(c); apply(c, 'in-slide');
            assert(l.marker.numKeys === 1 && state(l).slots['in'].timing.key !== key); assert(clean(c).count === 0); near(value(l, 'ADBE Opacity', 1.3), 87.5);
        });
    } catch (e) { report.failed.push({ name: 'setup', message: e.message, line: e.line }); }
    var file = File(root.fsName + '/test-results/ae-marker-delete.json'); file.encoding = 'UTF-8'; if (file.open('w')) { file.write(JSON.stringify(report, null, 2)); file.close(); }
}());
