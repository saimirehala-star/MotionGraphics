// Mutates only the guarded, empty, isolated native test instance.
(function () {
    var root = File($.fileName).parent.parent, bundle = $.global.MGInspectionBundle, host = bundle.host;
    var report = { version: app.version, passed: [], failed: [], safeInstance: false };
    function assert(v, message) { if (!v) { throw new Error(message || 'assertion failed'); } }
    function near(a, b) { assert(Math.abs(a - b) < .001, a + ' != ' + b); }
    function choose(c, layers) { for (var i = 1; i <= c.numLayers; i++) { c.layer(i).selected = false; } for (i = 0; i < layers.length; i++) { layers[i].selected = true; } }
    function apply(c, id, params) { var r = host.run({ action: 'apply', data: { id: id, params: params || {}, markerTiming: true } }, c); assert(r.ok, JSON.stringify(r)); return r; }
    function entry(c, category) { var entries = host.run({ action: 'inspect' }, c).data.entries; for (var i = 0; i < entries.length; i++) { if (entries[i].category === category) { return entries[i]; } } return null; }
    function controller(c, category) { var id = entry(c, category).timing.controllerId; for (var i = 1; i <= c.numLayers; i++) { if (c.layer(i).id === id) { return c.layer(i); } } return null; }
    function drag(layer, start, duration) { var m = layer.property('ADBE Marker'), v = m.keyValue(1); v.duration = duration; m.removeKey(1); m.setValueAtTime(start, v); }
    function value(l, name, time) { var p = l.property('ADBE Transform Group').property(name); var v = p.valueAtTime(time, false); assert(!p.expressionError, p.expressionError); return v; }
    function action(c, name, category, extra) { var data = extra || {}; data.category = category; return host.run({ action: name, data: data }, c); }
    function check(name, fn) {
        var c = null;
        try { c = app.project.items.addComp('MG TIMING TEST ONLY', 640, 480, 1, 8, 30); var l = c.layers.addShape(); l.name = 'Card'; l.inPoint = 1; l.outPoint = 7; c.time = 2; choose(c, [l]); fn(c, l); report.passed.push(name); }
        catch (e) { report.failed.push({ name: name, message: e.message, line: e.line }); }
        finally { if (c) { c.remove(); } }
    }
    try {
        assert(app.project && app.project.numItems === 0 && !app.project.file, 'Refusing nonempty project'); report.safeInstance = true;
        check('same-start entrance and loop retain independent duration markers', function (c, l) {
            apply(c, 'in-fade'); apply(c, 'loop-breathe'); var a = controller(c, 'in'), b = controller(c, 'loop');
            assert(a.id !== b.id && c.numLayers === 3); near(a.marker.keyTime(1), 1); near(b.marker.keyTime(1), 1);
            near(a.marker.keyValue(1).duration, .6); near(b.marker.keyValue(1).duration, 6);
            assert(l.marker.numKeys === 0 && l.selected && c.selectedLayers.length === 1);
            assert(a.guideLayer && !a.enabled && a.property('ADBE Root Vectors Group').numProperties === 0);
        });
        check('moving and stretching a range immediately changes evaluated opacity', function (c, l) {
            apply(c, 'in-fade'); var helper = controller(c, 'in'); drag(helper, 2, 2);
            near(value(l, 'ADBE Opacity', 1.5), 0); near(value(l, 'ADBE Opacity', 3), 87.5); near(value(l, 'ADBE Opacity', 4), 100);
            near(entry(c, 'in').range.start, 2); near(entry(c, 'in').range.end, 4); near(l.inPoint, 1); near(l.outPoint, 7);
        });
        check('marker timing works in the legacy ExtendScript expression engine', function (c, l) {
            var before = app.project.expressionEngine;
            try { app.project.expressionEngine = 'extendscript'; apply(c, 'in-fade'); drag(controller(c, 'in'), 2, 2); near(value(l, 'ADBE Opacity', 3), 87.5); }
            finally { app.project.expressionEngine = before; }
        });
        check('all twenty presets retain their pose after marker translation', function (c, l) {
            for (var i = 0; i < bundle.catalog.presets.length; i++) {
                var p = bundle.catalog.presets[i]; if (p.type !== 'ui') { continue; }
                apply(c, p.id); var helper = controller(c, p.category); drag(helper, 2, 1.2);
                var names = ['ADBE Position', 'ADBE Scale', 'ADBE Rotate Z', 'ADBE Opacity'], samples = [], j, k;
                for (j = 0; j < names.length; j++) { samples.push(value(l, names[j], 2.3)); }
                drag(helper, 3, 1.2);
                for (j = 0; j < names.length; j++) { var now = value(l, names[j], 3.3); if (typeof now === 'number') { near(now, samples[j]); } else { for (k = 0; k < now.length; k++) { near(now[k], samples[j][k]); } } }
                assert(action(c, 'remove', p.category).ok); assert(c.numLayers === 1);
            }
        });
        check('loop stops at marker end while period remains independently editable', function (c, l) {
            apply(c, 'loop-spin', { period: 2, angle: 360 }); drag(controller(c, 'loop'), 2, .5);
            near(value(l, 'ADBE Rotate Z', 1.9), 0); near(value(l, 'ADBE Rotate Z', 2.25), 45); near(value(l, 'ADBE Rotate Z', 5), 90);
            l.effect('MG / 循环动画 / 周期 秒')(1).setValue(1); near(value(l, 'ADBE Rotate Z', 5), 180);
            near(entry(c, 'loop').range.end, 2.5);
        });
        check('out and feedback use range duration without trimming the source', function (c, l) {
            apply(c, 'out-fade'); drag(controller(c, 'out'), 3, 2); near(value(l, 'ADBE Opacity', 4), 12.5);
            apply(c, 'feedback-press', { amount: 20 }); drag(controller(c, 'feedback'), 2, 2); near(value(l, 'ADBE Scale', 3)[0], 80); near(value(l, 'ADBE Scale', 5)[0], 100);
            near(l.inPoint, 1); near(l.outPoint, 7);
        });
        check('reapply and replace preserve marker edits including user comments', function (c, l) {
            apply(c, 'in-fade'); var helper = controller(c, 'in'); drag(helper, 2, 2); var v = helper.marker.keyValue(1); v.comment = 'My entrance'; helper.marker.setValueAtKey(1, v);
            apply(c, 'in-slide', { duration: .1, delay: 5, distance: 300 });
            assert(controller(c, 'in').id === helper.id && c.numLayers === 2); near(entry(c, 'in').range.start, 2); near(entry(c, 'in').range.end, 4); assert(helper.marker.keyValue(1).comment === 'My entrance');
            near(value(l, 'ADBE Opacity', 3), 87.5);
        });
        check('controller and marker renaming, layer reordering and extra markers are safe', function (c, l) {
            apply(c, 'in-fade'); var helper = controller(c, 'in'); drag(helper, 2, 2); helper.name = 'Renamed'; helper.moveToBeginning();
            var v = helper.marker.keyValue(1); v.comment = 'Renamed marker'; helper.marker.setValueAtKey(1, v); helper.marker.setValueAtTime(.5, new MarkerValue('User'));
            near(value(l, 'ADBE Opacity', 3), 87.5); assert(entry(c, 'in').timing.valid);
        });
        check('range dialog API sets exact time and rejects occupied timestamps', function (c, l) {
            apply(c, 'in-fade'); assert(action(c, 'setTiming', 'in', { start: 2.25, end: 4.75 }).ok); near(value(l, 'ADBE Opacity', 3.5), 87.5);
            var helper = controller(c, 'in'); helper.marker.setValueAtTime(3, new MarkerValue('User beat')); var rejected = false;
            try { action(c, 'setTiming', 'in', { start: 3, end: 5 }); } catch (e) { rejected = true; }
            assert(rejected); near(entry(c, 'in').range.start, 2.25); assert(helper.marker.numKeys === 2);
        });
        check('one-frame ranges work; empty, reversed and non-finite ranges are rejected', function (c, l) {
            apply(c, 'in-fade'); action(c, 'setTiming', 'in', { start: 2, end: 2 + c.frameDuration }); near(value(l, 'ADBE Opacity', 2 + c.frameDuration), 100);
            var invalid = [{ start: '', end: 3 }, { start: 3, end: 3 }, { start: 4, end: 2 }, { start: 'abc', end: 4 }];
            for (var i = 0; i < invalid.length; i++) { var rejected = false; try { action(c, 'setTiming', 'in', invalid[i]); } catch (e) { rejected = true; } assert(rejected); }
            near(entry(c, 'in').range.start, 2);
        });
        check('missing controller falls back safely and explicit repair restores control', function (c, l) {
            apply(c, 'in-fade'); action(c, 'setTiming', 'in', { start: 2, end: 4 }); controller(c, 'in').remove();
            assert(!entry(c, 'in').timing.valid); near(value(l, 'ADBE Opacity', 3), 87.5);
            var r = host.run({ action: 'apply', data: { id: 'in-slide', markerTiming: true } }, c); assert(!r.ok && c.numLayers === 1);
            assert(action(c, 'enableTiming', 'in').ok); assert(entry(c, 'in').timing.valid && c.numLayers === 2); near(value(l, 'ADBE Opacity', 3), 87.5);
        });
        check('zero-length or duplicate owned markers warn and use saved timing', function (c, l) {
            apply(c, 'in-fade'); var helper = controller(c, 'in'), v = helper.marker.keyValue(1); v.duration = 0; helper.marker.setValueAtKey(1, v);
            assert(!entry(c, 'in').timing.valid); near(value(l, 'ADBE Opacity', 1.3), 87.5);
            action(c, 'enableTiming', 'in'); helper = controller(c, 'in'); v = helper.marker.keyValue(1); helper.marker.setValueAtTime(3, v);
            assert(!entry(c, 'in').timing.valid); near(value(l, 'ADBE Opacity', 1.3), 87.5);
        });
        check('legacy conversion preserves live timings and removes only owned snapshots', function (c, l) {
            host.run({ action: 'apply', data: { id: 'in-fade', params: { duration: 1.2, delay: .25 }, autoMarkers: true } }, c);
            l.marker.setValueAtTime(6, new MarkerValue('User')); var before = value(l, 'ADBE Opacity', 1.85);
            assert(action(c, 'enableTiming', 'in').ok); near(value(l, 'ADBE Opacity', 1.85), before); near(entry(c, 'in').range.start, 1.25); near(entry(c, 'in').range.end, 2.45);
            assert(l.marker.numKeys === 1 && l.marker.keyValue(1).comment === 'User');
        });
        check('checkbox does not silently convert or disable existing modules', function (c, l) {
            host.run({ action: 'apply', data: { id: 'in-fade' } }, c); apply(c, 'in-slide'); assert(!entry(c, 'in').timing && c.numLayers === 1);
            action(c, 'enableTiming', 'in'); host.run({ action: 'apply', data: { id: 'in-fade', markerTiming: false } }, c); assert(entry(c, 'in').timing.valid && c.numLayers === 2);
        });
        check('animated legacy timing cannot be converted destructively', function (c, l) {
            host.run({ action: 'apply', data: { id: 'in-fade' } }, c); var p = l.effect('MG / 入场动画 / 时长 秒')(1); p.setValueAtTime(1, .5); p.setValueAtTime(3, 2);
            var rejected = false; try { action(c, 'enableTiming', 'in'); } catch (e) { rejected = true; } assert(rejected && c.numLayers === 1 && p.numKeys === 2);
        });
        check('layer duplicates can detach timing without changing the original', function (c, l) {
            apply(c, 'in-fade'); var original = controller(c, 'in'), duplicate = l.duplicate(); choose(c, [duplicate]); assert(entry(c, 'in').timing.shared);
            assert(action(c, 'enableTiming', 'in').ok); assert(!entry(c, 'in').timing.shared); drag(controller(c, 'in'), 3, 2);
            near(value(l, 'ADBE Opacity', 3), 100); near(value(duplicate, 'ADBE Opacity', 3), 0); near(original.marker.keyTime(1), 1);
        });
        check('composition duplication remaps layer-control references', function (c, l) {
            apply(c, 'in-fade'); var copied = c.duplicate();
            try { var target = copied.layer('Card'); choose(copied, [target]); drag(controller(copied, 'in'), 3, 2); near(value(target, 'ADBE Opacity', 4), 87.5); near(value(l, 'ADBE Opacity', 4), 100); }
            finally { copied.remove(); }
        });
        check('remove preserves shared helpers and helper user notes', function (c, l) {
            apply(c, 'in-fade'); var helper = controller(c, 'in'), dup = l.duplicate(); choose(c, [l]); action(c, 'remove', 'in'); assert(c.numLayers === 3); near(value(dup, 'ADBE Opacity', 1.3), 87.5);
            choose(c, [dup]); helper.marker.setValueAtTime(4, new MarkerValue('User')); action(c, 'remove', 'in'); assert(c.numLayers === 3 && helper.marker.numKeys === 2);
        });
        check('controller selection maps inspection and parameter changes to artwork', function (c, l) {
            apply(c, 'in-slide'); action(c, 'selectControl', 'in'); var data = host.run({ action: 'inspect' }, c).data; assert(data.selectedIsController && data.layerId === l.id);
            apply(c, 'in-slide', { distance: 250 }); assert(c.numLayers === 2); action(c, 'selectSource', 'in'); assert(l.selected);
            near(host.run({ action: 'read', data: { category: 'in' } }, c).data.params.distance, 250);
        });
        check('multi-selection, cameras and external-expression failures are safe', function (c, l) {
            var other = c.layers.addShape(), camera = c.layers.addCamera('Camera', [320, 240]); choose(c, [l, other]); var r = apply(c, 'in-slide'); assert(r.count === 2 && c.selectedLayers.length === 2);
            choose(c, [l]); assert(entry(c, 'in').timing.valid); var rejected = c.layers.addShape(); rejected.transform.position.expression = 'value+[5,0]'; choose(c, [rejected]); var count = c.numLayers;
            r = host.run({ action: 'apply', data: { id: 'in-slide', markerTiming: true } }, c); assert(!r.ok && c.numLayers === count && rejected.comment === '');
        });
        check('clear legacy markers never deletes active timing; inspection is read-only', function (c, l) {
            apply(c, 'in-fade'); var helper = controller(c, 'in'); drag(helper, 2, 2); var comment = l.comment;
            action(c, 'clearRanges', 'in'); assert(helper.marker.numKeys === 1 && c.numLayers === 2); for (var i = 0; i < 5; i++) { entry(c, 'in'); }
            assert(l.comment === comment); near(helper.marker.keyTime(1), 2); near(value(l, 'ADBE Opacity', 3), 87.5);
        });
        check('locked controller rejects range edits without partially changing artwork', function (c, l) {
            apply(c, 'in-fade'); var helper = controller(c, 'in'); helper.locked = true; var rejected = false;
            try { action(c, 'setTiming', 'in', { start: 2, end: 4 }); } catch (e) { rejected = true; } assert(rejected); near(entry(c, 'in').range.start, 1); helper.locked = false;
        });
        check('stagger carries ranges with artwork without double-moving selected helpers', function (c, l) {
            apply(c, 'in-fade'); var helper = controller(c, 'in'), other = c.layers.addShape(); other.inPoint = 1; other.outPoint = 7; choose(c, [other]); apply(c, 'in-fade');
            choose(c, [l, other, helper]); var r = host.run({ action: 'apply', data: { id: 'stagger-forward', params: { frames: 15 } } }, c); assert(r.ok && r.count === 2);
            near(l.inPoint, 1.5); near(helper.marker.keyTime(1), 1.5); near(value(l, 'ADBE Opacity', 1.8), 87.5); assert(l.selected && helper.selected && other.selected);
            choose(c, [l, other]); r = host.run({ action: 'apply', data: { id: 'align-in' } }, c); assert(r.ok); near(l.inPoint, 1); near(helper.marker.keyTime(1), 1);
        });
        check('stagger preflight prevents partial moves when a controller is locked', function (c, l) {
            apply(c, 'in-fade'); var helper = controller(c, 'in'), other = c.layers.addShape(); other.inPoint = 2; choose(c, [l, other]); helper.locked = true;
            var rejected = false; try { host.run({ action: 'apply', data: { id: 'stagger-forward' } }, c); } catch (e) { rejected = true; }
            assert(rejected); near(l.inPoint, 1); near(other.inPoint, 2); near(helper.marker.keyTime(1), 1); helper.locked = false;
        });
        check('trimming and source movement leave composition-based timing explicit', function (c, l) {
            apply(c, 'in-fade'); var helper = controller(c, 'in'); drag(helper, 2, 2); l.inPoint = 2.5; l.outPoint = 3.5;
            near(entry(c, 'in').range.start, 2); near(entry(c, 'in').range.visibleStart, 2.5); near(entry(c, 'in').range.visibleEnd, 3.5);
            l.startTime += .2; near(helper.marker.keyTime(1), 2); near(value(l, 'ADBE Opacity', 3), 87.5);
        });
        check('replacing a preset updates default marker labels without moving its range', function (c, l) {
            apply(c, 'in-fade'); var helper = controller(c, 'in'); drag(helper, 2, 2); apply(c, 'in-slide');
            assert(helper.marker.keyValue(1).comment === '[MG] 滑入'); near(helper.marker.keyTime(1), 2); near(helper.marker.keyValue(1).duration, 2);
        });
    } catch (e) { report.failed.push({ name: 'setup', message: e.message, line: e.line }); }
    var file = File(root.fsName + '/test-results/ae-marker-timing.json'); file.encoding = 'UTF-8'; if (file.open('w')) { file.write(JSON.stringify(report, null, 2)); file.close(); }
}());
