// Visual QA creates one temporary shape in its own guarded empty instance.
(function () {
    if (!app.project || app.project.numItems !== 0 || app.project.file) { return; }
    $.evalFile(File($.getenv('MG_JSX_TEST_ROOT') + '/test-results/jsx-standalone/MotionGraphics.jsx'));
    var c = app.project.items.addComp('MG Inspector QA Only', 640, 480, 1, 6, 30), l = c.layers.addShape(); l.name = '示例卡片'; c.time = 2; l.selected = true;
    var ids = ['in-slide', 'loop-breathe', 'out-fade', 'feedback-pop'];
    for (var i = 0; i < ids.length; i++) { MotionGraphicsJSX.host.run({ action: 'apply', data: { id: ids[i], markerTiming: true } }, c); }
    c.openInViewer();
    var ui = MotionGraphicsJSX.session; ui.selectPreset('in-slide');
    ui.root.text = 'Motion Graphics JSX QA';
    $.global.MGRangePreviewComp = c;
    app.exitAfterLaunchAndEval = false;
    app.scheduleTask("if(app.project.numItems===1 && !app.project.file && app.project.item(1).id===$.global.MGRangePreviewComp.id){$.global.MotionGraphicsJSXSession.root.close();$.global.MGRangePreviewComp.remove();app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);app.quit();}", 40000, false);
}());
