// Read-only launch probe: do not modify any AE project or preferences.
app.exitCode = 73;
app.exitAfterLaunchAndEval = true;
var mgProbeRoot = File($.fileName).parent.parent;
var mgProbeFile = File(mgProbeRoot.fsName + '/test-results/ae-probe.txt');
mgProbeFile.encoding = 'UTF-8';
if (mgProbeFile.open('w')) {
    mgProbeFile.writeln('AE ' + app.version + '; project items: ' + (app.project ? app.project.numItems : 'none'));
    try {
        $.evalFile(File(mgProbeRoot.fsName + '/tests/ae-smoke.jsx'));
        mgProbeFile.writeln('Smoke script finished');
    } catch (mgError) {
        mgProbeFile.writeln('ERROR: ' + mgError.toString() + '; line ' + mgError.line + '; file ' + mgError.fileName);
    }
    mgProbeFile.close();
} else {
    app.exitCode = 74;
}
