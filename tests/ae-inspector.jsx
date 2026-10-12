// Native tests run only inside the guarded, empty run-jsx-tests instance.
(function () {
    var root = File($.fileName).parent.parent, bundle = $.global.MGInspectionBundle, host = bundle.host, catalog = bundle.catalog;
    var report = { version: app.version, passed: [], failed: [], safeInstance: false };
    function assert(value, message) { if (!value) { throw new Error(message || 'assertion failed'); } }
    function near(a, b) { assert(Math.abs(a - b) < .0001, a + ' != ' + b); }
    function choose(c, layers) { for (var i = 1; i <= c.numLayers; i++) { c.layer(i).selected = false; } for (i = 0; i < layers.length; i++) { layers[i].selected = true; } }
    function apply(c, id, changes) { var p = catalog.defaults(id); for (var k in changes) { if (changes.hasOwnProperty(k)) { p[k] = changes[k]; } } var r = host.run({ action: 'apply', data: { id: id, params: p } }, c); assert(r.ok, JSON.stringify(r)); }
    function inspect(c) { return host.run({ action: 'inspect' }, c).data; }
    function autoApply(c, id, changes) { return host.run({ action: 'apply', data: { id: id, params: changes || {}, autoMarkers: true } }, c); }
    function entry(c, category) { var list = inspect(c).entries; for (var i = 0; i < list.length; i++) { if (list[i].category === category) { return list[i]; } } return null; }
    function control(l, category, field) { return l.property('ADBE Effect Parade').property('MG / ' + category + ' / ' + field).property(1); }
    function check(name, fn) {
        var c = null;
        try { c = app.project.items.addComp('MG INSPECTION TEST ONLY', 640, 480, 1, 6, 30); var l = c.layers.addShape(); l.inPoint = 1; l.outPoint = 5; c.time = 2; choose(c, [l]); fn(c, l); report.passed.push(name); }
        catch (e) { report.failed.push({ name: name, message: e.message, line: e.line }); }
        finally { if (c) { c.remove(); } }
    }
    try {
        assert(app.project && app.project.numItems === 0 && !app.project.file, 'Refusing nonempty project'); report.safeInstance = true;
        check('legacy metadata lists all slots without modifying the layer', function (c, l) {
            apply(c, 'in-slide', {}); apply(c, 'loop-breathe', {}); apply(c, 'out-fade', { duration: .4 }); apply(c, 'feedback-pop', { duration: .3, delay: .2 });
            var before = l.comment, effects = l.property('ADBE Effect Parade').numProperties, result = inspect(c);
            assert(result.entries.length === 4); assert(result.layerId === l.id); assert(result.compId === c.id); assert(l.comment === before); assert(l.property('ADBE Effect Parade').numProperties === effects); assert(l.property('ADBE Marker').numKeys === 0);
            near(entry(c, 'in').range.start, 1); near(entry(c, 'in').range.end, 1.6); near(entry(c, 'loop').range.end, 5); near(entry(c, 'out').range.start, 4.6); near(entry(c, 'feedback').range.start, 2.2); near(entry(c, 'feedback').range.end, 2.5);
        });
        check('range follows live sliders, trimming, and layer movement', function (c, l) {
            apply(c, 'in-slide', {}); apply(c, 'out-fade', {}); apply(c, 'feedback-pop', {});
            control(l, '入场动画', '时长 秒').setValue(1.2); control(l, '入场动画', '偏移 秒').setValue(.25); l.outPoint = 4; l.startTime += .5;
            near(entry(c, 'in').range.start, 1.75); near(entry(c, 'in').range.end, 2.95); near(entry(c, 'out').range.end, 4.5); near(entry(c, 'feedback').range.start, 2.5);
        });
        check('frame labels use internal zero even with a nonzero display timecode', function (c, l) {
            c.displayStartTime = 10; apply(c, 'in-fade', {}); near(entry(c, 'in').range.startFrame, 30); near(entry(c, 'in').range.endFrame, 48);
        });
        check('same-time boundaries merge without duplicating markers', function (c, l) {
            apply(c, 'in-fade', {}); apply(c, 'loop-breathe', {}); apply(c, 'out-fade', {});
            host.run({ action: 'markRanges' }, c); var m = l.property('ADBE Marker'); assert(m.numKeys === 4, 'expected four unique boundaries');
            assert(m.keyValue(1).comment.indexOf('淡入 开始') >= 0 && m.keyValue(1).comment.indexOf('呼吸 开始') >= 0);
            assert(m.keyValue(4).comment.indexOf('呼吸 结束') >= 0 && m.keyValue(4).comment.indexOf('淡出 结束') >= 0);
            assert(!inspect(c).markerStale); host.run({ action: 'markRanges' }, c); assert(m.numKeys === 4);
        });
        check('user markers including MG-looking comments are preserved', function (c, l) {
            apply(c, 'in-fade', {}); var m = l.property('ADBE Marker'), user = new MarkerValue('[MG] User note'); user.duration = .25; user.setParameters({ author: 'user' }); m.setValueAtTime(1, user);
            var r = host.run({ action: 'markRanges' }, c); assert(r.skipped.length === 1); assert(m.numKeys === 2); assert(m.keyValue(1).comment === '[MG] User note'); near(m.keyValue(1).duration, .25); assert(m.keyValue(1).getParameters().author === 'user');
            host.run({ action: 'clearRanges' }, c); assert(m.numKeys === 1); assert(m.keyValue(1).comment === '[MG] User note');
        });
        check('changed timing is flagged as stale until markers are refreshed', function (c, l) {
            apply(c, 'in-fade', {}); host.run({ action: 'markRanges' }, c); control(l, '入场动画', '时长 秒').setValue(1);
            assert(inspect(c).markerStale); host.run({ action: 'markRanges' }, c); assert(!inspect(c).markerStale); near(l.property('ADBE Marker').keyTime(2), 2);
        });
        check('removing a module and refreshing removes only its boundaries', function (c, l) {
            apply(c, 'in-fade', {}); apply(c, 'loop-breathe', {}); host.run({ action: 'markRanges' }, c); host.run({ action: 'remove', data: { category: 'in' } }, c);
            assert(inspect(c).markerStale); host.run({ action: 'markRanges' }, c); assert(l.property('ADBE Marker').numKeys === 2); assert(l.property('ADBE Marker').keyValue(1).comment.indexOf('淡入') < 0); assert(entry(c, 'loop'));
        });
        check('navigation seeks visible start and final frame, never beyond out-point', function (c, l) {
            apply(c, 'in-fade', {}); host.run({ action: 'locate', data: { category: 'in', edge: 'start' } }, c); near(c.time, 1);
            host.run({ action: 'locate', data: { category: 'in', edge: 'end' } }, c); near(c.time, 47 / 30);
        });
        check('stale panel selection cannot modify a different layer', function (c, l) {
            apply(c, 'in-fade', {}); var before = inspect(c), other = c.layers.addShape(); choose(c, [other]); var rejected = false;
            try { host.run({ action: 'markRanges', data: { compId: before.compId, layerId: before.layerId } }, c); } catch (e) { rejected = true; }
            assert(rejected); assert(other.property('ADBE Marker').numKeys === 0);
        });
        check('animated timing has no misleading fixed range or markers', function (c, l) {
            apply(c, 'in-fade', {}); var p = control(l, '入场动画', '时长 秒'); p.setValueAtTime(1, .3); p.setValueAtTime(2, 1.5);
            assert(entry(c, 'in').dynamic && entry(c, 'in').range === null); var r = host.run({ action: 'markRanges' }, c); assert(r.skipped.length); assert(l.property('ADBE Marker').numKeys === 0);
        });
        check('disabled expressions are flagged and excluded from boundary markers', function (c, l) {
            apply(c, 'in-fade', {}); l.property('ADBE Transform Group').property('ADBE Opacity').expressionEnabled = false;
            assert(!entry(c, 'in').active); host.run({ action: 'markRanges' }, c); assert(l.property('ADBE Marker').numKeys === 0);
        });
        check('markers describe clipping rather than pretending an off-layer range is visible', function (c, l) {
            apply(c, 'in-fade', { delay: -.2 }); var e = entry(c, 'in'); near(e.range.start, .8); near(e.range.visibleStart, 1);
            host.run({ action: 'markRanges' }, c); assert(l.property('ADBE Marker').keyValue(1).comment.indexOf('裁入') >= 0);
            apply(c, 'feedback-pop', { delay: 20 }); assert(!entry(c, 'feedback').range.visible);
        });
        check('locked layers remain inspectable but cannot receive markers', function (c, l) {
            apply(c, 'in-fade', {}); l.locked = true; assert(inspect(c).entries.length === 1); var rejected = false;
            try { host.run({ action: 'markRanges' }, c); } catch (e) { rejected = true; } assert(rejected); assert(l.property('ADBE Marker').numKeys === 0); l.locked = false;
        });
        check('automatic markers appear immediately and update without duplicates', function (c, l) {
            assert(autoApply(c, 'in-fade').ok); var m = l.property('ADBE Marker'); assert(m.numKeys === 2); near(m.keyTime(1), 1); near(m.keyTime(2), 1.6);
            assert(autoApply(c, 'in-fade', { duration: 1.2 }).ok); assert(m.numKeys === 2); near(m.keyTime(2), 2.2); assert(!inspect(c).markerStale);
        });
        check('automatic markers use each selected layer range and preserve selection', function (c, l) {
            var other = c.layers.addShape(), untouched = c.layers.addShape(); other.inPoint = 2; other.outPoint = 4; choose(c, [l, other]);
            var r = autoApply(c, 'in-fade'); assert(r.ok && r.count === 2); assert(c.selectedLayers.length === 2 && l.selected && other.selected && !untouched.selected);
            near(l.property('ADBE Marker').keyTime(1), 1); near(other.property('ADBE Marker').keyTime(1), 2); near(other.property('ADBE Marker').keyTime(2), 2.6);
            assert(untouched.property('ADBE Marker').numKeys === 0 && untouched.comment === '');
        });
        check('automatic marker conflicts preserve user notes without failing animation', function (c, l) {
            var m = l.property('ADBE Marker'), user = new MarkerValue('User beat'); user.duration = .25; user.setParameters({ source: 'user' }); m.setValueAtTime(1, user);
            var r = autoApply(c, 'in-fade'); assert(r.ok && r.count === 1 && r.skipped.length === 1); assert(entry(c, 'in')); assert(m.numKeys === 2);
            assert(m.keyValue(1).comment === 'User beat'); near(m.keyValue(1).duration, .25); assert(m.keyValue(1).getParameters().source === 'user');
        });
        check('automatic remove updates shared boundaries and clears the final module', function (c, l) {
            assert(autoApply(c, 'in-fade').ok); assert(autoApply(c, 'loop-breathe').ok);
            assert(host.run({ action: 'remove', data: { category: 'in', autoMarkers: true } }, c).ok);
            var m = l.property('ADBE Marker'); assert(m.numKeys === 2); assert(m.keyValue(1).comment.indexOf('淡入') < 0); assert(m.keyValue(1).comment.indexOf('呼吸') >= 0); assert(!inspect(c).markerStale);
            assert(host.run({ action: 'remove', data: { category: 'loop', autoMarkers: true } }, c).ok); assert(m.numKeys === 0); assert(l.comment === '');
        });
        check('failed automatic application leaves markers unchanged', function (c, l) {
            var m = l.property('ADBE Marker'); m.setValueAtTime(1, new MarkerValue('User beat'));
            l.property('ADBE Transform Group').property('ADBE Position').expression = 'value+[5,0]';
            var r = autoApply(c, 'in-slide'); assert(!r.ok); assert(m.numKeys === 1 && m.keyValue(1).comment === 'User beat'); assert(l.comment === '');
        });
        check('automatic marker updates can be disabled explicitly', function (c, l) {
            var r = host.run({ action: 'apply', data: { id: 'in-fade', autoMarkers: false } }, c); assert(r.ok); assert(l.property('ADBE Marker').numKeys === 0);
            host.run({ action: 'inspect' }, c); assert(l.property('ADBE Marker').numKeys === 0);
        });
        check('empty and multiple selections return guidance instead of stale entries', function (c, l) {
            apply(c, 'in-fade', {}); var other = c.layers.addShape(); choose(c, [l, other]); assert(inspect(c).entries.length === 0 && inspect(c).count === 2);
            choose(c, []); assert(inspect(c).entries.length === 0); assert(host.run({ action: 'inspect' }, null).data.entries.length === 0);
        });
    } catch (e) { report.failed.push({ name: 'setup', message: e.message, line: e.line }); }
    var output = File(root.fsName + '/test-results/ae-inspector.json'); output.encoding = 'UTF-8'; if (output.open('w')) { output.write(JSON.stringify(report, null, 2)); output.close(); }
}());
