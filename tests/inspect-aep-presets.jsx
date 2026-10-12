// Read-only deep extraction of all TARGET preset layers. Run only in a fresh -m AE instance.
(function () {
    var root = $.getenv('MG_JSX_TEST_ROOT'), projectPath = $.getenv('MG_INSPECT_AEP');
    $.evalFile(File(root + '/extension/vendor/json2.js'));
    var report = { safeInstance: false, project: projectPath, version: app.version, presets: [], warnings: [], error: null };
    function simple(value) {
        if (value === null || value === undefined || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') { return value; }
        if (value.length !== undefined) { var a = []; for (var i = 0; i < value.length; i++) { a.push(simple(value[i])); } return a; }
        try { return String(value); } catch (ignored) { return '[complex]'; }
    }
    function eases(values) {
        var result = [];
        for (var i = 0; i < values.length; i++) { result.push({ speed: values[i].speed, influence: values[i].influence }); }
        return result;
    }
    function propertyData(property, path) {
        var data = { path: path, name: property.name, matchName: property.matchName, propertyValueType: String(property.propertyValueType), keys: [], expression: property.expression || '' };
        try { data.value = simple(property.value); } catch (valueError) { data.valueError = String(valueError); }
        try { data.minValue = property.minValue; data.maxValue = property.maxValue; } catch (ignoredRange) {}
        for (var i = 1; i <= property.numKeys; i++) {
            var key = { index: i, time: property.keyTime(i), value: simple(property.keyValue(i)), inInterpolation: String(property.keyInInterpolationType(i)), outInterpolation: String(property.keyOutInterpolationType(i)), temporalAutoBezier: property.keyTemporalAutoBezier(i), temporalContinuous: property.keyTemporalContinuous(i), inTemporalEase: eases(property.keyInTemporalEase(i)), outTemporalEase: eases(property.keyOutTemporalEase(i)) };
            try { key.roving = property.keyRoving(i); } catch (ignoredRoving) {}
            try { key.spatialAutoBezier = property.keySpatialAutoBezier(i); key.spatialContinuous = property.keySpatialContinuous(i); key.inSpatialTangent = simple(property.keyInSpatialTangent(i)); key.outSpatialTangent = simple(property.keyOutSpatialTangent(i)); } catch (ignoredSpatial) {}
            data.keys.push(key);
        }
        return data;
    }
    function walk(group, path, output, includeStatic) {
        for (var i = 1; i <= group.numProperties; i++) {
            var property = group.property(i), next = path + '/' + property.name;
            if (property.propertyType === PropertyType.PROPERTY) {
                if (includeStatic || property.numKeys || property.expression) { output.push(propertyData(property, next)); }
            } else { walk(property, next, output, includeStatic); }
        }
    }
    try {
        if (!app.project || app.project.numItems !== 0 || app.project.file) { throw new Error('Inspection instance is not empty.'); }
        report.safeInstance = true;
        var input = File(projectPath); if (!input.exists) { throw new Error('AEP file does not exist: ' + projectPath); }
        app.beginSuppressDialogs(); app.open(input);
        for (var i = 1; i <= app.project.numItems; i++) {
            var comp = app.project.item(i); if (!(comp instanceof CompItem)) { continue; }
            var layer = null;
            for (var j = 1; j <= comp.numLayers; j++) { if (comp.layer(j).name === 'TARGET') { layer = comp.layer(j); break; } }
            if (!layer) { report.warnings.push('No TARGET layer in ' + comp.name); continue; }
            var preset = { comp: { id: comp.id, name: comp.name, width: comp.width, height: comp.height, duration: comp.duration, frameRate: comp.frameRate, frameDuration: comp.frameDuration }, layer: { id: layer.id, index: layer.index, name: layer.name, inPoint: layer.inPoint, outPoint: layer.outPoint, startTime: layer.startTime, threeD: !!layer.threeDLayer, motionBlur: !!layer.motionBlur, effectsActive: !!layer.effectsActive, transform: [], effects: [] } };
            walk(layer.property('ADBE Transform Group'), 'Transform', preset.layer.transform, true);
            var effects = layer.property('ADBE Effect Parade');
            for (j = 1; j <= effects.numProperties; j++) {
                var effect = effects.property(j), effectData = { index: j, name: effect.name, matchName: effect.matchName, enabled: effect.enabled, properties: [] };
                walk(effect, effect.name, effectData.properties, true); preset.layer.effects.push(effectData);
            }
            report.presets.push(preset);
        }
    } catch (e) { report.error = { message: e.message || String(e), line: e.line, file: e.fileName }; }
    finally {
        try { app.endSuppressDialogs(false); } catch (ignoredSuppress) {}
        var output = File(root + '/test-results/aep-presets-deep.json'); output.encoding = 'UTF-8';
        if (output.open('w')) { output.write(JSON.stringify(report, null, 2)); output.close(); }
        try { if (report.safeInstance && app.project && app.project.file && app.project.file.fsName === File(projectPath).fsName) { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } } catch (ignoredClose) {}
        app.exitAfterLaunchAndEval = true; app.exitCode = report.error ? 1 : 0;
    }
}());
