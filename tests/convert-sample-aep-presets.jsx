// Read-only expression-to-keyframe sampling in memory. The source AEP is always closed without saving.
(function () {
    var root = $.getenv('MG_JSX_TEST_ROOT'), projectPath = $.getenv('MG_INSPECT_AEP');
    var batchStart = Number($.getenv('MG_SAMPLE_START') || 0), batchEnd = Number($.getenv('MG_SAMPLE_END') || 9999);
    $.evalFile(File(root + '/extension/vendor/json2.js'));
    var report = { safeInstance: false, project: projectPath, version: app.version, commandId: 2639, batchStart: batchStart, batchEnd: batchEnd, presets: [], warnings: [], error: null };
    function simple(value) {
        if (value === null || value === undefined || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') { return value; }
        if (value.length !== undefined) { var a = []; for (var i = 0; i < value.length; i++) { a.push(simple(value[i])); } return a; }
        try { return String(value); } catch (ignored) { return '[complex]'; }
    }
    function visualEffect(matchName) { return matchName !== 'ADBE Slider Control' && matchName !== 'ADBE Checkbox Control' && matchName !== 'ADBE Angle Control' && matchName !== 'ADBE Point Control' && matchName !== 'ADBE Color Control' && matchName !== 'ADBE Layer Control'; }
    function captureProperties(group, indices, path, duration, dynamicList, output) {
        for (var i = 1; i <= group.numProperties; i++) {
            var property = group.property(i), nextIndices = indices.concat([i]), nextPath = path + '/' + property.name;
            if (property.propertyType === PropertyType.PROPERTY) {
                var item = { indices: nextIndices, path: nextPath, name: property.name, matchName: property.matchName, propertyValueType: String(property.propertyValueType), canSetExpression: !!property.canSetExpression, dynamic: !!(property.numKeys || property.expression), samples: [] };
                try { item.initial = simple(property.valueAtTime(0, true)); item.final = simple(property.valueAtTime(duration, true)); } catch (valueError) { item.valueError = String(valueError); }
                output.push(item); if (item.dynamic) { dynamicList.push({ property: property, output: item }); }
            } else { captureProperties(property, nextIndices, nextPath, duration, dynamicList, output); }
        }
    }
    function bake(comp, layer, property, output, label) {
        try {
            if (!property.canSetExpression) { output.unbaked = true; for (var k = 1; k <= property.numKeys; k++) { output.samples.push({ time: property.keyTime(k), value: simple(property.keyValue(k)) }); } return; }
            if (!property.expression) { property.expression = 'value'; }
            for (var i = 1; i <= comp.numLayers; i++) { comp.layer(i).selected = false; }
            layer.selected = true; property.selected = true; app.executeCommand(2639); property.selected = false;
            for (i = 1; i <= property.numKeys; i++) { output.samples.push({ time: property.keyTime(i), value: simple(property.keyValue(i)) }); }
            if (!output.samples.length) { report.warnings.push(label + ': command created no keys'); }
        } catch (e) { output.bakeError = e.message || String(e); report.warnings.push(label + ': ' + output.bakeError); }
    }
    try {
        if (!app.project || app.project.numItems !== 0 || app.project.file) { throw new Error('Sampling instance is not empty.'); }
        report.safeInstance = true; var input = File(projectPath); if (!input.exists) { throw new Error('AEP file does not exist: ' + projectPath); }
        app.beginSuppressDialogs(); app.open(input); var presetIndex = 0;
        for (var i = 1; i <= app.project.numItems; i++) {
            var comp = app.project.item(i); if (!(comp instanceof CompItem)) { continue; }
            var layer = null; for (var j = 1; j <= comp.numLayers; j++) { if (comp.layer(j).name === 'TARGET') { layer = comp.layer(j); break; } }
            if (!layer) { continue; }
            if (presetIndex < batchStart || presetIndex > batchEnd) { presetIndex++; continue; }
            comp.openInViewer();
            var preset = { name: comp.name, sourceDuration: comp.duration, frameRate: comp.frameRate, channels: {}, effects: [] }, transform = layer.property('ADBE Transform Group');
            var channelMap = { position: 'ADBE Position', scale: 'ADBE Scale', rotation: 'ADBE Rotate Z', opacity: 'ADBE Opacity' }, key, property, channelItems = [];
            for (key in channelMap) {
                if (!channelMap.hasOwnProperty(key)) { continue; } property = transform.property(channelMap[key]);
                if (property.numKeys || property.expression) {
                    var channel = { final: simple(property.valueAtTime(comp.duration, true)), samples: [] }; preset.channels[key] = channel; channelItems.push({ property: property, output: channel, label: comp.name + '/' + key });
                }
            }
            var effects = layer.property('ADBE Effect Parade'), effectDynamic = [];
            for (j = 1; j <= effects.numProperties; j++) {
                var effect = effects.property(j); if (!visualEffect(effect.matchName)) { continue; }
                var effectData = { name: effect.name, matchName: effect.matchName, enabled: !!effect.enabled, properties: [] }, dynamicList = [];
                captureProperties(effect, [], effect.name, comp.duration, dynamicList, effectData.properties);
                for (var d = 0; d < dynamicList.length; d++) { effectDynamic.push({ property: dynamicList[d].property, output: dynamicList[d].output, label: comp.name + '/' + effect.name + '/' + dynamicList[d].output.name }); }
                preset.effects.push(effectData);
            }
            for (j = 0; j < channelItems.length; j++) { bake(comp, layer, channelItems[j].property, channelItems[j].output, channelItems[j].label); }
            for (j = 0; j < effectDynamic.length; j++) { bake(comp, layer, effectDynamic[j].property, effectDynamic[j].output, effectDynamic[j].label); }
            report.presets.push(preset); presetIndex++;
        }
    } catch (e) { report.error = { message: e.message || String(e), line: e.line, file: e.fileName }; }
    finally {
        try { app.endSuppressDialogs(false); } catch (ignoredSuppress) {}
        var output = File(root + '/test-results/aep-converted-samples-' + batchStart + '-' + batchEnd + '.json'); output.encoding = 'UTF-8';
        if (output.open('w')) { output.write(JSON.stringify(report, null, 2)); output.close(); }
        try { if (report.safeInstance && app.project && app.project.file && app.project.file.fsName === File(projectPath).fsName) { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } } catch (ignoredClose) {}
        app.exitAfterLaunchAndEval = true; app.exitCode = report.error ? 1 : 0;
    }
}());
