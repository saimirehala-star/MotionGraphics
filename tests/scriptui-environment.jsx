// Diagnostic only: run in a separate empty AE instance.
var mgEnvironmentRoot = $.getenv('MG_JSX_TEST_ROOT');
function mgWriteEnvironment(stage) {
    var output = File(mgEnvironmentRoot + '/test-results/scriptui-environment.log');
    output.encoding = 'UTF-8';
    if (output.open('a')) {
        output.writeln(stage + ': Window=' + typeof Window + '; Panel=' + typeof Panel + '; ScriptUI=' + typeof ScriptUI + '; render=' + app.isRenderEngine + '; exit=' + app.exitAfterLaunchAndEval);
        try { var w = new Window('palette', 'Native UI diagnostic'); output.writeln('Window created; Panel=' + typeof Panel); w.close(); }
        catch (e) { output.writeln('Window failed: ' + e.toString()); }
        output.close();
    }
}
if (app.project && app.project.numItems === 0 && !app.project.file) {
    mgWriteEnvironment('immediate');
    app.exitAfterLaunchAndEval = false;
    app.scheduleTask("mgWriteEnvironment('scheduled'); if(app.project.numItems === 0 && !app.project.file){app.quit();}", 2500, false);
}
