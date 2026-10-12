// Probe CC Page Turn point expression units in a fresh empty AE 2023 instance.
(function () {
    var root = $.getenv('MG_JSX_TEST_ROOT'), report = { version: app.version, tests: [], error: null };
    $.evalFile(File(root + '/extension/vendor/json2.js'));
    function find(group, matchName) { for (var i = 1; i <= group.numProperties; i++) { var p = group.property(i); if (p.matchName === matchName) { return p; } if (p.propertyType !== PropertyType.PROPERTY) { var n = find(p, matchName); if (n) { return n; } } } return null; }
    try {
        if (!app.project || app.project.numItems !== 0 || app.project.file) { throw new Error('Probe requires an empty project.'); }
        var sizes = [[640, 480], [1920, 1080]];
        for (var i = 0; i < sizes.length; i++) {
            var c = app.project.items.addComp('POINT PROBE', sizes[i][0], sizes[i][1], 1, 2, 30), l = c.layers.addShape(), e = l.effect.addProperty('CC Page Turn'), p = find(e, 'CC Page Turn-0001');
            var row = { comp: sizes[i], layer: [l.width, l.height], tests: [] }, values = [[198.666667, 231.111111], [198.666667, 411.111111], [596, 520]];
            for (var j = 0; j < values.length; j++) { p.expression = JSON.stringify(values[j]) + ';'; row.tests.push({ expression: values[j], value: p.valueAtTime(0, false), error: p.expressionError }); }
            p.expression = '[thisLayer.width,thisLayer.height];'; row.tests.push({ expression: 'layer-size', value: p.valueAtTime(0, false), error: p.expressionError });
            report.tests.push(row); c.remove();
        }
    } catch (e) { report.error = { message: e.message, line: e.line }; }
    var out = File(root + '/test-results/page-turn-point-probe.json'); out.encoding = 'UTF-8'; if (out.open('w')) { out.write(JSON.stringify(report, null, 2)); out.close(); }
    if (app.project && !app.project.file) { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } app.exitAfterLaunchAndEval = true;
}());
