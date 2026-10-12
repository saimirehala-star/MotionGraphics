// Preview only in an isolated, empty test instance. No project changes.
(function () {
    if (!app.project || app.project.numItems !== 0 || app.project.file) { return; }
    $.evalFile(File($.getenv('MG_JSX_TEST_ROOT') + '/test-results/jsx-standalone/MotionGraphics.jsx'));
    if (MotionGraphicsJSX.session) {
        MotionGraphicsJSX.session.root.text = 'Motion Graphics JSX QA';
        MotionGraphicsJSX.session.selectPreset('in-slide');
    }
    app.exitAfterLaunchAndEval = false;
    app.scheduleTask("if(app.project.numItems===0 && !app.project.file){if($.global.MotionGraphicsJSXSession){$.global.MotionGraphicsJSXSession.root.close();}app.quit();}", 45000, false);
}());
