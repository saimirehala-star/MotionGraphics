// Run only with AfterFX.com -m -r in a fresh empty AE instance.
(function () {
    var root = $.getenv('MG_JSX_TEST_ROOT');
    $.evalFile(File(root + '/extension/vendor/json2.js'));
    var report = { safeInstance: false, version: app.version, candidates: [], effect: null, error: null };
    function simple(value) {
        if (value === null || value === undefined || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') { return value; }
        if (value.length !== undefined) { var result = []; for (var i = 0; i < value.length; i++) { result.push(simple(value[i])); } return result; }
        try { return String(value); } catch (ignored) { return '[complex]'; }
    }
    try {
        if (!app.project || app.project.numItems !== 0 || app.project.file) { throw new Error('Probe instance is not empty.'); }
        report.safeInstance = true;
        var comp = app.project.items.addComp('MG CC Force Motion Blur Probe', 320, 180, 1, 1, 30);
        var layer = comp.layers.addShape();
        var effects = layer.property('ADBE Effect Parade');
        var names = ['CC Force Motion Blur', 'CC Force Motion Blur 2'];
        for (var i = 0; i < names.length; i++) {
            var candidate = { name: names[i], canAdd: false, added: false, error: null };
            try { candidate.canAdd = effects.canAddProperty(names[i]); } catch (canError) { candidate.error = String(canError); }
            if (candidate.canAdd && !report.effect) {
                try {
                    var effect = effects.addProperty(names[i]); candidate.added = !!effect;
                    if (effect) {
                        report.effect = { requestedName: names[i], name: effect.name, matchName: effect.matchName, properties: [] };
                        for (var j = 1; j <= effect.numProperties; j++) {
                            var property = effect.property(j), item = { index: j, name: property.name, matchName: property.matchName, propertyValueType: String(property.propertyValueType), canSetExpression: property.canSetExpression };
                            try { item.value = simple(property.value); } catch (valueError) { item.valueError = String(valueError); }
                            report.effect.properties.push(item);
                        }
                    }
                } catch (addError) { candidate.error = String(addError); }
            }
            report.candidates.push(candidate);
        }
    } catch (e) { report.error = { message: e.message || String(e), line: e.line, file: e.fileName }; }
    finally {
        var output = File(root + '/test-results/cc-force-motion-blur-probe.json'); output.encoding = 'UTF-8';
        if (output.open('w')) { output.write(JSON.stringify(report, null, 2)); output.close(); }
        try { if (app.project) { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } } catch (ignoredClose) {}
        app.exitAfterLaunchAndEval = true; app.exitCode = report.error || !report.effect ? 1 : 0;
    }
}());
