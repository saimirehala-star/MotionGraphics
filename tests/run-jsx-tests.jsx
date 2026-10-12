// ASCII CLI bootstrap that captures parse errors from the native test suite.
var mgTestRoot = $.getenv('MG_JSX_TEST_ROOT');
var mgTestEmpty = app.project && app.project.numItems === 0 && !app.project.file;
var mgTestLog = File(mgTestRoot + '/test-results/ae-jsx-launch.log');
mgTestLog.encoding = 'UTF-8';
if (mgTestLog.open('w')) {
    mgTestLog.writeln('AE ' + app.version + '; script: ' + $.fileName);
    try {
        $.evalFile(File(mgTestRoot + '/tests/ae-jsx-probe.jsx'));
        mgTestLog.writeln('JSX test runner finished.');
    } catch (mgLaunchError) {
        mgTestLog.writeln('ERROR: ' + mgLaunchError.toString() + '; line ' + mgLaunchError.line + '; file ' + mgLaunchError.fileName);
    }
    mgTestLog.close();
}
if (mgTestEmpty) {
    // Smoke tests can leave solid source items after deleting their comps. Do not leave a save prompt.
    if (app.project && !app.project.file) { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); }
    app.exitAfterLaunchAndEval = true;
}
