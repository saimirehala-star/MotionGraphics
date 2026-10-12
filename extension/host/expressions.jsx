/* Team expression reference library. Expressions are copied by the user and never executed here. */
var MGExpressionHost = (function () {
    var SCHEMA = 1, PREFIX = 'expr-', EXTENSION = '.mgexpression.json';
    var TEAM_ROOT = 'Y:/项目素材/童话岛/Plug/MotionGraphics/表达式库';
    function fail(message) { throw new Error(message); }
    function trim(value) { return String(value === undefined || value === null ? '' : value).replace(/^\s+|\s+$/g, ''); }
    function validId(id) { return typeof id === 'string' && /^expr-[a-z0-9-]{6,80}$/.test(id); }
    function setRoot(data) { if (data && data.folder !== undefined) { var value = trim(data.folder); if (value) { var probe = Folder(value); $.global.MotionGraphicsExpressionRoot = value; } } }
    function chooseRoot() { var selected = Folder.selectDialog('选择表达式保存目录'); if (!selected) { return { ok:true, message:'已取消选择表达式目录。', data:{cancelled:true} }; } $.global.MotionGraphicsExpressionRoot = selected.fsName; return { ok:true, message:'表达式目录已设置。', data:{folder:selected.fsName} }; }
    function rootFolder() {
        var override = $.global.MotionGraphicsExpressionRoot;
        var folder = Folder(override ? override : TEAM_ROOT);
        if (!folder.exists && !folder.create()) { fail('表达式目录不可访问：' + folder.fsName + '。请确认绿联云已连接并映射为 Y: 盘。'); }
        return folder;
    }
    function fileFor(id) { if (!validId(id)) { fail('表达式 ID 无效。'); } return File(rootFolder().fsName + '/' + id + EXTENSION); }
    function readText(file) {
        file.encoding = 'UTF-8'; if (!file.exists || !file.open('r')) { fail('无法读取表达式文件：' + file.fsName); }
        var text = file.read(); file.close(); return text;
    }
    function writeText(file, text) {
        file.encoding = 'UTF-8'; file.lineFeed = 'Unix'; if (!file.open('w')) { fail('无法写入表达式文件：' + file.fsName); }
        var ok = file.write(text); file.close(); if (!ok) { fail('表达式文件写入失败：' + file.fsName); }
    }
    function writeDocument(document) {
        var target = fileFor(document.id), temp = File(target.fsName + '.tmp');
        if (temp.exists) { temp.remove(); } writeText(temp, JSON.stringify(document, null, 2));
        if (target.exists && !target.remove()) { temp.remove(); fail('无法更新表达式：' + target.error); }
        if (!temp.rename(target.name)) { temp.remove(); fail('无法完成表达式保存。'); }
        return target;
    }
    function record(document) {
        return { id: document.id, name: document.name, usage: document.usage, expression: document.expression, createdAt: document.createdAt || '', updatedAt: document.updatedAt || '' };
    }
    function readLibrary() {
        var folder = rootFolder(), files = folder.getFiles('*' + EXTENSION), expressions = [], skipped = [], i, document;
        for (i = 0; i < files.length; i++) {
            if (!(files[i] instanceof File)) { continue; }
            try {
                document = JSON.parse(readText(files[i]));
                if (!document || Number(document.schemaVersion) !== SCHEMA || !validId(document.id) || !trim(document.name) || !trim(document.usage) || !trim(document.expression)) { fail('文件格式无效。'); }
                expressions.push(record(document));
            } catch (error) { skipped.push(files[i].name + '：' + (error.message || error)); }
        }
        expressions.sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); });
        return { expressions: expressions, skipped: skipped, folder: folder.fsName };
    }
    function save(data) {
        var id = trim(data.id), existing = null, file, now = new Date().toUTCString();
        var name = trim(data.name).replace(/[\r\n\t]/g, ' ').substring(0, 64);
        var usage = trim(data.usage).substring(0, 1200), expression = trim(data.expression).substring(0, 50000);
        if (!name) { fail('请填写表达式名称。'); }
        if (!usage) { fail('请填写表达式使用方法。'); }
        if (!expression) { fail('请填写具体表达式。'); }
        if (id) {
            if (!validId(id)) { fail('要修改的表达式 ID 无效。'); }
            file = fileFor(id); if (!file.exists) { fail('找不到要修改的表达式。'); }
            existing = JSON.parse(readText(file));
        } else { id = PREFIX + new Date().getTime().toString(36) + '-' + Math.floor(Math.random() * 2147483647).toString(36); }
        var document = { schemaVersion: SCHEMA, id: id, name: name, usage: usage, expression: expression, createdAt: existing && existing.createdAt ? existing.createdAt : now, updatedAt: now };
        file = writeDocument(document);
        return { ok: true, message: existing ? '已更新表达式“' + name + '”。' : '已新增表达式“' + name + '”。', data: { expression: record(document), file: file.fsName } };
    }
    function remove(data) {
        var id = trim(data.id), file = fileFor(id), name = id;
        if (!file.exists) { fail('找不到要删除的表达式。'); }
        try { name = JSON.parse(readText(file)).name || id; } catch (ignored) {}
        if (!file.remove()) { fail('无法删除表达式：' + file.error); }
        return { ok: true, message: '已删除表达式“' + name + '”。', data: { id: id } };
    }
    function run(action, data) {
        if (action === 'chooseExpressionFolder') { return chooseRoot(); }
        setRoot(data);
        if (action === 'listExpressions') { var library = readLibrary(); return { ok: true, message: library.expressions.length ? '已读取 ' + library.expressions.length + ' 个表达式。' : '团队表达式库还是空的。', data: library }; }
        if (action === 'saveExpression') { return save(data || {}); }
        if (action === 'deleteExpression') { return remove(data || {}); }
        if (action === 'revealExpressionFolder') { var folder = rootFolder(); if (!folder.execute()) { fail('无法打开表达式目录。'); } return { ok: true, message: '已打开表达式目录。', data: { folder: folder.fsName } }; }
        fail('未知表达式操作。');
    }
    function handles(action) { return /^(?:listExpressions|saveExpression|deleteExpression|revealExpressionFolder|chooseExpressionFolder)$/.test(String(action || '')); }
    return { handles: handles, run: run, version: '1.0.0' };
}());
