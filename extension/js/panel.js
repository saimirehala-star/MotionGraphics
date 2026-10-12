(function () {
    'use strict';
    var USER_CATEGORY = { id: 'user', panel: 'ui', name: '团队预设', en: 'TEAM PRESETS', hint: '保存在绿联云共享目录的 JSON 动效；单击应用，右上角可导出或删除。', symbol: 'save' };
    var CLEARABLE = { 'in': true, loop: true, out: true, feedback: true };
    var PRERENDER_TEMPLATE_CACHE = 'mg-prerender-output-templates-v1';
    var LIBRARY_FOLDER_KEYS = { user: 'mg-user-presets-folder-v1', templates: 'mg-templates-folder-v1', expressions: 'mg-expressions-folder-v1' };
    var state = { panel: 'ui', category: 'in', selected: '', autoplay: false, busy: false, checking: false, lastCheck: 0, userFolder: '', userLoaded: false, templates: [], templateCategories: [], templateCategory: 'all', templateFolder: '', templatesLoaded: false, templateJob: null, templateTimer: null, expressions: [], expressionFolder: '', expressionsLoaded: false, currentExpression: null, prerender: null, prerenderTemplates: [], activeComp: '' };
    var lastCategory = { ui: 'in', tools: 'stagger' }, toastTimer;
    var $ = function (id) { return document.getElementById(id); };

    function storedFolder(kind) { try { return String(localStorage.getItem(LIBRARY_FOLDER_KEYS[kind]) || '').trim(); } catch (ignored) { return ''; } }
    function rememberFolder(kind, folder) { folder = String(folder || '').trim(); if (!folder) { return; } try { localStorage.setItem(LIBRARY_FOLDER_KEYS[kind], folder); } catch (ignored) {} }
    function folderData(kind, extra) { var data = extra || {}, folder = data.folder || storedFolder(kind); if (folder) { data.folder = folder; } return data; }
    function showFolder(kind, folder) {
        folder = String(folder || storedFolder(kind) || '').trim(); if (folder) { rememberFolder(kind, folder); }
        var node = $(kind === 'user' ? 'user-folder-path' : (kind === 'templates' ? 'template-folder-path' : 'expression-folder-path'));
        if (node) { node.textContent = folder || '使用默认目录'; node.title = folder || '使用默认团队目录'; }
    }
    async function chooseLibraryFolder(kind) {
        var actions = { user: 'chooseUserPresetFolder', templates: 'chooseTemplateFolder', expressions: 'chooseExpressionFolder' };
        var result = await execute(actions[kind], {});
        if (!result || !result.ok || !result.data || result.data.cancelled) { return; }
        rememberFolder(kind, result.data.folder); showFolder(kind, result.data.folder);
        if (kind === 'user') { state.userLoaded = false; await loadUserPresets(true); renderCategories(); renderCards(); }
        else if (kind === 'expressions') { state.expressionsLoaded = false; await loadExpressions(true); renderCategories(); renderExpressionCards(); }
        else { state.templatesLoaded = false; state.templateCategory = 'all'; await loadTemplates(true); }
    }

    MGIcons.hydrate();

    function escapeHTML(value) {
        return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, function (character) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
        });
    }

    function toast(message, error) {
        clearTimeout(toastTimer);
        $('toast').textContent = message;
        $('toast').classList.toggle('error', !!error);
        $('toast').hidden = false;
        toastTimer = setTimeout(function () { $('toast').hidden = true; }, error ? 8000 : 4300);
    }

    function setStatus(message, error) {
        $('status').textContent = message;
        $('connection-dot').style.background = error ? '#d89494' : '#96ccb0';
    }

    function renderApplied(data) {
        var categories = data && data.categories ? data.categories : [], valid = { 'in': true, loop: true, out: true, feedback: true }, validTarget = { 'in': true, loop: true, out: true, feedback: true, user: true }, html = [];
        for (var i = 0; i < categories.length; i++) {
            var entry = categories[i]; if (!valid[entry.category]) { continue; }
            var target = validTarget[entry.targetCategory] ? entry.targetCategory : entry.category;
            var count = Number(entry.totalCount) > 1 ? '<span class="applied-chip-count">' + Number(entry.appliedCount) + '/' + Number(entry.totalCount) + '</span>' : '';
            html.push('<div class="applied-chip-shell"><button class="applied-chip" data-applied-goto="' + target + '" title="查看' + escapeHTML(entry.name) + '"><span class="applied-chip-category">' + escapeHTML(entry.categoryName) + '</span><span class="applied-chip-name">' + escapeHTML(entry.name) + '</span>' + count + '</button><button class="applied-remove" data-applied-remove="' + entry.category + '" aria-label="清除' + escapeHTML(entry.categoryName) + '：' + escapeHTML(entry.name) + '" title="清除选中图层的' + escapeHTML(entry.categoryName) + '">×</button></div>');
        }
        $('applied-chips').innerHTML = html.join(''); $('applied-bar').hidden = state.panel !== 'ui' || html.length === 0;
        $('applied-scope').textContent = data && Number(data.layerCount) > 1 ? Number(data.layerCount) + ' 个图层' : (html.length ? '当前图层' : '');
        $('applied-chips').querySelectorAll('[data-applied-goto]').forEach(function (button) { button.addEventListener('click', function () { gotoAppliedCategory(button.dataset.appliedGoto); }); });
        $('applied-chips').querySelectorAll('[data-applied-remove]').forEach(function (button) { button.addEventListener('click', function () { clearCategory(button.dataset.appliedRemove); }); });
    }

    async function refreshApplied() {
        if (!MGBridge.connected) { renderApplied(null); return; }
        var result = await MGBridge.call('appliedSummary');
        if (result.ok && result.data) { renderApplied(result.data); }
        else { renderApplied(null); }
    }

    function gotoAppliedCategory(category) {
        if (!/^(in|loop|out|feedback|user)$/.test(category)) { return; }
        lastCategory.ui = category; changePanel('ui');
    }

    function currentCategory() { return state.category === 'user' ? USER_CATEGORY : MGCatalog.category(state.category); }

    function presetsInCategory() {
        var query = $('search').value.trim().toLowerCase();
        return MGCatalog.presets.filter(function (preset) {
            if (state.category === 'user') { if (!preset.user) { return false; } }
            else if (preset.user || preset.category !== state.category) { return false; }
            return !query || (preset.name + ' ' + preset.en + ' ' + preset.desc).toLowerCase().indexOf(query) !== -1;
        });
    }

    function categoryList() {
        var result = MGCatalog.categories.filter(function (category) { return category.panel === state.panel; });
        if (state.panel === 'ui') { result = result.concat([USER_CATEGORY]); }
        return result;
    }

    function renderCategories() {
        document.querySelector('.app').dataset.panel = state.panel;
        $('categories').innerHTML = categoryList().map(function (category) {
            var count = category.id === 'expressions' ? state.expressions.length : MGCatalog.presets.filter(function (preset) { return category.id === 'user' ? !!preset.user : !preset.user && preset.category === category.id; }).length;
            return '<button class="category-button ' + (category.id === state.category ? 'active' : '') + '" data-category="' + category.id + '" aria-current="' + (category.id === state.category ? 'page' : 'false') + '">' + MGIcons.svg(category.symbol) + '<span>' + category.name + '</span><span class="count">' + String(count).padStart(2, '0') + '</span></button>';
        }).join('');
        $('categories').querySelectorAll('button').forEach(function (button) {
            button.addEventListener('click', async function () {
                state.category = button.dataset.category; lastCategory[state.panel] = state.category; state.selected = ''; $('search').value = '';
                if (state.category === 'expressions') { await loadExpressions(false); }
                renderCategories(); renderCards();
            });
        });
    }

    function cardHTML(preset, index) {
        if (preset.clear) {
            return '<button class="preset-card clear-preset-card" data-clear="' + preset.category + '" aria-label="清除本类动效" title="清除选中图层的' + escapeHTML(currentCategory().name) + '、范围标记和插件控件"><span class="card-number">CLEAR</span><span class="clear-card-visual">' + MGIcons.svg('trash') + '<i></i></span><span class="card-label"><span>清除本类动效</span>' + MGIcons.svg('trash') + '</span></button>';
        }
        var selected = preset.id === state.selected, userClass = preset.user ? ' user-preset' : '';
        var number = preset.user ? 'USER' : String(index + (CLEARABLE[state.category] ? 0 : 1)).padStart(2, '0');
        var button = '<button class="preset-card' + userClass + (selected ? ' selected' : '') + '" data-id="' + escapeHTML(preset.id) + '" aria-label="应用：' + escapeHTML(preset.name) + '" aria-pressed="' + String(selected) + '" title="' + escapeHTML(preset.desc) + '"><span class="card-number">' + number + '</span><canvas width="244" height="200" aria-hidden="true"></canvas><span class="card-label"><span>' + escapeHTML(preset.name) + '</span>' + MGIcons.svg('plus') + '</span></button>';
        if (!preset.user) { return button; }
        return '<div class="preset-card-shell">' + button + '<div class="card-actions"><button class="card-action" data-export="' + preset.id + '" title="导出预设" aria-label="导出：' + escapeHTML(preset.name) + '">' + MGIcons.svg('export') + '</button><button class="card-action danger" data-delete="' + preset.id + '" title="删除预设" aria-label="删除：' + escapeHTML(preset.name) + '">' + MGIcons.svg('trash') + '</button></div></div>';
    }

    function renderCards() {
        var category = currentCategory(), presets = presetsInCategory(), cards = presets.slice();
        var expressions = state.category === 'expressions';
        $('autoplay').hidden = expressions || state.panel !== 'ui';
        document.querySelector('#preset-workspace .collection-tip').hidden = expressions;
        $('search').parentNode.hidden = false;
        if (state.panel === 'tools') {
            $('workflow-note-text').textContent = expressions ? '表达式只作为团队文档保存；单击卡片查看说明，再复制到 AE 属性。' : '效率工具会直接作用于选中图层；具体的选择和操作要求见当前分类说明。';
        }
        if (expressions) { renderExpressionCards(); return; }
        if (CLEARABLE[state.category]) { cards.unshift({ clear: true, category: state.category }); }
        $('category-en').textContent = category.en; $('category-name').firstChild.textContent = category.name + ' ';
        $('preset-count').textContent = String(presets.length).padStart(2, '0'); $('category-hint').textContent = category.hint;
        $('extract-backup-option').hidden = state.category !== 'composition';
        $('stagger-options').hidden = state.category !== 'stagger'; $('remove-keyloop').hidden = state.category !== 'keyloop'; $('user-library-actions').hidden = state.category !== 'user'; $('expression-library-actions').hidden = true;
        $('presets').innerHTML = cards.map(cardHTML).join(''); $('empty').hidden = presets.length > 0;
        $('empty').innerHTML = state.category === 'user' && !presets.length ? '团队目录还没有预设<span>选择一个带动画的图层，点击“保存当前动画”</span>' : '没有找到匹配的预设<span>请换一个关键词</span>';
        $('presets').querySelectorAll('.preset-card[data-id]').forEach(function (button) { button.addEventListener('click', function () { applyPreset(button.dataset.id); }); });
        $('presets').querySelectorAll('[data-clear]').forEach(function (button) { button.addEventListener('click', function () { clearCategory(button.dataset.clear); }); });
        $('presets').querySelectorAll('[data-export]').forEach(function (button) { button.addEventListener('click', function () { exportUserPreset(button.dataset.export); }); });
        $('presets').querySelectorAll('[data-delete]').forEach(function (button) { button.addEventListener('click', function () { deleteUserPreset(button.dataset.delete); }); });
        MGPreview.mount($('presets')); MGPreview.autoplay(state.autoplay);
    }

    function readInteger(id, min, max, title) {
        var input = $(id), text = String(input.value).replace(/\s/g, ''), value = Number(text), invalid = !text || !isFinite(value) || Math.floor(value) !== value || value < min || value > max;
        input.setAttribute('aria-invalid', String(invalid)); if (invalid) { throw new Error(title + '须为 ' + min + '–' + max + ' 的整数。'); } return value;
    }

    function markSelected(id) {
        state.selected = id;
        document.querySelectorAll('.preset-card').forEach(function (card) { var selected = card.dataset.id === id; card.classList.toggle('selected', selected); card.setAttribute('aria-pressed', String(selected)); });
        var preset = MGCatalog.find(id); if (preset) { MGPreview.select(preset, MGCatalog.defaults(id)); }
    }

    async function execute(action, data) {
        if (state.busy || (window.MGAI && window.MGAI.isBusy())) { toast('AI 正在操作 AE，请等待完成或停止后再执行其他修改。', true); return null; }
        state.busy = true; document.body.setAttribute('aria-busy', 'true');
        document.querySelectorAll('button').forEach(function (button) { if (!button.classList.contains('mode-tab')) { button.disabled = true; } });
        try {
            var result = await MGBridge.call(action, data || {}), detail = result.message || '';
            if (result.preview) { setStatus('界面预览模式 · 未修改 AE 图层', false); toast(result.message, false); return result; }
            var skipped = result.skipped || (result.data && result.data.skipped) || [];
            if (skipped.length) { detail += '\n' + skipped[0]; }
            setStatus(result.message || (result.ok ? '操作完成。' : '没有修改任何图层。'), !result.ok); toast(detail, !result.ok); return result;
        } finally {
            state.busy = false; document.body.removeAttribute('aria-busy'); document.querySelectorAll('button').forEach(function (button) { button.disabled = false; });
        }
    }

    async function applyPreset(id) {
        if (state.busy) { return; }
        var preset = MGCatalog.find(id), data = { id: id, markerTiming: true, reuseExisting: true };
        if (!preset) { return; }
        try {
            if (preset.category === 'composition') {
                var actionMap={'composition-extract':'compositionExtract','composition-detach':'compositionDetach','composition-markers':'compositionMarkers'};
                markSelected(id);await execute(actionMap[id],{keepBackup:$('extract-keep-backup').checked});return;
            }
            if (preset.type === 'ui') {
                data.durationMode=$('motion-duration-mode').value;
                if(data.durationMode==='custom') { var seconds=Number($('motion-duration-seconds').value);if(!isFinite(seconds)||seconds<=0||seconds>3600)throw new Error('时长需要大于 0 且不超过 3600 秒。');data.durationSeconds=seconds; }
            }
            if (preset.category === 'stagger') { data.params = { frames: readInteger('frames', 0, 1000, '间隔帧数') }; if (id === 'stagger-random') { data.params.seed = readInteger('seed', 1, 99999, '随机种子'); } }
            markSelected(id); var result = await execute('apply', data); if (result && result.ok && preset.type === 'ui') { await refreshApplied(); }
        } catch (error) { setStatus(error.message, true); toast(error.message, true); }
    }

    async function clearCategory(category) {
        if (!CLEARABLE[category] || state.busy) { return; }
        state.selected = ''; var result = await execute('remove', { category: category, allowEmpty: true });
        if (result && result.ok) { renderCards(); await refreshApplied(); }
    }

    // MGBridge.call('listUserPresets') reads the selected persistent folder.
    async function loadUserPresets(showErrors) {
        if (!MGBridge.connected) { MGCatalog.registerUser([]); return; }
        var result = await MGBridge.call('listUserPresets', folderData('user'));
        if (result.ok && result.data) {
            MGCatalog.registerUser(result.data.presets || []); state.userFolder = result.data.folder || ''; showFolder('user', state.userFolder);
            state.userLoaded = true;
            if (result.data.skipped && result.data.skipped.length && showErrors) { toast('有损坏的团队预设未载入。\n' + result.data.skipped[0], true); }
        } else if (showErrors) { setStatus(result.message || '无法读取团队预设。', true); toast(result.message || '无法读取团队预设。', true); }
    }

    async function loadExpressions(showErrors) {
        var result = await MGBridge.call('listExpressions', folderData('expressions'));
        if (result.ok && result.data) {
            state.expressions = result.data.expressions || []; state.expressionFolder = result.data.folder || ''; showFolder('expressions', state.expressionFolder);
            state.expressionsLoaded = true;
            if (showErrors && result.data.skipped && result.data.skipped.length) { toast('有损坏的表达式文件未载入。\n' + result.data.skipped[0], true); }
        } else if (showErrors) { setStatus(result.message || '无法读取表达式库。', true); toast(result.message || '无法读取表达式库。', true); }
    }

    function expressionById(id) {
        for (var i = 0; i < state.expressions.length; i++) { if (state.expressions[i].id === id) { return state.expressions[i]; } }
        return null;
    }

    function expressionCardHTML(item) {
        return '<div class="preset-card-shell"><button class="preset-card expression-card" data-expression="' + escapeHTML(item.id) + '" title="查看：' + escapeHTML(item.name) + '"><span class="card-number">EXPR</span><span class="expression-visual">' + MGIcons.svg('code') + '</span><span class="card-label"><span>' + escapeHTML(item.name) + '</span>' + MGIcons.svg('eye') + '</span></button><div class="card-actions"><button class="card-action" data-edit-expression="' + escapeHTML(item.id) + '" title="修改表达式">' + MGIcons.svg('edit') + '</button><button class="card-action danger" data-delete-expression="' + escapeHTML(item.id) + '" title="删除表达式">' + MGIcons.svg('trash') + '</button></div></div>';
    }

    function renderExpressionCards() {
        var query = $('search').value.trim().toLowerCase();
        var list = state.expressions.filter(function (item) { return !query || (item.name + ' ' + item.usage + ' ' + item.expression).toLowerCase().indexOf(query) !== -1; });
        $('category-en').textContent = 'EXPRESSIONS'; $('category-name').firstChild.textContent = '表达式 ';
        $('preset-count').textContent = String(list.length).padStart(2, '0'); $('category-hint').textContent = '整理团队常用表达式，查看说明并一键复制。';
        $('extract-backup-option').hidden = state.category !== 'composition';
        $('stagger-options').hidden = true; $('remove-keyloop').hidden = true; $('user-library-actions').hidden = true; $('expression-library-actions').hidden = false;
        var addCard = '<button class="preset-card expression-card" data-add-expression title="新增团队表达式"><span class="card-number">NEW</span><span class="expression-visual">' + MGIcons.svg('plus') + '</span><span class="card-label"><span>新增表达式</span>' + MGIcons.svg('plus') + '</span></button>';
        $('presets').innerHTML = addCard + list.map(expressionCardHTML).join(''); $('presets').hidden = false;
        $('empty').hidden = list.length > 0 || !query; $('empty').innerHTML = '没有找到匹配的表达式<span>请换一个关键词</span>';
        $('presets').querySelector('[data-add-expression]').addEventListener('click', function () { openExpressionEdit(null); });
        $('presets').querySelectorAll('[data-expression]').forEach(function (button) { button.addEventListener('click', function () { openExpressionView(button.dataset.expression); }); });
        $('presets').querySelectorAll('[data-edit-expression]').forEach(function (button) { button.addEventListener('click', function () { openExpressionEdit(expressionById(button.dataset.editExpression)); }); });
        $('presets').querySelectorAll('[data-delete-expression]').forEach(function (button) { button.addEventListener('click', function () { removeExpression(button.dataset.deleteExpression); }); });
        MGPreview.mount($('presets'));
    }

    function openExpressionEdit(item) {
        item = item || null; $('expression-id').value = item ? item.id : ''; $('expression-name').value = item ? item.name : '';
        $('expression-usage').value = item ? item.usage : ''; $('expression-code').value = item ? item.expression : '';
        $('expression-edit-title').textContent = item ? '修改表达式' : '新增表达式'; $('expression-edit-modal').hidden = false; $('expression-name').focus();
    }
    function closeExpressionEdit() { $('expression-edit-modal').hidden = true; }
    function openExpressionView(id) {
        var item = expressionById(id); if (!item) { return; } state.currentExpression = item;
        $('expression-view-title').textContent = item.name; $('expression-view-usage').textContent = item.usage; $('expression-view-code').textContent = item.expression;
        $('expression-view-modal').hidden = false; $('copy-expression').focus();
    }
    function closeExpressionView() { $('expression-view-modal').hidden = true; }
    async function saveExpression(event) {
        event.preventDefault(); var name = $('expression-name').value.trim(), usage = $('expression-usage').value.trim(), expression = $('expression-code').value.trim();
        if (!name || !usage || !expression) { toast('请完整填写名称、使用方法和表达式。', true); return; }
        var result = await execute('saveExpression', folderData('expressions', { id: $('expression-id').value, name: name, usage: usage, expression: expression }));
        if (result && result.ok) { closeExpressionEdit(); await loadExpressions(true); renderCategories(); renderExpressionCards(); }
    }
    async function removeExpression(id) {
        var item = expressionById(id); if (!item || !window.confirm('确定删除表达式“' + item.name + '”吗？')) { return; }
        var result = await execute('deleteExpression', folderData('expressions', { id: id }));
        if (result && result.ok) { closeExpressionView(); state.currentExpression = null; await loadExpressions(true); renderCategories(); renderExpressionCards(); }
    }
    function copyCurrentExpression() {
        if (!state.currentExpression) { return; }
        var textarea = document.createElement('textarea'); textarea.value = state.currentExpression.expression; textarea.setAttribute('readonly', ''); textarea.style.position = 'fixed'; textarea.style.opacity = '0';
        document.body.appendChild(textarea); textarea.select(); var copied = false; try { copied = document.execCommand('copy'); } catch (ignored) {} document.body.removeChild(textarea);
        toast(copied ? '表达式已复制到剪贴板。' : '复制失败，请在代码框中手动复制。', !copied);
    }

    function prerenderData(extra) {
        var data = {
            scope: Number($('prerender-scope').value || 0),
            range: Number($('prerender-range').value || 0),
            resultMode: Number($('prerender-result').value || 0),
            templateName: $('prerender-template').value || '',
            outputFolder: $('prerender-folder').value.trim()
        };
        if (extra) { Object.keys(extra).forEach(function (key) { data[key] = extra[key]; }); }
        return data;
    }

    function renderPrerender() {
        var data = state.prerender || {}, modeNames = { none: '尚未缓存', regular: '常规模式', modify: '修改模式' };
        $('prerender-count').textContent = String(Number(data.groupCount || 0)).padStart(2, '0');
        $('prerender-comp').textContent = data.comp || '请打开一个合成';
        $('prerender-mode').textContent = modeNames[data.mode] || modeNames.none;
        $('prerender-mode').classList.toggle('modify', data.mode === 'modify');
        $('prerender-groups').textContent = Number(data.groupCount || 0) + ' 个时间块';
        var hasComp = !!data.comp, hasGroups = Number(data.groupCount || 0) > 0;
        $('prerender-start').disabled = !hasComp || !!data.rendering || !$('prerender-template').value;
        ['prerender-regular', 'prerender-modify', 'prerender-update', 'prerender-return', 'prerender-select-related', 'prerender-select-source'].forEach(function (id) { $(id).disabled = !hasGroups; });
        $('prerender-open-source').disabled = !hasComp; $('prerender-open-preview').disabled = !data.hasPreview;
    }

    function normalizePrerenderTemplates(items) {
        var result = [], seen = {};
        (items || []).forEach(function (item) {
            var name = String(item || '');
            if (name.trim() && !seen[name]) { seen[name] = true; result.push(name); }
        });
        return result;
    }

    function rememberPrerenderTemplates(items) {
        state.prerenderTemplates = normalizePrerenderTemplates(items);
        try { localStorage.setItem(PRERENDER_TEMPLATE_CACHE, JSON.stringify(state.prerenderTemplates)); } catch (ignored) {}
    }

    function restorePrerenderTemplates() {
        try { state.prerenderTemplates = normalizePrerenderTemplates(JSON.parse(localStorage.getItem(PRERENDER_TEMPLATE_CACHE) || '[]')); }
        catch (ignored) { state.prerenderTemplates = []; }
        renderPrerenderTemplateSelect('');
    }

    function renderPrerenderTemplateSelect(preferred) {
        var select = $('prerender-template'), templates = state.prerenderTemplates;
        preferred = preferred || select.value;
        if (!templates.length) {
            select.innerHTML = '<option value="">请点击右侧“读取 / 刷新”</option>';
            select.value = '';
            return;
        }
        select.innerHTML = templates.map(function (name) { return '<option value="' + escapeHTML(name) + '">' + escapeHTML(name) + '</option>'; }).join('');
        if (preferred && templates.indexOf(preferred) !== -1) { select.value = preferred; }
    }

    async function loadPrerenderStatus(showErrors) {
        var result = await MGBridge.call('prerenderStatus');
        if (result.ok && result.data) {
            var previous = $('prerender-template').value, templates = normalizePrerenderTemplates(result.data.templates || []);
            state.prerender = result.data;
            if (templates.length) { rememberPrerenderTemplates(templates); }
            renderPrerenderTemplateSelect(previous);
            if (!$('prerender-folder').value.trim()) { $('prerender-folder').value = result.data.outputFolder || ''; }
            renderPrerender();
        } else if (showErrors) { setStatus(result.message || '无法读取预渲染状态。', true); toast(result.message || '无法读取预渲染状态。', true); }
        return result;
    }

    async function loadPrerenderTemplates(showErrors) {
        var previous = $('prerender-template').value, result = await execute('prerenderTemplates', {});
        if (result && result.ok && result.data) {
            var templates = normalizePrerenderTemplates(result.data.templates || []);
            if (templates.length) {
                rememberPrerenderTemplates(templates); renderPrerenderTemplateSelect(previous); state.prerender = result.data; renderPrerender();
            } else if (showErrors) { toast('当前 AE 没有可用的输出模块模板。', true); }
        }
        return result;
    }

    async function runPrerenderAction(action, extra, reload) {
        var result = await execute(action, prerenderData(extra));
        if (result && result.ok && reload !== false) { await loadPrerenderStatus(false); }
        return result;
    }

    async function startPrerender() {
        if (!$('prerender-template').value) { toast('请先点击“读取 / 刷新”获取 AE 输出模块模板。', true); return; }
        var check = await runPrerenderAction('prerenderPreflight', null, false);
        if (!check || !check.ok) { return; }
        var warnings = check.data && check.data.warnings || [];
        if (warnings.length && !window.confirm('预渲染前请确认：\n\n• ' + warnings.join('\n• ') + '\n\n继续预渲染？')) { return; }
        await runPrerenderAction('prerenderRender', { confirmed: true });
    }

    async function choosePrerenderFolder() {
        var result = await runPrerenderAction('prerenderChooseFolder', null, false);
        if (result && result.ok && result.data && !result.data.cancelled) { $('prerender-folder').value = result.data.folder || ''; }
    }

    function fileURL(path) {
        var normalized = String(path || '').replace(/\\/g, '/');
        if (!normalized) { return ''; }
        return 'file:///' + normalized.split('/').map(function (part, index) {
            return index === 0 && /^[A-Za-z]:$/.test(part) ? part : encodeURIComponent(part);
        }).join('/');
    }

    function formatDuration(seconds) {
        var value = Number(seconds || 0);
        if (!isFinite(value) || value <= 0) { return '—'; }
        return value < 10 ? value.toFixed(1) + 's' : Math.round(value) + 's';
    }

    function renderTemplateCategories() {
        var items = [{ name: 'all', label: '全部模版', count: state.templates.length }].concat(state.templateCategories.map(function (item) { return { name: item.name, label: item.name, count: item.count }; }));
        $('template-categories').innerHTML = items.map(function (item) {
            var active = state.templateCategory === item.name;
            return '<button class="category-button ' + (active ? 'active' : '') + '" data-template-category="' + escapeHTML(item.name) + '" aria-current="' + (active ? 'page' : 'false') + '">' + MGIcons.svg(item.name === 'all' ? 'layers' : 'folder') + '<span>' + escapeHTML(item.label) + '</span><span class="count">' + String(item.count).padStart(2, '0') + '</span></button>';
        }).join('');
        $('template-categories').querySelectorAll('[data-template-category]').forEach(function (button) { button.addEventListener('click', function () { state.templateCategory = button.dataset.templateCategory; renderTemplateCategories(); renderTemplates(); }); });
    }

    function populateTemplateCategorySelect() {
        var names = [], seen = {}, i, name;
        for (i = 0; i < state.templateCategories.length; i++) { name = state.templateCategories[i].name; if (!seen[name]) { seen[name] = true; names.push(name); } }
        if (!seen['未分类']) { names.push('未分类'); }
        $('template-save-category').innerHTML = '<option value="__new__">＋ 新建分类</option>' + names.map(function (item) { return '<option value="' + escapeHTML(item) + '">' + escapeHTML(item) + '</option>'; }).join('');
        if (state.templateCategory !== 'all' && seen[state.templateCategory]) { $('template-save-category').value = state.templateCategory; }
        else if (names.length) { $('template-save-category').value = names[0]; }
        else { $('template-save-category').value = '__new__'; }
        toggleNewTemplateCategory();
    }

    function toggleNewTemplateCategory() { $('template-new-category-field').hidden = $('template-save-category').value !== '__new__'; }

    function renderTemplates() {
        var query = $('template-search').value.trim().toLowerCase();
        var templates = state.templates.filter(function (item) {
            if (state.templateCategory !== 'all' && item.category !== state.templateCategory) { return false; }
            return !query || (item.name + ' ' + item.category + ' ' + item.description + ' ' + item.mainCompName).toLowerCase().indexOf(query) !== -1;
        });
        $('template-count').textContent = String(templates.length).padStart(2, '0');
        $('templates').innerHTML = templates.map(function (item) {
            var preview = item.preview ? '<img src="' + escapeHTML(fileURL(item.preview)) + '" alt="" loading="lazy">' : '';
            var warnings = item.warnings && item.warnings.length ? '<span class="warning" title="' + escapeHTML(item.warnings[0]) + '">⚠ ' + item.warnings.length + '</span>' : '';
            return '<button class="template-card" data-template-id="' + escapeHTML(item.id) + '" title="' + escapeHTML(item.description || ('导入：' + item.name)) + '"><span class="template-preview">' + preview + '<span class="template-preview-fallback"' + (preview ? ' hidden' : '') + '>' + MGIcons.svg('folder') + '</span></span><span class="template-card-name"><span>' + escapeHTML(item.name) + '</span>' + MGIcons.svg('plus') + '</span><span class="template-meta"><span title="分类">' + escapeHTML(item.category || '未分类') + '</span><span>' + Number(item.width || 0) + '×' + Number(item.height || 0) + '</span><span>' + formatDuration(item.duration) + '</span>' + warnings + '</span></button>';
        }).join('');
        $('template-empty').hidden = templates.length > 0;
        if (!templates.length && query) { $('template-empty').innerHTML = '没有找到匹配的合成模版<span>请换一个关键词</span>'; }
        else { $('template-empty').innerHTML = '团队目录还没有合成模版<span>打开一个已保存的工程和合成，然后点击“保存当前合成”</span>'; }
        $('templates').querySelectorAll('[data-template-id]').forEach(function (button) {
            button.addEventListener('click', function () { importTemplate(button.dataset.templateId); });
        });
        $('templates').querySelectorAll('.template-preview img').forEach(function (preview) {
            preview.addEventListener('error', function () { preview.hidden = true; preview.nextElementSibling.hidden = false; });
        });
    }

    // MGBridge.call('listTemplates') reads the selected persistent folder.
    async function loadTemplates(showErrors) {
        var result = await MGBridge.call('listTemplates', folderData('templates'));
        if (result.ok && result.data) {
            state.templates = result.data.templates || []; state.templateCategories = result.data.categories || []; state.templateFolder = result.data.folder || ''; showFolder('templates', state.templateFolder);
            state.templatesLoaded = true;
            if (state.templateCategory !== 'all' && !state.templateCategories.some(function (item) { return item.name === state.templateCategory; })) { state.templateCategory = 'all'; }
            if (result.data.skipped && result.data.skipped.length && showErrors) { toast('有不完整的合成模版未载入。\n' + result.data.skipped[0], true); }
            renderTemplateCategories(); renderTemplates();
        } else if (showErrors) {
            setStatus(result.message || '无法读取团队合成模版。', true); toast(result.message || '无法读取团队合成模版。', true);
        }
    }

    function setTemplateProgress(status, error) {
        var progress = Math.max(0, Math.min(100, Number(status && status.progress || 0)));
        $('template-job').hidden = false; $('template-job').classList.toggle('error', !!error);
        $('template-job-title').textContent = error ? '合成模版保存失败' : (progress >= 100 ? '合成模版已保存' : '正在保存合成模版');
        $('template-job-message').textContent = status && status.message ? status.message : '正在准备…';
        $('template-progress-bar').style.width = progress + '%';
        $('show-template-worker').hidden = !(state.templateJob && state.templateJob.workerPid);
        $('cancel-template-job').hidden = !state.templateJob;
    }

    async function terminateTemplateSave(){
        var job=state.templateJob;if(!job||state.templateTerminating)return;state.templateTerminating=true;
        clearTemplatePolling();
        $('cancel-template-job').hidden=true;$('show-template-worker').hidden=true;
        setTemplateProgress({progress:0,message:'正在终止后台任务…'},false);$('template-job-title').textContent='正在终止';
        try{
            var extension=decodeURI(window.__adobe_cep__.getSystemPath('extension')).replace(/^file:\/\//,'').replace(/^\/([A-Za-z]:\/)/,'$1');
            var control=nodeRequire(extension+'/node/template-control.cjs');
            var result=await control.terminate(job);
            state.templateJob=null;rememberTemplateJob(null);
            setTemplateProgress({progress:0,message:result.stopped.length?'后台保存进程已终止，可重新保存。':'任务记录已清除；没有找到命令行匹配的后台进程。旧版后台进程如仍运行，请手动检查。'},false);
            $('template-job-title').textContent='模版保存已终止';setStatus('模版任务已终止，可重新保存。',false);
        }catch(e){setTemplateProgress({progress:0,message:e.message+' 可点击终止重试。'},true);$('template-job-title').textContent='终止未完成';}finally{state.templateTerminating=false;}
    }

    function clearTemplatePolling() {
        if (state.templateTimer) { clearTimeout(state.templateTimer); state.templateTimer = null; }
    }

    function rememberTemplateJob(job) {
        try { if (job) { localStorage.setItem('mg-template-job-v1', JSON.stringify(job)); } else { localStorage.removeItem('mg-template-job-v1'); } } catch (ignored) { /* Polling still works while the panel stays open. */ }
    }

    async function pollTemplateJob(id, startedAt) {
        if (!state.templateJob || state.templateJob.id !== id) { return; }
        var jobRoot = state.templateJob.root || '';
        var result = await MGBridge.call('templateJobStatus', folderData('templates', { id: id, folder: jobRoot })), status = result.data || { state: 'queued', progress: 2, message: result.message };
        if (!state.templateJob || state.templateJob.id !== id) { return; }
        setTemplateProgress(status, status.state === 'error');
        if (status.state === 'done') {
            var finishedJob = state.templateJob;
            clearTemplatePolling(); state.templateJob = null; rememberTemplateJob(null); $('cancel-template-job').hidden=true; setStatus(status.message || '合成模版已保存。', false); toast(status.message || '合成模版已保存。', false);
            $('show-template-worker').hidden = true;
            setTimeout(function () { stopTemplateWindowMonitor(finishedJob, true); }, 12000);
            await MGBridge.call('ackTemplateJob', folderData('templates', { id: id, folder: finishedJob && finishedJob.root })); await loadTemplates(true); return;
        }
        if (status.state === 'error') {
            showTemplateWorker(true);
            clearTemplatePolling(); state.templateJob = null; rememberTemplateJob(null); $('cancel-template-job').hidden=true; setStatus(status.message || '合成模版保存失败。', true); toast(status.message || '合成模版保存失败。', true);
            await MGBridge.call('ackTemplateJob', folderData('templates', { id: id, folder: finishedJob && finishedJob.root })); return;
        }
        if (Date.now() - startedAt > 30 * 60 * 1000) {
            showTemplateWorker(true);
            clearTemplatePolling(); setTemplateProgress({ progress: status.progress, message: '后台处理超时，可点击终止保存。请检查后台 AE 或共享盘状态；未完成的模版不会显示在列表中。' }, true); return;
        }
        var elapsed = Date.now() - startedAt, delay = elapsed < 20000 ? 900 : (elapsed < 120000 ? 1500 : 2500);
        state.templateTimer = setTimeout(function () { pollTemplateJob(id, startedAt); }, delay);
    }

    function nodeRequire(name) {
        var node = window.cep_node && window.cep_node.require ? window.cep_node : null;
        return node ? node.require(name) : (typeof require === 'function' ? require(name) : null);
    }

    function snapshotAfterEffectsPids(childProcess) {
        try {
            var output = childProcess.execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', '(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like "AfterFX*" } | ForEach-Object { $_.Id }) -join ","'], { windowsHide: true, encoding: 'utf8' });
            return String(output || '').split(',').map(function (value) { return Number(value); }).filter(function (value) { return isFinite(value) && value > 0; });
        } catch (ignored) { return null; }
    }

    function startTemplateWindowMonitor(workerPid, childProcess, beforePids, pidFile, readyFile, expectedPidFile, monitorScript) {
        try {
            if (!monitorScript) { return 0; }
            var monitor = childProcess.spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', monitorScript, '-Mode', 'Monitor', '-LauncherPid', String(workerPid), '-BeforePids', beforePids ? beforePids.join(',') : '', '-PidFile', pidFile, '-ReadyFile', readyFile, '-ExpectedPidFile', expectedPidFile], { windowsHide: true, stdio: 'ignore' });
            monitor.unref(); return monitor.pid;
        } catch (ignored) { return 0; }
    }

    function stopTemplateWindowMonitor(job, reveal) {
        if (!job) { return; }
        try {
            var processModule = window.cep_node && window.cep_node.process ? window.cep_node.process : nodeRequire('process'), childProcess = nodeRequire('child_process'), fs = nodeRequire('fs');
            if (job.monitorPid && processModule) { try { processModule.kill(job.monitorPid); } catch (ignored) {} job.monitorPid = 0; }
            if (reveal && childProcess && job.windowMonitor) {
                var process = childProcess.spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', job.windowMonitor, '-Mode', 'Show', '-LauncherPid', String(job.workerPid || 0), '-PidFile', job.windowPidFile, '-ReadyFile', job.windowReadyFile || '', '-ExpectedPidFile', job.windowExpectedPidFile || ''], { windowsHide: true, stdio: 'ignore' }); process.unref();
            } else {
                try { if (fs && job.windowPidFile && fs.existsSync(job.windowPidFile)) { fs.unlinkSync(job.windowPidFile); } } catch (ignoredFile) {}
                try { if (fs && job.windowReadyFile && fs.existsSync(job.windowReadyFile)) { fs.unlinkSync(job.windowReadyFile); } } catch (ignoredReady) {}
                try { if (fs && job.windowExpectedPidFile && fs.existsSync(job.windowExpectedPidFile)) { fs.unlinkSync(job.windowExpectedPidFile); } } catch (ignoredExpected) {}
            }
        } catch (ignoredOuter) {}
    }

    function showTemplateWorker(silent) {
        var job = state.templateJob; if (!job || !job.workerPid) { if (!silent) { toast('当前没有可显示的后台 AE。', true); } return; }
        try {
            stopTemplateWindowMonitor(job, true); rememberTemplateJob(job);
            if (!silent) { toast('已显示后台 AE；模板任务会继续运行。', false); }
        } catch (error) { if (!silent) { toast('无法显示后台 AE：' + error.message, true); } }
    }

    function waitForWindowMonitorReady(fs, readyFile, monitorPid) {
        return new Promise(function (resolve) {
            if (!fs || !monitorPid) { resolve(); return; }
            var deadline = Date.now() + 1200;
            function finish() {
                try { if (fs.existsSync(readyFile)) { fs.unlinkSync(readyFile); } } catch (ignoredRemove) {}
                resolve();
            }
            function check() {
                try {
                    if (fs.existsSync(readyFile) || Date.now() >= deadline) { finish(); return; }
                } catch (ignoredCheck) { finish(); return; }
                setTimeout(check, 25);
            }
            check();
        });
    }

    async function launchTemplateWorker(job) {
        var windowJob = null;
        try {
            var childProcess = nodeRequire('child_process'), fs = nodeRequire('fs');
            if (!childProcess) { throw new Error('CEP 未启用后台进程能力。'); }
            var beforePids = snapshotAfterEffectsPids(childProcess), startedAt = Date.now(), pidFile = String(job.staging).replace(/[\\\/]$/, '') + '.window-pids', readyFile = pidFile + '.ready', expectedPidFile = pidFile + '.expected';
            var monitorPid = startTemplateWindowMonitor(0, childProcess, beforePids, pidFile, readyFile, expectedPidFile, job.windowMonitor);
            windowJob = { staging: job.staging, launchFile: job.launchFile, id: job.id, startedAt: startedAt, workerPid: 0, windowPidFile: pidFile, windowReadyFile: readyFile, windowExpectedPidFile: expectedPidFile, windowMonitor: job.windowMonitor || '', monitorPid: monitorPid };
            await waitForWindowMonitorReady(fs, readyFile, monitorPid);
            var child = childProcess.spawn(job.command, ['-noui', '-m', '-r', job.launchFile], { windowsHide: true, detached: true, stdio: 'ignore' });
            child.on('error', function (error) {
                var failedJob = state.templateJob || windowJob; clearTemplatePolling(); state.templateJob = null; rememberTemplateJob(null); stopTemplateWindowMonitor(failedJob, false); MGBridge.call('cancelTemplateJob', folderData('templates', { id: job.id, staging: job.staging, folder: job.root })); setTemplateProgress({ progress: 100, message: '无法启动 AE 后台工作进程：' + error.message }, true); toast('无法启动 AE 后台工作进程：' + error.message, true);
            });
            windowJob.workerPid = child.pid; windowJob.root = job.root || storedFolder('templates'); try { if (fs && monitorPid) { fs.writeFileSync(expectedPidFile, String(child.pid), 'ascii'); } } catch (ignoredExpectedPid) {}
            child.unref(); state.templateJob = windowJob; rememberTemplateJob(state.templateJob); setTemplateProgress({ progress: 4, message: '正在后台启动独立 AE 工作进程…' }, false); pollTemplateJob(job.id, startedAt);
        } catch (error) {
            stopTemplateWindowMonitor(windowJob, false); rememberTemplateJob(null); MGBridge.call('cancelTemplateJob', folderData('templates', { id: job.id, staging: job.staging, folder: job.root })); setTemplateProgress({ progress: 100, message: error.message }, true); setStatus(error.message, true); toast(error.message, true);
        }
    }

    async function importTemplate(id) {
        var result = await execute('importTemplate', { id: id });
        if (result && result.ok) { await refreshHost(); }
    }

    async function deleteUserPreset(id) {
        var preset = MGCatalog.find(id);
        if (!preset || !window.confirm('确定从预设库删除“' + preset.name + '”吗？\n\n已经应用到图层的实例不会消失。')) { return; }
        var result = await execute('deleteUserPreset', folderData('user', { id: id }));
        if (result && result.ok) { await loadUserPresets(true); state.selected = ''; renderCategories(); renderCards(); }
    }
    async function exportUserPreset(id) { await execute('exportUserPreset', folderData('user', { id: id })); }

    function openSave() {
        if (state.busy) { return; }
        $('save-category').value = /^(in|loop|out|feedback)$/.test(state.category) ? state.category : 'in'; $('save-modal').hidden = false; $('save-name').focus();
    }
    function closeSave() { $('save-modal').hidden = true; $('save-current').focus(); }
    async function saveCurrent(event) {
        event.preventDefault(); var name = $('save-name').value.trim();
        if (!name) { toast('请输入预设名称。', true); $('save-name').focus(); return; }
        var result = await execute('captureUserPreset', folderData('user', { name: name, category: $('save-category').value, description: $('save-description').value.trim() }));
        if (result && result.ok && !result.preview) {
            closeSave(); $('save-form').reset(); await loadUserPresets(true);
            state.panel = 'ui'; state.category = 'user'; lastCategory.ui = 'user'; state.selected = result.data && result.data.preset ? result.data.preset.id : '';
            document.querySelectorAll('.mode-tab').forEach(function (tab) { var active = tab.dataset.panel === 'ui'; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); });
            renderCategories(); renderCards();
        }
    }

    function openTemplateSave() {
        if (state.templateTerminating) {toast('正在终止后台保存，请稍候。',false);return;}
        if (state.busy || state.templateJob) { if (state.templateJob) { toast('已有合成模版正在保存，请等待完成。', true); } return; }
        populateTemplateCategorySelect(); $('template-new-category').value = ''; $('template-save-name').value = state.activeComp || ''; $('template-save-modal').hidden = false; $('template-save-name').focus(); $('template-save-name').select();
    }
    function closeTemplateSave() { $('template-save-modal').hidden = true; $('template-save-current').focus(); }
    async function saveTemplate(event) {
        event.preventDefault(); var name = $('template-save-name').value.trim();
        if (!name) { toast('请输入模版名称。', true); $('template-save-name').focus(); return; }
        var category = $('template-save-category').value === '__new__' ? $('template-new-category').value.trim() : $('template-save-category').value;
        if (!category) { toast('请输入新分类名称。', true); $('template-new-category').focus(); return; }
        var result = await execute('beginTemplateSave', folderData('templates', { name: name, category: category, description: $('template-save-description').value.trim() }));
        if (result && result.ok && !result.preview && result.data) {
            closeTemplateSave(); $('template-save-form').reset(); changePanel('templates'); await launchTemplateWorker(result.data);
        }
    }

    function changePanel(panel) {
        if (!/^(ui|tools|prerender|templates|assets|ai)$/.test(panel)) { return; }
        if (window.MGAssets && panel !== 'assets') { window.MGAssets.leave(); }
        $('asset-workspace').hidden = panel !== 'assets';
        state.panel = panel; state.selected = '';
        $('motion-duration').hidden=panel!=='ui';
        if (panel === 'ui' || panel === 'tools') { state.category = lastCategory[panel]; $('search').value = ''; }
        document.querySelectorAll('.mode-tab').forEach(function (tab) { var active = tab.dataset.panel === panel; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); });
        $('preset-workspace').hidden = panel !== 'ui' && panel !== 'tools'; $('template-workspace').hidden = panel !== 'templates'; $('prerender-workspace').hidden = panel !== 'prerender'; $('ai-workspace').hidden = panel !== 'ai';
        $('save-current-label').textContent = '保存当前动画';
        $('save-current').hidden = panel !== 'ui';
        $('autoplay').hidden = panel !== 'ui';
        $('workflow-note-text').textContent = panel === 'templates' ? '合成模版保存到团队共享目录；单击卡片即可导入并放到当前时间头。' : (panel === 'prerender' ? '预渲染使用 AE 渲染队列；常规模式查看缓存，修改模式返回源图层。' : (panel === 'tools' ? '效率工具会直接作用于选中图层；具体的选择和操作要求见当前分类说明。' : '拖动范围标记改起止，拉伸改时长；每个 UI 分类第一张卡片可清除本类动效。'));
        $('applied-bar').hidden = panel !== 'ui' || !$('applied-chips').children.length;
        if (panel === 'assets') {
            document.querySelector('.app').dataset.panel = panel; $('workflow-note-text').textContent = '完整显示素材 · 悬停播放预览 · 添加到合成时间头';
            if (window.MGAssets) { window.MGAssets.enter(); }
        } else if (panel === 'ai') {
            document.querySelector('.app').dataset.panel = panel; $('workflow-note-text').textContent = 'AI 可独立操作 AE，也可调用插件；自由 JSX 可选择逐次确认或无需确认，普通编辑可在 AE 撤销。';
        } else if (panel === 'templates') {
            document.querySelector('.app').dataset.panel = panel; renderTemplateCategories(); renderTemplates();
            if (!state.templatesLoaded) { loadTemplates(false); }
        } else if (panel === 'prerender') {
            document.querySelector('.app').dataset.panel = panel; renderPrerender(); loadPrerenderStatus(false);
        } else {
            renderCategories(); renderCards();
            if (state.category === 'user' && !state.userLoaded) { loadUserPresets(false).then(function () { renderCategories(); renderCards(); }); }
            else if (state.category === 'expressions' && !state.expressionsLoaded) { loadExpressions(false).then(function () { renderCategories(); renderCards(); }); }
        }
    }

    async function refreshHost() {
        if (!MGBridge.connected) { $('host-badge').textContent = '界面预览模式'; setStatus('未连接 AE · 可预览动态图标', false); $('connection-dot').style.background = '#b7a0ff'; return; }
        var result = await MGBridge.call('status');
        if (result.ok) { state.activeComp = result.data.comp || ''; $('host-badge').textContent = 'AE ' + result.data.version; setStatus(result.data.comp ? result.data.comp + ' · 已选 ' + result.data.count + ' 个图层' : '请打开合成并选中图层', false); }
        else { $('host-badge').textContent = 'AE 连接异常'; setStatus(result.message, true); }
    }

    async function refreshOnFocus() {
        var now = Date.now();
        if (!MGBridge.connected) { await refreshHost(); return; }
        if (state.panel === 'ai' || state.panel === 'assets' || (window.MGAI && window.MGAI.isBusy())) { return; }
        if (document.hidden || state.busy || state.checking || MGBridge.busy() || now - state.lastCheck < 1500) { return; }
        state.checking = true; state.lastCheck = now;
        try {
            var cleanup = state.panel === 'templates' || state.panel === 'prerender' ? { ok: true, message: '' } : await MGBridge.call('syncDeletedMarkers', { force: true });
            if (state.panel === 'templates') { await loadTemplates(false); }
            else if (state.panel === 'prerender') { await loadPrerenderStatus(false); }
            else if (state.category === 'user') { await loadUserPresets(false); renderCategories(); renderCards(); }
            else if (state.category === 'expressions') { await loadExpressions(false); renderCategories(); renderCards(); }
            await refreshHost();
            if (state.panel === 'ui') { await refreshApplied(); }
            if (cleanup.message) { setStatus(cleanup.message, !cleanup.ok); toast(cleanup.message, !cleanup.ok); }
        } finally { state.checking = false; }
    }

    document.querySelectorAll('.mode-tab').forEach(function (tab) { tab.addEventListener('click', function () { if (!state.busy) { changePanel(tab.dataset.panel); } }); });
    $('motion-duration-mode').addEventListener('change',function(){var custom=this.value==='custom';$('motion-duration-seconds').hidden=!custom;$('motion-duration-unit').hidden=!custom;});
    $('search').addEventListener('input', renderCards); $('template-search').addEventListener('input', renderTemplates);
    $('remove-keyloop').addEventListener('click', function () { execute('remove', { category: 'keyloop' }); });
    $('choose-user-folder').addEventListener('click', function () { chooseLibraryFolder('user'); }); $('open-user-folder').addEventListener('click', function () { execute('revealUserPresetFolder', folderData('user')); });
    $('save-current').addEventListener('click', function () { if (state.panel === 'templates') { openTemplateSave(); } else { openSave(); } }); $('close-save').addEventListener('click', closeSave); $('cancel-save').addEventListener('click', closeSave); $('save-form').addEventListener('submit', saveCurrent);
    $('save-modal').addEventListener('click', function (event) { if (event.target === this) { closeSave(); } });
    $('template-save-current').addEventListener('click', openTemplateSave); $('refresh-templates').addEventListener('click', function () { loadTemplates(true); }); $('choose-template-folder').addEventListener('click', function () { chooseLibraryFolder('templates'); }); $('open-template-folder').addEventListener('click', function () { execute('revealTemplateFolder', folderData('templates')); });
    $('close-template-save').addEventListener('click', closeTemplateSave); $('cancel-template-save').addEventListener('click', closeTemplateSave); $('template-save-form').addEventListener('submit', saveTemplate);
    $('template-save-category').addEventListener('change', toggleNewTemplateCategory); $('show-template-worker').addEventListener('click', function () { showTemplateWorker(false); });
    $('template-save-modal').addEventListener('click', function (event) { if (event.target === this) { closeTemplateSave(); } });
    $('add-expression').addEventListener('click', function () { openExpressionEdit(null); }); $('choose-expression-folder').addEventListener('click', function () { chooseLibraryFolder('expressions'); }); $('open-expression-folder').addEventListener('click', function () { execute('revealExpressionFolder', folderData('expressions')); });
    $('close-expression-edit').addEventListener('click', closeExpressionEdit); $('cancel-expression-edit').addEventListener('click', closeExpressionEdit); $('expression-form').addEventListener('submit', saveExpression);
    $('expression-edit-modal').addEventListener('click', function (event) { if (event.target === this) { closeExpressionEdit(); } });
    $('close-expression-view').addEventListener('click', closeExpressionView); $('copy-expression').addEventListener('click', copyCurrentExpression);
    $('edit-expression').addEventListener('click', function () { var item = state.currentExpression; closeExpressionView(); openExpressionEdit(item); });
    $('delete-expression').addEventListener('click', function () { if (state.currentExpression) { removeExpression(state.currentExpression.id); } });
    $('expression-view-modal').addEventListener('click', function (event) { if (event.target === this) { closeExpressionView(); } });
    $('prerender-refresh').addEventListener('click', function () { loadPrerenderTemplates(true); }); $('prerender-browse').addEventListener('click', choosePrerenderFolder); $('prerender-start').addEventListener('click', startPrerender);
    $('prerender-create-range').addEventListener('click', function () { runPrerenderAction('prerenderCreateRange'); });
    $('prerender-regular').addEventListener('click', function () { runPrerenderAction('prerenderMode', { mode: 'regular' }); }); $('prerender-modify').addEventListener('click', function () { runPrerenderAction('prerenderMode', { mode: 'modify' }); });
    $('prerender-update').addEventListener('click', function () { if (window.confirm('将重新渲染选中时间块对应的源图层，并替换当前缓存。继续？')) { runPrerenderAction('prerenderUpdate', { confirmed: true }); } });
    $('prerender-return').addEventListener('click', function () { runPrerenderAction('prerenderReturnCache'); });
    $('prerender-select-related').addEventListener('click', function () { runPrerenderAction('prerenderSelect', { sourcesOnly: false }); }); $('prerender-select-source').addEventListener('click', function () { runPrerenderAction('prerenderSelect', { sourcesOnly: true }); });
    $('cancel-template-job').addEventListener('click',terminateTemplateSave);
    $('prerender-open-source').addEventListener('click', function () { runPrerenderAction('prerenderOpen', { target: 'source' }); }); $('prerender-open-preview').addEventListener('click', function () { runPrerenderAction('prerenderOpen', { target: 'preview' }); });
    $('autoplay').addEventListener('click', function () {
        state.autoplay = !state.autoplay; this.setAttribute('aria-pressed', String(state.autoplay)); this.innerHTML = MGIcons.svg(state.autoplay ? 'pause' : 'play');
        this.title = state.autoplay ? '暂停全部动态图标' : '播放全部动态图标'; this.setAttribute('aria-label', this.title); MGPreview.autoplay(state.autoplay);
    });

    function openHelp() { $('help-modal').hidden = false; $('close-help').focus(); }
    function closeHelp() { $('help-modal').hidden = true; $('help').focus(); }
    $('help').addEventListener('click', openHelp); $('close-help').addEventListener('click', closeHelp); $('close-help-bottom').addEventListener('click', closeHelp);
    $('help-modal').addEventListener('click', function (event) { if (event.target === this) { closeHelp(); } }); $('upgrade').addEventListener('click', function () { closeHelp(); execute('upgradeTiming'); });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !$('expression-view-modal').hidden) { closeExpressionView(); } else if (event.key === 'Escape' && !$('expression-edit-modal').hidden) { closeExpressionEdit(); } else if (event.key === 'Escape' && !$('template-save-modal').hidden) { closeTemplateSave(); } else if (event.key === 'Escape' && !$('save-modal').hidden) { closeSave(); } else if (event.key === 'Escape' && !$('help-modal').hidden) { closeHelp(); }
        if (event.key === '/' && state.panel !== 'prerender' && state.panel !== 'ai' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { event.preventDefault(); $(state.panel === 'templates' ? 'template-search' : 'search').focus(); }
    });
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { refreshOnFocus(); } });

    async function start() {
        restorePrerenderTemplates(); showFolder('user', storedFolder('user')); showFolder('templates', storedFolder('templates')); showFolder('expressions', storedFolder('expressions')); renderCategories(); renderCards(); await refreshOnFocus();
        if (MGBridge.connected) { try { var remembered = JSON.parse(localStorage.getItem('mg-template-job-v1') || 'null'); if (remembered && /^tpl-[a-z0-9-]{6,80}$/.test(remembered.id)) { state.templateJob = remembered; setTemplateProgress({progress:2,message:'正在恢复任务状态，可随时终止保存。'},false); pollTemplateJob(remembered.id, Number(remembered.startedAt || Date.now())); } } catch (ignored) { rememberTemplateJob(null); } }
    }
    start();
}());
