/* Run ONLY in a NEW instance: AfterFX.exe -m -noui -r <absolute script path>. */
(function () {
    var workspace = File($.fileName).parent.parent;
    $.evalFile(File(workspace.fsName + '/extension/vendor/json2.js'));
    var report = { version: app.version, passed: [], failed: [], safeInstance: false };
    function assert(value, message) { if (!value) { throw new Error(message || 'assertion failed'); } }
    function near(a, b, message) { assert(Math.abs(a - b) < .005, (message || 'not equal') + ': ' + a + ' vs ' + b); }
    function check(name, fn) { try { fn(); report.passed.push(name); } catch (e) { report.failed.push({ name: name, error: e.message, line: e.line }); } }
    function comp(name) { return app.project.items.addComp('MG TEST ' + name, 640, 480, 1, 6, 30); }
    function select(c, layers) { for (var i = 1; i <= c.numLayers; i++) { c.layer(i).selected = false; } for (i = 0; i < layers.length; i++) { layers[i].selected = true; } }
    function apply(c, id, params) { return MG.run({ action: 'apply', data: { id: id, params: params || catalog.defaults(id) } }, c); }
    function transform(layer, name) { return layer.property('ADBE Transform Group').property(name); }
    try {
        assert(app.project && app.project.numItems === 0 && !app.project.file, 'Not an empty isolated instance. No project changes were made.');
        report.safeInstance = true;
        var MG, catalog;
        if ($.global.MGSmokeBundle) { MG = $.global.MGSmokeBundle.host; catalog = $.global.MGSmokeBundle.catalog; }
        else { $.evalFile(File(workspace.fsName + '/extension/host/main.jsx')); MG = MG2023Host; catalog = MGCatalog; }
        for (var n = 0; n < catalog.presets.length; n++) {
            var preset = catalog.presets[n];
            if (preset.type !== 'ui') { continue; }
            (function (p) { check('UI ' + p.id, function () {
                var c = comp(p.id), layer = c.layers.addShape(); layer.name = 'card'; select(c, [layer]);
                var r = apply(c, p.id); assert(r.ok, JSON.stringify(r));
                var names = ['ADBE Position', 'ADBE Scale', 'ADBE Rotate Z', 'ADBE Opacity'];
                for (var j = 0; j < names.length; j++) {
                    var prop = transform(layer, names[j]);
                    var value = prop.valueAtTime(.23, false); assert(!prop.expressionError, prop.expressionError);
                    if (typeof value === 'number') { assert(isFinite(value), 'nonfinite'); }
                    else { for (var k = 0; k < value.length; k++) { assert(isFinite(value[k]), 'nonfinite vector'); } }
                }
                c.remove();
            }); }(preset));
        }
        check('compose, update, read and remove without duplicate controls', function () {
            var c = comp('compose'), l = c.layers.addShape(); l.comment = 'USER NOTES'; select(c, [l]);
            assert(apply(c, 'in-slide').ok); assert(apply(c, 'loop-breathe').ok); assert(apply(c, 'out-fade').ok);
            var total = l.property('ADBE Effect Parade').numProperties;
            assert(apply(c, 'in-slide').ok); assert(l.property('ADBE Effect Parade').numProperties === total, 'duplicate controls');
            var r = MG.run({ action: 'read', data: { category: 'in' } }, c); assert(r.data.id === 'in-slide');
            assert(MG.run({ action: 'remove', data: { category: 'in' } }, c).ok);
            assert(transform(l, 'ADBE Position').expression === '', 'position not cleared');
            assert(transform(l, 'ADBE Scale').expression !== '', 'loop lost');
            MG.run({ action: 'remove', data: { category: 'out' } }, c); MG.run({ action: 'remove', data: { category: 'loop' } }, c);
            assert(l.comment === 'USER NOTES', 'user notes changed'); assert(l.property('ADBE Effect Parade').numProperties === 0, 'controls remain'); c.remove();
        });
        check('preserve existing keyframes and refuse foreign expressions', function () {
            var c = comp('preserve'), l = c.layers.addShape(), pos = transform(l, 'ADBE Position'); select(c, [l]);
            pos.setValueAtTime(0, [100, 100]); pos.setValueAtTime(2, [200, 120]);
            assert(apply(c, 'in-slide').ok); assert(pos.numKeys === 2); near(pos.keyValue(1)[0], 100);
            MG.run({ action: 'remove', data: { category: 'in' } }, c);
            pos.expression = 'value+[3,0]'; var original = l.comment;
            assert(!apply(c, 'in-slide').ok, 'foreign expression overwritten'); assert(pos.expression === 'value+[3,0]'); assert(l.comment === original); c.remove();
        });
        check('separated position dimensions', function () {
            var c = comp('separated'), l = c.layers.addShape(), p = transform(l, 'ADBE Position'); p.dimensionsSeparated = true; select(c, [l]);
            assert(apply(c, 'in-slide').ok); assert(p.getSeparationFollower(0).expression); assert(!p.getSeparationFollower(1).expressionError); c.remove();
        });
        check('playhead animation follows layer shifts', function () {
            var c = comp('playhead'), l = c.layers.addShape(); l.startTime = 1; c.time = 2; select(c, [l]);
            assert(apply(c, 'feedback-pop').ok); var before = transform(l, 'ADBE Scale').valueAtTime(2.2, false)[0];
            l.startTime += .5; near(transform(l, 'ADBE Scale').valueAtTime(2.7, false)[0], before); c.remove();
        });
        for (var modeIndex = 0; modeIndex < 3; modeIndex++) {
            (function (id) { check(id, function () {
                var c = comp(id), l = c.layers.addShape(), p = transform(l, 'ADBE Rotate Z'); p.setValueAtTime(0, 0); p.setValueAtTime(1, 100); select(c, [l]);
                var expected = 25;
                if (id === 'keyloop-pingpong') { expected = 75; }
                if (id === 'keyloop-offset') { expected = 125; }
                var r = apply(c, id); assert(r.ok, JSON.stringify(r));
                near(p.valueAtTime(1.25, false), expected, id);
                assert(MG.run({ action: 'remove', data: { category: 'keyloop' } }, c).ok); assert(!p.expression); c.remove();
            }); }(['keyloop-cycle', 'keyloop-pingpong', 'keyloop-offset'][modeIndex]));
        }
        check('stagger shifts layers and internal keys; alignment preserves duration', function () {
            var c = comp('timing'), a = c.layers.addShape(), b = c.layers.addShape(); a.inPoint = 1; b.inPoint = 2;
            var p = transform(a, 'ADBE Rotate Z'); p.setValueAtTime(1, 0); p.setValueAtTime(2, 90); var key = p.keyTime(1);
            select(c, [a, b]); var r = apply(c, 'stagger-forward'); assert(r.ok, JSON.stringify(r));
            near(a.inPoint - b.inPoint, .1); near(p.keyTime(1) - key, .1);
            var aDuration = a.outPoint - a.inPoint, bDuration = b.outPoint - b.inPoint;
            assert(apply(c, 'align-sequence').ok); near(a.inPoint, b.outPoint); near(a.outPoint - a.inPoint, aDuration); near(b.outPoint - b.inPoint, bDuration);
            assert(apply(c, 'align-in').ok); near(a.inPoint, b.inPoint); c.remove();
        });
        check('entrance starts at in-point and exit ends at out-point', function () {
            var c = comp('anchor timing'), l = c.layers.addShape(); l.inPoint = 1; l.outPoint = 5; c.time = 2; select(c, [l]);
            assert(apply(c, 'in-fade').ok); var p = transform(l, 'ADBE Opacity');
            near(p.valueAtTime(1, false), 0); near(p.valueAtTime(1.6, false), 100);
            assert(apply(c, 'out-fade').ok); near(p.valueAtTime(3, false), 100); near(p.valueAtTime(5, false), 0);
            assert(p.valueAtTime(4.7, false) > 0 && p.valueAtTime(4.7, false) < 100);
            MG.run({ action: 'remove', data: { category: 'in' } }, c); MG.run({ action: 'remove', data: { category: 'out' } }, c);
            var params = catalog.defaults('in-fade'); params.anchor = 'playhead'; params.delay = .2;
            assert(apply(c, 'in-fade', params).ok); near(p.valueAtTime(2.2, false), 0); near(p.valueAtTime(2.8, false), 100); c.remove();
        });
        check('layer looping repeats or ping-pongs the cropped source without blank turn frames', function () {
            var source = app.project.items.addComp('MG TEST source', 640, 480, 1, 2, 30), c = comp('layerloop'), l = c.layers.add(source);
            l.startTime = .5; l.inPoint = 1; l.outPoint = 2; select(c, [l]);
            var r = apply(c, 'layerloop-cycle'); assert(r.ok, JSON.stringify(r)); var p = l.property('ADBE Time Remapping');
            near(p.valueAtTime(1.25, false), .75); near(p.valueAtTime(2.25, false), .75); near(p.valueAtTime(3, false), .5); near(l.outPoint, 6);
            assert(!apply(c, 'layerloop-cycle').ok, 'should not stack the same remapping mode');
            r = apply(c, 'layerloop-pingpong'); assert(r.ok && p.expression.indexOf('// Mode:pingpong') >= 0, JSON.stringify(r));
            near(p.valueAtTime(1, false), .5); near(p.valueAtTime(1 + 29 / 30, false), 1 + 14 / 30); near(p.valueAtTime(2, false), 1 + 13 / 30); near(p.valueAtTime(1 + 58 / 30, false), .5);
            assert(!apply(c, 'layerloop-pingpong').ok, 'should not stack ping-pong remapping');
            r = apply(c, 'layerloop-cycle'); assert(r.ok && p.expression.indexOf('// Mode:cycle') >= 0, JSON.stringify(r)); near(p.valueAtTime(2.25, false), .75);
            c.remove(); source.remove();
        });
        check('null parenting preserves animated world positions and original hierarchy', function () {
            var c = comp('parent'), parent = c.layers.addNull(), a = c.layers.addShape(), b = c.layers.addShape();
            transform(parent, 'ADBE Position').setValue([90, 120]); transform(parent, 'ADBE Scale').setValue([130, 130]);
            a.parent = parent; b.parent = parent; var p = transform(a, 'ADBE Position'); p.setValueAtTime(0, [80, 20]); p.setValueAtTime(2, [220, 50]);
            var point = a.property('ADBE Effect Parade').addProperty('ADBE Point Control'); point.name = 'World Probe'; point.property(1).expression = 'toComp(anchorPoint)';
            var before = point.property(1).valueAtTime(.75, false); select(c, [a, b]); assert(apply(c, 'parent-group').ok);
            var after = a.property('ADBE Effect Parade').property('World Probe').property(1).valueAtTime(.75, false);
            near(before[0], after[0]); near(before[1], after[1]); assert(a.parent === b.parent); assert(a.parent.parent === parent); assert(p.numKeys === 2);
            select(c, [a, b]); assert(apply(c, 'parent-each').ok); after = a.property('ADBE Effect Parade').property('World Probe').property(1).valueAtTime(.75, false);
            near(before[0], after[0]); near(before[1], after[1]); assert(a.parent !== b.parent); c.remove();
        });
        check('locked layers and mixed parents fail without unintended changes', function () {
            var c = comp('guards'), a = c.layers.addShape(), b = c.layers.addShape(), parent = c.layers.addNull(); a.parent = parent; select(c, [a, b]);
            var count = c.numLayers; var threw = false; try { apply(c, 'parent-group'); } catch (e) { threw = true; } assert(threw); assert(c.numLayers === count);
            select(c, [a]); a.locked = true; assert(!apply(c, 'in-fade').ok); a.locked = false; assert(a.comment === ''); c.remove();
        });
    } catch (error) { report.failed.push({ name: 'setup', error: error.message, line: error.line }); }
    var reportName = 'ae-smoke.json'; if ($.global.MGSmokeBundle) { reportName = 'ae-jsx-engine.json'; }
    var output = File(workspace.fsName + '/test-results/' + reportName); output.encoding = 'UTF-8';
    if (output.open('w')) { output.write(JSON.stringify(report, null, 2)); output.close(); }
    $.writeln(JSON.stringify(report));
    if (report.safeInstance) { app.exitAfterLaunchAndEval = true; app.exitCode = report.failed.length ? 1 : 0; }
}());
