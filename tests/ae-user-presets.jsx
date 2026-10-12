// Standalone native regression. Run only with AfterFX.com -m -r in a fresh empty instance.
app.exitCode = 81;
app.exitAfterLaunchAndEval = true;
(function () {
    var root = File($.fileName).parent.parent, report = { version: app.version, safeInstance: false, passed: [], failed: [] };
    var runtime = Folder(root.fsName + '/test-results/user-presets-runtime'), exportBase = File(root.fsName + '/test-results/exported-user-preset');
    function assert(value, message) { if (!value) { throw new Error(message || 'assertion failed'); } }
    function near(a, b, tolerance) { tolerance = tolerance || .05; assert(Math.abs(a - b) <= tolerance, a + ' != ' + b); }
    function selectOnly(comp, layer) { for (var i = 1; i <= comp.numLayers; i++) { comp.layer(i).selected = false; } layer.selected = true; }
    function nativeProp(group, matchName) { for (var i = 1; i <= group.numProperties; i++) { var p = group.property(i); if (p.matchName === matchName) { return p; } if (p.propertyType !== PropertyType.PROPERTY) { var nested = nativeProp(p, matchName); if (nested) { return nested; } } } return null; }
    function findOwned(layer, matchName) { for (var i = 1; i <= layer.effect.numProperties; i++) { var e = layer.effect(i); if (e.matchName === matchName && e.name.indexOf('MG / USER ') === 0) { return e; } } return null; }
    function inventory(group, output, prefix) { for (var i = 1; i <= group.numProperties; i++) { var p = group.property(i); output.push({ path: prefix + '/' + p.name, matchName: p.matchName, propertyType: String(p.propertyType), valueType: String(p.propertyValueType) }); if (p.propertyType !== PropertyType.PROPERTY) { inventory(p, output, prefix + '/' + p.name); } } }
    function readJSON(file) { file.encoding = 'UTF-8'; assert(file.open('r'), 'cannot read ' + file.fsName); var data = JSON.parse(file.read()); file.close(); return data; }
    function cleanRuntime() {
        var files, i;
        if (runtime.exists) { files = runtime.getFiles(); for (i = 0; i < files.length; i++) { if (files[i] instanceof File) { files[i].remove(); } } runtime.remove(); }
        var exported = File(exportBase.fsName + '.mgpreset.json'); if (exported.exists) { exported.remove(); }
    }
    function check(name, fn) { try { fn(); report.passed.push(name); } catch (error) { report.failed.push({ name: name, message: error.message || String(error), line: error.line || 0 }); } }
    var comp, source, target, captured, id, presetFile, capturedDuration;
    try {
        assert(app.project && app.project.numItems === 0 && !app.project.file, 'Refusing nonempty project'); report.safeInstance = true;
        cleanRuntime(); assert(runtime.create(), 'cannot create isolated user preset test folder'); $.global.MotionGraphicsUserPresetRoot = runtime.fsName;
        $.evalFile(File(root.fsName + '/extension/host/main.jsx'));
        assert(MG2023Host && MG2023Host.version === '2.2.0', 'host version mismatch');
        comp = app.project.items.addComp('MG USER PRESET TEST ONLY', 640, 480, 1, 8, 30); comp.workAreaStart = 1; comp.workAreaDuration = 1; comp.time = 1;
        source = comp.layers.addSolid([1, .4, .2], 'SOURCE', 200, 140, 1, 8); source.inPoint = 0; source.outPoint = 8;
        source.transform.position.setValueAtTime(1, [100, 220]); source.transform.position.setValueAtTime(2, [300, 220]);
        source.transform.position.setSelectedAtKey(1, true); source.transform.position.setSelectedAtKey(2, true);
        source.transform.scale.setValueAtTime(1, [20, 20]); source.transform.scale.setValueAtTime(2, [100, 100]);
        source.transform.scale.expression = 'amp=.08; freq=4; decay=5; n=0; if(numKeys>0){n=nearestKey(time).index;if(key(n).time>time)n--;} if(n==0){value}else{t=time-key(n).time;if(n==numKeys && t>0 && t<1){v=velocityAtTime(key(n).time-thisComp.frameDuration/10);value+v*amp*Math.sin(freq*t*2*Math.PI)/Math.exp(decay*t)}else{value}}';
        source.transform.rotation.expression = 'value + Math.sin(time * 3) * 10';
        var gaussian = source.effect.addProperty('ADBE Gaussian Blur 2'), blur = nativeProp(gaussian, 'ADBE Gaussian Blur 2-0001');
        assert(gaussian && blur, 'Gaussian Blur unavailable'); blur.setValueAtTime(1, 25); blur.setValueAtTime(2, 0);
        var force = source.effect.addProperty('CC Force Motion Blur'); assert(force, 'CC Force Motion Blur unavailable'); force.property(1).setValue(7);
        selectOnly(comp, source);
        var sourceParade = source.property('ADBE Effect Parade');
        report.source = { selectedName: comp.selectedLayers[0].name, positionKeys: source.transform.position.numKeys, positionType: String(source.transform.position.propertyValueType), twoD: String(PropertyValueType.TwoD), twoDSpatial: String(PropertyValueType.TwoD_SPATIAL), threeD: String(PropertyValueType.ThreeD), paradeExists: !!sourceParade, paradeCount: sourceParade ? sourceParade.numProperties : -1, effectCount: source.effect.numProperties, effectNames: [] };
        for (var sourceEffectIndex = 1; sourceEffectIndex <= source.effect.numProperties; sourceEffectIndex++) { report.source.effectNames.push(source.effect(sourceEffectIndex).matchName); }
        report.source.properties = []; inventory(source.effect, report.source.properties, 'Effects');

        check('capture writes JSON with transform, expression source, and native effects', function () {
            captured = MG2023Host.run({ action: 'captureUserPreset', data: { name: '测试弹入', category: 'in', description: 'AE native regression' } }, comp);
            assert(captured.ok, JSON.stringify(captured)); id = captured.data.preset.id; presetFile = File(captured.data.file); assert(presetFile.exists, 'preset JSON missing');
            var document = readJSON(presetFile); assert(document.schemaVersion === 1 && document.id === id && document.category === 'in');
            report.capture = { sourceLayer: document.capture.sourceLayer, channelNames: [], expressionCount: document.capture.expressions.length, effectNames: [], skipped: document.capture.skipped };
            for (var channelName in document.template.channels) { if (document.template.channels.hasOwnProperty(channelName)) { report.capture.channelNames.push(channelName); } }
            assert(document.template.channels.position, 'position channel missing'); assert(document.template.channels.scale, 'scale channel missing'); assert(document.template.channels.rotation, 'rotation channel missing');
            assert(document.capture.expressions.length === 2, 'expression source count mismatch');
            var expressionText = document.capture.expressions[0].source + '\n' + document.capture.expressions[1].source; assert(expressionText.indexOf('Math.sin') >= 0 && expressionText.indexOf('velocityAtTime') >= 0, 'expression source missing');
            var matchNames = {}; for (var i = 0; i < document.template.effects.length; i++) { matchNames[document.template.effects[i].matchName] = true; report.capture.effectNames.push(document.template.effects[i].matchName); }
            assert(matchNames['ADBE Gaussian Blur 2'] && matchNames['CC Force Motion Blur'], 'native effects missing');
            capturedDuration = document.template.duration; assert(document.capture.expressionTail > .8 && document.capture.expressionTail < 1.5, 'elastic expression tail was not detected');
            assert(document.capture.sourceRange.indexOf('expressionTail') >= 0 && capturedDuration > 1.8, 'capture range did not include elastic tail');
        });

        check('library lists and exports the captured preset', function () {
            var listed = MG2023Host.run({ action: 'listUserPresets', data: {} }, null); assert(listed.ok && listed.data.presets.length === 1 && listed.data.presets[0].id === id, JSON.stringify(listed));
            var exported = MG2023Host.run({ action: 'exportUserPreset', data: { id: id, path: exportBase.fsName } }, null);
            assert(exported.ok && File(exportBase.fsName + '.mgpreset.json').exists, JSON.stringify(exported));
        });

        check('saved JSON reloads and applies to another layer with a range marker', function () {
            MGCatalog.registerUser([]);
            target = comp.layers.addSolid([.2, .5, 1], 'TARGET', 200, 140, 1, 8); target.inPoint = 0; target.outPoint = 8; comp.time = 3; selectOnly(comp, target);
            var applied = MG2023Host.run({ action: 'apply', data: { id: id, markerTiming: true, reuseExisting: true } }, comp); report.applied = applied; assert(applied.ok, JSON.stringify(applied));
            assert(target.marker.numKeys === 1, 'range marker missing'); near(target.marker.keyTime(1), 0, .001); near(target.marker.keyValue(1).duration, capturedDuration, .001);
            assert(target.transform.position.expression.indexOf('// MotionGraphics:UI:1') === 0 && !target.transform.position.expressionError, target.transform.position.expressionError);
            assert(target.transform.scale.expression.indexOf('// MotionGraphics:UI:1') === 0 && !target.transform.scale.expressionError, target.transform.scale.expressionError);
            assert(target.transform.rotation.expression.indexOf('// MotionGraphics:UI:1') === 0 && !target.transform.rotation.expressionError, target.transform.rotation.expressionError);
            var targetBlur = findOwned(target, 'ADBE Gaussian Blur 2'), targetForce = findOwned(target, 'CC Force Motion Blur');
            assert(targetBlur && targetForce, 'owned effects missing on target');
            var targetBlurValue = nativeProp(targetBlur, 'ADBE Gaussian Blur 2-0001'); assert(targetBlurValue && !targetBlurValue.expressionError, targetBlurValue ? targetBlurValue.expressionError : 'blur property missing');
            near(targetBlurValue.valueAtTime(0, false), 25); near(targetBlurValue.valueAtTime(1, false), 0);
            near(target.transform.position.valueAtTime(0, false)[0], 120); near(target.transform.position.valueAtTime(1, false)[0], 320);
            near(target.transform.scale.valueAtTime(0, false)[0], 20); assert(Math.abs(target.transform.scale.valueAtTime(1.1, false)[0] - 100) > 1, 'elastic overshoot missing after the final keyframe'); near(target.transform.scale.valueAtTime(capturedDuration, false)[0], 100, .1);
            assert(target.comment.indexOf('"userPreset"') >= 0, 'embedded user preset missing');
            var summary = MG2023Host.run({ action: 'appliedSummary', data: {} }, comp); assert(summary.ok && summary.data.layerCount === 1 && summary.data.categories.length === 1, JSON.stringify(summary));
            assert(summary.data.categories[0].category === 'in' && summary.data.categories[0].name === '测试弹入' && summary.data.categories[0].targetCategory === 'user', 'single-layer applied summary mismatch');
            source.selected = true; summary = MG2023Host.run({ action: 'appliedSummary', data: {} }, comp); assert(summary.data.layerCount === 2 && summary.data.categories[0].appliedCount === 1 && summary.data.categories[0].totalCount === 2, 'multi-layer applied summary mismatch'); selectOnly(comp, target);
        });

        check('return-to-panel cleanup removes a deleted marker without polling', function () {
            target.marker.removeKey(1); selectOnly(comp, target);
            var cleaned = MG2023Host.run({ action: 'syncDeletedMarkers', data: { force: true } }, comp); assert(cleaned.ok && cleaned.count === 1, JSON.stringify(cleaned));
            assert(target.transform.position.expression === '' && target.transform.scale.expression === '' && !findOwned(target, 'ADBE Gaussian Blur 2'), 'forced marker cleanup failed');
            var summary = MG2023Host.run({ action: 'appliedSummary', data: {} }, comp); assert(summary.ok && summary.data.categories.length === 0, 'applied summary did not hide after cleanup');
            var reapplied = MG2023Host.run({ action: 'apply', data: { id: id, markerTiming: true, reuseExisting: true } }, comp); assert(reapplied.ok && target.marker.numKeys === 1, JSON.stringify(reapplied));
        });

        check('deleting library JSON leaves applied instance removable', function () {
            var deleted = MG2023Host.run({ action: 'deleteUserPreset', data: { id: id } }, null); assert(deleted.ok && !presetFile.exists, JSON.stringify(deleted));
            var listed = MG2023Host.run({ action: 'listUserPresets', data: {} }, null); assert(listed.ok && listed.data.presets.length === 0, JSON.stringify(listed));
            selectOnly(comp, target); var removed = MG2023Host.run({ action: 'remove', data: { category: 'in' } }, comp); assert(removed.ok, JSON.stringify(removed));
            assert(target.marker.numKeys === 0 && !findOwned(target, 'ADBE Gaussian Blur 2') && !findOwned(target, 'CC Force Motion Blur'), 'applied instance cleanup failed');
            assert(target.transform.position.expression === '' && target.transform.scale.expression === '' && target.transform.rotation.expression === '', 'transform expressions remain');
            var emptyClear = MG2023Host.run({ action: 'remove', data: { category: 'in', allowEmpty: true } }, comp); assert(emptyClear.ok && emptyClear.count === 0, JSON.stringify(emptyClear));
        });

        check('shared team folder resolves in AE without test writes', function () {
            $.global.MotionGraphicsUserPresetRoot = undefined;
            var shared = MG2023Host.run({ action: 'listUserPresets', data: {} }, null); assert(shared.ok, JSON.stringify(shared));
            var actual = String(shared.data.folder).replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
            var suffix = '/项目素材/童话岛/plug/motiongraphics/动效预设';
            assert(actual.indexOf(suffix) === actual.length - suffix.length, 'shared team folder mismatch: ' + shared.data.folder);
            report.teamLibrary = { folder: shared.data.folder, presetCount: shared.data.presets.length, skipped: shared.data.skipped };
        });
    } catch (error) { report.failed.push({ name: 'setup', message: error.message || String(error), line: error.line || 0 }); }
    try { if (comp) { comp.remove(); } cleanRuntime(); } catch (cleanupError) { report.failed.push({ name: 'cleanup', message: cleanupError.message || String(cleanupError), line: cleanupError.line || 0 }); }
    var reportFile = File(root.fsName + '/test-results/ae-user-presets.json'); reportFile.encoding = 'UTF-8'; reportFile.lineFeed = 'Unix';
    if (reportFile.open('w')) { reportFile.write(JSON.stringify(report, null, 2)); reportFile.close(); }
    app.exitCode = report.failed.length ? 82 : 0;
}());
