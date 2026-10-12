// Native project tests: only run in the guarded fresh run-jsx-tests instance.
(function () {
    var root = File($.fileName).parent.parent, bundle = $.global.MGInspectionBundle, host = bundle.host, legacy = $.global.MGLegacyTimingHost;
    var report = { version: app.version, passed: [], failed: [], safeInstance: false };
    function assert(v, message) { if (!v) { throw new Error(message || 'assertion failed'); } }
    function near(a, b) { assert(Math.abs(a - b) < .001, a + ' != ' + b); }
    function choose(c, layers) { for (var i = 1; i <= c.numLayers; i++) { c.layer(i).selected = false; } for (i = 0; i < layers.length; i++) { layers[i].selected = true; } }
    function apply(c, id, params) { var r = host.run({ action: 'apply', data: { id: id, params: params || {}, markerTiming: true } }, c); assert(r.ok, JSON.stringify(r)); return r; }
    function action(c, name, category, extra) { var data = extra || {}; data.category = category; return host.run({ action: name, data: data }, c); }
    function entry(c, category) { var entries = host.run({ action: 'inspect' }, c).data.entries; for (var i = 0; i < entries.length; i++) { if (entries[i].category === category) { return entries[i]; } } return null; }
    function state(l) { var text = l.comment, a = text.lastIndexOf('\n[MotionGraphics:1]\n') + 20; return JSON.parse(text.substring(a, text.indexOf('\n[/MotionGraphics]', a))); }
    function keyIndex(l, category) { var key = state(l).slots[category].timing.key; for (var i = 1; i <= l.marker.numKeys; i++) { if (l.marker.keyValue(i).getParameters().MotionGraphicsTiming === key) { return i; } } return 0; }
    function drag(l, category, start, duration) { var index = keyIndex(l, category), v = l.marker.keyValue(index); v.duration = duration; l.marker.removeKey(index); l.marker.setValueAtTime(start, v); }
    function value(l, name, time) { var p = l.property('ADBE Transform Group').property(name), v = p.valueAtTime(time, false); assert(!p.expressionError, p.expressionError); return v; }
    function nativeProp(group, matchName) { for (var i = 1; i <= group.numProperties; i++) { var p = group.property(i); if (p.matchName === matchName) { return p; } if (p.propertyType !== PropertyType.PROPERTY) { var nested = nativeProp(p, matchName); if (nested) { return nested; } } } return null; }
    function legacyApply(c, id, params) { var r = legacy.run({ action: 'apply', data: { id: id, params: params || {}, markerTiming: true } }, c); assert(r.ok, JSON.stringify(r)); var category = bundle.catalog.find(id).category, id = entry(c, category).timing.controllerId; for (var i = 1; i <= c.numLayers; i++) { if (c.layer(i).id === id) { return c.layer(i); } } return null; }
    function check(name, fn) {
        var c = null;
        try { c = app.project.items.addComp('MG LAYER TIMING TEST ONLY', 640, 480, 1, 8, 30); var l = c.layers.addShape(); l.name = 'Card'; l.inPoint = 1; l.outPoint = 7; c.time = 2; choose(c, [l]); fn(c, l); report.passed.push(name); }
        catch (e) { report.failed.push({ name: name, message: e.message, line: e.line }); }
        finally { if (c) { c.remove(); } }
    }
    try {
        assert(app.project && app.project.numItems === 0 && !app.project.file, 'Refusing nonempty project'); report.safeInstance = true;
        check('new presets use source markers without creating layers or bindings', function (c, l) {
            apply(c, 'in-fade'); assert(c.numLayers === 1 && l.marker.numKeys === 1); assert(entry(c, 'in').timing.location === 'layer');
            near(l.marker.keyTime(1), 1); near(l.marker.keyValue(1).duration, .6); assert(!l.effect('MG / 入场动画 / 范围图层'));
            assert(l.selected && c.selectedLayers.length === 1);
        });
        check('new loop ranges start at the playhead and last exactly one second', function (c, l) {
            apply(c, 'in-fade'); var r = apply(c, 'loop-breathe'); assert(c.numLayers === 1 && l.marker.numKeys === 2 && r.message.indexOf('顺延') < 0);
            near(entry(c, 'in').range.start, 1); near(entry(c, 'loop').range.start, 2); near(entry(c, 'loop').range.end, 3); near(l.marker.keyValue(keyIndex(l, 'loop')).duration, 1);
        });
        check('playhead conflicts still shift the one-second range by one frame', function (c, l) {
            c.time = 1; apply(c, 'in-fade'); var r = apply(c, 'loop-breathe'); assert(r.message.indexOf('顺延') >= 0);
            near(entry(c, 'loop').range.start, 1 + c.frameDuration); near(entry(c, 'loop').range.end, 2 + c.frameDuration);
        });
        check('occupied user timestamps are skipped and their markers are preserved', function (c, l) {
            var v = new MarkerValue('[MG] User note'); v.duration = .25; v.setParameters({ custom: 'preserve' }); l.marker.setValueAtTime(1, v); l.marker.setValueAtTime(1 + c.frameDuration, new MarkerValue('Beat'));
            apply(c, 'in-fade'); near(entry(c, 'in').range.start, 1 + 2 * c.frameDuration); assert(l.marker.numKeys === 3); near(l.marker.keyValue(1).duration, .25); assert(l.marker.keyValue(1).getParameters().custom === 'preserve');
        });
        check('different starts can have overlapping duration ranges', function (c, l) {
            apply(c, 'in-fade'); apply(c, 'loop-breathe'); action(c, 'setTiming', 'loop', { start: 2.2, end: 5.2 }); action(c, 'setTiming', 'in', { start: 2, end: 4 });
            near(entry(c, 'in').range.end, 4); near(entry(c, 'loop').range.start, 2.2); near(entry(c, 'loop').range.end, 5.2); assert(l.marker.numKeys === 2);
        });
        check('direct marker movement and stretching drive evaluated opacity', function (c, l) {
            apply(c, 'in-fade'); drag(l, 'in', 2, 2); near(value(l, 'ADBE Opacity', 1.9), 0); near(value(l, 'ADBE Opacity', 3), 87.5); near(value(l, 'ADBE Opacity', 4), 100);
            near(l.inPoint, 1); near(l.outPoint, 7);
        });
        check('all 80 presets retain their poses after source marker translation', function (c, l) {
            for (var i = 0; i < bundle.catalog.presets.length; i++) {
                var p = bundle.catalog.presets[i]; if (p.type !== 'ui') { continue; } try { apply(c, p.id); } catch (applyError) { throw new Error(p.id + ': ' + applyError.message); } drag(l, p.category, 2, 1.2);
                var names = ['ADBE Position', 'ADBE Scale', 'ADBE Rotate Z', 'ADBE Opacity'], samples = [], j, k;
                for (j = 0; j < names.length; j++) { samples.push(value(l, names[j], 2.3)); } drag(l, p.category, 3, 1.2);
                for (j = 0; j < names.length; j++) { var now = value(l, names[j], 3.3); if (typeof now === 'number') { near(now, samples[j]); } else { for (k = 0; k < now.length; k++) { near(now[k], samples[j][k]); } } }
                assert(action(c, 'remove', p.category).ok && c.numLayers === 1 && l.marker.numKeys === 0);
            }
        });
        check('updated right blur recreates the latest position, Y stretch and bounce timing', function (c, l) {
            apply(c, 'in-right-smear'); var start = 1, d = bundle.catalog.defaults('in-right-smear').duration, basePos = l.transform.position.valueAtTime(start, true), baseScale = l.transform.scale.valueAtTime(start, true);
            var blur = l.effect('MG / IN 22 / Motion Blur'); assert(blur && blur.matchName === 'CC Force Motion Blur');
            near(blur.property(1).value, 8); near(blur.property(3).value, 180);
            var pos = value(l, 'ADBE Position', start), scale = value(l, 'ADBE Scale', start), opacity = value(l, 'ADBE Opacity', start);
            near(pos[0], basePos[0]); near(pos[1], basePos[1] + 1208); near(scale[0], baseScale[0]); near(scale[1], baseScale[1] * 1.81); near(opacity, 100);
            pos = value(l, 'ADBE Position', start + .1333333333); scale = value(l, 'ADBE Scale', start + .1333333333); assert(Math.abs(pos[1] - basePos[1]) < .1); near(scale[0], baseScale[0]); near(scale[1], baseScale[1]);
            pos = value(l, 'ADBE Position', start + .2); assert(Math.abs(pos[1] - basePos[1]) > 1);
            scale = value(l, 'ADBE Scale', start + d + .001); pos = value(l, 'ADBE Position', start + d + .001); near(scale[0], baseScale[0]); near(scale[1], baseScale[1]); near(pos[1], basePos[1]); near(l.marker.keyValue(1).duration, d);
        });
        check('right smear preserves native blur edits and leaves manual blur effects alone', function (c, l) {
            l.effect.addProperty('CC Force Motion Blur'); apply(c, 'in-right-smear');
            var owned = l.effect('MG / IN 22 / Motion Blur'); assert(owned && owned.matchName === 'CC Force Motion Blur' && l.effect('CC Force Motion Blur'));
            owned.property(1).setValue(14); l.effect('MG / 入场动画 / 时长 秒')(1).setValue(.9); var markerTime = l.marker.keyTime(1);
            var r = host.run({ action: 'apply', data: { id: 'in-right-smear', markerTiming: true, reuseExisting: true } }, c); assert(r.ok, JSON.stringify(r));
            near(l.effect('MG / IN 22 / Motion Blur').property(1).value, 14); near(l.effect('MG / 入场动画 / 时长 秒')(1).value, .9); near(l.marker.keyTime(1), markerTime);
            apply(c, 'in-fade'); assert(!l.effect('MG / IN 22 / Motion Blur') && l.effect('CC Force Motion Blur'));
        });
        check('right smear repairs a deleted owned blur without resetting animation controls', function (c, l) {
            apply(c, 'in-right-smear'); l.effect('MG / 入场动画 / 时长 秒')(1).setValue(.9); l.effect('MG / IN 22 / Motion Blur').remove(); var markerTime = l.marker.keyTime(1);
            var r = host.run({ action: 'apply', data: { id: 'in-right-smear', markerTiming: true, reuseExisting: true } }, c); assert(r.ok && r.message.indexOf('补回') >= 0, JSON.stringify(r));
            assert(l.effect('MG / IN 22 / Motion Blur').matchName === 'CC Force Motion Blur'); near(l.effect('MG / 入场动画 / 时长 秒')(1).value, .9); near(l.marker.keyTime(1), markerTime);
        });
        check('right smear rejects a conflicting owned effect name without partial changes', function (c, l) {
            l.effect.addProperty('ADBE Angle Control').name = 'MG / IN 22 / Motion Blur'; var before = l.comment;
            var r = host.run({ action: 'apply', data: { id: 'in-right-smear', markerTiming: true } }, c); assert(!r.ok && r.skipped.length);
            assert(l.comment === before && l.marker.numKeys === 0 && l.effect.numProperties === 1); assert(l.effect(1).matchName === 'ADBE Angle Control');
        });
        check('reference native effects follow ranges and replacements clean only owned effects', function (c, l) {
            apply(c, 'in-ref-converge'); var blur = l.effect('MG / IN 10 / Motion Blur'), gaussian = l.effect('MG / IN 10 / Gaussian Blur'), slant = l.effect('MG / IN 10 / Slant');
            assert(blur && gaussian && slant && blur.matchName === 'CC Force Motion Blur' && gaussian.matchName === 'ADBE Gaussian Blur 2' && slant.matchName === 'CC Slant');
            near(blur.property(3).value, 411); near(gaussian.property(1).valueAtTime(1, false), 42.1); near(slant.property(1).valueAtTime(1, false), -18);
            var axis = slant.property(4).value; near(axis[0], l.width * .5); near(axis[1], l.height);
            near(gaussian.property(1).valueAtTime(1.3, false), 0); near(slant.property(1).valueAtTime(1.3, false), 0);
            apply(c, 'in-ref-jitter-sling'); assert(!l.effect('MG / IN 10 / Motion Blur') && !l.effect('MG / IN 10 / Gaussian Blur') && !l.effect('MG / IN 10 / Slant'));
            var turbulence = l.effect('MG / IN 06 / Turbulence'); assert(turbulence && turbulence.matchName === 'ADBE Turbulent Displace'); near(turbulence.property(2).valueAtTime(1, false), 128); near(turbulence.property(2).valueAtTime(1.6, false), 0);
            apply(c, 'in-ref-snow-glow'); assert(!l.effect('MG / IN 06 / Turbulence') && l.effect('MG / IN 27 / Glow') && l.effect('MG / IN 27 / Gaussian Blur'));
            assert(action(c, 'remove', 'in').ok && !l.effect('MG / IN 27 / Glow') && !l.effect('MG / IN 27 / Gaussian Blur'));
        });
        check('entrance and exit native effects remain independently owned', function (c, l) {
            apply(c, 'in-ref-converge'); apply(c, 'out-ref-left-blur');
            assert(l.effect('MG / IN 10 / Motion Blur') && l.effect('MG / IN 10 / Slant') && l.effect('MG / OUT 22 / Motion Blur') && l.effect('MG / OUT 22 / Slant'));
            assert(action(c, 'remove', 'out').ok); assert(l.effect('MG / IN 10 / Motion Blur') && l.effect('MG / IN 10 / Slant'));
            assert(!l.effect('MG / OUT 22 / Motion Blur') && !l.effect('MG / OUT 22 / Slant'));
        });
        check('exit native curves hold the final pose and scale animated effect points', function (c, l) {
            apply(c, 'out-ref-stretch-blur'); var range = entry(c, 'out').range, glow = l.effect('MG / OUT 09 / Glow'), radial = l.effect('MG / OUT 09 / Radial Blur');
            assert(glow && radial && glow.matchName === 'ADBE Glo2' && radial.matchName === 'ADBE Radial Blur');
            var threshold = nativeProp(glow, 'ADBE Glo2-0002'), half = range.start + (range.end - range.start) * .5;
            near(threshold.valueAtTime(range.start, false), 0); near(threshold.valueAtTime(half, false), 46); near(threshold.valueAtTime(range.end, false), 46);
            assert(action(c, 'remove', 'out').ok); apply(c, 'out-ref-dissipate'); range = entry(c, 'out').range;
            var page = l.effect('MG / OUT 23 / Page Turn'), turbulence = l.effect('MG / OUT 23 / Turbulence'), fold = nativeProp(page, 'CC Page Turn-0001'), start = fold.valueAtTime(range.start, false), end = fold.valueAtTime(range.end, false);
            var foldStart = l.effect('MG / OUT 23 / Fold Start'), foldEnd = l.effect('MG / OUT 23 / Fold End');
            assert(page && turbulence && foldStart && foldEnd && page.matchName === 'CC Page Turn' && turbulence.matchName === 'ADBE Turbulent Displace');
            near(start[0], l.width * 596 / 1920); near(start[1], l.height * 520 / 1920); near(end[0], l.width * -300 / 1920); near(end[1], l.height * -504 / 1920);
            foldStart.property(1).setValue([100, 150]); foldEnd.property(1).setValue([500, 350]);
            start = fold.valueAtTime(range.start, false); end = fold.valueAtTime(range.end, false); near(start[0], 100); near(start[1], 150); near(end[0], 500); near(end[1], 350);
            apply(c, 'out-ref-dissipate'); near(foldStart.property(1).value[0], 100); near(foldStart.property(1).value[1], 150); near(foldEnd.property(1).value[0], 500); near(foldEnd.property(1).value[1], 350);
            l.comment = l.comment.replace('"id":"out-ref-dissipate","version":2', '"id":"out-ref-dissipate","version":1'); l.effect('MG / OUT 23 / Fold Start').remove(); l.effect('MG / OUT 23 / Fold End').remove();
            var upgraded = host.run({ action: 'apply', data: { id: 'out-ref-dissipate', markerTiming: true, reuseExisting: true } }, c); assert(upgraded.ok, JSON.stringify(upgraded));
            fold = nativeProp(l.effect('MG / OUT 23 / Page Turn'), 'CC Page Turn-0001'); assert(l.effect('MG / OUT 23 / Fold Start') && l.effect('MG / OUT 23 / Fold End') && !fold.expressionError);
        });
        check('both expression engines read source marker time and duration', function (c, l) {
            var before = app.project.expressionEngine, engines = ['extendscript', 'javascript-1.0'];
            try { for (var i = 0; i < engines.length; i++) { app.project.expressionEngine = engines[i]; apply(c, 'in-fade'); drag(l, 'in', 2, 2); near(value(l, 'ADBE Opacity', 3), 87.5); action(c, 'remove', 'in'); } }
            finally { app.project.expressionEngine = before; }
        });
        check('loop bounds stop motion but period remains independent', function (c, l) {
            apply(c, 'loop-spin', { period: 2, angle: 360 }); drag(l, 'loop', 2, .5); near(value(l, 'ADBE Rotate Z', 1.9), 0); near(value(l, 'ADBE Rotate Z', 2.25), 45); near(value(l, 'ADBE Rotate Z', 6), 90);
            l.effect('MG / 循环动画 / 周期 秒')(1).setValue(1); near(value(l, 'ADBE Rotate Z', 6), 180); near(entry(c, 'loop').range.end, 2.5);
        });
        check('reapply preserves dragged ranges and custom marker data', function (c, l) {
            apply(c, 'in-fade'); drag(l, 'in', 2, 2); var v = l.marker.keyValue(1), p = v.getParameters(); p.user = 'keep'; v.setParameters(p); v.comment = 'My entrance'; l.marker.setValueAtKey(1, v);
            apply(c, 'in-slide', { duration: .1, delay: 5, distance: 200 }); near(entry(c, 'in').range.start, 2); near(entry(c, 'in').range.end, 4); assert(l.marker.keyValue(1).comment === 'My entrance' && l.marker.keyValue(1).getParameters().user === 'keep'); assert(c.numLayers === 1);
        });
        check('preset replacement changes only default marker labels', function (c, l) { apply(c, 'in-fade'); apply(c, 'in-slide'); assert(l.marker.keyValue(1).comment === '[MG] 滑入'); near(l.marker.keyTime(1), 1); });
        check('numeric range edits avoid occupied starts and retain requested duration', function (c, l) {
            apply(c, 'in-fade'); l.marker.setValueAtTime(3, new MarkerValue('User beat')); var r = action(c, 'setTiming', 'in', { start: 3, end: 5 }); assert(r.ok && r.message.indexOf('顺延') >= 0);
            near(entry(c, 'in').range.start, 3 + c.frameDuration); near(entry(c, 'in').range.end, 5 + c.frameDuration); assert(l.marker.keyValue(1).comment === 'User beat');
        });
        check('invalid and zero ranges are rejected but one-frame ranges work', function (c, l) {
            apply(c, 'in-fade'); action(c, 'setTiming', 'in', { start: 2, end: 2 + c.frameDuration }); near(value(l, 'ADBE Opacity', 2 + c.frameDuration), 100);
            var invalid = [{ start: '', end: 3 }, { start: 3, end: 3 }, { start: 4, end: 2 }, { start: 'NaN', end: 4 }];
            for (var i = 0; i < invalid.length; i++) { var rejected = false; try { action(c, 'setTiming', 'in', invalid[i]); } catch (e) { rejected = true; } assert(rejected); } near(entry(c, 'in').range.start, 2);
        });
        check('moving the source carries its markers and evaluated animation', function (c, l) {
            apply(c, 'in-fade'); drag(l, 'in', 2, 2); l.startTime += .5; near(entry(c, 'in').range.start, 2.5); near(value(l, 'ADBE Opacity', 3.5), 87.5);
            l.inPoint = 3; l.outPoint = 4; near(entry(c, 'in').range.start, 2.5); near(entry(c, 'in').range.visibleStart, 3);
        });
        check('duplicating the source creates independent range markers immediately', function (c, l) {
            apply(c, 'in-fade'); var dup = l.duplicate(); choose(c, [dup]); assert(!entry(c, 'in').timing.shared); drag(dup, 'in', 3, 2);
            near(value(dup, 'ADBE Opacity', 3), 0); near(value(l, 'ADBE Opacity', 3), 100); assert(c.numLayers === 2);
        });
        check('composition copies keep marker timing self-contained', function (c, l) {
            apply(c, 'in-fade'); var copy = c.duplicate(); try { var target = copy.layer('Card'); choose(copy, [target]); drag(target, 'in', 3, 2); near(value(target, 'ADBE Opacity', 4), 87.5); near(value(l, 'ADBE Opacity', 4), 100); } finally { copy.remove(); }
        });
        check('deleted markers stop motion after layer movement and explicit repair can restore pending slots', function (c, l) {
            apply(c, 'in-fade'); action(c, 'setTiming', 'in', { start: 2, end: 4 }); l.marker.removeKey(1); l.startTime += .5; assert(entry(c, 'in').timing.deleted && entry(c, 'in').range === null); near(value(l, 'ADBE Opacity', 3.5), 100);
            assert(action(c, 'enableTiming', 'in').ok); near(entry(c, 'in').range.start, 2.5); assert(c.numLayers === 1 && l.marker.numKeys === 1);
        });
        check('manual same-time overwrite is detected and repair finds a free start', function (c, l) {
            apply(c, 'in-fade'); apply(c, 'loop-breathe'); drag(l, 'loop', 1, 6); assert(!entry(c, 'in').timing.valid && entry(c, 'loop').timing.valid && l.marker.numKeys === 1);
            action(c, 'enableTiming', 'in'); near(entry(c, 'in').range.start, 1 + c.frameDuration); near(entry(c, 'loop').range.start, 1); assert(l.marker.numKeys === 2);
        });
        check('zero-duration and duplicated marker IDs use fallback until repaired', function (c, l) {
            apply(c, 'in-fade'); var v = l.marker.keyValue(1); v.duration = 0; l.marker.setValueAtKey(1, v); assert(!entry(c, 'in').timing.valid); near(value(l, 'ADBE Opacity', 1.3), 87.5);
            action(c, 'enableTiming', 'in'); v = l.marker.keyValue(1); l.marker.setValueAtTime(3, v); assert(!entry(c, 'in').timing.valid); action(c, 'enableTiming', 'in'); assert(l.marker.numKeys === 1 && entry(c, 'in').timing.valid);
        });
        check('legacy snapshot conversion keeps live timing and user markers', function (c, l) {
            host.run({ action: 'apply', data: { id: 'in-fade', params: { duration: 1.2, delay: .25 }, autoMarkers: true } }, c); l.marker.setValueAtTime(6, new MarkerValue('User'));
            action(c, 'enableTiming', 'in'); near(entry(c, 'in').range.start, 1.25); near(entry(c, 'in').range.end, 2.45); assert(l.marker.numKeys === 2 && l.marker.keyValue(2).comment === 'User' && c.numLayers === 1);
        });
        check('actual 1.1.0 controller ranges migrate preserving edited timing and metadata', function (c, l) {
            var helper = legacyApply(c, 'in-fade'); var v = helper.marker.keyValue(1); v.duration = 2; v.comment = 'Custom'; helper.marker.removeKey(1); helper.marker.setValueAtTime(2, v); near(value(l, 'ADBE Opacity', 3), 87.5);
            assert(action(c, 'enableTiming', 'in').ok); assert(c.numLayers === 1 && entry(c, 'in').timing.location === 'layer'); near(value(l, 'ADBE Opacity', 3), 87.5); assert(l.marker.keyValue(1).comment === 'Custom'); assert(!l.effect('MG / 入场动画 / 范围图层'));
        });
        check('migrating same-start 1.1.0 modules offsets only the later migration', function (c, l) {
            legacyApply(c, 'in-fade'); legacyApply(c, 'loop-breathe'); action(c, 'enableTiming', 'in'); var r = action(c, 'enableTiming', 'loop'); assert(r.message.indexOf('顺延') >= 0);
            assert(c.numLayers === 1 && l.marker.numKeys === 2); near(entry(c, 'in').range.start, 1); near(entry(c, 'loop').range.start, 1 + c.frameDuration);
        });
        check('shared legacy helpers survive until all owners migrate', function (c, l) {
            var helper = legacyApply(c, 'in-fade'), dup = l.duplicate(); choose(c, [dup]); action(c, 'enableTiming', 'in'); assert(c.numLayers === 3); drag(dup, 'in', 3, 2); near(value(l, 'ADBE Opacity', 3), 100);
            choose(c, [l]); assert(entry(c, 'in').timing.location === 'controller'); action(c, 'enableTiming', 'in'); assert(c.numLayers === 2); near(value(dup, 'ADBE Opacity', 3), 0);
        });
        check('migration from selected helper preserves its user content and selects artwork', function (c, l) {
            var helper = legacyApply(c, 'in-fade'); helper.marker.setValueAtTime(6, new MarkerValue('User note')); choose(c, [helper]); action(c, 'enableTiming', 'in');
            assert(l.selected && c.selectedLayers.length === 1 && c.numLayers === 2); assert(helper.marker.keyValue(2).comment === 'User note'); assert(entry(c, 'in').timing.location === 'layer');
        });
        check('legacy modes remain unchanged until explicitly converted', function (c, l) {
            host.run({ action: 'apply', data: { id: 'in-fade' } }, c); apply(c, 'in-slide'); assert(!entry(c, 'in').timing && l.marker.numKeys === 0);
            var helper = legacyApply(c, 'loop-breathe'), before = l.comment; entry(c, 'loop'); assert(l.comment === before); apply(c, 'loop-breathe'); assert(entry(c, 'loop').timing.location === 'controller' && c.numLayers === 2);
        });
        check('animated timing and foreign transform expressions are protected during conversion', function (c, l) {
            host.run({ action: 'apply', data: { id: 'in-fade' } }, c); var p = l.effect('MG / 入场动画 / 时长 秒')(1); p.setValueAtTime(1, .5); p.setValueAtTime(3, 2); var rejected = false;
            try { action(c, 'enableTiming', 'in'); } catch (e) { rejected = true; } assert(rejected && p.numKeys === 2 && l.marker.numKeys === 0);
            var other = c.layers.addShape(); other.transform.position.expression = 'value+[5,0]'; choose(c, [other]); var r = host.run({ action: 'apply', data: { id: 'in-right-smear', markerTiming: true } }, c); assert(!r.ok && other.marker.numKeys === 0 && c.numLayers === 2 && !other.effect('MG / IN 22 / Motion Blur'));
        });
        check('clear snapshots and remove one module preserve other ranges and user markers', function (c, l) {
            l.marker.setValueAtTime(6, new MarkerValue('User')); apply(c, 'in-fade'); apply(c, 'loop-breathe'); action(c, 'clearRanges', 'in'); assert(l.marker.numKeys === 3);
            action(c, 'remove', 'in'); assert(l.marker.numKeys === 2 && entry(c, 'loop').timing.valid); action(c, 'remove', 'loop'); assert(l.marker.numKeys === 1 && l.marker.keyValue(1).comment === 'User');
        });
        check('select-range chooses the owned marker and stale targets cannot edit another layer', function (c, l) {
            apply(c, 'in-fade'); apply(c, 'loop-breathe'); action(c, 'selectControl', 'loop'); assert(l.selected && l.marker.selectedKeys.length === 1 && l.marker.selectedKeys[0] === keyIndex(l, 'loop'));
            var before = host.run({ action: 'inspect' }, c).data, other = c.layers.addShape(); choose(c, [other]); var rejected = false;
            try { action(c, 'setTiming', 'in', { layerId: before.layerId, start: 3, end: 4 }); } catch (e) { rejected = true; } assert(rejected && other.marker.numKeys === 0);
        });
        check('multi-layer apply and stagger carry source markers exactly once', function (c, l) {
            var other = c.layers.addShape(); other.inPoint = 1; other.outPoint = 7; choose(c, [l, other]); var r = apply(c, 'in-fade'); assert(r.count === 2 && c.numLayers === 2 && c.selectedLayers.length === 2);
            r = host.run({ action: 'apply', data: { id: 'stagger-forward', params: { frames: 15 } } }, c); assert(r.ok && r.count === 2); near(l.inPoint, 1.5); near(l.marker.keyTime(1), 1.5); near(value(l, 'ADBE Opacity', 1.8), 87.5);
            host.run({ action: 'apply', data: { id: 'align-in' } }, c); near(l.marker.keyTime(1), 1);
        });
        check('inspection is read-only and locked sources reject range edits', function (c, l) {
            apply(c, 'in-fade'); drag(l, 'in', 2, 2); var before = l.comment; for (var i = 0; i < 4; i++) { entry(c, 'in'); } assert(l.comment === before); near(l.marker.keyTime(1), 2);
            l.locked = true; var rejected = false; try { action(c, 'setTiming', 'in', { start: 3, end: 5 }); } catch (e) { rejected = true; } assert(rejected); near(l.marker.keyTime(1), 2); l.locked = false;
        });
    } catch (e) { report.failed.push({ name: 'setup', message: e.message, line: e.line }); }
    var file = File(root.fsName + '/test-results/ae-layer-timing.json'); file.encoding = 'UTF-8'; if (file.open('w')) { file.write(JSON.stringify(report, null, 2)); file.close(); }
}());
