// Read-only AEP inventory. Run only with AfterFX.com -m -r in a fresh empty instance.
(function () {
    var root = $.getenv('MG_JSX_TEST_ROOT'), projectPath = $.getenv('MG_INSPECT_AEP');
    $.evalFile(File(root + '/extension/vendor/json2.js'));
    var report = { safeInstance: false, project: projectPath, version: app.version, comps: [], error: null };
    function folderPath(item) {
        var names = [], folder = item.parentFolder;
        while (folder && folder !== app.project.rootFolder) { names.unshift(folder.name); folder = folder.parentFolder; }
        return names.join('/');
    }
    function animated(group) {
        var result = [];
        for (var i = 1; i <= group.numProperties; i++) {
            var property = group.property(i);
            if (property.propertyType === PropertyType.PROPERTY) {
                if (property.numKeys || property.expression) { result.push({ name: property.name, matchName: property.matchName, keys: property.numKeys, expression: !!property.expression }); }
            } else {
                var children = animated(property);
                for (var j = 0; j < children.length; j++) { result.push(children[j]); }
            }
        }
        return result;
    }
    try {
        if (!app.project || app.project.numItems !== 0 || app.project.file) { throw new Error('Inventory instance is not empty.'); }
        report.safeInstance = true;
        var input = File(projectPath); if (!input.exists) { throw new Error('AEP file does not exist: ' + projectPath); }
        app.beginSuppressDialogs(); app.open(input);
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i); if (!(item instanceof CompItem)) { continue; }
            var comp = { id: item.id, index: i, folder: folderPath(item), name: item.name, width: item.width, height: item.height, duration: item.duration, frameRate: item.frameRate, layers: [] };
            for (var j = 1; j <= item.numLayers; j++) {
                var layer = item.layer(j), effects = layer.property('ADBE Effect Parade'), effectNames = [];
                if (effects) { for (var k = 1; k <= effects.numProperties; k++) { effectNames.push({ name: effects.property(k).name, matchName: effects.property(k).matchName }); } }
                comp.layers.push({ index: j, id: layer.id, name: layer.name, matchName: layer.matchName, source: layer.source ? layer.source.name : '', inPoint: layer.inPoint, outPoint: layer.outPoint, startTime: layer.startTime, threeD: !!layer.threeDLayer, effects: effectNames, animated: animated(layer) });
            }
            report.comps.push(comp);
        }
    } catch (e) { report.error = { message: e.message || String(e), line: e.line, file: e.fileName }; }
    finally {
        try { app.endSuppressDialogs(false); } catch (ignoredSuppress) {}
        var output = File(root + '/test-results/aep-inventory.json'); output.encoding = 'UTF-8';
        if (output.open('w')) { output.write(JSON.stringify(report, null, 2)); output.close(); }
        try { if (report.safeInstance && app.project && app.project.file && app.project.file.fsName === File(projectPath).fsName) { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } } catch (ignoredClose) {}
        app.exitAfterLaunchAndEval = true; app.exitCode = report.error ? 1 : 0;
    }
}());
