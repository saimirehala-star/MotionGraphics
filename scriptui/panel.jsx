/* Compact native ScriptUI. Animation properties are edited in AE Effect Controls. */
var MGScriptUI = (function () {
    function clear(group) { while (group.children.length) { group.remove(group.children[0]); } }
    function create(container, run) {
        var root = container;
        if (!(container instanceof Panel)) { root = new Window('palette', 'Motion Graphics · JSX 1.8.0', undefined, { resizeable: true }); }
        root.orientation = 'column'; root.alignChildren = ['fill', 'top']; root.margins = 12; root.spacing = 8;
        root.minimumSize = [380, 470]; root.preferredSize = [400, 490];
        var refs = { root: root, modes: {}, presetButtons: {}, version: '1.8.0' }, busy = false, changing = false, mode = 'ui';
        var heading = root.add('group'); heading.alignment = ['fill', 'top'];
        var brand = heading.add('statictext', undefined, 'Motion Graphics / JSX 1.8.0'); brand.alignment = ['fill', 'center'];
        refs.autoMarkers = heading.add('checkbox', undefined, '标记控时'); refs.autoMarkers.value = true;
        refs.autoMarkers.helpTip = '默认在原图层创建范围标记，拖动改时间，删除移除动效。关闭只影响新动效，新动效的时长和偏移改由效果控件控制。';
        refs.help = heading.add('button', undefined, '帮助'); refs.help.preferredSize = [48, 25];
        refs.tabs = root.add('tabbedpanel'); refs.tabs.alignment = ['fill', 'fill']; refs.tabs.alignChildren = ['fill', 'fill'];
        refs.tabs.minimumSize.height = 274;
        function makeMode(id, title) {
            var tab = refs.tabs.add('tab', undefined, title); tab.orientation = 'column'; tab.alignChildren = ['fill', 'top']; tab.margins = 8; tab.spacing = 7;
            var row = tab.add('group'); row.alignment = ['fill', 'top']; row.add('statictext', undefined, '分类');
            var menu = row.add('dropdownlist'); menu.alignment = ['fill', 'center'];
            var previousPage = row.add('button', undefined, '‹'); previousPage.preferredSize = [28, 24];
            var pageLabel = row.add('statictext', undefined, '1 / 1'); pageLabel.preferredSize = [38, 20];
            var nextPage = row.add('button', undefined, '›'); nextPage.preferredSize = [28, 24];
            var categories = [], i;
            for (i = 0; i < MGCatalog.categories.length; i++) {
                if (MGCatalog.categories[i].panel === id) { categories.push(MGCatalog.categories[i]); menu.add('item', MGCatalog.categories[i].name); }
            }
            menu.selection = 0;
            var aux = tab.add('group'); aux.orientation = 'stack'; aux.alignment = ['fill', 'top']; aux.preferredSize.height = 28;
            var hint = aux.add('statictext', undefined, '单击预设应用，参数在图层效果控件中调整。'); hint.alignment = ['fill', 'center'];
            var section = { tab: tab, menu: menu, categories: categories, hint: hint, buttons: {}, selectedId: '', page: 0, pageSize: 8, previousPage: previousPage, nextPage: nextPage, pageLabel: pageLabel };
            if (id === 'tools') {
                section.stagger = aux.add('group'); section.stagger.alignment = ['fill', 'center']; section.stagger.spacing = 5;
                section.stagger.add('statictext', undefined, '间隔帧'); refs.frames = section.stagger.add('edittext', undefined, '3'); refs.frames.characters = 4;
                section.stagger.add('statictext', undefined, '随机种子'); refs.seed = section.stagger.add('edittext', undefined, '17'); refs.seed.characters = 5;
                refs.frames.helpTip = '0–1000 的整数；先设间隔，再单击错帧工具。'; refs.seed.helpTip = '仅随机错帧使用，1–99999 的整数；相同种子可复现。';
                refs.removeKeyLoop = aux.add('button', undefined, '移除关键帧循环'); refs.removeKeyLoop.alignment = ['left', 'center'];
                refs.removeKeyLoop.onClick = function () { execute({ action: 'remove', data: { category: 'keyloop' } }); };
            }
            section.grid = tab.add('group'); section.grid.orientation = 'column'; section.grid.alignChildren = ['fill', 'top']; section.grid.spacing = 6;
            refs.modes[id] = section;
            previousPage.onClick = function () { if (section.page > 0) { section.page--; section.selectedId = ''; renderGrid(id); relayout(); } };
            nextPage.onClick = function () { section.page++; section.selectedId = ''; renderGrid(id); relayout(); };
            menu.onChange = function () { if (!changing && menu.selection) { section.page = 0; section.selectedId = ''; renderGrid(id); relayout(); } };
        }
        makeMode('ui', 'UI 动效'); makeMode('tools', '效率工具');
        refs.status = root.add('statictext', undefined, '选中图层后，单击预设即可应用。', { multiline: true });
        refs.status.alignment = ['fill', 'top']; refs.status.preferredSize = [360, 42];
        refs.note = root.add('statictext', undefined, '动效参数 → 效果控件；起止 / 时长 → 范围标记。\n删除标记移除动效；自动清理单独占一次撤销。', { multiline: true });
        refs.note.alignment = ['fill', 'top']; refs.note.preferredSize = [360, 34];
        function relayout() { root.layout.layout(true); root.layout.resize(); }
        function report(result) {
            refs.lastResult = result;
            var text = result.message || '', details = text;
            if (result.skipped && result.skipped.length) { text += '\n' + result.skipped[0]; details += '\n' + result.skipped.join('\n'); }
            refs.status.text = text; refs.status.helpTip = details;
        }
        function integer(input, min, max, title) {
            var text = String(input.text).replace(/\s/g, ''), n = Number(text);
            if (!text || !isFinite(n) || n !== Math.floor(n) || n < min || n > max) { throw new Error(title + '须为 ' + min + '–' + max + ' 的整数。'); }
            return n;
        }
        function execute(request) {
            if (busy) { return; } busy = true;
            try { report(run(request)); } catch (e) { report({ ok: false, message: e.message || String(e) }); }
            finally { busy = false; }
            return refs.lastResult;
        }
        function clickPreset(id) {
            if (busy) { return; }
            var preset = MGCatalog.find(id), data = { id: id, markerTiming: refs.autoMarkers.value, reuseExisting: true };
            try {
                if (preset.category === 'stagger') {
                    data.params = { frames: integer(refs.frames, 0, 1000, '间隔帧数') };
                    if (id === 'stagger-random') { data.params.seed = integer(refs.seed, 1, 99999, '随机种子'); }
                }
                highlight(preset.type, id); return execute({ action: 'apply', data: data });
            } catch (e) { report({ ok: false, message: e.message || String(e) }); return refs.lastResult; }
        }
        function highlight(id, presetId) {
            var section = refs.modes[id], key; section.selectedId = presetId;
            for (key in section.buttons) { if (section.buttons.hasOwnProperty(key)) { section.buttons[key].text = (key === presetId ? '● ' : '') + MGCatalog.find(key).name; } }
            if (id === mode) { refs.presetButtons = section.buttons; refs.selectedId = presetId; }
        }
        function renderGrid(id) {
            var section = refs.modes[id], category = section.categories[section.menu.selection.index], found = [], i, p, row, button;
            clear(section.grid); section.buttons = {};
            for (i = 0; i < MGCatalog.presets.length; i++) { if (MGCatalog.presets[i].category === category.id) { found.push(MGCatalog.presets[i]); } }
            if (id === 'tools') {
                section.stagger.visible = category.id === 'stagger'; refs.removeKeyLoop.visible = category.id === 'keyloop';
                section.hint.visible = category.id !== 'stagger' && category.id !== 'keyloop'; section.hint.text = '单击工具执行；Ctrl+Z 撤销工具操作。';
            }
            var pages = Math.max(1, Math.ceil(found.length / section.pageSize)), selectedIndex = -1;
            for (i = 0; i < found.length; i++) { if (found[i].id === section.selectedId) { selectedIndex = i; break; } }
            if (selectedIndex >= 0) { section.page = Math.floor(selectedIndex / section.pageSize); }
            section.page = Math.max(0, Math.min(pages - 1, section.page)); section.previousPage.visible = pages > 1; section.nextPage.visible = pages > 1; section.pageLabel.visible = pages > 1;
            section.previousPage.enabled = section.page > 0; section.nextPage.enabled = section.page < pages - 1; section.pageLabel.text = (section.page + 1) + ' / ' + pages;
            var begin = section.page * section.pageSize, end = Math.min(found.length, begin + section.pageSize), pageIndex = 0;
            for (i = begin; i < end; i++) {
                if (pageIndex % 2 === 0) { row = section.grid.add('group'); row.alignment = ['fill', 'top']; row.spacing = 6; }
                p = found[i]; button = row.add('button', undefined, p.name); button.alignment = ['fill', 'center']; button.preferredSize = [166, 42];
                button.mgId = p.id; button.helpTip = p.desc; button.onClick = function () { return clickPreset(this.mgId); }; section.buttons[p.id] = button; pageIndex++;
            }
            var selected = section.selectedId; if (!section.buttons[selected]) { selected = found[begin].id; } highlight(id, selected);
        }
        refs.selectPreset = function (id) {
            var preset = MGCatalog.find(id); if (!preset) { throw new Error('未知预设。'); } changing = true;
            try {
                mode = preset.type; var section = refs.modes[mode]; refs.tabs.selection = section.tab;
                for (var i = 0; i < section.categories.length; i++) { if (section.categories[i].id === preset.category) { section.menu.selection = i; } }
                section.selectedId = id; renderGrid(mode); relayout();
            } finally { changing = false; }
        };
        refs.upgradeLegacy = function () { return execute({ action: 'upgradeTiming' }); };
        refs.help.onClick = function () {
            var dialog = new Window('dialog', 'Motion Graphics · 帮助'); dialog.orientation = 'column'; dialog.alignChildren = ['fill', 'top']; dialog.margins = 14;
            var helpText = '选中图层，单击预设立即应用。新动效使用默认参数；幅度、方向、角度、弹性、循环周期等在图层的“效果控件”中调整。重复单击同一个已有动效不会重置参数；更换同类预设使用新预设默认值并保留已有范围。\n\n标记控时开启时：拖动范围改起点，拉伸改时长；也可用 AE 自带标记对话框编辑。旧时长/偏移滑块保留兼容，不决定标记范围。关闭顶部开关只影响新动效，改用效果控件的时长和偏移。\n\n删除范围标记会立即停止对应动效。面板显示时约 1–2 秒清理控件和记录，清理单独占一次撤销；恢复通常需要依次撤销清理和标记删除。其他动效、原关键帧和用户标记保留。\n\n不同范围可以重叠，但起点不能完全相同。创建时自动避让；手动拖动造成覆盖也按删除处理。\n\n错帧间隔和随机种子是一次性工具设置，只在错帧分类显示。关键帧循环的移除入口保留在对应分类。\n\n旧工程：选中图层后点击下方“旧动效升级/修复”，将旧参数或旧控制层动效转为本层范围并启用删除联动，也可修复零时长/重复 ID。不会恢复已按删除联动删除的标记。仅打开新版不会修改旧动效。';
            var body = dialog.add('edittext', undefined, helpText, { multiline: true, readonly: true, scrolling: true }); body.preferredSize = [430, 310];
            var actions = dialog.add('group'); actions.alignment = ['fill', 'top'];
            var upgrade = actions.add('button', undefined, '旧动效升级/修复'); upgrade.onClick = function () { dialog.close(); refs.upgradeLegacy(); };
            actions.add('button', undefined, '关闭', { name: 'ok' }); dialog.show();
        };
        refs.tabs.onChange = function () {
            if (changing || !refs.tabs.selection) { return; } mode = refs.tabs.selection === refs.modes.tools.tab ? 'tools' : 'ui';
            highlight(mode, refs.modes[mode].selectedId); relayout();
        };
        var cleanupSignature = '';
        refs.syncDeletedMarkers = function () {
            if (busy) { return; } busy = true;
            try {
                var result = run({ action: 'syncDeletedMarkers' }), signature = JSON.stringify(result);
                if (result.message && (result.count || signature !== cleanupSignature)) { report(result); }
                cleanupSignature = signature;
            } catch (e) { report({ ok: false, message: '自动清理暂停：' + (e.message || e) }); }
            finally { busy = false; }
        };
        root.onResizing = root.onResize = function () { this.layout.resize(); };
        changing = true; renderGrid('ui'); renderGrid('tools'); refs.tabs.selection = refs.modes.ui.tab; changing = false;
        highlight('ui', refs.modes.ui.selectedId); relayout(); return refs;
    }
    function watch(refs) {
        // Keep deletion cleanup without an inspector tab.
        var hub = $.global.MotionGraphicsWatchHub;
        if (!hub || hub.version !== 3) {
            if (hub && hub.task !== null) { app.cancelTask(hub.task); }
            hub = { sessions: [], task: null, version: 3 };
            hub.tick = function () {
                for (var i = hub.sessions.length - 1; i >= 0; i--) {
                    var session = hub.sessions[i];
                    try { if (session.root.visible) { session.syncDeletedMarkers(); } } catch (closed) { hub.sessions.splice(i, 1); }
                }
                if (!hub.sessions.length && hub.task !== null) { app.cancelTask(hub.task); hub.task = null; }
            };
            $.global.MotionGraphicsWatchHub = hub;
        }
        for (var i = 0; i < hub.sessions.length; i++) { if (hub.sessions[i] === refs) { return; } }
        hub.sessions.push(refs);
        refs.stopWatching = function () {
            for (var j = hub.sessions.length - 1; j >= 0; j--) { if (hub.sessions[j] === refs) { hub.sessions.splice(j, 1); } }
            if (!hub.sessions.length && hub.task !== null) { app.cancelTask(hub.task); hub.task = null; }
        };
        refs.root.onClose = function () { refs.stopWatching(); return true; };
        if (hub.task === null) { hub.task = app.scheduleTask('if($.global.MotionGraphicsWatchHub){$.global.MotionGraphicsWatchHub.tick();}', 1000, true); }
    }
    return { create: create, watch: watch };
}());

