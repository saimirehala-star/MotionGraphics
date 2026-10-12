// Read-only 60 fps sampling of all TARGET preset layers. Run only in a fresh -m AE instance.
(function () {
    var root = $.getenv('MG_JSX_TEST_ROOT'), projectPath = $.getenv('MG_INSPECT_AEP'), step = 1 / 30;
    var batchStart = Number($.getenv('MG_SAMPLE_START') || 0), batchEnd = Number($.getenv('MG_SAMPLE_END') || 9999);
    $.evalFile(File(root + '/extension/vendor/json2.js'));
    var report = { safeInstance: false, project: projectPath, version: app.version, sampleStep: step, presets: [], warnings: [], error: null };
    function simple(value) {
        if (value === null || value === undefined || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') { return value; }
        if (value.length !== undefined) { var a = []; for (var i = 0; i < value.length; i++) { a.push(simple(value[i])); } return a; }
        try { return String(value); } catch (ignored) { return '[complex]'; }
    }
    function sample(property, duration, preExpression) {
        var values = [], count = Math.round(duration / step);
        for (var i = 0; i <= count; i++) { values.push(simple(property.valueAtTime(Math.min(duration, i * step), preExpression))); }
        return values;
    }
    function propertySpecs(group, indices, path, duration, output) {
        for (var i = 1; i <= group.numProperties; i++) {
            var property = group.property(i), nextIndices = indices.concat([i]), nextPath = path + '/' + property.name;
            if (property.propertyType === PropertyType.PROPERTY) {
                var item = { indices: nextIndices, path: nextPath, name: property.name, matchName: property.matchName, propertyValueType: String(property.propertyValueType), canSetExpression: !!property.canSetExpression, dynamic: !!(property.numKeys || property.expression), keys: property.numKeys, expression: property.expression || '' };
                try { item.initial = simple(property.valueAtTime(0, true)); item.final = simple(property.valueAtTime(duration, true)); } catch (valueError) { item.valueError = String(valueError); }
                if (item.dynamic) { try { item.samples = sample(property, duration, false); } catch (sampleError) { item.sampleError = String(sampleError); } }
                output.push(item);
            } else { propertySpecs(property, nextIndices, nextPath, duration, output); }
        }
    }
    try {
        if (!app.project || app.project.numItems !== 0 || app.project.file) { throw new Error('Sampling instance is not empty.'); }
        report.safeInstance = true;
        var input = File(projectPath); if (!input.exists) { throw new Error('AEP file does not exist: ' + projectPath); }
        app.beginSuppressDialogs(); app.open(input);
        var presetIndex = 0;
        for (var i = 1; i <= app.project.numItems; i++) {
            var comp = app.project.item(i); if (!(comp instanceof CompItem)) { continue; }
            var layer = null;
            for (var j = 1; j <= comp.numLayers; j++) { if (comp.layer(j).name === 'TARGET') { layer = comp.layer(j); break; } }
            if (!layer) { report.warnings.push('No TARGET layer in ' + comp.name); continue; }
            if (presetIndex < batchStart || presetIndex > batchEnd) { presetIndex++; continue; }
            var transform = layer.property('ADBE Transform Group'), channels = {}, prop;
            var map = { position: 'ADBE Position', scale: 'ADBE Scale', rotation: 'ADBE Rotate Z', opacity: 'ADBE Opacity' };
            for (var key in map) {
                if (!map.hasOwnProperty(key)) { continue; }
                prop = transform.property(map[key]);
                if (prop.numKeys || prop.expression) { channels[key] = { final: simple(prop.valueAtTime(comp.duration, true)), samples: sample(prop, comp.duration, false) }; }
            }
            var preset = { name: comp.name, duration: comp.duration, frameRate: comp.frameRate, channels: channels, effects: [] }, effects = layer.property('ADBE Effect Parade');
            for (j = 1; j <= effects.numProperties; j++) {
                var effect = effects.property(j);
                if (effect.matchName === 'ADBE Slider Control' || effect.matchName === 'ADBE Checkbox Control' || effect.matchName === 'ADBE Angle Control' || effect.matchName === 'ADBE Point Control' || effect.matchName === 'ADBE Color Control' || effect.matchName === 'ADBE Layer Control') { continue; }
                var effectData = { name: effect.name, matchName: effect.matchName, enabled: !!effect.enabled, properties: [] };
                propertySpecs(effect, [], effect.name, comp.duration, effectData.properties); preset.effects.push(effectData);
            }
            report.presets.push(preset); presetIndex++;
        }
    } catch (e) { report.error = { message: e.message || String(e), line: e.line, file: e.fileName }; }
    finally {
        try { app.endSuppressDialogs(false); } catch (ignoredSuppress) {}
        var output = File(root + '/test-results/aep-presets-samples-' + batchStart + '-' + batchEnd + '.json'); output.encoding = 'UTF-8';
        if (output.open('w')) { output.write(JSON.stringify(report, null, 2)); output.close(); }
        try { if (report.safeInstance && app.project && app.project.file && app.project.file.fsName === File(projectPath).fsName) { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } } catch (ignoredClose) {}
        app.exitAfterLaunchAndEval = true; app.exitCode = report.error ? 1 : 0;
    }
}());
