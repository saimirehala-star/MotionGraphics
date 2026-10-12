/* AI tools for AE 2023. IDs and a turn token pin requests to one project/comp. */
var MGAIHost = (function () {
    var session = null;
    function fail(s) { throw new Error(s); }
    function ok(data) { return { ok: true, data: data }; }
    function finite(v, min, max, name) { var n = Number(v); if (!isFinite(n) || n < min || n > max) fail('无效的' + name); return n; }
    function compById(id) { for (var i = 1; i <= app.project.numItems; i++) { var c = app.project.item(i); if (c instanceof CompItem && c.id === Number(id)) return c; } return null; }
    function validate(d) {
        if (!session) fail('[AI_SESSION_MISSING] AE 任务状态未保留。请检查是否已安装 2.2.1 或更新版本，并重启 AE。');
        if (d.token !== session.token) fail('[AI_SESSION_EXPIRED] 本次任务已结束或被新任务替换，旧请求未执行。');
        if (app.project !== session.project) fail('[AI_PROJECT_CHANGED] 当前工程已切换，旧请求未执行。请在目标工程重新发送需求。');
        var c = session.compId ? compById(session.compId) : null;
        if (session.compId && !c) fail('目标合成已删除。');
        var active = app.project.activeItem;
        if (active instanceof CompItem && active.id !== session.compId) fail('当前合成已切换，请重新发送需求以更新操作范围。');
        if (app.project.renderQueue.rendering) fail('AE 正在渲染，请完成后再操作。');
        return c;
    }
    function layer(c, id) {
        if (!c) fail('当前没有目标合成。');
        for (var i = 1; i <= c.numLayers; i++) if (c.layer(i).id === Number(id)) return c.layer(i);
        fail('目标图层不存在：' + id);
    }
    function info(l) {
        var effects = [], e = l.property('ADBE Effect Parade');
        if (e) for (var j = 1; j <= Math.min(e.numProperties, 80); j++) effects.push({ index: j, name: e.property(j).name, matchName: e.property(j).matchName });
        return { id: l.id, index: l.index, name: l.name, locked: l.locked, enabled: l.enabled, selected: l.selected,
            inPoint: l.inPoint, outPoint: l.outPoint, startTime: l.startTime, parentId: l.parent ? l.parent.id : null, effects: effects };
    }
    function context(c) {
        var selected = [], layers = [], i;
        if (c) { for (i = 0; i < c.selectedLayers.length; i++) selected.push(c.selectedLayers[i].id); for (i = 1; i <= Math.min(c.numLayers, 200); i++) layers.push(info(c.layer(i))); }
        return { aeVersion: String(app.version), compatibility: typeof MGCompatibility !== 'undefined' ? MGCompatibility.current() : null, projectName: app.project.file ? app.project.file.name : '未保存工程', comp: c ? { id: c.id, name: c.name, width: c.width, height: c.height, duration: c.duration, frameRate: c.frameRate, time: c.time, displayStartTime: c.displayStartTime, layerCount: c.numLayers } : null, selectedLayerIds: selected, layers: layers, truncated: c ? c.numLayers > 200 : false, timeConvention: '工具和关键帧时间均为合成内部秒数。优先操作 selectedLayerIds，其他对象须符合用户需求。' };
    }
    function begin(c) {
        session = { project: app.project, compId: c ? c.id : 0, token: 'ai-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000000) };
        return ok({ token: session.token, context: context(c) });
    }
    function property(l, path) {
        if (!(path instanceof Array) || !path.length || path.length > 20) fail('propertyPath 必须是属性索引或 matchName 数组。');
        var p = l;
        for (var i = 0; i < path.length; i++) { p = p.property(path[i]); if (!p) fail('属性路径不存在：' + path.join('/')); }
        return p;
    }
    function plainValue(v) {
        if (v instanceof TextDocument) return { text: v.text, font: v.font, fontSize: v.fontSize, applyFill: v.applyFill, fillColor: v.applyFill ? v.fillColor : null };
        if (v instanceof Shape) return { vertices: v.vertices, inTangents: v.inTangents, outTangents: v.outTangents, closed: v.closed };
        if (v instanceof MarkerValue) return { comment: v.comment, duration: v.duration };
        return v;
    }
    function describe(p, depth, budget) {
        var r = { name: p.name, matchName: p.matchName, index: p.propertyIndex }, i;
        budget.count++;
        if (p.propertyType === PropertyType.PROPERTY) {
            try { r.value = plainValue(p.value); } catch (e) { r.value = '无法序列化的 AE 值'; }
            r.numKeys = p.numKeys; r.canSetExpression = p.canSetExpression;
            if (p.canSetExpression) { r.expression = p.expression; r.expressionEnabled = p.expressionEnabled; r.expressionError = p.expressionError; }
            r.keys = []; for (i = 1; i <= Math.min(p.numKeys, 60); i++) r.keys.push({ time: p.keyTime(i), value: plainValue(p.keyValue(i)) });
        } else if (depth > 0) {
            r.children = []; for (i = 1; i <= p.numProperties && budget.count < 300; i++) r.children.push(describe(p.property(i), depth - 1, budget));
            r.truncated = r.children.length < p.numProperties;
        }
        return r;
    }
    function read(d) {
        var c = validate(d), a = d.args || {}, q = a.query || 'context';
        if (q === 'context') return ok(context(c));
        if (q === 'project') { var list = []; for (var i = 1; i <= app.project.numItems && list.length < 300; i++) { var item = app.project.item(i); list.push({ id: item.id, name: item.name, kind: item instanceof CompItem ? 'composition' : 'asset' }); } return ok({ items: list, truncated: app.project.numItems > 300 }); }
        if (q === 'properties') { var l = layer(c, a.layerId); return ok(describe(a.propertyPath && a.propertyPath.length ? property(l, a.propertyPath) : l, Math.min(5, Number(a.depth) || 3), { count: 0 })); }
        if (q === 'catalog') { var presets = []; for (var j = 0; j < MGCatalog.presets.length; j++) { var p = MGCatalog.presets[j]; presets.push({ id: p.id, name: p.name, category: p.category, defaults: p.defaults, desc: p.desc }); } return ok(presets); }
        var actions = { templates: 'listTemplates', presets: 'listUserPresets', expressions: 'listExpressions' };
        if (actions[q]) {
            var library = MG2023Host.run({ action: actions[q], data: {} }, c);
            if (!library.ok) return library;
            var source = library.data[q] || [], rows = [], offset = Math.max(0, Math.floor(Number(a.offset) || 0)), search = String(a.search || '').toLowerCase();
            for (var n = 0; n < source.length; n++) {
                var entry = source[n];
                if (a.id && entry.id !== a.id) continue;
                if (search && String(entry.name).toLowerCase().indexOf(search) < 0) continue;
                var row = { id: entry.id, name: entry.name, category: entry.category, description: entry.desc || entry.description, defaults: entry.defaults, duration: entry.duration, width: entry.width, height: entry.height };
                if (q === 'expressions') { row.usage = entry.usage; if (a.id) row.expression = entry.expression; }
                rows.push(row);
            }
            return ok({ items: rows.slice(offset, offset + 100), total: rows.length, nextOffset: rows.length > offset + 100 ? offset + 100 : null });
        }
        fail('未知读取类型。');
    }
    function applyOne(c, a) {
        var l, p, t, i, result;
        if (a.op === 'createComp') {
            c = app.project.items.addComp(String(a.name || 'AI 合成'), Math.round(finite(a.width || 1920, 4, 30000, '宽度')), Math.round(finite(a.height || 1080, 4, 30000, '高度')), 1, finite(a.duration || 5, .04, 10800, '时长'), finite(a.frameRate || 30, 1, 120, '帧率'));
            session.compId = c.id; c.openInViewer(); return { compId: c.id };
        }
        if (!c) fail('请先创建或打开合成。');
        if (a.op === 'addText') { l = c.layers.addText(String(a.text || '')); if (a.name) l.name = String(a.name); }
        else if (a.op === 'addNull') { l = c.layers.addNull(c.duration); if (a.name) l.name = String(a.name); }
        else if (a.op === 'addSolid') { l = c.layers.addSolid(a.color || [1,1,1], String(a.name || 'AI 色块'), Math.round(finite(a.width || c.width, 4, 30000, '宽度')), Math.round(finite(a.height || c.height, 4, 30000, '高度')), 1, c.duration); }
        else if (a.op === 'addShape') {
            l = c.layers.addShape(); l.name = String(a.name || 'AI 形状');
            var contents = l.property('ADBE Root Vectors Group'), shape = contents.addProperty(a.shape === 'ellipse' ? 'ADBE Vector Shape - Ellipse' : 'ADBE Vector Shape - Rect');
            shape.property(a.shape === 'ellipse' ? 'ADBE Vector Ellipse Size' : 'ADBE Vector Rect Size').setValue(a.size || [200,200]);
            contents.addProperty('ADBE Vector Graphic - Fill').property('ADBE Vector Fill Color').setValue(a.color || [1,1,1]);
        }
        else {
            l = layer(c, a.layerId); if (l.locked) fail('图层已锁定：' + l.name);
            if (a.op === 'rename') l.name = String(a.name);
            else if (a.op === 'duplicate') { l = l.duplicate(); if (a.name) l.name = String(a.name); }
            else if (a.op === 'remove') { result = { removedLayerId: l.id }; l.remove(); return result; }
            else if (a.op === 'parent') { var parent = a.parentId ? layer(c, a.parentId) : null; if (parent === l) fail('图层不能绑定自身。'); l.parent = parent; }
            else if (a.op === 'addEffect') { var effects = l.property('ADBE Effect Parade'); if (!effects || !effects.canAddProperty(a.matchName)) fail('当前 AE 不支持效果：' + a.matchName); p = effects.addProperty(a.matchName); return { layerId: l.id, effectIndex: p.propertyIndex, matchName: p.matchName }; }
            else if (a.op === 'text') { p = l.property('ADBE Text Properties').property('ADBE Text Document'); t = p.value; if (a.text !== undefined) t.text = String(a.text); if (a.fontSize !== undefined) t.fontSize = finite(a.fontSize, 1, 2000, '字号'); if (a.color) {t.applyFill = true; t.fillColor = a.color;} if (a.font) t.font = a.font; p.setValue(t); }
            else if (a.op === 'timing') { if (a.startTime !== undefined) l.startTime = finite(a.startTime, -10800, 10800, '图层起点'); if (a.inPoint !== undefined) l.inPoint = finite(a.inPoint, -10800, 10800, '入点'); if (a.outPoint !== undefined) l.outPoint = finite(a.outPoint, -10800, 10800, '出点'); }
            else if (a.op === 'property') {
                p = property(l, a.propertyPath); if (p.propertyType !== PropertyType.PROPERTY) fail('必须指定可赋值属性。');
                if (a.clearKeys === true) { for (i = p.numKeys; i >= 1; i--) p.removeKey(i); }
                if (a.value !== undefined) { if (p.numKeys) p.setValueAtTime(c.time, a.value); else p.setValue(a.value); }
                if (a.keys) { if (!(a.keys instanceof Array) || a.keys.length > 300) fail('单属性最多设置 300 个关键帧。'); for (i = 0; i < a.keys.length; i++) { var k = a.keys[i], time = finite(k.time, 0, c.duration, '关键帧时间'); p.setValueAtTime(time, k.value); if (k.hold) { var n = p.nearestKeyIndex(time); p.setInterpolationTypeAtKey(n, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD); } } }
                if (a.expression !== undefined) { if (!p.canSetExpression) fail('此属性不支持表达式。'); var old = p.expression, enabled = p.expressionEnabled; p.expression = String(a.expression); if (p.expressionError) { var error = p.expressionError; p.expression = old; if (old) p.expressionEnabled = enabled; fail('表达式未应用，已恢复原表达式：' + error); } }
                return { layerId: l.id, property: describe(p, 0, {count:0}) };
            } else fail('未知编辑操作：' + a.op);
        }
        return info(l);
    }
    function edit(d) {
        var c = validate(d), a = d.args || {}, ops = a.operations, completed = [], error = null;
        if (!(ops instanceof Array) || !ops.length || ops.length > 50) fail('每批需要 1–50 个编辑操作。');
        app.beginUndoGroup('Motion Graphics · AI 编辑');
        try { for (var i = 0; i < ops.length; i++) { completed.push(applyOne(c, ops[i])); c = session.compId ? compById(session.compId) : null; } }
        catch(e) { error = e.message || String(e); }
        finally { app.endUndoGroup(); }
        return { ok: !error, data: { completed: completed, context: context(c), partial: !!error && completed.length > 0 }, message: error ? error + '；已完成操作可能保留，可在 AE 撤销本批修改。' : '已完成 ' + completed.length + ' 项操作。' };
    }
    function plugin(d) {
        var c = validate(d), a = d.args || {}, allowed = ['apply','remove','setTiming','importTemplate','prerenderStatus','prerenderTemplates','prerenderPreflight','prerenderCreateRange','prerenderRender','prerenderMode','prerenderUpdate','prerenderReturnCache'];
        var found = false; for (var i=0;i<allowed.length;i++) if(allowed[i]===a.action) found=true;
        if (!found) fail('AI 暂不开放这个插件操作。');
        if (!c) fail('请先打开目标合成。');
        var old = c.selectedLayers, chosen = a.layerIds, data = a.data || {};
        if (chosen && chosen.length) { var targets=[]; for(i=0;i<chosen.length;i++) targets.push(layer(c,chosen[i])); for(i=1;i<=c.numLayers;i++) c.layer(i).selected=false; for(i=0;i<targets.length;i++) targets[i].selected=true; }
        try { return MG2023Host.run({ action: a.action, data: data }, c); }
        finally { if(chosen && chosen.length) { for(i=1;i<=c.numLayers;i++) c.layer(i).selected=false; for(i=0;i<old.length;i++) try{old[i].selected=true;}catch(ignore){} } }
    }
    function script(d) {
        var c = validate(d); if (d.approved !== true) fail('自由 JSX 需要用户在面板内确认。');
        var code = String((d.args || {}).code || ''); if (!code || code.length > 60000) fail('脚本为空或过长。');
        app.beginUndoGroup('Motion Graphics · AI JSX');
        try { var value = (new Function('comp','selectedLayers',code))(c,c ? c.selectedLayers : []); return ok({ result: value === undefined ? null : value, context: context(c) }); }
        finally { app.endUndoGroup(); }
    }
    function run(action,d,c) {
        if(action==='aiBegin') return begin(c);
        if(action==='aiEnd') { if(session && d.token===session.token) session=null; return ok(null); }
        if(action==='aiRead') return read(d);
        if(action==='aiEdit') return edit(d);
        if(action==='aiPlugin') return plugin(d);
        if(action==='aiScript') return script(d);
        fail('未知 AI 操作。');
    }
    return { run: run, handles: function(a){return /^ai(?:Begin|End|Read|Edit|Plugin|Script)$/.test(a);} };
}());
