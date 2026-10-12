// Evaluated inside the guarded native JSX probe; contributes to its result report.
function compactCheck(name, fn) {
    var c = null, panel = null;
    try {
        c = app.project.items.addComp('COMPACT UI TEST ONLY', 640, 480, 1, 8, 30);
        var l = c.layers.addShape(); l.name = 'Card'; l.inPoint = 1; l.outPoint = 7; l.selected = true; c.time = 2;
        panel = MotionGraphicsJSX.create(null, function (r) { return MotionGraphicsJSX.host.run(r, c); });
        fn(c, l, panel); result.passed.push(name);
    } catch (e) { result.failed.push({ name: name, message: e.message, line: e.line }); }
    finally { if (panel) { panel.root.close(); } if (c) { c.remove(); } }
}
function clickUI(panel, id) { panel.selectPreset(id); panel.presetButtons[id].onClick(); assert(panel.lastResult.ok, JSON.stringify(panel.lastResult)); }
function compactEntries(c) { return MotionGraphicsJSX.host.run({ action: 'inspect' }, c).data.entries; }
compactCheck('only two tabs remain and removed UI controls do not exist', function (c, l, p) {
    assert(p.tabs.children.length === 2 && !p.fields && !p.settings && !p.apply && !p.details && !p.inspectTab && !p.read && !p.refreshInspection);
    function visit(node) {
        assert(node.text !== '应用到选中图层' && node.text !== '结果详情' && node.text !== '当前图层' && node.text !== '恢复默认');
        if (node.children) { for (var i = 0; i < node.children.length; i++) { visit(node.children[i]); } }
    }
    visit(p.root); assert(l.comment === '' && l.marker.numKeys === 0 && l.effect.numProperties === 0);
});
compactCheck('all 92 preset and tool buttons remain available in nine categories', function (c, l, p) {
    var expected = { 'in': 36, loop: 5, out: 34, feedback: 5, stagger: 3, keyloop: 3, layerloop: 2, parent: 2, align: 2 };
    for (var i = 0; i < MotionGraphicsJSX.catalog.presets.length; i++) {
        var preset = MotionGraphicsJSX.catalog.presets[i]; p.selectPreset(preset.id); var count = 0;
        for (var id in p.presetButtons) { if (p.presetButtons.hasOwnProperty(id)) { count++; } }
        assert(count > 0 && count <= Math.min(8, expected[preset.category]), preset.id + ' page count ' + count); assert(p.presetButtons[preset.id], preset.id + ' is not visible on its selected page');
    }
    p.selectPreset('in-fade'); assert(p.modes.ui.pageLabel.text === '1 / 5', 'page label ' + p.modes.ui.pageLabel.text); assert(p.modes.ui.nextPage.enabled, 'next disabled');
    p.modes.ui.nextPage.onClick(); assert(p.modes.ui.page === 1, 'next page is ' + p.modes.ui.page); assert(!p.presetButtons['in-fade'], 'first preset remained on page 2');
    p.modes.ui.previousPage.onClick(); assert(p.presetButtons['in-fade'], 'previous did not return first preset');
});
compactCheck('single click applies all 80 real UI animations without an apply button', function (c, l, p) {
    for (var i = 0; i < MotionGraphicsJSX.catalog.presets.length; i++) {
        var preset = MotionGraphicsJSX.catalog.presets[i]; if (preset.type !== 'ui') { continue; }
        try { clickUI(p, preset.id); } catch (applyError) { throw new Error(preset.id + ': ' + applyError.message); } assert(compactEntries(c)[0].id === preset.id && l.marker.numKeys === 1 && c.numLayers === 1);
        MotionGraphicsJSX.host.run({ action: 'remove', data: { category: preset.category } }, c);
    }
});
compactCheck('effect-control edits change evaluated motion without panel updates', function (c, l, p) {
    clickUI(p, 'in-slide'); l.effect('MG / 入场动画 / 距离 px')(1).setValue(240); l.effect('MG / 入场动画 / 方向 1左2右3上4下')(1).setValue(1);
    var actual = l.transform.position.valueAtTime(1.3, false), base = l.transform.position.valueAtTime(1.3, true); near(actual[0], base[0] - 30); assert(!l.transform.position.expressionError);
    clickUI(p, 'loop-spin'); l.effect('MG / 循环动画 / 周期 秒')(1).setValue(1); near(l.transform.rotation.valueAtTime(2.25, false), 90);
});
compactCheck('repeat click keeps live values, keyed controls and range positions', function (c, l, p) {
    clickUI(p, 'in-slide'); var slider = l.effect('MG / 入场动画 / 距离 px')(1); slider.setValueAtTime(1, 200); slider.setValueAtTime(2, 300);
    var marker = l.marker.keyValue(1); marker.duration = 2; l.marker.removeKey(1); l.marker.setValueAtTime(3, marker);
    var before = l.comment, effects = l.effect.numProperties; clickUI(p, 'in-slide');
    assert(l.comment === before && l.effect.numProperties === effects && slider.numKeys === 2); near(slider.keyValue(1), 200); near(l.marker.keyTime(1), 3); near(l.marker.keyValue(1).duration, 2);
});
compactCheck('replacement presets keep edited marker ranges and use new defaults', function (c, l, p) {
    clickUI(p, 'in-slide'); var v = l.marker.keyValue(1); v.duration = 2; l.marker.removeKey(1); l.marker.setValueAtTime(3, v);
    clickUI(p, 'in-rotate'); assert(compactEntries(c)[0].id === 'in-rotate' && l.marker.numKeys === 1); near(l.marker.keyTime(1), 3); near(l.marker.keyValue(1).duration, 2); near(l.effect('MG / 入场动画 / 角度')(1).value, -30);
});
compactCheck('stagger parameters are local to tools and one click applies the interval', function (c, l, p) {
    var other = c.layers.addShape(); other.inPoint = 1; other.outPoint = 7; choose(c, [l, other]);
    p.selectPreset('stagger-forward'); assert(p.modes.tools.stagger.visible && !p.removeKeyLoop.visible); p.frames.text = '6'; p.seed.text = 'invalid';
    p.presetButtons['stagger-forward'].onClick(); assert(p.lastResult.ok); near(l.inPoint - other.inPoint, .2);
    p.selectPreset('stagger-random'); p.presetButtons['stagger-random'].onClick(); assert(!p.lastResult.ok && p.status.text.indexOf('随机种子') >= 0);
    p.seed.text = '17'; p.frames.text = '2.5'; var before = l.startTime; p.presetButtons['stagger-random'].onClick(); assert(!p.lastResult.ok); near(l.startTime, before);
    p.frames.text = '4'; clickUI(p, 'stagger-random'); p.selectPreset('align-in'); assert(!p.modes.tools.stagger.visible && p.frames.text === '4');
});
compactCheck('keyframe-loop removal remains local to its category', function (c, l, p) {
    l.transform.opacity.setValueAtTime(1, 0); l.transform.opacity.setValueAtTime(2, 100); clickUI(p, 'keyloop-cycle');
    assert(p.removeKeyLoop.visible && l.transform.opacity.expression.length > 0); p.removeKeyLoop.onClick(); assert(p.lastResult.ok && l.transform.opacity.expression === '' && l.transform.opacity.numKeys === 2);
});
compactCheck('warnings stay visible without a result-details dialog', function (c, l, p) {
    choose(c, []); p.selectPreset('in-fade'); p.presetButtons['in-fade'].onClick(); assert(!p.lastResult.ok && p.status.text.indexOf('选中图层') >= 0);
    choose(c, [l]); l.locked = true; p.presetButtons['in-fade'].onClick(); assert(!p.lastResult.ok && p.status.helpTip.indexOf('锁定') >= 0 && l.marker.numKeys === 0); l.locked = false;
});
compactCheck('marker cleanup continues without inspector or selection and stops on close', function (c, l, p) {
    clickUI(p, 'in-fade'); clickUI(p, 'loop-breathe'); l.marker.removeKey(1); l.selected = false;
    p.root.show(); MotionGraphicsJSX.watch(p); $.global.MotionGraphicsWatchHub.tick(); $.sleep(950); $.global.MotionGraphicsWatchHub.tick();
    assert(!l.effect('MG / 入场动画 / 时长 秒') && l.effect('MG / 循环动画 / 周期 秒') && l.marker.numKeys === 1);
    p.stopWatching(); assert($.global.MotionGraphicsWatchHub.task === null);
});
compactCheck('opening and repeat-clicking old slots does not silently upgrade them', function (c, l, p) {
    $.global.MGLegacyLayerTimingHost.run({ action: 'apply', data: { id: 'in-slide', markerTiming: true } }, c);
    var before = l.comment; clickUI(p, 'in-slide'); assert(l.comment === before && !compactEntries(c)[0].timing.removeOnDelete);
    p.upgradeLegacy(); assert(p.lastResult.ok && compactEntries(c)[0].timing.removeOnDelete);
});
compactCheck('help upgrade migrates multiple legacy layers while preserving their timing and selection', function (c, l, p) {
    $.global.MGLegacyTimingHost.run({ action: 'apply', data: { id: 'in-fade', markerTiming: true } }, c);
    var other = c.layers.addShape(); choose(c, [other]); MotionGraphicsJSX.host.run({ action: 'apply', data: { id: 'loop-breathe' } }, c);
    choose(c, [l, other]); p.upgradeLegacy(); assert(p.lastResult.count === 2 && c.numLayers === 2 && l.selected && other.selected);
    choose(c, [l]); assert(compactEntries(c)[0].timing.location === 'layer' && compactEntries(c)[0].timing.removeOnDelete); near(l.marker.keyTime(1), 1);
});
compactCheck('help repair handles invalid ranges but never resurrects a deleted range', function (c, l, p) {
    clickUI(p, 'in-fade'); var v = l.marker.keyValue(1); v.duration = 0; l.marker.setValueAtKey(1, v); p.upgradeLegacy(); assert(p.lastResult.count === 1 && l.marker.keyValue(1).duration > 0);
    l.marker.removeKey(1); p.upgradeLegacy(); assert(p.lastResult.count === 0 && l.marker.numKeys === 0); near(l.transform.opacity.valueAtTime(1.3, false), 100);
});
compactCheck('legacy parameter mode remains adjustable entirely in effect controls', function (c, l, p) {
    p.autoMarkers.value = false; clickUI(p, 'in-fade'); assert(l.marker.numKeys === 0); l.effect('MG / 入场动画 / 时长 秒')(1).setValue(2);
    near(l.transform.opacity.valueAtTime(2, false), 87.5); p.upgradeLegacy(); assert(p.lastResult.count === 1 && l.marker.numKeys === 1); near(l.marker.keyValue(1).duration, 2);
});
compactCheck('compact layout fits UI and tool controls at minimum size', function (c, l, p) {
    p.root.show(); p.root.size = p.root.minimumSize;
    var choices = ['in-fade', 'stagger-random', 'keyloop-cycle'];
    for (var i = 0; i < choices.length; i++) {
        p.selectPreset(choices[i]); p.root.layout.layout(true); p.root.layout.resize();
        assert(p.note.bounds.bottom <= p.root.size.height - 8, 'Footer clipped');
        var section = p.modes[MotionGraphicsJSX.catalog.find(choices[i]).type]; assert(section.grid.bounds.bottom <= section.tab.size.height, 'Grid clipped');
    }
    assert(p.frames.size.width >= 30 && p.seed.size.width >= 40); result.bounds.window = [p.root.size.width, p.root.size.height];
});
compactCheck('compact builder still supports docked Panel containers', function (c, l, p) {
    var w = new Window('palette', 'COMPACT DOCK TEST ONLY'), container = w.add('panel');
    var docked = MotionGraphicsJSX.create(container, function (r) { return MotionGraphicsJSX.host.run(r, c); }); assert(docked.root === container && docked.tabs.children.length === 2); w.close();
});
