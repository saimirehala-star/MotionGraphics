// Standalone native regression. Run only with AfterFX.com -m -r in a fresh empty instance.
app.exitCode = 81;
app.exitAfterLaunchAndEval = true;
(function () {
    var root = File($.fileName).parent.parent, runtime = Folder(root.fsName + '/test-results/expression-library-runtime');
    var report = { version: app.version, safeInstance: false, passed: [], failed: [] };
    function assert(value, message) { if (!value) { throw new Error(message || 'assertion failed'); } }
    function removeTree(folder) { if (!folder.exists) { return; } var entries = folder.getFiles(), i; for (i = 0; i < entries.length; i++) { if (entries[i] instanceof Folder) { removeTree(entries[i]); } else { entries[i].remove(); } } folder.remove(); }
    function check(name, fn) { try { fn(); report.passed.push(name); } catch (error) { report.failed.push({ name: name, message: error.message || String(error), line: error.line || 0 }); } }
    try {
        assert(app.project && app.project.numItems === 0 && !app.project.file, 'Refusing nonempty project'); report.safeInstance = true;
        removeTree(runtime); assert(runtime.create(), 'cannot create isolated expression folder');
        $.global.MotionGraphicsExpressionRoot = runtime.fsName;
        $.evalFile(File(root.fsName + '/extension/host/main.jsx'));
        assert(MG2023Host && MG2023Host.version === '2.2.0', 'host version mismatch');
        var created, id;
        check('empty expression library lists cleanly', function () {
            var listed = MG2023Host.run({ action: 'listExpressions', data: {} }, null);
            assert(listed.ok && listed.data.expressions.length === 0, JSON.stringify(listed));
        });
        check('expression can be created and preserves multiline source', function () {
            created = MG2023Host.run({ action: 'saveExpression', data: { name: '弹性回弹', usage: '添加到缩放属性\n需要两个关键帧', expression: 'amp = .08;\nfreq = 2;\nvalue + amp;' } }, null);
            assert(created.ok && created.data.expression.id, JSON.stringify(created)); id = created.data.expression.id;
            var listed = MG2023Host.run({ action: 'listExpressions', data: {} }, null);
            assert(listed.data.expressions.length === 1 && listed.data.expressions[0].expression.indexOf('\nfreq') > 0, 'multiline expression changed');
        });
        check('expression can be updated without changing id', function () {
            var updated = MG2023Host.run({ action: 'saveExpression', data: { id: id, name: '弹性回弹 2', usage: '选中属性后粘贴', expression: 'value + Math.sin(time);' } }, null);
            assert(updated.ok && updated.data.expression.id === id && updated.data.expression.name === '弹性回弹 2', JSON.stringify(updated));
        });
        check('expression can be deleted', function () {
            var removed = MG2023Host.run({ action: 'deleteExpression', data: { id: id } }, null);
            assert(removed.ok, JSON.stringify(removed));
            var listed = MG2023Host.run({ action: 'listExpressions', data: {} }, null);
            assert(listed.ok && listed.data.expressions.length === 0, 'expression remains after delete');
        });
    } catch (error) { report.failed.push({ name: 'setup', message: error.message || String(error), line: error.line || 0 }); }
    try { removeTree(runtime); } catch (cleanupError) { report.failed.push({ name: 'cleanup', message: cleanupError.message || String(cleanupError), line: cleanupError.line || 0 }); }
    var reportFile = File(root.fsName + '/test-results/ae-expression-library.json'); reportFile.encoding = 'UTF-8'; reportFile.lineFeed = 'Unix';
    if (reportFile.open('w')) { reportFile.write(JSON.stringify(report, null, 2)); reportFile.close(); }
    app.exitCode = report.failed.length ? 82 : 0;
}());
