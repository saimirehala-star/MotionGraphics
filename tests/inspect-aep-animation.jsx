// Read-only inspection of a user-provided AEP. Run only in a fresh -m AE instance.
(function () {
    var root = $.getenv('MG_JSX_TEST_ROOT'), projectPath = $.getenv('MG_INSPECT_AEP'), compName = $.getenv('MG_INSPECT_COMP'), layerName = $.getenv('MG_INSPECT_LAYER');
    $.evalFile(File(root + '/extension/vendor/json2.js'));
    var result = { safeInstance: false, project: projectPath, requestedComp: compName, requestedLayer: layerName, warnings: [], frames: [], error: null };
    function fail(message) { throw new Error(message); }
    function simple(value) {
        if (value === null || value === undefined || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') { return value; }
        if (value.length !== undefined) { var a = []; for (var i = 0; i < value.length; i++) { a.push(simple(value[i])); } return a; }
        try { return String(value); } catch (ignored) { return '[complex value]'; }
    }
    function ease(value) {
        var out = [];
        for (var i = 0; i < value.length; i++) { out.push({ speed: value[i].speed, influence: value[i].influence }); }
        return out;
    }
    function animatedProperty(property, path) {
        var data = { name: property.name, matchName: property.matchName, path: path, propertyValueType: String(property.propertyValueType), dimensionsSeparated: !!property.dimensionsSeparated, keys: [] };
        if (property.expression) { data.expression = property.expression; data.expressionEnabled = property.expressionEnabled; data.expressionError = property.expressionError; }
        if (!property.numKeys) { try { data.value = simple(property.value); } catch (ignoredValue) { data.value = '[unavailable]'; } return data; }
        for (var i = 1; i <= property.numKeys; i++) {
            var key = { index: i, time: property.keyTime(i), value: simple(property.keyValue(i)), inInterpolation: String(property.keyInInterpolationType(i)), outInterpolation: String(property.keyOutInterpolationType(i)),
                temporalAutoBezier: property.keyTemporalAutoBezier(i), temporalContinuous: property.keyTemporalContinuous(i), inTemporalEase: ease(property.keyInTemporalEase(i)), outTemporalEase: ease(property.keyOutTemporalEase(i)) };
            try { key.roving = property.keyRoving(i); } catch (notSpatialRoving) { /* Non-spatial property. */ }
            try { key.spatialAutoBezier = property.keySpatialAutoBezier(i); key.spatialContinuous = property.keySpatialContinuous(i); key.inSpatialTangent = simple(property.keyInSpatialTangent(i)); key.outSpatialTangent = simple(property.keyOutSpatialTangent(i)); } catch (notSpatial) { /* Non-spatial property. */ }
            data.keys.push(key);
        }
        return data;
    }
    function walk(group, path, output, includeStatic) {
        for (var i = 1; i <= group.numProperties; i++) {
            var property = group.property(i), nextPath = path + ' / ' + property.name;
            if (property.propertyType === PropertyType.PROPERTY) {
                if (property.numKeys || property.expression || includeStatic) { output.push(animatedProperty(property, nextPath)); }
            } else { walk(property, nextPath, output, includeStatic); }
        }
    }
    function uniquePush(array, value) { for (var i = 0; i < array.length; i++) { if (Math.abs(array[i] - value) < .000001) { return; } } array.push(value); }
    var empty = app.project && app.project.numItems === 0 && !app.project.file;
    try {
        if (!empty) { fail('Inspection instance is not empty; refusing to open the supplied project.'); }
        result.safeInstance = true;
        var input = File(projectPath); if (!input.exists) { fail('AEP file does not exist: ' + projectPath); }
        app.beginSuppressDialogs(); app.open(input);
        var comp = null, item, i;
        for (i = 1; i <= app.project.numItems; i++) { item = app.project.item(i); if (item instanceof CompItem && item.name === compName) { comp = item; break; } }
        if (!comp) { fail('Composition not found: ' + compName); }
        var layer = null;
        for (i = 1; i <= comp.numLayers; i++) { if (comp.layer(i).name === layerName) { layer = comp.layer(i); break; } }
        if (!layer) { fail('Layer not found: ' + layerName); }
        result.comp = { id: comp.id, name: comp.name, width: comp.width, height: comp.height, pixelAspect: comp.pixelAspect, duration: comp.duration, frameDuration: comp.frameDuration, frameRate: comp.frameRate, displayStartTime: comp.displayStartTime, workAreaStart: comp.workAreaStart, workAreaDuration: comp.workAreaDuration, numLayers: comp.numLayers };
        result.layer = { id: layer.id, index: layer.index, name: layer.name, matchName: layer.matchName, inPoint: layer.inPoint, outPoint: layer.outPoint, startTime: layer.startTime, stretch: layer.stretch, threeDLayer: layer.threeDLayer, enabled: layer.enabled, locked: layer.locked, sourceName: layer.source ? layer.source.name : '', animated: [], effects: [] };
        walk(layer.property('ADBE Transform Group'), 'Transform', result.layer.animated, false);
        var effects = layer.property('ADBE Effect Parade'); if (effects) { walk(effects, 'Effects', result.layer.effects, true); }
        var times = [];
        for (i = 0; i < result.layer.animated.length; i++) { for (var j = 0; j < result.layer.animated[i].keys.length; j++) { uniquePush(times, result.layer.animated[i].keys[j].time); } }
        for (i = 0; i < result.layer.effects.length; i++) { for (j = 0; j < result.layer.effects[i].keys.length; j++) { uniquePush(times, result.layer.effects[i].keys[j].time); } }
        times.sort(function (a, b) { return a - b; });
        var samples = [];
        for (i = 0; i < times.length; i++) { uniquePush(samples, times[i]); if (i < times.length - 1) { uniquePush(samples, (times[i] + times[i + 1]) / 2); } }
        if (samples.length > 9) { samples = [samples[0], samples[Math.floor(samples.length / 4)], samples[Math.floor(samples.length / 2)], samples[Math.floor(samples.length * 3 / 4)], samples[samples.length - 1]]; }
        var outputDir = Folder(root + '/test-results/aep-inspection'); if (!outputDir.exists) { outputDir.create(); }
        for (i = 0; i < samples.length; i++) {
            var image = File(outputDir.fsName + '/frame-' + i + '-' + samples[i].toFixed(3).replace('.', '_') + '.png');
            try { comp.saveFrameToPng(samples[i], image); result.frames.push({ time: samples[i], path: image.fsName }); } catch (frameError) { result.warnings.push('Frame ' + samples[i] + ': ' + frameError.message); }
        }
    } catch (e) { result.error = { message: e.message || String(e), line: e.line, file: e.fileName }; }
    finally {
        try { app.endSuppressDialogs(false); } catch (noSuppress) { /* It may not have started. */ }
        var output = File(root + '/test-results/aep-animation-inspection.json'); output.encoding = 'UTF-8';
        if (output.open('w')) { output.write(JSON.stringify(result, null, 2)); output.close(); }
        if (result.safeInstance && app.project && app.project.file && app.project.file.fsName === File(projectPath).fsName) { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); }
        app.exitAfterLaunchAndEval = true; app.exitCode = result.error ? 1 : 0;
    }
}());
