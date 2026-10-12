/* Motion Graphics / AE 2023. All project mutations live inside one undo group. */
var MGRoot = File($.fileName).parent.parent;
$.evalFile(File(MGRoot.fsName + '/vendor/json2.js'));
$.evalFile(File(MGRoot.fsName + '/host/compatibility.jsx'));
$.evalFile(File(MGRoot.fsName + '/host/templates.jsx'));
$.evalFile(File(MGRoot.fsName + '/host/expressions.jsx'));
$.evalFile(File(MGRoot.fsName + '/host/assets.jsx'));
$.evalFile(File(MGRoot.fsName + '/host/composition-tools.jsx'));
$.evalFile(File(MGRoot.fsName + '/host/ai.jsx'));
// The pre-render core is large enough that AE 2023 can fail while converting
// $.evalFile's return value. Reading and evaluating its UTF-8 source avoids
// that conversion while keeping the host in the same CEP engine.
var MGPreRenderingFile = File(MGRoot.fsName + '/host/prerender.jsx');
MGPreRenderingFile.encoding = 'UTF-8';
if (!MGPreRenderingFile.open('r')) { throw new Error('无法读取预渲染宿主脚本。'); }
var MGPreRenderingSource = MGPreRenderingFile.read(); MGPreRenderingFile.close();
eval(MGPreRenderingSource);
$.evalFile(File(MGRoot.fsName + '/js/reference-presets.js'));
$.evalFile(File(MGRoot.fsName + '/js/catalog.js'));
$.evalFile(File(MGRoot.fsName + '/js/motion.js'));
var MG2023Host = (function () {
    var UI_TAG = '// MotionGraphics:UI:1\n';
    var NATIVE_TAG = '// MotionGraphics:Native:1\n';
    var KEY_TAG = '// MotionGraphics:KeyLoop:1\n';
    var LAYER_TAG = '// MotionGraphics:LayerLoop:1\n';
    var META_START = '\n[MotionGraphics:1]\n', META_END = '\n[/MotionGraphics]';
    var slots = ['in', 'loop', 'out', 'feedback'];
    var labels = { duration: '时长 秒', distance: '距离 px', direction: '方向 1左2右3上4下', elastic: '弹性', amount: '幅度', stretch: '横向拉伸 %', angle: '角度', period: '周期 秒', frequency: '次数', delay: '偏移 秒' };
    function fail(message) { throw new Error(message); }
    function own(expression, tag) { return expression && expression.indexOf(tag) === 0; }
    function clone(value) { return JSON.parse(JSON.stringify(value)); }
    function includes(array, value) { for (var i = 0; i < array.length; i++) { if (array[i] === value) { return true; } } return false; }
    var USER_SCHEMA = 1, USER_PREFIX = 'user-', USER_EXTENSION = '.mgpreset.json';
    var TEAM_USER_PRESET_ROOT = 'Y:/项目素材/童话岛/Plug/MotionGraphics/动效预设';
    var USER_EFFECTS = {
        'CC Force Motion Blur': true, 'CC Slant': true, 'CC Page Turn': true,
        'ADBE Gaussian Blur 2': true, 'ADBE Turbulent Displace': true, 'ADBE Polar Coordinates': true,
        'ADBE Wave Warp': true, 'ADBE Glo2': true, 'ADBE Radial Blur': true,
        'ADBE Slider Control': true, 'ADBE Angle Control': true, 'ADBE Checkbox Control': true,
        'ADBE Color Control': true, 'ADBE Point Control': true, 'ADBE Point3D Control': true
    };
    function setUserRoot(data) { if (data && data.folder !== undefined) { var value = String(data.folder || '').replace(/^\s+|\s+$/g, ''); if (value) { var probe = Folder(value); $.global.MotionGraphicsUserPresetRoot = value; } } }
    function chooseUserRoot() { var selected = Folder.selectDialog('选择团队预设保存目录'); if (!selected) { return { ok:true, message:'已取消选择预设目录。', data:{cancelled:true} }; } $.global.MotionGraphicsUserPresetRoot = selected.fsName; return { ok:true, message:'预设目录已设置。', data:{folder:selected.fsName} }; }
    function userPresetRoot() {
        var override = $.global.MotionGraphicsUserPresetRoot;
        var folder = override ? Folder(override) : Folder(TEAM_USER_PRESET_ROOT);
        if (!folder.exists && override && !folder.create()) { fail('无法创建测试预设目录：' + folder.fsName); }
        if (!folder.exists) { fail('团队预设目录不可访问：' + folder.fsName + '。请确认绿联云已连接并映射为 Y: 盘。'); }
        return folder;
    }
    function validUserId(id) { return typeof id === 'string' && /^user-[a-z0-9-]{6,80}$/.test(id); }
    function userPresetFile(id) { if (!validUserId(id)) { fail('用户预设 ID 无效。'); } return File(userPresetRoot().fsName + '/' + id + USER_EXTENSION); }
    function readTextFile(file) {
        if (!file.exists) { fail('用户预设文件不存在。'); }
        file.encoding = 'UTF-8'; if (!file.open('r')) { fail('无法读取用户预设：' + file.error); }
        var text = file.read(); file.close(); return text;
    }
    function writeUserDocument(document) {
        var target = userPresetFile(document.id), temp = File(target.fsName + '.tmp');
        if (temp.exists) { temp.remove(); }
        temp.encoding = 'UTF-8'; temp.lineFeed = 'Unix';
        if (!temp.open('w')) { fail('无法写入用户预设：' + temp.error); }
        var ok = temp.write(JSON.stringify(document, null, 2)); temp.close();
        if (!ok) { if (temp.exists) { temp.remove(); } fail('写入用户预设失败。'); }
        if (target.exists && !target.remove()) { temp.remove(); fail('无法更新用户预设文件。'); }
        if (!temp.rename(target.name)) { temp.remove(); fail('无法完成用户预设文件。'); }
        return target;
    }
    function userCatalogRecord(document) {
        if (!document || Number(document.schemaVersion) !== USER_SCHEMA || !validUserId(document.id)) { fail('用户预设格式无效。'); }
        if (!includes(slots, document.category)) { fail('用户预设分类无效。'); }
        if (!document.template || !document.template.channels || !isFinite(Number(document.template.duration)) || Number(document.template.duration) <= 0) { fail('用户预设运动数据无效。'); }
        var duration = Number(document.template.duration), loop = document.category === 'loop';
        return {
            id: document.id, category: document.category, name: String(document.name || '未命名预设'), en: 'USER ' + document.id.substring(document.id.length - 4).toUpperCase(),
            desc: String(document.description || '用户保存的 UI 动效。'), fields: loop ? ['period'] : ['duration'],
            defaults: loop ? { period: duration, duration: duration } : { duration: duration }, type: 'ui', version: Number(document.version || 1), user: true,
            createdAt: document.createdAt || '', capture: document.capture || {}, template: clone(document.template)
        };
    }
    function readUserDocument(id) {
        var document;
        try { document = JSON.parse(readTextFile(userPresetFile(id))); } catch (e) { fail('用户预设 JSON 损坏：' + (e.message || e)); }
        return document;
    }
    function readUserCatalog() {
        var files = userPresetRoot().getFiles('*' + USER_EXTENSION), result = [], skipped = [], i, document;
        for (i = 0; i < files.length; i++) {
            if (!(files[i] instanceof File)) { continue; }
            try { document = JSON.parse(readTextFile(files[i])); result.push(userCatalogRecord(document)); }
            catch (e) { skipped.push(files[i].name + '：' + (e.message || e)); }
        }
        result.sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); });
        MGCatalog.registerUser(result); return { presets: result, skipped: skipped, folder: userPresetRoot().fsName };
    }
    function findPreset(id) {
        var preset = MGCatalog.find(id);
        if (!preset && validUserId(id)) { readUserCatalog(); preset = MGCatalog.find(id); }
        return preset;
    }
    function slotPreset(slot) { return slot && slot.userPreset ? slot.userPreset : (slot ? findPreset(slot.id) : null); }
    // ExtendScript host classes do not implement JavaScript prototype inheritance.
    function isAV(layer) { return layer instanceof AVLayer || layer instanceof ShapeLayer || layer instanceof TextLayer; }
    function prefix(category) { return 'MG / ' + MGCatalog.category(category).name + ' / '; }
    function controlName(category, key) { return prefix(category) + labels[key]; }
    function controlFields(preset) { return preset.fields.concat(['delay']); }
    function presetVersion(preset) { return preset && preset.version ? Number(preset.version) : 1; }
    function slotVersion(slot) { return slot && slot.version ? Number(slot.version) : 1; }
    function nativeShortLabel(matchName) {
        if (matchName === 'CC Force Motion Blur') { return 'Motion Blur'; } if (matchName === 'CC Slant') { return 'Slant'; }
        if (matchName === 'ADBE Gaussian Blur 2') { return 'Gaussian Blur'; } if (matchName === 'ADBE Turbulent Displace') { return 'Turbulence'; }
        if (matchName === 'ADBE Polar Coordinates') { return 'Polar'; } if (matchName === 'ADBE Wave Warp') { return 'Wave Warp'; } if (matchName === 'ADBE Glo2') { return 'Glow'; }
        if (matchName === 'CC Page Turn') { return 'Page Turn'; } if (matchName === 'ADBE Radial Blur') { return 'Radial Blur'; }
        return 'Effect';
    }
    function nativeEffectSpecs(preset, slot) {
        var result = [], i, effect;
        if (!preset) { return result; }
        if (preset.id === 'in-right-smear' && slot && slotVersion(slot) < 2) { return [{ name: prefix('in') + 'CC Force Motion Blur', matchName: 'CC Force Motion Blur', enabled: true, properties: [] }]; }
        if (!preset.template || !preset.template.effects) { return result; }
        var categoryCode = 'FB';
        if (preset.category === 'in') { categoryCode = 'IN'; } else if (preset.category === 'out') { categoryCode = 'OUT'; } else if (preset.category === 'loop') { categoryCode = 'LOOP'; }
        if (preset.id === 'out-ref-dissipate') {
            var pageTurn, foldPosition, j;
            for (i = 0; i < preset.template.effects.length; i++) { if (preset.template.effects[i].matchName === 'CC Page Turn') { pageTurn = preset.template.effects[i]; } }
            if (pageTurn) { for (j = 0; j < pageTurn.properties.length; j++) { if (pageTurn.properties[j].matchName === 'CC Page Turn-0001') { foldPosition = pageTurn.properties[j]; } } }
            if (foldPosition && foldPosition.pointCurve) {
                result.push({ name: 'MG / OUT 23 / Fold Start', matchName: 'ADBE Point Control', enabled: true, properties: [{ matchName: 'ADBE Point Control-0001', point: foldPosition.value }] });
                result.push({ name: 'MG / OUT 23 / Fold End', matchName: 'ADBE Point Control', enabled: true, properties: [{ matchName: 'ADBE Point Control-0001', point: foldPosition.end }] });
            }
        }
        for (i = 0; i < preset.template.effects.length; i++) {
            effect = preset.template.effects[i];
            var effectName = 'MG / ' + categoryCode + ' ' + preset.en.substring(preset.en.length - 2) + ' / ' + nativeShortLabel(effect.matchName);
            if (preset.user) { effectName = 'MG / USER ' + preset.id.substring(preset.id.length - 4).toUpperCase() + ' / ' + cleanUserText(effect.label || nativeShortLabel(effect.matchName), 'Effect', 22) + ' ' + (i + 1); }
            result.push({ name: effectName, matchName: effect.matchName, enabled: effect.enabled, properties: effect.properties || [] });
        }
        return result;
    }
    function loadState(layer) {
        var text = layer.comment || '', start = text.lastIndexOf(META_START), end;
        if (start < 0) { return { slots: {} }; }
        end = text.indexOf(META_END, start);
        if (end < 0) { fail('动效元数据不完整，未修改图层。'); }
        var state;
        try { state = JSON.parse(text.substring(start + META_START.length, end)); } catch (e) { fail('动效元数据损坏，未修改图层。'); }
        if (!state.slots) { fail('无法读取图层动效数据。'); }
        return state;
    }
    function saveState(layer, state) {
        var text = layer.comment || '', start = text.lastIndexOf(META_START), end, count = 0, i;
        if (start >= 0) { end = text.indexOf(META_END, start); text = text.substring(0, start) + text.substring(end + META_END.length); }
        for (i = 0; i < slots.length; i++) { if (state.slots[slots[i]]) { count++; } }
        layer.comment = text + (count ? META_START + JSON.stringify(state) + META_END : '');
    }
    function normalized(preset, input) {
        var params = MGCatalog.defaults(preset.id), ranges = {
            duration: [.05, 30], distance: [0, 4000], direction: [1, 4], elastic: [0, 1], amount: [0, 1000], stretch: [0, 400], angle: [-3600, 3600],
            period: [.1, 60], frequency: [1, 20], frames: [0, 1000], seed: [1, 99999], delay: [-60, 60]
        }, key, n;
        input = input || {};
        for (key in ranges) {
            if (ranges.hasOwnProperty(key) && input[key] !== undefined) {
                n = Number(input[key]);
                if (!isFinite(n) || n < ranges[key][0] || n > ranges[key][1]) { fail('参数超出范围：' + key); }
                if (includes(['direction', 'frames', 'frequency', 'seed'], key) && n !== Math.floor(n)) { fail('参数必须为整数：' + key); }
                params[key] = n;
            }
        }
        if (input.anchor !== undefined) { if (!includes(['auto', 'in', 'out', 'playhead'], input.anchor)) { fail('时间定位参数无效。'); } params.anchor = input.anchor; }
        if (includes(['loop-breathe', 'loop-blink', 'feedback-press', 'feedback-rebound', 'feedback-pop'], preset.id) && params.amount > 100) { fail('此预设幅度范围为 0–100%。'); }
        if (preset.id === 'loop-sway' && params.amount > 180) { fail('摇摆幅度范围为 0–180 度。'); }
        return params;
    }
    function channels(id, suppliedPreset) {
        var referencePreset = suppliedPreset || findPreset(id), referenceChannels, referenceResult = '';
        if (referencePreset && referencePreset.template) {
            referenceChannels = referencePreset.template.channels;
            if (referenceChannels.position) { referenceResult += 'p'; } if (referenceChannels.scale) { referenceResult += 's'; }
            if (referenceChannels.rotation) { referenceResult += 'r'; } if (referenceChannels.opacity) { referenceResult += 'o'; }
            return referenceResult;
        }
        if (id === 'in-fade' || id === 'out-fade' || id === 'loop-blink') { return 'o'; }
        if (id === 'in-slide' || id === 'out-slide') { return 'po'; }
        if (id === 'in-scale' || id === 'out-scale' || id === 'in-elastic' || id === 'out-elastic') { return 'so'; }
        if (id === 'in-rotate' || id === 'out-rotate') { return 'rso'; }
        if (id === 'loop-float' || id === 'feedback-shake' || id === 'feedback-bounce') { return 'p'; }
        if (id === 'loop-sway' || id === 'loop-spin') { return 'r'; }
        return 's';
    }
    function transforms(layer) {
        var t = layer.property('ADBE Transform Group'), pos = t.property('ADBE Position'), list = [];
        if (pos.dimensionsSeparated) {
            list.push({ property: pos.getSeparationFollower(0), channel: 'p', output: 'x' });
            list.push({ property: pos.getSeparationFollower(1), channel: 'p', output: 'y' });
        } else { list.push({ property: pos, channel: 'p', output: 'p' }); }
        list.push({ property: t.property('ADBE Scale'), channel: 's', output: 's' });
        list.push({ property: t.property('ADBE Rotate Z'), channel: 'r', output: 'r' });
        list.push({ property: t.property('ADBE Opacity'), channel: 'o', output: 'o' });
        return list;
    }
    function usedChannels(state) {
        var result = '', i, slot;
        for (i = 0; i < slots.length; i++) { slot = state.slots[slots[i]]; if (slot) { var preset = slotPreset(slot); result += preset ? channels(preset.id, preset) : ''; } }
        return result;
    }
    var TIMING_OWNER = 'MotionGraphics.Timing.1', TIMING_PARENT = 'MG / 所属图层';
    function layerTiming(slot) { return !!(slot && slot.timing && slot.timing.location === 'layer'); }
    function timingName(category) { return prefix(category) + '范围图层'; }
    function controllerKey(layer) {
        var text = layer.comment || '', tag = '[' + TIMING_OWNER + ']';
        if (text.indexOf(tag) !== 0) { return ''; }
        return text.substring(tag.length).split('\n')[0];
    }
    function boundController(layer, category, slot) {
        if (!slot || !slot.timing || layerTiming(slot)) { return null; }
        var effect = findEffect(layer, timingName(category)), n;
        if (!effect || effect.matchName !== 'ADBE Layer Control') { return null; }
        n = effect.property(1).value;
        if (n < 1 || n > layer.containingComp.numLayers) { return null; }
        var target = layer.containingComp.layer(n);
        if (controllerKey(target) !== slot.timing.key) { return null; }
        return target;
    }
    function controllerUsers(controller) {
        var c = controller.containingComp, count = 0, i, j, effect;
        for (i = 1; i <= c.numLayers; i++) {
            for (j = 0; j < slots.length; j++) {
                effect = findEffect(c.layer(i), timingName(slots[j]));
                if (effect && effect.matchName === 'ADBE Layer Control' && effect.property(1).value === controller.index) { count++; }
            }
        }
        return count;
    }
    function timingRange(layer, category, slot) {
        var t = slot.timing, controller = boundController(layer, category, slot), fallbackStart = t.start, target = controller;
        if (layerTiming(slot)) { target = layer; fallbackStart = layer.startTime + t.offset; }
        var result = {
            start: fallbackStart, duration: t.duration, valid: false, missing: false, controller: controller, markerLayer: target, markerIndex: 0, issue: '范围控制层丢失或绑定失效，暂用保存的范围；可点击修复。'
        }, markers, i, value, count = 0;
        if (target) {
            markers = target.property('ADBE Marker');
            for (i = 1; i <= markers.numKeys; i++) {
                value = markers.keyValue(i);
                if (value.getParameters().MotionGraphicsTiming === t.key) {
                    count++; result.markerIndex = i;
                    if (value.duration > 0) { result.start = markers.keyTime(i); result.duration = value.duration; result.valid = true; }
                }
            }
            result.missing = count === 0;
            if (count !== 1 || !result.valid) {
                result.start = fallbackStart; result.duration = t.duration; result.valid = false;
                result.issue = '范围标记丢失、重复或时长为零，暂用保存的范围；可点击修复。';
            } else { result.issue = ''; }
            if (result.missing && t.removeOnDelete === true) {
                result.issue = '范围标记已删除，动效已停止；面板将在空闲时清理对应控件。';
                var deleteHub = $.global.MotionGraphicsDeletedMarkerHub, recordId = layer.containingComp.id + ':' + layer.id + ':' + t.key;
                if (deleteHub && deleteHub.records[recordId] && deleteHub.records[recordId].handled) {
                    result.cleanupUndone = true; result.issue = '已撤销控件清理。继续按 AE 历史顺序撤销标记删除，才能恢复动效；不会再次自动清理。';
                }
            }
        }
        return result;
    }
    function validateTiming(start, duration) {
        if (!isFinite(start) || !isFinite(duration) || duration <= 0 || start < -10800 || start + duration > 10800) { fail('范围起点和终点须在 AE 时间范围内，且终点必须晚于起点。'); }
    }
    function initialTiming(layer, preset, params, origin) {
        var anchor = params.anchor, start = layer.startTime + origin, defaultLoop = preset.category === 'loop' && anchor === 'auto';
        if (anchor === 'auto') { anchor = 'in'; if (preset.category === 'out') { anchor = 'out'; } else if (preset.category === 'feedback' || defaultLoop) { anchor = 'playhead'; } }
        if (anchor === 'in') { start = layer.inPoint; }
        else if (anchor === 'out') { start = layer.outPoint - Math.max(.001, preset.category === 'loop' ? params.period : params.duration); }
        start += params.delay;
        var duration = params.duration;
        if (preset.category === 'loop') { duration = defaultLoop ? 1 : layer.outPoint - start; }
        validateTiming(start, duration); return { start: start, duration: duration };
    }
    function newTimingKey() { return new Date().getTime().toString(36) + '-' + Math.floor(Math.random() * 2147483647).toString(36); }
    function requestedDuration(data, preset, comp) {
        if (data.durationMode === undefined) { return null; }
        if (data.durationMode !== 'default' && data.durationMode !== 'custom') { fail('动效时长模式无效。'); }
        var seconds = data.durationMode === 'custom' ? Number(data.durationSeconds) : (preset.category === 'loop' && !preset.user ? 1 : (preset.defaults && preset.defaults.duration !== undefined ? preset.defaults.duration : MGCatalog.defaults(preset.id).duration));
        if (!isFinite(seconds) || seconds <= 0 || seconds > 3600) { fail('动效时长需要大于 0 且不超过 3600 秒。'); }
        return Math.max(1, Math.round(seconds / comp.frameDuration)) * comp.frameDuration;
    }
    function applyRequestedDuration(layer, preset, seconds) {
        if (seconds === null) { return ''; }
        var state = loadState(layer), slot = state.slots[preset.category];
        if (!slot || !slot.timing || !layerTiming(slot)) { fail('前置时长需要原图层上的范围标记，请先升级旧控制层动效。'); }
        var range = timingRange(layer, preset.category, slot);
        if (!range.valid) { fail(range.issue); }
        var start = preset.category === 'out' ? range.start + range.duration - seconds : range.start;
        var desired = start; start = vacantTimingStart(layer, start, slot.timing.key); validateTiming(start,seconds);
        var backup = snapshotMarkers(layer), oldComment = layer.comment, tracks = transforms(layer), oldExpressions = [], i, marker = null;
        var durationControl = preset.category === 'loop' ? null : findEffect(layer,controlName(preset.category,'duration'));
        var syncControl = durationControl && !durationControl.property(1).numKeys && !durationControl.property(1).expression;
        var oldControl = syncControl ? durationControl.property(1).value : null;
        for (i=0;i<tracks.length;i++) { oldExpressions.push({text:tracks[i].property.expression,enabled:tracks[i].property.expressionEnabled}); }
        for (i=0;i<backup.length;i++) { if (backup[i].value.getParameters().MotionGraphicsTiming === slot.timing.key) { marker = backup[i].value; break; } }
        preflightExpressions(layer,state,state);
        try {
            slot.timing.start=start;slot.timing.offset=start-layer.startTime;slot.timing.duration=seconds;
            if(preset.category!=='loop') { slot.params.duration=seconds; }
            // Use a fresh marker; retain existing user comment and non-timing parameters.
            var v = marker ? new MarkerValue(marker.comment) : null;
            if (v) { v.setParameters(marker.getParameters()); }
            putTimingMarker(layer,preset,slot.timing,v);if(syncControl)durationControl.property(1).setValue(seconds);rewriteExpressions(layer,state);saveState(layer,state);
        } catch(e) {
            restoreMarkers(layer,backup);layer.comment=oldComment;
            if(syncControl)durationControl.property(1).setValue(oldControl);
            for(i=0;i<tracks.length;i++){tracks[i].property.expression=oldExpressions[i].text;if(oldExpressions[i].text)tracks[i].property.expressionEnabled=oldExpressions[i].enabled;}throw e;
        }
        return timingShiftNotice(layer,desired,start);
    }
    function snapshotMarkers(layer) {
        var markers = layer.property('ADBE Marker'), backup = [];
        for (var i = 1; i <= markers.numKeys; i++) { backup.push({ time: markers.keyTime(i), value: markers.keyValue(i) }); }
        return backup;
    }
    function restoreMarkers(layer, backup) {
        var markers = layer.property('ADBE Marker'), i;
        for (i = markers.numKeys; i >= 1; i--) { markers.removeKey(i); }
        for (i = 0; i < backup.length; i++) { markers.setValueAtTime(backup[i].time, backup[i].value); }
    }
    function removeTimingMarkers(layer, key) {
        var markers = layer.property('ADBE Marker');
        for (var i = markers.numKeys; i >= 1; i--) { if (markers.keyValue(i).getParameters().MotionGraphicsTiming === key) { markers.removeKey(i); } }
    }
    function vacantTimingStart(layer, requested, ignoreKey) {
        var markers = layer.property('ADBE Marker'), start = requested, fd = layer.containingComp.frameDuration, i, attempt, occupied;
        // Range overlap is allowed. Only occupied start timestamps need a later frame.
        for (attempt = 0; attempt <= markers.numKeys; attempt++) {
            occupied = false;
            for (i = 1; i <= markers.numKeys; i++) {
                var v = markers.keyValue(i);
                if (rangeMarker(v) || (ignoreKey && v.getParameters().MotionGraphicsTiming === ignoreKey)) { continue; }
                if (Math.abs(markers.keyTime(i) - start) < .00001) { occupied = true; break; }
            }
            if (!occupied) { return start; }
            start = (Math.floor(start / fd + .00001) + 1) * fd;
        }
        fail('无法找到空闲的标记起点。');
    }
    function onLayerTiming(layer, range, key) { return { location: 'layer', removeOnDelete: true, key: key || newTimingKey(), start: range.start, offset: range.start - layer.startTime, duration: range.duration }; }
    function putTimingMarker(layer, preset, timing, template) {
        var markers = layer.property('ADBE Marker'), v, i;
        for (i = markers.numKeys; i >= 1; i--) {
            v = markers.keyValue(i);
            if (v.getParameters().MotionGraphicsTiming === timing.key || (rangeMarker(v) && Math.abs(markers.keyTime(i) - timing.start) < .00001)) { markers.removeKey(i); }
        }
        v = template || new MarkerValue('[MG] ' + preset.name); v.duration = timing.duration; v.label = 9;
        var parameters = v.getParameters(); parameters.MotionGraphicsTiming = timing.key; v.setParameters(parameters);
        markers.setValueAtTime(timing.start, v);
    }
    function timingShiftNotice(layer, requested, actual) {
        if (Math.abs(requested - actual) < .00001) { return ''; }
        return layer.name + '：起点 ' + requested.toFixed(3) + ' 秒已有标记，范围整体顺延至 ' + actual.toFixed(3) + ' 秒（时长不变）。';
    }
    function checkTimingBinding(layer, category, previous) {
        var effect = findEffect(layer, timingName(category));
        if (effect && (!previous || !previous.timing || effect.matchName !== 'ADBE Layer Control' || effect.property(1).numKeys || effect.property(1).expression)) { fail('范围图层控制器冲突或已被动画化，未修改。'); }
    }
    function disposeController(controller) {
        // Never delete a helper still referenced by a duplicate, or containing user artwork/markers.
        if (!controller || controller.locked || controllerUsers(controller)) { return; }
        var key = controllerKey(controller), markers = controller.property('ADBE Marker'), i;
        if (!key || !(controller instanceof ShapeLayer) || controller.property('ADBE Root Vectors Group').numProperties) { return; }
        if (controller.comment !== '[' + TIMING_OWNER + ']' + key + '\n范围标记控制动画时间；不参与渲染。') { return; }
        var comp = controller.containingComp, dependent;
        for (i = 1; i <= comp.numLayers; i++) {
            dependent = comp.layer(i);
            if (dependent.parent && dependent.parent.id === controller.id) { return; }
            if (isAV(dependent) && dependent.trackMatteLayer && dependent.trackMatteLayer.id === controller.id) { return; }
        }
        for (i = 1; i <= markers.numKeys; i++) { if (markers.keyValue(i).getParameters().MotionGraphicsTiming !== key) { return; } }
        if (controller.property('ADBE Effect Parade').numProperties !== 1 || !findEffect(controller, TIMING_PARENT)) { return; }
        controller.remove();
    }
    function sourceFromController(layer) {
        if (!controllerKey(layer)) { return layer; }
        var effect = findEffect(layer, TIMING_PARENT), c = layer.containingComp, n, state, i;
        if (effect && effect.matchName === 'ADBE Layer Control') {
            n = effect.property(1).value;
            if (n >= 1 && n <= c.numLayers) {
                var source = c.layer(n); state = loadState(source);
                for (i = 0; i < slots.length; i++) { var bound = boundController(source, slots[i], state.slots[slots[i]]); if (bound && bound.id === layer.id) { return source; } }
            }
        }
        fail('控制层找不到原图层，请直接选择需要编辑的画面图层。');
    }
    function expressionFor(state, output) {
        var code = UI_TAG + mgPose.toString() + '\n';
        code += 'function mgControl(n,d){try{return effect(n)(1).value;}catch(e){return d;}}\n';
        code += 'function mgRange(n,k,s,d){var r=[s,d,-1],count=0;try{var l=thisLayer;if(n){l=effect(n)(1);}var m=l.marker,v;for(var i=1;i<=m.numKeys;i++){v=m.key(i);if(v.parameters.MotionGraphicsTiming===k){count++;if(v.duration>0){r=[v.time,v.duration,1];}else{count+=2;}}}if(count===0){r=[s,d,0];}else if(count!==1){r=[s,d,-1];}}catch(e){r=[s,d,-1];}return r;}\n';
        code += 'var mgX=0,mgY=0,mgSX=1,mgSY=1,mgR=0,mgO=1,mgP,mgT,mgV,mgBounds;\n';
        var i, j, slot, p, keys, key, anchor, start;
        for (i = 0; i < slots.length; i++) {
            slot = state.slots[slots[i]]; if (!slot) { continue; }
            p = slotPreset(slot); if (!p || p.category !== slots[i]) { fail('未知的动效模块。'); }
            code += 'mgP=' + JSON.stringify(MGCatalog.defaults(p.id)) + ';\n';
            if (p.template) { code += 'mgP.__ref=' + JSON.stringify({ duration: p.template.duration, seed: p.template.seed, holdEnd: !!p.template.holdEnd, loop: !!p.template.loop, channels: p.template.channels }) + ';\n'; }
            else { code += 'mgP.__ref=null;\n'; }
            keys = controlFields(p);
            for (j = 0; j < keys.length; j++) {
                key = keys[j];
                code += 'mgP.' + key + '=mgControl(' + JSON.stringify(controlName(p.category, key)) + ',' + slot.params[key] + ');\n';
            }
            anchor = slot.params.anchor;
            // ExtendScript's nested conditional operator is not reliably right-associative.
            if (anchor === 'auto') {
                anchor = 'in';
                if (p.category === 'out') { anchor = 'out'; }
                else if (p.category === 'feedback') { anchor = 'playhead'; }
            }
            start = 'startTime+' + Number(slot.origin);
            if (anchor === 'in') { start = 'inPoint'; }
            else if (anchor === 'out') { start = 'outPoint-Math.max(.001,mgP.' + (p.category === 'loop' ? 'period' : 'duration') + ')'; }
            if (slot.timing) {
                var targetName = timingName(p.category), fallback = String(slot.timing.start);
                if (layerTiming(slot)) { targetName = ''; fallback = '(startTime+' + slot.timing.offset + ')'; }
                code += 'mgBounds=mgRange(' + JSON.stringify(targetName) + ',' + JSON.stringify(slot.timing.key) + ',' + fallback + ',' + slot.timing.duration + ');mgT=time-mgBounds[0];\n';
                if (p.category === 'loop') { code += 'mgT=Math.min(mgT,mgBounds[1]);\n'; }
                else { code += 'mgP.duration=mgBounds[1];\n'; }
            } else { code += 'mgT=time-(' + start + ')-mgP.delay;\n'; }
            if (slot.timing && slot.timing.removeOnDelete === true) {
                code += 'if(mgBounds[2]===0){mgV={x:0,y:0,scale:1,scaleX:1,scaleY:1,rotation:0,opacity:1};}else{mgV=mgPose(' + JSON.stringify(p.id) + ',mgT,mgP);}\n';
            } else { code += 'mgV=mgPose(' + JSON.stringify(p.id) + ',mgT,mgP);\n'; }
            code += 'mgX+=mgV.x;mgY+=mgV.y;mgSX*=mgV.scaleX;mgSY*=mgV.scaleY;mgR+=mgV.rotation;mgO*=mgV.opacity;\n';
        }
        if (output === 'p') { code += '[value[0]+mgX,value[1]+mgY];'; }
        if (output === 'x') { code += 'value+mgX;'; }
        if (output === 'y') { code += 'value+mgY;'; }
        if (output === 's') { code += '[value[0]*mgSX,value[1]*mgSY];'; }
        if (output === 'r') { code += 'value+mgR;'; }
        if (output === 'o') { code += 'Math.max(0,Math.min(100,value*mgO));'; }
        return code;
    }
    function supportedUI(layer) {
        if (controllerKey(layer)) { fail('请选中画面图层，不要把预设应用到范围控制层。'); }
        if (layer.locked) { fail('图层已锁定。'); }
        if (!isAV(layer) || !layer.hasVideo || layer.nullLayer) { fail('请选择文字、形状、图片、视频或预合成图层。'); }
        if (layer.threeDLayer) { fail('首版 UI 动效仅支持 2D 图层。'); }
    }
    function plainValue(value) {
        if (value instanceof Array) { var result = []; for (var i = 0; i < value.length; i++) { result.push(Number(value[i])); } return result; }
        if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') { return value; }
        fail('属性值类型暂不支持。');
    }
    function captureValueType(property) {
        var type = property.propertyValueType;
        return type === PropertyValueType.OneD || type === PropertyValueType.TwoD || type === PropertyValueType.TwoD_SPATIAL ||
            type === PropertyValueType.ThreeD || type === PropertyValueType.ThreeD_SPATIAL || type === PropertyValueType.COLOR;
    }
    function propertyExpression(property) {
        try { if (property.canSetExpression && property.expressionEnabled && property.expression) { return String(property.expression); } } catch (ignored) {}
        return '';
    }
    function addAnimatedProperty(list, property, label, scope) {
        if (!property || property.propertyType !== PropertyType.PROPERTY || !captureValueType(property)) { return; }
        var expression = propertyExpression(property);
        if (property.numKeys || expression) { list.push({ property: property, label: label, scope: scope, expression: expression }); }
    }
    function collectEffectLeaves(group, output, effectLabel) {
        for (var i = 1; i <= group.numProperties; i++) {
            var property = group.property(i);
            if (property.propertyType === PropertyType.PROPERTY) {
                if (property.matchName && captureValueType(property)) { output.push({ property: property, label: effectLabel + ' / ' + property.name, scope: 'effect', expression: propertyExpression(property) }); }
            } else { collectEffectLeaves(property, output, effectLabel); }
        }
    }
    function captureInventory(layer) {
        var transform = layer.property('ADBE Transform Group'), position = transform.property('ADBE Position'), animated = [], effectLeaves = [], effects = [], expressions = [], skipped = [], i, effect;
        if (position.dimensionsSeparated) {
            addAnimatedProperty(animated, position.getSeparationFollower(0), '位置 X', 'position');
            addAnimatedProperty(animated, position.getSeparationFollower(1), '位置 Y', 'position');
        } else { addAnimatedProperty(animated, position, '位置', 'position'); }
        addAnimatedProperty(animated, transform.property('ADBE Scale'), '缩放', 'scale');
        addAnimatedProperty(animated, transform.property('ADBE Rotate Z'), '旋转', 'rotation');
        addAnimatedProperty(animated, transform.property('ADBE Opacity'), '不透明度', 'opacity');
        var parade = layer.property('ADBE Effect Parade');
        for (i = 1; parade && i <= parade.numProperties; i++) {
            effect = parade.property(i);
            if ((effect.name || '').indexOf('MG / ') === 0) { skipped.push(effect.name + '：已是 Motion Graphics 控件，未重复捕获。'); continue; }
            if (!USER_EFFECTS[effect.matchName]) { skipped.push(effect.name + '：效果暂不在用户预设白名单中。'); continue; }
            var leaves = []; collectEffectLeaves(effect, leaves, effect.name);
            effects.push({ source: effect, leaves: leaves, label: effect.name, matchName: effect.matchName, enabled: effect.enabled });
            for (var j = 0; j < leaves.length; j++) { effectLeaves.push(leaves[j]); if (leaves[j].property.numKeys || leaves[j].expression) { animated.push(leaves[j]); } }
        }
        for (i = 0; i < animated.length; i++) { if (animated[i].expression) { expressions.push({ scope: animated[i].scope, label: animated[i].label, source: animated[i].expression, mode: 'baked' }); } }
        return { transform: transform, position: position, animated: animated, effects: effects, effectLeaves: effectLeaves, expressions: expressions, skipped: skipped };
    }
    function selectedKeyRange(properties) {
        var min = Infinity, max = -Infinity, count = 0, i, j, keys;
        for (i = 0; i < properties.length; i++) {
            try { keys = properties[i].property.selectedKeys || []; } catch (e) { keys = []; }
            for (j = 0; j < keys.length; j++) { min = Math.min(min, properties[i].property.keyTime(keys[j])); max = Math.max(max, properties[i].property.keyTime(keys[j])); count++; }
        }
        return count >= 2 && max > min ? { start: min, end: max, source: 'selectedKeys' } : null;
    }
    function allKeyRange(properties) {
        var min = Infinity, max = -Infinity, count = 0, i, j, property;
        for (i = 0; i < properties.length; i++) {
            property = properties[i].property;
            for (j = 1; j <= property.numKeys; j++) { min = Math.min(min, property.keyTime(j)); max = Math.max(max, property.keyTime(j)); count++; }
        }
        return count >= 2 && max > min ? { start: min, end: max, source: 'allKeys' } : null;
    }
    function sampledDifference(a, b) {
        if (a instanceof Array && b instanceof Array) {
            var distance = 0; for (var i = 0; i < Math.min(a.length, b.length); i++) { distance = Math.max(distance, Math.abs(Number(a[i]) - Number(b[i]))); } return distance;
        }
        if (typeof a === 'number' && typeof b === 'number') { return Math.abs(a - b); }
        return a === b ? 0 : 1;
    }
    function extendExpressionTail(comp, layer, inventory, range) {
        if (!range || !inventory.expressions.length || (range.source !== 'selectedKeys' && range.source !== 'allKeys')) { return range; }
        var properties = [], i, item;
        for (i = 0; i < inventory.animated.length; i++) { item = inventory.animated[i]; if (item.expression && item.property.numKeys > 0) { properties.push(item.property); } }
        if (!properties.length) { return range; }
        var originalEnd = range.end, maximumEnd = Math.min(comp.duration, layer.outPoint, originalEnd + 3, range.start + 30), step = comp.frameDuration;
        if (maximumEnd <= originalEnd + step / 2) { return range; }
        var previous = [], current, time, moving, lastMoving = originalEnd, tolerance, j;
        for (i = 0; i < properties.length; i++) { previous.push(propertyAt(properties[i], originalEnd)); }
        for (time = originalEnd + step; time <= maximumEnd + step / 4; time += step) {
            moving = false;
            for (j = 0; j < properties.length; j++) {
                try { current = propertyAt(properties[j], Math.min(time, maximumEnd)); }
                catch (tailReadError) { continue; }
                tolerance = properties[j].propertyValueType === PropertyValueType.COLOR ? .0001 : .01;
                if (sampledDifference(current, previous[j]) > tolerance) { moving = true; }
                previous[j] = current;
            }
            if (moving) { lastMoving = Math.min(time, maximumEnd); }
        }
        if (lastMoving <= originalEnd + step / 2) { return range; }
        var limited = lastMoving >= maximumEnd - step * 1.5, extendedEnd = limited ? maximumEnd : Math.min(maximumEnd, lastMoving + step * 3);
        range.end = extendedEnd; range.source += '+expressionTail'; range.expressionTail = extendedEnd - originalEnd; range.expressionTailLimited = limited;
        if (limited) { inventory.skipped.push('表达式在最后关键帧后 3 秒内仍未稳定；已保存 3 秒尾段。若需要更长范围，请调整工作区并只保存表达式动画。'); }
        return range;
    }
    function captureRange(comp, layer, inventory) {
        var range = selectedKeyRange(inventory.animated) || allKeyRange(inventory.animated), start, end;
        if (!range && inventory.expressions.length) {
            start = Math.max(layer.inPoint, comp.workAreaStart); end = Math.min(layer.outPoint, comp.workAreaStart + comp.workAreaDuration);
            if (end > start + comp.frameDuration / 2) { range = { start: start, end: end, source: 'workArea' }; }
        }
        if (!range && inventory.effects.length) {
            start = Math.max(layer.inPoint, comp.time); end = Math.min(layer.outPoint, start + 1);
            if (end <= start + .000001) { end = start + Math.max(comp.frameDuration, .05); }
            range = { start: start, end: end, source: 'static' };
        }
        if (!range) { fail('未找到可保存的关键帧、表达式或受支持原生效果。'); }
        range = extendExpressionTail(comp, layer, inventory, range);
        range.duration = range.end - range.start;
        if (range.duration < .05) { fail('预设范围至少需要 0.05 秒。'); }
        if (range.duration > 30) { fail('预设范围不能超过 30 秒；请选择关键帧或缩短工作区。'); }
        return range;
    }
    function sampleTimes(comp, range) {
        var frames = Math.max(2, Math.round(range.duration / comp.frameDuration) + 1), count = Math.min(121, frames), result = [];
        for (var i = 0; i < count; i++) { result.push(range.start + range.duration * i / (count - 1)); }
        return result;
    }
    function propertyAt(property, time) { return plainValue(property.valueAtTime(time, false)); }
    function positionAt(inventory, time) {
        var position = inventory.position;
        if (position.dimensionsSeparated) { return [Number(position.getSeparationFollower(0).valueAtTime(time, false)), Number(position.getSeparationFollower(1).valueAtTime(time, false))]; }
        var value = propertyAt(position, time); return [Number(value[0]), Number(value[1])];
    }
    function vectorOperation(value, neutral, operation) {
        if (value instanceof Array) {
            var result = []; for (var i = 0; i < value.length; i++) { result.push(operation(value[i], neutral[i], i)); } return result;
        }
        return operation(value, neutral, 0);
    }
    function sampledCurve(times, sampler, normalize) {
        var keys = [], i, value;
        for (i = 0; i < times.length; i++) { value = sampler(times[i]); if (normalize) { value = normalize(value); } keys.push({ t: times[i] - times[0], v: value, mode: 'l' }); }
        return { keys: keys };
    }
    function animatedScope(inventory, name) { for (var i = 0; i < inventory.animated.length; i++) { if (inventory.animated[i].scope === name) { return true; } } return false; }
    function captureChannels(layer, inventory, range, times, category) {
        var channels = {}, transform = inventory.transform, neutralTime = category === 'in' ? range.end : range.start, neutral, property;
        if (animatedScope(inventory, 'position')) {
            neutral = positionAt(inventory, neutralTime);
            channels.position = sampledCurve(times, function (time) { return positionAt(inventory, time); }, function (value) { return [value[0] - neutral[0], value[1] - neutral[1]]; });
        }
        if (animatedScope(inventory, 'scale')) {
            property = transform.property('ADBE Scale'); neutral = propertyAt(property, neutralTime);
            if (Math.abs(neutral[0]) < .000001 || Math.abs(neutral[1]) < .000001) { fail('缩放基准值不能为 0。'); }
            channels.scale = sampledCurve(times, function (time) { return propertyAt(property, time); }, function (value) { return [value[0] / neutral[0], value[1] / neutral[1]]; });
        }
        if (animatedScope(inventory, 'rotation')) {
            property = transform.property('ADBE Rotate Z'); neutral = Number(propertyAt(property, neutralTime));
            channels.rotation = sampledCurve(times, function (time) { return Number(propertyAt(property, time)); }, function (value) { return value - neutral; });
        }
        if (animatedScope(inventory, 'opacity')) {
            property = transform.property('ADBE Opacity'); neutral = Number(propertyAt(property, neutralTime));
            if (Math.abs(neutral) < .000001) { neutral = 100; }
            channels.opacity = sampledCurve(times, function (time) { return Number(propertyAt(property, time)); }, function (value) { return value / neutral; });
        }
        return channels;
    }
    function pointValue(value, layer) { return [Number(value[0]) / Math.max(1, layer.width), Number(value[1]) / Math.max(1, layer.height)]; }
    function captureEffects(layer, inventory, range, times, category) {
        var output = [], neutralTime = category === 'in' ? range.end : range.start, i, j, info, leaf, property, item, dynamic, value, end, curve, effect;
        for (i = 0; i < inventory.effects.length; i++) {
            info = inventory.effects[i]; effect = { label: info.label, matchName: info.matchName, enabled: info.enabled, properties: [] };
            for (j = 0; j < info.leaves.length; j++) {
                leaf = info.leaves[j]; property = leaf.property; dynamic = property.numKeys > 0 || !!leaf.expression;
                try { value = propertyAt(property, neutralTime); } catch (unsupportedValue) { inventory.skipped.push(leaf.label + '：无法读取。'); continue; }
                item = { matchName: property.matchName };
                var isPoint = property.propertyValueType === PropertyValueType.TwoD_SPATIAL;
                if (isPoint) { item.pointCurve = true; item.value = pointValue(value, layer); }
                else { item.value = value; }
                if (dynamic) {
                    if (!property.canSetExpression) { inventory.skipped.push(leaf.label + '：不支持范围控时，已跳过动画参数。'); continue; }
                    curve = sampledCurve(times, function (time) { return propertyAt(property, time); }, isPoint ? function (sample) { return pointValue(sample, layer); } : null);
                    end = curve.keys[curve.keys.length - 1].v; item.curve = curve; item.end = end;
                    if (leaf.expression) { item.originalExpression = leaf.expression; item.expressionMode = 'baked'; }
                }
                effect.properties.push(item);
            }
            if (effect.properties.length) { output.push(effect); }
        }
        return output;
    }
    function cleanUserText(value, fallback, max) {
        var text = String(value === undefined || value === null ? '' : value).replace(/[\r\n\t]/g, ' ').replace(/^\s+|\s+$/g, '');
        if (!text) { text = fallback; } return text.substring(0, max);
    }
    function captureUserPreset(comp, data) {
        if (comp.selectedLayers.length !== 1) { fail('保存用户预设时请只选择一个源图层。'); }
        var layer = comp.selectedLayers[0]; supportedUI(layer);
        var category = String(data.category || 'in'); if (!includes(slots, category)) { fail('请选择有效的 UI 动效分类。'); }
        var inventory = captureInventory(layer), range = captureRange(comp, layer, inventory), times = sampleTimes(comp, range);
        var channels = captureChannels(layer, inventory, range, times, category), effects = captureEffects(layer, inventory, range, times, category), channelCount = 0, key;
        for (key in channels) { if (channels.hasOwnProperty(key)) { channelCount++; } }
        if (!channelCount && !effects.length) { fail('没有捕获到可应用的动画或原生效果。'); }
        var id = USER_PREFIX + new Date().getTime().toString(36) + '-' + Math.floor(Math.random() * 2147483647).toString(36);
        var document = {
            schemaVersion: USER_SCHEMA, id: id, version: 1,
            name: cleanUserText(data.name, '我的动效', 48), category: category, description: cleanUserText(data.description, '用户保存的 UI 动效。', 160),
            createdAt: new Date().toUTCString(),
            capture: { sourceLayer: layer.name, sourceRange: range.source, duration: range.duration, expressionTail: range.expressionTail || 0, expressionTailLimited: !!range.expressionTailLimited, sampleCount: times.length, expressionMode: 'baked', expressions: inventory.expressions, skipped: inventory.skipped },
            template: { duration: range.duration, seed: Math.floor(Math.random() * 10000) + 1, holdEnd: category === 'out', loop: category === 'loop', channels: channels, effects: effects }
        };
        var file = writeUserDocument(document), preset = userCatalogRecord(document); readUserCatalog();
        var message = '已保存团队预设“' + preset.name + '”。捕获 ' + channelCount + ' 个变换通道、' + effects.length + ' 个原生效果';
        if (inventory.expressions.length) { message += '，' + inventory.expressions.length + ' 条表达式已保存原文并采样'; }
        if (range.expressionTail) { message += '，已自动包含最后关键帧后 ' + range.expressionTail.toFixed(2) + ' 秒的表达式尾段'; }
        message += '。'; if (inventory.skipped.length) { message += ' 有 ' + inventory.skipped.length + ' 项暂未支持。'; }
        return { ok: true, message: message, data: { preset: preset, file: file.fsName, skipped: inventory.skipped } };
    }
    function listUserPresets() {
        var library = readUserCatalog();
        return { ok: true, message: library.presets.length ? '已读取 ' + library.presets.length + ' 个团队预设。' : '团队目录还没有保存预设。', data: library };
    }
    function deleteUserPreset(data) {
        var id = String(data.id || ''), preset = findPreset(id), file;
        if (!validUserId(id) || !preset || !preset.user) { fail('找不到要删除的用户预设。'); }
        file = userPresetFile(id);
        if (file.exists && !file.remove()) { fail('无法删除用户预设文件：' + file.error); }
        readUserCatalog();
        return { ok: true, message: '已从团队预设库删除“' + preset.name + '”。已应用到图层的动效仍可通过其范围标记管理。', data: { id: id } };
    }
    function exportUserPreset(data) {
        var id = String(data.id || ''), preset = findPreset(id), source, destination;
        if (!validUserId(id) || !preset || !preset.user) { fail('找不到要导出的用户预设。'); }
        source = userPresetFile(id);
        if (data.path) { destination = File(String(data.path)); }
        else { destination = File.saveDialog('导出 Motion Graphics 团队预设', 'Motion Graphics 团队预设:*' + USER_EXTENSION); }
        if (!destination) { return { ok: true, message: '已取消导出。', data: { cancelled: true } }; }
        if (destination.name.toLowerCase().indexOf(USER_EXTENSION) !== destination.name.length - USER_EXTENSION.length) {
            destination = File(destination.fsName + USER_EXTENSION);
        }
        if (destination.exists && !destination.remove()) { fail('无法覆盖导出文件。'); }
        if (!source.copy(destination.fsName)) { fail('导出用户预设失败：' + source.error); }
        return { ok: true, message: '已导出“' + preset.name + '”。', data: { file: destination.fsName } };
    }
    function revealUserPresetFolder() {
        var folder = userPresetRoot();
        if (!folder.execute()) { fail('无法打开用户预设目录。'); }
        return { ok: true, message: '已打开团队预设目录。', data: { folder: folder.fsName } };
    }
    function findEffect(layer, name) { var effects = layer.property('ADBE Effect Parade'); return effects ? effects.property(name) : null; }
    function ownedNativeEffect(layer, spec, claimed) {
        if (!spec) { return null; }
        var effects = layer.property('ADBE Effect Parade'), found = null, count = 0, i, effect;
        for (i = 1; i <= effects.numProperties; i++) {
            effect = effects.property(i);
            if (effect.name === spec.name) { found = effect; count++; }
        }
        if (count > 1 || (found && (found.matchName !== spec.matchName || !claimed))) { fail('效果名称冲突，已保留：' + spec.name); }
        return found;
    }
    function addOwnedNativeEffect(layer, spec) {
        var effects = layer.property('ADBE Effect Parade');
        if (!effects.canAddProperty(spec.matchName)) { fail('当前 AE 无法添加效果：' + spec.matchName); }
        var effect = effects.addProperty(spec.matchName);
        if (!effect || effect.matchName !== spec.matchName) { fail('添加效果失败：' + spec.matchName); }
        effect.name = spec.name;
        return effect;
    }
    function findNativeProperty(group, matchName) {
        for (var i = 1; i <= group.numProperties; i++) {
            var property = group.property(i);
            if (property.matchName === matchName) { return property; }
            if (property.propertyType !== PropertyType.PROPERTY) { var nested = findNativeProperty(property, matchName); if (nested) { return nested; } }
        }
        return null;
    }
    function nativeCurveExpression(preset, slot, item) {
        var code = NATIVE_TAG;
        code += 'function mgC(x){return Math.max(0,Math.min(1,x));}function mgS(x){x=mgC(x);return x*x*(3-2*x);}function mgA(v){return v instanceof Array;}function mgM(a,b,x){if(mgA(a)){var r=[];for(var q=0;q<a.length;q++){r.push(a[q]+(b[q]-a[q])*x);}return r;}return a+(b-a)*x;}\n';
        code += 'function mgCurve(k,t,n){if(!k.length){return n;}if(t<=k[0].t){return k[0].v;}for(var i=0;i<k.length-1;i++){if(t<k[i+1].t){var x=(t-k[i].t)/Math.max(.000001,k[i+1].t-k[i].t);if(k[i].mode===\"h\"){x=0;}else if(k[i].mode===\"b\"){x=mgS(x);}return mgM(k[i].v,k[i+1].v,x);}}return n;}\n';
        if (item.pointCurve && preset.id === 'out-ref-dissipate' && item.matchName === 'CC Page Turn-0001') {
            var foldStart = 'MG / OUT 23 / Fold Start', foldEnd = 'MG / OUT 23 / Fold End', sourceStart = item.value, sourceEnd = item.end;
            code += 'function mgPoint(v){var a=effect(' + JSON.stringify(foldStart) + ')(1).value,b=effect(' + JSON.stringify(foldEnd) + ')(1).value,u=(v[0]-' + sourceStart[0] + ')/' + (sourceEnd[0] - sourceStart[0]) + ';return[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];}\n';
        } else if (item.pointCurve) { code += 'function mgPoint(v){return[v[0]*thisLayer.width,v[1]*thisLayer.height];}\n'; }
        var duration, start, targetName = '', fallback, anchor, neutralValue = item.value, endValue = item.end !== undefined ? item.end : item.value;
        function output(valueCode) { var result = item.pointCurve ? 'mgPoint(' + valueCode + ')' : valueCode; if (item.expressionScale) { result = '(' + result + ')*' + Number(item.expressionScale); } return result; }
        if (slot.timing) {
            code += 'function mgRange(n,k,s,d){var r=[s,d,-1],count=0;try{var l=thisLayer;if(n){l=effect(n)(1);}var m=l.marker,v;for(var i=1;i<=m.numKeys;i++){v=m.key(i);if(v.parameters.MotionGraphicsTiming===k){count++;if(v.duration>0){r=[v.time,v.duration,1];}else{count+=2;}}}if(count===0){r=[s,d,0];}else if(count!==1){r=[s,d,-1];}}catch(e){r=[s,d,-1];}return r;}\n';
            targetName = layerTiming(slot) ? '' : timingName(preset.category); fallback = layerTiming(slot) ? '(startTime+' + slot.timing.offset + ')' : String(slot.timing.start);
            code += 'var mgB=mgRange(' + JSON.stringify(targetName) + ',' + JSON.stringify(slot.timing.key) + ',' + fallback + ',' + slot.timing.duration + '),mgT=time-mgB[0],mgD=Math.max(.001,mgB[1]);\n';
            if (slot.timing.removeOnDelete === true) { code += 'if(mgB[2]===0){' + output(JSON.stringify(neutralValue)) + ';}else{'; }
        } else {
            duration = 'effect(' + JSON.stringify(controlName(preset.category, 'duration')) + ')(1).value';
            anchor = slot.params.anchor;
            if (anchor === 'auto') { anchor = 'in'; if (preset.category === 'out') { anchor = 'out'; } else if (preset.category === 'feedback') { anchor = 'playhead'; } }
            start = 'inPoint'; if (anchor === 'out') { start = 'outPoint-Math.max(.001,' + duration + ')'; } else if (anchor === 'playhead') { start = 'startTime+' + Number(slot.origin); }
            code += 'var mgD=Math.max(.001,' + duration + '),mgT=time-(' + start + ')-effect(' + JSON.stringify(controlName(preset.category, 'delay')) + ')(1).value;\n';
        }
        if (preset.user && preset.category === 'loop') {
            code += 'var mgP=Math.max(.05,effect(' + JSON.stringify(controlName(preset.category, 'period')) + ')(1).value),mgST=(Math.max(0,mgT)%mgP)/mgP*' + preset.template.duration + ';';
            code += 'if(mgT<0){' + output(JSON.stringify(neutralValue)) + ';}else{' + output('mgCurve(' + JSON.stringify(item.curve.keys) + ',mgST,' + JSON.stringify(endValue) + ')') + ';}';
        } else { code += 'var mgU=mgC(mgT/mgD);if(mgU>=1){' + output(JSON.stringify(endValue)) + ';}else{' + output('mgCurve(' + JSON.stringify(item.curve.keys) + ',mgU*' + preset.template.duration + ',' + JSON.stringify(endValue) + ')') + ';}'; }
        if (slot.timing && slot.timing.removeOnDelete === true) { code += '}'; }
        return code;
    }
    function configureOwnedNativeEffect(layer, effect, spec, preset, slot, isNew, backups) {
        if (isNew) { effect.enabled = spec.enabled; }
        for (var i = 0; i < spec.properties.length; i++) {
            var item = spec.properties[i], property = findNativeProperty(effect, item.matchName), value;
            if (!property) { fail('效果参数缺失：' + spec.name + ' / ' + item.matchName); }
            if (item.point) { value = [layer.width * item.point[0], layer.height * item.point[1]]; } else { value = item.value; }
            if (item.curve) {
                if (!property.canSetExpression) { fail('效果参数不支持范围控时：' + spec.name + ' / ' + property.name); }
                if (property.numKeys || (property.expression && !own(property.expression, NATIVE_TAG))) { fail('原生效果参数已有外部动画，已保留：' + spec.name + ' / ' + property.name); }
                if (!isNew) { backups.push({ effectName: spec.name, matchName: item.matchName, value: property.value, expression: property.expression, enabled: property.expressionEnabled }); }
                property.expression = nativeCurveExpression(preset, slot, item);
                if (property.expressionError) { fail(spec.name + ' / ' + property.name + '：' + property.expressionError); }
            } else if (isNew) {
                try { property.setValue(value); } catch (e) { fail('无法设置效果参数：' + spec.name + ' / ' + property.name); }
            }
        }
    }
    function restoreNativeBackups(layer, backups) {
        for (var i = backups.length - 1; i >= 0; i--) {
            var backup = backups[i], effect = findEffect(layer, backup.effectName), property = effect ? findNativeProperty(effect, backup.matchName) : null;
            if (!property) { continue; }
            property.expression = ''; try { property.setValue(backup.value); } catch (ignoredValue) {}
            property.expression = backup.expression; if (backup.expression) { property.expressionEnabled = backup.enabled; }
        }
    }
    function ensureControl(layer, name, value) {
        var effect = findEffect(layer, name);
        if (!effect) { effect = layer.property('ADBE Effect Parade').addProperty('ADBE Slider Control'); effect.name = name; }
        effect.property(1).setValue(value);
    }
    function rewriteExpressions(layer, state) {
        var list = transforms(layer), used = usedChannels(state), i, track;
        for (i = 0; i < list.length; i++) {
            track = list[i];
            if (used.indexOf(track.channel) >= 0) {
                track.property.expression = expressionFor(state, track.output);
                if (track.property.expressionError) { fail(track.property.name + '：' + track.property.expressionError); }
            } else if (own(track.property.expression, UI_TAG)) { track.property.expression = ''; }
        }
    }
    function preflightExpressions(layer, state, previous) {
        var list = transforms(layer), used = usedChannels(state) + (previous ? usedChannels(previous) : ''), i, prop;
        for (i = 0; i < list.length; i++) {
            if (used.indexOf(list[i].channel) < 0) { continue; }
            prop = list[i].property;
            if (!prop.canSetExpression) { fail(prop.name + ' 不支持表达式。'); }
            if (prop.expression && !own(prop.expression, UI_TAG)) { fail(prop.name + ' 已有外部表达式，已保留。'); }
        }
    }
    function updateUI(layer, preset, params, comp, markerTiming, reuseExisting) {
        supportedUI(layer);
        var previous = loadState(layer), next = clone(previous), fields = controlFields(preset), i, effect, name;
        next.slots[preset.category] = { id: preset.id, version: presetVersion(preset), params: params, origin: comp.time - layer.startTime };
        if (preset.user) { next.slots[preset.category].userPreset = clone(preset); }
        var oldSlot = previous.slots[preset.category], existing = null, createRange = false, timing = null, notice = '';
        var oldPreset = slotPreset(oldSlot), oldNatives = nativeEffectSpecs(oldPreset, oldSlot), nextNatives = nativeEffectSpecs(preset, next.slots[preset.category]);
        var createdNatives = [], nativeBackups = [], oldNativeEffects = [], nextNativeEffects = [], j, claimed;
        var current = null, deletedSlot = false;
        if (oldSlot && oldSlot.timing) { current = timingRange(layer, preset.category, oldSlot); deletedSlot = oldSlot.timing.removeOnDelete === true && current.missing; }
        if (reuseExisting && oldSlot && oldSlot.id === preset.id && slotVersion(oldSlot) === presetVersion(preset) && !deletedSlot) {
            var repaired = [];
            try {
                for (i = 0; i < nextNatives.length; i++) {
                    effect = ownedNativeEffect(layer, nextNatives[i], true);
                    if (!effect) { effect = addOwnedNativeEffect(layer, nextNatives[i]); repaired.push(nextNatives[i].name); configureOwnedNativeEffect(layer, effect, nextNatives[i], preset, oldSlot, true, nativeBackups); }
                }
            } catch (repairError) {
                for (i = 0; i < repaired.length; i++) { effect = findEffect(layer, repaired[i]); if (effect) { effect.remove(); } }
                throw repairError;
            }
            if (repaired.length) { return layer.name + '：已补回缺少的原生效果，其余参数和关键帧保持不变。'; }
            return layer.name + '：已有“' + preset.name + '”，保留效果控件中的参数和关键帧。';
        }
        if (oldSlot && oldSlot.timing && !deletedSlot) {
            if (!current.valid) { fail(current.issue); }
            timing = clone(oldSlot.timing); timing.start = current.start; timing.duration = current.duration;
            existing = current.markerLayer;
            if (layerTiming(oldSlot)) { timing.offset = current.start - layer.startTime; timing.removeOnDelete = true; }
            else if (controllerUsers(existing) > 1) { fail('复制图层共用旧控制层，请先使用“帮助 → 旧动效升级/修复”。'); }
            // Existing marker timing is authoritative; parameter applies must not move its range.
            params.duration = oldSlot.params.duration; params.anchor = oldSlot.params.anchor; params.delay = oldSlot.params.delay;
        } else if (markerTiming && (!oldSlot || deletedSlot)) {
            var initial = initialTiming(layer, preset, params, comp.time - layer.startTime), requested = initial.start;
            initial.start = vacantTimingStart(layer, initial.start, ''); validateTiming(initial.start, initial.duration);
            notice = timingShiftNotice(layer, requested, initial.start);
            timing = onLayerTiming(layer, initial); createRange = true; existing = layer;
        }
        if (timing) {
            if (timing.location !== 'layer') { checkTimingBinding(layer, preset.category, oldSlot); }
            next.slots[preset.category].timing = timing;
        }
        preflightExpressions(layer, next, previous);
        for (i = 0; i < oldNatives.length; i++) { oldNativeEffects.push(ownedNativeEffect(layer, oldNatives[i], true)); }
        for (i = 0; i < nextNatives.length; i++) {
            claimed = false; for (j = 0; j < oldNatives.length; j++) { if (oldNatives[j].name === nextNatives[i].name) { claimed = true; break; } }
            nextNativeEffects.push(ownedNativeEffect(layer, nextNatives[i], claimed));
        }
        var backup = [], created = [], tracks = transforms(layer), originalComment = layer.comment, markerBackup = null;
        if (timing) { markerBackup = snapshotMarkers(existing); }
        for (i = 0; i < tracks.length; i++) { tracks[i].old = tracks[i].property.expression; tracks[i].enabled = tracks[i].property.expressionEnabled; }
        for (i = 0; i < fields.length; i++) {
            name = controlName(preset.category, fields[i]); effect = findEffect(layer, name);
            if (effect) {
                if (!previous.slots[preset.category] || effect.matchName !== 'ADBE Slider Control') { fail('控制器名称冲突：' + name); }
                if (effect.property(1).numKeys || effect.property(1).expression) { fail('参数已有关键帧或表达式，请在 AE 效果控件中调整。'); }
                backup.push({ name: name, value: effect.property(1).value });
            } else { created.push(name); }
        }
        try {
            for (i = 0; i < fields.length; i++) { ensureControl(layer, controlName(preset.category, fields[i]), params[fields[i]]); }
            for (i = 0; i < nextNatives.length; i++) {
                effect = findEffect(layer, nextNatives[i].name); claimed = false;
                if (!effect) { effect = addOwnedNativeEffect(layer, nextNatives[i]); createdNatives.push(nextNatives[i].name); claimed = true; }
                configureOwnedNativeEffect(layer, effect, nextNatives[i], preset, next.slots[preset.category], claimed, nativeBackups);
            }
            if (createRange) { putTimingMarker(layer, preset, timing); }
            else if (timing && !existing.locked) {
                var markerTrack = existing.property('ADBE Marker'), v;
                for (i = 1; i <= markerTrack.numKeys; i++) {
                    v = markerTrack.keyValue(i);
                    if (v.getParameters().MotionGraphicsTiming === timing.key && v.comment === '[MG] ' + oldPreset.name) { v.comment = '[MG] ' + preset.name; markerTrack.setValueAtKey(i, v); }
                }
            }
            rewriteExpressions(layer, next);
            saveState(layer, next);
        } catch (e) {
            if (markerBackup && !existing.locked) { restoreMarkers(existing, markerBackup); }
            // Reacquire effects after addProperty, which invalidates indexed-group handles in AE.
            for (i = 0; i < created.length; i++) { effect = findEffect(layer, created[i]); if (effect) { effect.remove(); } }
            for (i = 0; i < createdNatives.length; i++) { effect = findEffect(layer, createdNatives[i]); if (effect) { effect.remove(); } }
            restoreNativeBackups(layer, nativeBackups);
            for (i = 0; i < backup.length; i++) { ensureControl(layer, backup[i].name, backup[i].value); }
            tracks = transformsWithBackup(layer, tracks);
            for (i = 0; i < tracks.length; i++) { tracks[i].property.expression = tracks[i].old; if (tracks[i].old) { tracks[i].property.expressionEnabled = tracks[i].enabled; } }
            layer.comment = originalComment; throw e;
        }
        // Only remove obsolete controls belonging to the module being replaced.
        if (previous.slots[preset.category]) {
            var oldFields = controlFields(slotPreset(previous.slots[preset.category]));
            for (i = 0; i < oldFields.length; i++) { if (!includes(fields, oldFields[i])) { effect = findEffect(layer, controlName(preset.category, oldFields[i])); if (effect) { effect.remove(); } } }
        }
        for (i = 0; i < oldNatives.length; i++) {
            claimed = false; for (j = 0; j < nextNatives.length; j++) { if (oldNatives[i].name === nextNatives[j].name) { claimed = true; break; } }
            if (!claimed) { effect = findEffect(layer, oldNatives[i].name); if (effect && effect.matchName === oldNatives[i].matchName) { effect.remove(); } }
        }
        if (timing && timing.location !== 'layer' && existing && !existing.locked) {
            existing.name = 'MG · ' + layer.name + ' · ' + preset.name;
        }
        return notice;
    }
    function transformsWithBackup(layer, old) { var fresh = transforms(layer); for (var i = 0; i < fresh.length; i++) { fresh[i].old = old[i].old; fresh[i].enabled = old[i].enabled; } return fresh; }
    function removeUI(layer, category) {
        supportedUI(layer);
        var state = loadState(layer), previous = clone(state), old = state.slots[category], fields, i, effect;
        if (!old) { return 0; }
        var controller = boundController(layer, category, old);
        delete state.slots[category];
        preflightExpressions(layer, state, previous);
        var oldPreset = slotPreset(old), oldNatives = nativeEffectSpecs(oldPreset, old), nativeEffects = [];
        fields = controlFields(oldPreset);
        for (i = 0; i < oldNatives.length; i++) { nativeEffects.push(ownedNativeEffect(layer, oldNatives[i], true)); }
        // Never remove an unrelated effect that happens to use one of our names.
        var effects = layer.property('ADBE Effect Parade'), j, found;
        for (i = 0; i < fields.length; i++) {
            found = 0;
            for (j = 1; j <= effects.numProperties; j++) {
                effect = effects.property(j);
                if (effect.name === controlName(category, fields[i])) {
                    found++;
                    if (effect.matchName !== 'ADBE Slider Control' || found > 1) { fail('控制器名称冲突，保留控件：' + effect.name); }
                }
            }
        }
        var tracks = transforms(layer), originalComment = layer.comment;
        for (i = 0; i < tracks.length; i++) { tracks[i].old = tracks[i].property.expression; tracks[i].enabled = tracks[i].property.expressionEnabled; }
        try {
            rewriteExpressions(layer, state);
            for (i = 0; i < tracks.length; i++) { if (tracks[i].old && tracks[i].property.expression) { tracks[i].property.expressionEnabled = tracks[i].enabled; } }
            saveState(layer, state);
        }
        catch (e) {
            tracks = transformsWithBackup(layer, tracks);
            for (i = 0; i < tracks.length; i++) { tracks[i].property.expression = tracks[i].old; if (tracks[i].old) { tracks[i].property.expressionEnabled = tracks[i].enabled; } }
            layer.comment = originalComment; throw e;
        }
        for (i = 0; i < fields.length; i++) { effect = findEffect(layer, controlName(category, fields[i])); if (effect) { effect.remove(); } }
        for (i = 0; i < oldNatives.length; i++) { effect = findEffect(layer, oldNatives[i].name); if (effect && effect.matchName === oldNatives[i].matchName) { effect.remove(); } }
        if (layerTiming(old)) { removeTimingMarkers(layer, old.timing.key); }
        else if (old.timing) { effect = findEffect(layer, timingName(category)); if (effect && effect.matchName === 'ADBE Layer Control') { effect.remove(); } }
        disposeController(controller);
        return 1;
    }
    function syncDeletedMarkers(comp, force) {
        var result = { ok: true, count: 0, message: '', skipped: [] };
        if (!comp || !(comp instanceof CompItem) || app.isRenderEngine || app.project.renderQueue.rendering) { return result; }
        // Session-only tombstones survive Undo of our cleanup. Never auto-clean the same deletion twice.
        var hub = $.global.MotionGraphicsDeletedMarkerHub;
        if (!hub) { hub = { records: {} }; $.global.MotionGraphicsDeletedMarkerHub = hub; }
        var now = new Date().getTime(), candidates = [], i, j, layer, state, slot, range, id, record;
        for (i = 1; i <= comp.numLayers; i++) {
            layer = comp.layer(i);
            if (!isAV(layer) || (layer.comment || '').indexOf(META_START) < 0) { continue; }
            try {
                state = loadState(layer);
                for (j = 0; j < slots.length; j++) {
                    slot = state.slots[slots[j]];
                    if (!layerTiming(slot) || slot.timing.removeOnDelete !== true) { continue; }
                    id = comp.id + ':' + layer.id + ':' + slot.timing.key;
                    range = timingRange(layer, slots[j], slot);
                    if (!range.missing) { delete hub.records[id]; continue; }
                    record = hub.records[id];
                    if (!record) { record = { since: now, handled: false }; hub.records[id] = record; if (!force) { continue; } }
                    if (!record.handled && (force || now - record.since >= 900)) { candidates.push({ layer: layer, category: slots[j], record: record }); }
                }
            } catch (unreadable) { /* Unknown/damaged metadata is never grounds for deleting content. */ }
        }
        if (!candidates.length) { return result; }
        app.beginUndoGroup('Motion Graphics · 清理已删除标记的动效');
        try {
            for (i = 0; i < candidates.length; i++) {
                var candidate = candidates[i];
                try {
                    result.count += removeUI(candidate.layer, candidate.category); candidate.record.handled = true;
                } catch (e) { result.skipped.push(candidate.layer.name + '：' + e.message); }
            }
        } finally { app.endUndoGroup(); }
        if (result.count) { result.message = '已随标记移除 ' + result.count + ' 项动效。恢复时需依次撤销清理和标记删除。'; }
        else if (result.skipped.length) { result.message = '标记已删除，动效已停止；部分控件暂不能清理。'; }
        return result;
    }
    function readUI(comp, category) {
        var layers = comp.selectedLayers;
        if (layers.length !== 1) { fail('读取参数时请只选择一个图层。'); }
        var layer = sourceFromController(layers[0]), state = loadState(layer), slot = state.slots[category], i, keys, effect;
        if (!slot) { fail('所选图层没有此类动效。'); }
        var params = clone(slot.params); keys = controlFields(slotPreset(slot));
        for (i = 0; i < keys.length; i++) { effect = findEffect(layer, controlName(category, keys[i])); if (effect) { params[keys[i]] = effect.property(1).value; } }
        if (slot.timing && category !== 'loop') { params.duration = timingRange(layer, category, slot).duration; }
        return { ok: true, message: '已读取所选图层参数。', data: { id: slot.id, params: params } };
    }
    // Inspection is read-only. Marker timing overrides legacy timing sliders only for converted slots.
    var RANGE_OWNER = 'MotionGraphics.UIBounds.1';
    function rangeMarker(value) {
        try { return value.getParameters().MotionGraphicsOwner === RANGE_OWNER; } catch (ignored) { return false; }
    }
    function inspectUI(comp, inspectedLayer) {
        var data = { entries: [], count: 0, compId: null, layerId: null, layerName: '', ownedMarkers: 0, markerStale: false };
        if (!comp) { return { ok: true, data: data, message: '请打开合成并单选一个图层。' }; }
        data.count = inspectedLayer ? 1 : comp.selectedLayers.length; data.compId = comp.id;
        if (data.count !== 1) { return { ok: true, data: data, message: '已选 ' + data.count + ' 个图层，请单选查看已用动效。' }; }
        var selectedLayer = inspectedLayer || comp.selectedLayers[0], layer = sourceFromController(selectedLayer), state = loadState(layer), i, j, slot, preset, keys, effect, prop, p, anchor, start, end, dynamic, notes, tracks, required;
        data.selectedLayerId = selectedLayer.id; data.selectedIsController = selectedLayer.id !== layer.id;
        data.layerId = layer.id; data.layerName = layer.name; data.frameDuration = comp.frameDuration;
        data.inPoint = layer.inPoint; data.outPoint = layer.outPoint;
        for (i = 0; i < slots.length; i++) {
            slot = state.slots[slots[i]]; if (!slot) { continue; }
            preset = slotPreset(slot);
            if (!preset || preset.category !== slots[i]) { fail('图层记录包含未知动效，请保留原图层并检查版本。'); }
            p = clone(slot.params); keys = controlFields(preset); dynamic = false; notes = [];
            for (j = 0; j < keys.length; j++) {
                effect = findEffect(layer, controlName(preset.category, keys[j]));
                if (!effect) { notes.push('缺少控制器：' + labels[keys[j]] + '，按已保存值计算'); continue; }
                prop = effect.property(1); p[keys[j]] = prop.valueAtTime(comp.time, false);
                if (!slot.timing && includes(['duration', 'period', 'delay'], keys[j]) && (prop.numKeys > 0 || prop.expressionEnabled)) { dynamic = true; }
            }
            required = channels(slot.id, preset); tracks = transforms(layer);
            for (j = 0; j < tracks.length; j++) {
                if (required.indexOf(tracks[j].channel) < 0) { continue; }
                prop = tracks[j].property;
                if (!own(prop.expression, UI_TAG) || !prop.expressionEnabled || prop.expressionError) { notes.push(prop.name + ' 的插件表达式已关闭、移除或报错'); }
            }
            anchor = p.anchor;
            if (anchor === 'auto') { anchor = 'in'; if (preset.category === 'out') { anchor = 'out'; } else if (preset.category === 'feedback') { anchor = 'playhead'; } }
            start = layer.startTime + Number(slot.origin);
            if (anchor === 'in') { start = layer.inPoint; }
            else if (anchor === 'out') { start = layer.outPoint - Math.max(.001, preset.category === 'loop' ? p.period : p.duration); }
            start += p.delay; end = start + Math.max(.001, p.duration);
            if (preset.category === 'loop') { end = layer.outPoint; }
            var timingInfo = null;
            if (slot.timing) {
                var actualTiming = timingRange(layer, preset.category, slot);
                start = actualTiming.start; end = start + actualTiming.duration;
                if (preset.category !== 'loop') { p.duration = actualTiming.duration; }
                timingInfo = { valid: actualTiming.valid, deleted: actualTiming.missing && slot.timing.removeOnDelete === true, removeOnDelete: slot.timing.removeOnDelete === true,
                    cleanupUndone: actualTiming.cleanupUndone === true,
                    location: layerTiming(slot) ? 'layer' : 'controller', controllerId: null, controllerName: '', shared: false };
                if (actualTiming.controller) {
                    timingInfo.controllerId = actualTiming.controller.id; timingInfo.controllerName = actualTiming.controller.name;
                    timingInfo.shared = controllerUsers(actualTiming.controller) > 1;
                }
                if (!actualTiming.valid) { notes.push(actualTiming.issue); }
                if (timingInfo.shared) { notes.push('复制图层共用旧控制层；点击“迁回原图层”后可单独编辑'); }
            }
            if (!isFinite(start) || !isFinite(end)) { dynamic = true; notes.push('时间参数无效'); }
            var entry = { id: preset.id, category: preset.category, name: preset.name, categoryName: MGCatalog.category(preset.category).name,
                params: p, dynamic: dynamic, notes: notes, timing: timingInfo, range: null, rangeText: '动态时间参数', active: notes.length === 0 };
            if (!dynamic) {
                var visibleStart = Math.max(0, layer.inPoint, start), visibleEnd = Math.min(comp.duration, layer.outPoint, end);
                entry.range = { start: start, end: end, visibleStart: visibleStart, visibleEnd: visibleEnd, visible: visibleEnd > visibleStart + .000001,
                    startFrame: Math.round(start / comp.frameDuration * 100) / 100, endFrame: Math.round(end / comp.frameDuration * 100) / 100 };
                entry.rangeText = entry.range.startFrame + '–' + entry.range.endFrame + ' f';
                if (!entry.range.visible) { entry.rangeText += '（层外）'; }
                if (preset.category === 'loop') { entry.rangeText += ' 循环'; }
                if (slot.timing) { entry.rangeText += layerTiming(slot) ? ' 本层' : ' 控制层'; }
            } else { notes.push('时长、周期或时间偏移含关键帧/表达式，无法确定固定区间'); }
            if (notes.length) { entry.rangeText += ' !'; }
            if (timingInfo && timingInfo.deleted) { entry.range = null; entry.rangeText = '已删除 · 待清理'; entry.active = false; }
            if (timingInfo && timingInfo.cleanupUndone) { entry.rangeText = '已停止 · 待恢复标记'; }
            data.entries.push(entry);
        }
        var markers = layer.property('ADBE Marker'), actual = [], value;
        for (i = 1; markers && i <= markers.numKeys; i++) {
            value = markers.keyValue(i);
            if (rangeMarker(value)) { data.ownedMarkers++; actual.push({ time: markers.keyTime(i), text: value.comment }); }
        }
        var expected = rangeEvents(data, comp);
        if (actual.length) {
            data.markerStale = actual.length !== expected.length;
            for (i = 0; !data.markerStale && i < actual.length; i++) { if (Math.abs(actual[i].time - expected[i].time) > .00001 || actual[i].text !== expected[i].text) { data.markerStale = true; } }
        }
        return { ok: true, data: data, message: layer.name + ' · 已用 ' + data.entries.length + ' 个 UI 动效' };
    }
    function appliedSummary(comp) {
        var data = { selectedCount: 0, layerCount: 0, categories: [], skipped: [] }, selected, layers = [], i, j, layer, duplicate, state, slot, preset, aggregate;
        if (!comp || !(comp instanceof CompItem)) { return { ok: true, data: data, message: '请打开合成并选中图层。' }; }
        selected = comp.selectedLayers; data.selectedCount = selected.length;
        for (i = 0; i < selected.length; i++) {
            try { layer = sourceFromController(selected[i]); } catch (sourceError) { layer = selected[i]; }
            duplicate = false; for (j = 0; j < layers.length; j++) { if (layers[j].id === layer.id) { duplicate = true; } }
            if (!duplicate) { layers.push(layer); }
        }
        data.layerCount = layers.length;
        var grouped = { 'in': null, loop: null, out: null, feedback: null };
        for (i = 0; i < layers.length; i++) {
            layer = layers[i];
            try {
                state = loadState(layer);
                for (j = 0; j < slots.length; j++) {
                    slot = state.slots[slots[j]]; if (!slot) { continue; }
                    preset = slotPreset(slot); if (!preset) { continue; }
                    aggregate = grouped[slots[j]];
                    if (!aggregate) { aggregate = { category: slots[j], categoryName: MGCatalog.category(slots[j]).name, appliedCount: 0, names: {}, ids: {}, targets: {} }; grouped[slots[j]] = aggregate; }
                    aggregate.appliedCount++; aggregate.names[preset.name] = true; aggregate.ids[preset.id] = true; aggregate.targets[preset.user ? 'user' : preset.category] = true;
                }
            } catch (summaryError) { data.skipped.push(layer.name + '：' + (summaryError.message || summaryError)); }
        }
        for (i = 0; i < slots.length; i++) {
            aggregate = grouped[slots[i]]; if (!aggregate) { continue; }
            var names = [], ids = [], targets = [], key;
            for (key in aggregate.names) { if (aggregate.names.hasOwnProperty(key)) { names.push(key); } }
            for (key in aggregate.ids) { if (aggregate.ids.hasOwnProperty(key)) { ids.push(key); } }
            for (key in aggregate.targets) { if (aggregate.targets.hasOwnProperty(key)) { targets.push(key); } }
            data.categories.push({ category: aggregate.category, categoryName: aggregate.categoryName, appliedCount: aggregate.appliedCount, totalCount: data.layerCount,
                name: names.length === 1 ? names[0] : '多个预设', id: ids.length === 1 ? ids[0] : '', mixed: names.length > 1, targetCategory: targets.length === 1 ? targets[0] : aggregate.category });
        }
        return { ok: true, data: data, message: data.layerCount ? '已读取 ' + data.layerCount + ' 个选中图层的动效。' : '请选中图层。' };
    }
    function rangeEvents(data, comp) {
        var events = [], i, j, e, range;
        function add(time, text) {
            for (var n = 0; n < events.length; n++) { if (Math.abs(events[n].time - time) < .00001) { events[n].text += ' / ' + text; return; } }
            events.push({ time: time, text: '[MG] ' + text });
        }
        for (i = 0; i < data.entries.length; i++) {
            e = data.entries[i]; range = e.range; if (e.timing || !range || !range.visible || !e.active) { continue; }
            // Boundary markers can merge at one timestamp without hiding overlapping ranges.
            add(range.visibleStart, e.name + ' 开始' + (range.visibleStart > range.start + .00001 ? '（裁入）' : ''));
            add(range.visibleEnd, e.name + ' 结束' + (range.visibleEnd < range.end - .00001 ? '（裁出）' : ''));
        }
        events.sort(function (a, b) { return a.time - b.time; }); return events;
    }
    function checkTarget(comp, data) {
        if (comp.selectedLayers.length !== 1) { fail('请只选择一个图层。'); }
        var layer = sourceFromController(comp.selectedLayers[0]);
        if ((data.compId !== undefined && data.compId !== comp.id) || (data.layerId !== undefined && data.layerId !== layer.id) || (data.selectedLayerId !== undefined && data.selectedLayerId !== comp.selectedLayers[0].id)) { fail('所选图层已改变，请刷新后重试。'); }
    }
    function writeRangeMarkers(comp, clearOnly, targetLayer, grouped) {
        var layer = targetLayer || sourceFromController(comp.selectedLayers[0]); if (layer.locked) { fail('图层已锁定，未修改时间标记。'); }
        var inspection = inspectUI(comp, layer).data, events = clearOnly ? [] : rangeEvents(inspection, comp), markers = layer.property('ADBE Marker');
        if (!markers) { fail('此图层不支持时间标记。'); }
        var backup = [], desired = [], skipped = [], added = [], i, j, value, conflict;
        for (i = 1; i <= markers.numKeys; i++) { value = markers.keyValue(i); if (rangeMarker(value)) { backup.push({ time: markers.keyTime(i), value: value }); } }
        for (i = 0; i < events.length; i++) {
            conflict = false;
            for (j = 1; j <= markers.numKeys; j++) { if (!rangeMarker(markers.keyValue(j)) && Math.abs(markers.keyTime(j) - events[i].time) < .00001) { conflict = true; break; } }
            if (conflict) { skipped.push(events[i].text + '：此位置已有其他标记，已保留。'); } else { desired.push(events[i]); }
        }
        if (!clearOnly) { for (i = 0; i < inspection.entries.length; i++) { if (!inspection.entries[i].range || !inspection.entries[i].range.visible || !inspection.entries[i].active) { skipped.push(inspection.entries[i].name + '：区间不确定、处于层外或表达式异常，未生成标记。'); } } }
        if (!grouped) { app.beginUndoGroup('Motion Graphics · 时间标记'); }
        try {
            for (i = markers.numKeys; i >= 1; i--) { if (rangeMarker(markers.keyValue(i))) { markers.removeKey(i); } }
            for (i = 0; i < desired.length; i++) {
                value = new MarkerValue(desired[i].text); value.setParameters({ MotionGraphicsOwner: RANGE_OWNER }); value.label = 9;
                markers.setValueAtTime(desired[i].time, value); added.push(desired[i].time);
            }
        } catch (error) {
            for (i = markers.numKeys; i >= 1; i--) { if (rangeMarker(markers.keyValue(i))) { markers.removeKey(i); } }
            for (i = 0; i < backup.length; i++) { markers.setValueAtTime(backup[i].time, backup[i].value); }
            throw error;
        } finally { if (!grouped) { app.endUndoGroup(); } }
        return { ok: true, count: desired.length, skipped: skipped, message: clearOnly ? '已清除本插件生成的时间标记，其他标记保留。' : '已生成 ' + desired.length + ' 个开始/结束标记。直接调整效果控件或裁切后，可在这里刷新。' };
    }
    function syncAppliedRanges(comp, layer, skipped) {
        // A marker warning must not misreport a successfully applied animation as failed.
        try {
            var result = writeRangeMarkers(comp, false, layer, true);
            for (var i = 0; i < result.skipped.length; i++) { skipped.push(layer.name + '：' + result.skipped[i]); }
            return 1;
        } catch (e) { skipped.push(layer.name + '：动效已修改，但起止标记未更新：' + e.message); return 0; }
    }
    function locateUI(comp, data) {
        var entries = inspectUI(comp).data.entries, entry, i;
        for (i = 0; i < entries.length; i++) { if (entries[i].category === data.category) { entry = entries[i]; break; } }
        if (!entry || !entry.range || !entry.range.visible) { fail('没有可定位的固定可见区间。'); }
        var time = entry.range.visibleStart;
        if (data.edge === 'end') { time = Math.max(time, (Math.ceil(entry.range.visibleEnd / comp.frameDuration - .000001) - 1) * comp.frameDuration); }
        comp.time = Math.max(0, Math.min(comp.duration - comp.frameDuration, time));
        return { ok: true, message: '已定位到 ' + entry.name + (data.edge === 'end' ? ' 的末帧。' : ' 的起点。') };
    }
    function timingAction(comp, action, data) {
        var layer = sourceFromController(comp.selectedLayers[0]), previous = loadState(layer), state = clone(previous), slot = state.slots[data.category];
        if (!slot) { fail('所选图层没有该类动效。'); }
        var oldSlot = previous.slots[data.category], preset = slotPreset(slot), range = null, controller = null, i, entry, notice = '', template = null;
        if (slot.timing) { range = timingRange(layer, data.category, slot); controller = range.controller; }
        if (action === 'selectControl' || action === 'selectSource') {
            var selected = layer;
            if (action === 'selectControl') {
                if (!range || !range.valid) { fail('请先启用或修复范围标记。'); }
                selected = range.markerLayer;
            }
            for (i = 1; i <= comp.numLayers; i++) { comp.layer(i).selected = false; }
            selected.selected = true;
            if (action === 'selectControl') {
                var selectedMarkers = selected.property('ADBE Marker');
                for (i = 1; i <= selectedMarkers.numKeys; i++) { selectedMarkers.setSelectedAtKey(i, i === range.markerIndex); }
            }
            return { ok: true, message: action === 'selectControl' ? '已选中范围标记。拖动改起点，拖动边缘改时长；不要与其他标记的起点重合。' : '已返回画面图层。' };
        }
        supportedUI(layer);
        if (oldSlot.timing && !layerTiming(oldSlot)) { checkTimingBinding(layer, data.category, oldSlot); }
        if (action === 'enableTiming' && layerTiming(slot) && range.valid && slot.timing.removeOnDelete === true) { return { ok: true, message: '范围标记已启用删除联动，保留当前起点和时长。' }; }
        var target = layer, desired, migrate = !!(action === 'enableTiming' && oldSlot.timing && !layerTiming(oldSlot));
        if (action === 'setTiming') {
            if (!range || !range.valid) { fail('请先启用或修复范围控制。'); }
            target = range.markerLayer;
            if (target.locked) { fail('标记所在图层已锁定，请解锁后调整。'); }
            if (controller && controllerUsers(controller) > 1) { fail('该范围由复制图层共用，请先点击“迁回原图层”。'); }
            var start = Number(data.start), end = Number(data.end);
            if (String(data.start).replace(/\s/g, '') === '' || String(data.end).replace(/\s/g, '') === '') { fail('请输入范围起点和终点。'); }
            validateTiming(start, end - start); desired = { start: start, duration: end - start };
        } else {
            if (!range) {
                var entries = inspectUI(comp, layer).data.entries;
                for (i = 0; i < entries.length; i++) { if (entries[i].category === data.category) { entry = entries[i]; } }
                if (!entry || !entry.range || !entry.active || entry.dynamic) { fail('此动效的时间参数动态变化或表达式异常，暂不能转换为固定范围标记。'); }
                range = { start: entry.range.start, duration: entry.range.end - entry.range.start };
            }
            desired = { start: range.start, duration: range.duration };
        }
        if (range.valid) { template = range.markerLayer.property('ADBE Marker').keyValue(range.markerIndex); }
        var ignoreKey = '';
        if (oldSlot.timing && !migrate) { ignoreKey = oldSlot.timing.key; }
        var requested = desired.start;
        desired.start = vacantTimingStart(target, desired.start, ignoreKey); validateTiming(desired.start, desired.duration);
        notice = timingShiftNotice(layer, requested, desired.start);
        if (action === 'setTiming' && !layerTiming(oldSlot)) { slot.timing.start = desired.start; slot.timing.duration = desired.duration; }
        else { slot.timing = onLayerTiming(layer, desired, ignoreKey); }
        preflightExpressions(layer, state, previous);
        var tracks = transforms(layer), originalComment = layer.comment, binding = null, oldBinding = null, removedBinding = false;
        var backup = snapshotMarkers(target), selectedLayers = comp.selectedLayers;
        if (migrate) { binding = findEffect(layer, timingName(data.category)); if (binding) { oldBinding = binding.property(1).value; } }
        for (i = 0; i < tracks.length; i++) { tracks[i].old = tracks[i].property.expression; tracks[i].enabled = tracks[i].property.expressionEnabled; }
        app.beginUndoGroup('Motion Graphics · 原图层范围');
        try {
            try {
                putTimingMarker(target, preset, slot.timing, template);
                rewriteExpressions(layer, state); saveState(layer, state);
                if (migrate && binding) { removedBinding = true; binding.remove(); }
            } catch (error) {
                restoreMarkers(target, backup);
                if (removedBinding && !findEffect(layer, timingName(data.category))) {
                    binding = layer.property('ADBE Effect Parade').addProperty('ADBE Layer Control'); binding.name = timingName(data.category); binding.property(1).setValue(oldBinding);
                }
                tracks = transformsWithBackup(layer, tracks);
                for (i = 0; i < tracks.length; i++) { tracks[i].property.expression = tracks[i].old; if (tracks[i].old) { tracks[i].property.expressionEnabled = tracks[i].enabled; } }
                layer.comment = originalComment; throw error;
            }
            // Cleanup happens after a successful conversion; preserve content we cannot safely own.
            if (migrate && controller) { try { disposeController(controller); } catch (keepHelper) { /* Keep the legacy helper. */ } }
            if (action === 'enableTiming') {
                var legacyMarkers = layer.property('ADBE Marker'), hasLegacy = false;
                for (i = 1; i <= legacyMarkers.numKeys; i++) { if (rangeMarker(legacyMarkers.keyValue(i))) { hasLegacy = true; } }
                if (hasLegacy) { try { writeRangeMarkers(comp, false, layer, true); } catch (keepLegacy) { /* Inspection reports stale snapshots. */ } }
            }
        } finally {
            for (i = 1; i <= comp.numLayers; i++) { comp.layer(i).selected = false; }
            if (action === 'enableTiming') { layer.selected = true; }
            else { for (i = 0; i < selectedLayers.length; i++) { try { selectedLayers[i].selected = true; } catch (removedHelper) { layer.selected = true; } } }
            app.endUndoGroup();
        }
        var message = '已启用原图层范围及删除联动。拖动改时间，删除标记移除动效。';
        if (migrate) { message = '已将范围标记迁回原图层；无其他用途的旧控制层已清理。'; }
        if (action === 'setTiming') { message = '已设置范围，动画立即跟随；画面图层入点和出点未改变。'; }
        if (notice) { message += '\n' + notice; }
        return { ok: true, count: 1, message: message };
    }
    function upgradeTiming(comp) {
        var original = comp.selectedLayers, sources = [], jobs = [], skipped = [], notices = [], count = 0, i, j, layer, state, slot, range, exists;
        for (i = 0; i < original.length; i++) {
            try {
                layer = sourceFromController(original[i]); exists = false;
                for (j = 0; j < sources.length; j++) { if (sources[j].id === layer.id) { exists = true; } }
                if (!exists) { sources.push(layer); }
            } catch (e) { skipped.push(original[i].name + '：' + e.message); }
        }
        for (i = 0; i < sources.length; i++) {
            layer = sources[i];
            try {
                state = loadState(layer);
                for (j = 0; j < slots.length; j++) {
                    slot = state.slots[slots[j]]; if (!slot) { continue; }
                    if (layerTiming(slot) && slot.timing.removeOnDelete === true) {
                        range = timingRange(layer, slots[j], slot);
                        // Never resurrect a marker the user intentionally deleted, including undone cleanup.
                        if (range.valid || range.missing) { continue; }
                    }
                    jobs.push({ layer: layer, category: slots[j] });
                }
            } catch (e) { skipped.push(layer.name + '：' + e.message); }
        }
        if (jobs.length) {
            app.beginUndoGroup('Motion Graphics · 旧动效升级/修复');
            try {
                for (i = 0; i < jobs.length; i++) {
                    layer = jobs[i].layer;
                    try {
                        for (j = 1; j <= comp.numLayers; j++) { comp.layer(j).selected = false; }
                        layer.selected = true;
                        var result = timingAction(comp, 'enableTiming', { category: jobs[i].category }); count += result.count || 0;
                        if (result.message.indexOf('顺延') >= 0) { notices.push(result.message); }
                    } catch (e) { skipped.push(layer.name + '：' + e.message); }
                }
            } finally {
                for (i = 1; i <= comp.numLayers; i++) { comp.layer(i).selected = false; }
                for (i = 0; i < original.length; i++) { try { original[i].selected = true; } catch (removedHelper) { /* Select its source below if needed. */ } }
                if (!comp.selectedLayers.length) { for (i = 0; i < sources.length; i++) { try { sources[i].selected = true; } catch (gone) { /* Keep other selections. */ } } }
                app.endUndoGroup();
            }
        }
        return { ok: skipped.length === 0 || count > 0, count: count, skipped: skipped,
            message: (count ? '已升级/修复 ' + count + ' 项动效：时间由原图层范围标记控制，删除标记移除动效。' : '没有需要升级/修复的旧动效；已删除的范围不会被重新创建。') + (notices.length ? '\n' + notices.join('\n') : '') };
    }
    function collectProperties(layer, remove) {
        var chosen = layer.selectedProperties, roots = [], leaves = [], result = [], i;
        for (i = 0; i < chosen.length; i++) { if (chosen[i].propertyType === PropertyType.PROPERTY) { leaves.push(chosen[i]); } else { roots.push(chosen[i]); } }
        if (leaves.length) { roots = leaves; } else if (!roots.length) { roots = [layer]; }
        function walk(p) {
            var j;
            if (p.propertyType === PropertyType.PROPERTY) {
                if (p.canSetExpression && (remove ? own(p.expression, KEY_TAG) : p.numKeys >= 2) && !includes(result, p)) { result.push(p); }
            } else { for (j = 1; j <= p.numProperties; j++) { walk(p.property(j)); } }
        }
        for (i = 0; i < roots.length; i++) { walk(roots[i]); } return result;
    }
    function keyLoop(layer, mode, remove, skipped) {
        if (layer.locked) { fail('图层已锁定。'); }
        var props = collectProperties(layer, remove), i, prop, old, enabled, count = 0, supported;
        for (i = 0; i < props.length; i++) {
            prop = props[i];
            if (remove) { prop.expression = ''; count++; continue; }
            supported = includes([PropertyValueType.OneD, PropertyValueType.TwoD, PropertyValueType.TwoD_SPATIAL, PropertyValueType.ThreeD, PropertyValueType.ThreeD_SPATIAL, PropertyValueType.COLOR], prop.propertyValueType);
            if (!supported) { skipped.push(layer.name + ' / ' + prop.name + '：不支持此属性类型。'); continue; }
            if (prop.expression && !own(prop.expression, KEY_TAG)) { skipped.push(layer.name + ' / ' + prop.name + '：已有表达式，已保留。'); continue; }
            old = prop.expression; enabled = prop.expressionEnabled;
            try {
                prop.expression = KEY_TAG + 'loopOut(' + JSON.stringify(mode) + ',0);';
                if (prop.expressionError) { fail(prop.expressionError); } count++;
            } catch (e) { prop.expression = old; if (old) { prop.expressionEnabled = enabled; } skipped.push(layer.name + ' / ' + prop.name + '：循环失败。'); }
        }
        if (!count && !props.length) { fail(remove ? '没有本插件添加的关键帧循环。' : '未找到至少有两个关键帧的可循环属性。'); }
        return count;
    }
    function layerLoop(layer, preset, comp) {
        if (layer.locked) { fail('图层已锁定。'); }
        if (!(layer instanceof AVLayer) || !layer.canSetTimeRemapEnabled) { fail('图层循环仅支持视频或预合成；图片、形状、文字需先预合成。'); }
        if (layer.stretch <= 0) { fail('暂不支持反向拉伸图层，请先预合成。'); }
        var mode = preset.id === 'layerloop-pingpong' ? 'pingpong' : 'cycle', existing = false, remap, oldExpression = '', oldOut = layer.outPoint;
        var begin = layer.inPoint, end = layer.outPoint, period, sourceIn, sourceOut, sourceLast, origin = begin - layer.startTime, match;
        if (layer.timeRemapEnabled) {
            remap = layer.property('ADBE Time Remapping');
            if (!own(remap.expression, LAYER_TAG)) { fail('已有时间重映射，已保留；请先预合成再循环。'); }
            var currentMode = remap.expression.indexOf('// Mode:pingpong') >= 0 ? 'pingpong' : 'cycle';
            if (currentMode === mode) { return 0; }
            existing = true; oldExpression = remap.expression; match = /var d=([\d.eE+\-]+)/.exec(oldExpression);
            period = match ? Number(match[1]) : remap.keyTime(remap.numKeys) - begin; end = begin + period;
        } else { period = end - begin; }
        if (period < comp.frameDuration - .000001) { fail('片段长度至少为一帧。'); }
        if (mode === 'pingpong' && period < comp.frameDuration * 2 - .000001) { fail('往返循环的片段长度至少为两帧。'); }
        try {
            if (!existing) { layer.timeRemapEnabled = true; remap = layer.property('ADBE Time Remapping'); }
            sourceIn = remap.valueAtTime(begin, true); sourceOut = remap.valueAtTime(end, true);
            if (sourceOut <= sourceIn) { fail('当前片段没有有效的源时间范围。'); }
            if (mode === 'pingpong') {
                sourceLast = remap.valueAtTime(end - comp.frameDuration, true);
                if (sourceLast <= sourceIn) { fail('往返循环没有足够的可见源帧。'); }
                remap.expression = LAYER_TAG + '// Mode:pingpong\nvar d=' + period + ',fd=thisComp.frameDuration,leg=Math.max(fd,d-fd),t=time-(startTime+' + origin + ');\nvar q=((t%(2*leg))+2*leg)%(2*leg),u=q<=leg?q:2*leg-q;\n' + sourceIn + '+u/leg*' + (sourceLast - sourceIn) + ';';
            } else {
                // Map the original half-open [in,out) interval. Never sample the empty endpoint frame.
                remap.expression = LAYER_TAG + '// Mode:cycle\nvar d=' + period + ',t=time-(startTime+' + origin + ');\nvar u=((t%d)+d)%d;\n' + sourceIn + '+u/d*' + (sourceOut - sourceIn) + ';';
            }
            if (remap.expressionError) { fail(remap.expressionError); }
            layer.inPoint = begin; layer.outPoint = comp.duration + comp.displayStartTime;
        } catch (e) {
            if (existing) { remap.expression = oldExpression; layer.outPoint = oldOut; }
            else { layer.timeRemapEnabled = false; layer.inPoint = begin; layer.outPoint = end; }
            throw e;
        }
        return 1;
    }
    function moveLayers(layers, preset, params, comp, skipped) {
        var ordered = [], i, earliest = Infinity, latest = -Infinity;
        for (i = 0; i < layers.length; i++) {
            if (controllerKey(layers[i])) { continue; }
            if (layers[i].locked) { skipped.push(layers[i].name + '：图层已锁定。'); }
            else { ordered.push(layers[i]); earliest = Math.min(earliest, layers[i].inPoint); latest = Math.max(latest, layers[i].outPoint); }
        }
        if (ordered.length < 2) { fail('请至少选择两个未锁定图层。'); }
        ordered.sort(function(a, b) { return a.index - b.index; });
        if (preset.id === 'stagger-reverse') { ordered.reverse(); }
        if (preset.id === 'stagger-random') {
            var seed = params.seed, j, tmp;
            for (i = ordered.length - 1; i > 0; i--) { seed = (seed * 1664525 + 1013904223) % 4294967296; j = Math.floor(seed / 4294967296 * (i + 1)); tmp = ordered[i]; ordered[i] = ordered[j]; ordered[j] = tmp; }
        }
        var moves = [], target, cursor = ordered[0].inPoint;
        for (i = 0; i < ordered.length; i++) {
            if (preset.id === 'align-sequence') {
                target = ordered[i].startTime + cursor - ordered[i].inPoint;
                cursor += ordered[i].outPoint - ordered[i].inPoint;
            }
            else { target = ordered[i].startTime + earliest - ordered[i].inPoint + (preset.category === 'stagger' ? i * params.frames * comp.frameDuration : 0); }
            if (target < -10800 || target > 10800) { fail('移动超出 AE 时间范围，未执行。'); }
            moves.push({ layer: ordered[i], old: ordered[i].startTime, value: target });
        }
        var contentMoves = moves.length, state, category, controller, helperTarget, seenHelpers = [], n;
        for (i = 0; i < contentMoves; i++) {
            state = loadState(moves[i].layer);
            for (n = 0; n < slots.length; n++) {
                category = slots[n]; if (!state.slots[category] || !state.slots[category].timing || layerTiming(state.slots[category])) { continue; }
                controller = boundController(moves[i].layer, category, state.slots[category]);
                if (!controller) { fail('范围控制层丢失，请先修复后再移动图层。'); }
                if (controllerUsers(controller) > 1) { fail('有复制图层共用旧控制层，请先使用“帮助 → 旧动效升级/修复”。'); }
                if (controller.locked) { fail('范围控制层已锁定，请解锁后再移动图层。'); }
                if (includes(seenHelpers, controller.id)) { continue; } seenHelpers.push(controller.id);
                helperTarget = controller.startTime + moves[i].value - moves[i].old;
                if (helperTarget < -10800 || helperTarget > 10800) { fail('范围控制层移动超出 AE 时间范围，未执行。'); }
                moves.push({ layer: controller, old: controller.startTime, value: helperTarget });
            }
        }
        try { for (i = 0; i < moves.length; i++) { moves[i].layer.startTime = moves[i].value; } }
        catch (e) { for (i = 0; i < moves.length; i++) { moves[i].layer.startTime = moves[i].old; } throw e; }
        return contentMoves;
    }
    function identityNull(comp, parent, threeD, name, duration) {
        var n = comp.layers.addNull(duration); n.name = name; n.label = 9; n.threeDLayer = threeD;
        var t = n.property('ADBE Transform Group'), zero = threeD ? [0, 0, 0] : [0, 0];
        t.property('ADBE Anchor Point').setValue(zero); t.property('ADBE Position').setValue(zero);
        // Identity local transform preserves every child keyframe and expression at all times.
        n.setParentWithJump(parent); return n;
    }
    function parentLayers(layers, preset, comp) {
        var i, old = [], created = [], common = layers[0].parent, threeD = layers[0].threeDLayer;
        for (i = 0; i < layers.length; i++) {
            if (layers[i].locked) { fail(layers[i].name + '：图层已锁定，绑定未执行。'); }
            if (!isAV(layers[i])) { fail('暂不支持为摄像机或灯光绑定空对象。'); }
            if (preset.id === 'parent-group' && (layers[i].parent !== common || layers[i].threeDLayer !== threeD)) { fail('同组图层需要相同父级及相同 2D/3D 类型；可使用“分别绑定空对象”。'); }
            old.push({ layer: layers[i], parent: layers[i].parent });
        }
        try {
            if (preset.id === 'parent-group') {
                created.push(identityNull(comp, common, threeD, 'MG · 图层组', comp.duration));
                for (i = 0; i < old.length; i++) { old[i].layer.setParentWithJump(created[0]); }
            } else {
                for (i = 0; i < old.length; i++) {
                    created.push(identityNull(comp, old[i].parent, old[i].layer.threeDLayer, 'MG · ' + old[i].layer.name, comp.duration));
                    old[i].layer.setParentWithJump(created[created.length - 1]);
                }
            }
        } catch (e) {
            for (i = 0; i < old.length; i++) { old[i].layer.setParentWithJump(old[i].parent); }
            for (i = created.length - 1; i >= 0; i--) { created[i].remove(); } throw e;
        }
        // addNull changes the layer selection; restore the user's original selection.
        for (i = 1; i <= comp.numLayers; i++) { comp.layer(i).selected = false; }
        for (i = 0; i < old.length; i++) { old[i].layer.selected = true; }
        return old.length;
    }
    function run(request, comp) {
        var action = request.action, data = request.data || {}, i, layer, preset, params, count = 0, skipped = [], notices = [], layers, changed, markersUpdated = 0;
        if (action === 'status') { return { ok: true, data: { version: app.version, compatibility: MGCompatibility.current(), comp: comp ? comp.name : '', count: comp ? comp.selectedLayers.length : 0 } }; }
        MGCompatibility.requireSupported();
        if (typeof MGAIHost !== 'undefined' && MGAIHost.handles(action)) { return MGAIHost.run(action, data, comp); }
        if (typeof MGTemplateHost !== 'undefined' && MGTemplateHost.handles(action)) { return MGTemplateHost.run(action, data, comp); }
        if (typeof MGAssetHost !== 'undefined' && MGAssetHost.handles(action)) { return MGAssetHost.run(action, data, comp); }
        if (typeof MGCompositionTools !== 'undefined' && MGCompositionTools.handles(action)) { return MGCompositionTools.run(action, data, comp); }
        if (typeof MGExpressionHost !== 'undefined' && MGExpressionHost.handles(action)) { return MGExpressionHost.run(action, data); }
        if (typeof MGPreRendering !== 'undefined' && MGPreRendering.handles(action)) { return MGPreRendering.run(action, data); }
        if (action === 'appliedSummary') { return appliedSummary(comp); }
        if (action === 'chooseUserPresetFolder') { return chooseUserRoot(); }
        setUserRoot(data);
        if (action === 'listUserPresets') { return listUserPresets(); }
        if (action === 'deleteUserPreset') { return deleteUserPreset(data); }
        if (action === 'exportUserPreset') { return exportUserPreset(data); }
        if (action === 'revealUserPresetFolder') { return revealUserPresetFolder(); }
        if (action === 'inspect') { return inspectUI(comp); }
        if (action === 'syncDeletedMarkers') { return syncDeletedMarkers(comp, data.force === true); }
        if (!comp || !(comp instanceof CompItem)) { fail('请先打开一个合成。'); }
        if (action === 'captureUserPreset') { return captureUserPreset(comp, data); }
        layers = comp.selectedLayers;
        if (!layers.length) { fail('请先在合成中选中图层。'); }
        if (action === 'upgradeTiming') { return upgradeTiming(comp); }
        if (includes(['read', 'locate', 'markRanges', 'clearRanges', 'enableTiming', 'setTiming', 'selectControl', 'selectSource'], action)) { checkTarget(comp, data); }
        if (action === 'read') { return readUI(comp, data.category); }
        if (action === 'locate') { return locateUI(comp, data); }
        if (action === 'markRanges' || action === 'clearRanges') { return writeRangeMarkers(comp, action === 'clearRanges'); }
        if (includes(['enableTiming', 'setTiming', 'selectControl', 'selectSource'], action)) { return timingAction(comp, action, data); }
        if (action !== 'apply' && action !== 'remove') { fail('未知操作。'); }
        var requestedSeconds = null;
        if (action === 'apply') { preset = findPreset(data.id); if (!preset) { fail('未知预设。'); } params = normalized(preset, data.params); if(preset.type==='ui') { requestedSeconds=requestedDuration(data,preset,comp); } }
        if (action === 'remove' && !includes(slots.concat(['keyloop']), data.category)) { fail('此工具不支持直接移除，请使用 AE 撤销。'); }
        var originalSelection = comp.selectedLayers, mapped = [], j;
        if ((preset && preset.type === 'ui') || (action === 'remove' && data.category !== 'keyloop')) {
            for (i = 0; i < layers.length; i++) {
                layer = sourceFromController(layers[i]);
                var duplicate = false; for (j = 0; j < mapped.length; j++) { if (mapped[j].id === layer.id) { duplicate = true; } }
                if (!duplicate) { mapped.push(layer); }
            }
            layers = mapped;
        }
        app.beginUndoGroup('Motion Graphics · ' + (preset ? preset.name : '移除动效'));
        try {
            if (preset && (preset.category === 'stagger' || preset.category === 'align')) { count = moveLayers(layers, preset, params, comp, skipped); }
            else if (preset && preset.category === 'parent') { count = parentLayers(layers, preset, comp); }
            else {
                for (i = 0; i < layers.length; i++) {
                    layer = layers[i];
                    try {
                        if (action === 'remove') {
                            changed = data.category === 'keyloop' ? keyLoop(layer, '', true, skipped) : removeUI(layer, data.category); count += changed;
                            if (changed && data.category !== 'keyloop' && data.autoMarkers === true) { markersUpdated += syncAppliedRanges(comp, layer, skipped); }
                        }
                        else if (preset.type === 'ui') {
                            if(requestedSeconds!==null){var priorDurationSlot=loadState(layer).slots[preset.category];if(priorDurationSlot&&priorDurationSlot.timing&&!layerTiming(priorDurationSlot))fail('请先升级旧控制层动效，再使用前置时长。');}
                            var notice = updateUI(layer, preset, clone(params), comp, data.markerTiming === true, data.reuseExisting === true);
                            var durationNotice = applyRequestedDuration(layer,preset,requestedSeconds); if(durationNotice) { notices.push(durationNotice); } count++;
                            if (notice) { notices.push(notice); }
                            if (data.autoMarkers === true) { markersUpdated += syncAppliedRanges(comp, layer, skipped); }
                        }
                        else if (preset.category === 'keyloop') { count += keyLoop(layer, preset.id.substring(8), false, skipped); }
                        else if (preset.category === 'layerloop') { count += layerLoop(layer, preset, comp); }
                    } catch (e) { skipped.push(layer.name + '：' + e.message); }
                }
            }
        } finally {
            for (i = 1; i <= comp.numLayers; i++) { comp.layer(i).selected = false; }
            for (i = 0; i < originalSelection.length; i++) { try { originalSelection[i].selected = true; } catch (removedControl) { /* Its UI module was removed. */ } }
            app.endUndoGroup();
        }
        var emptyClear = action === 'remove' && data.allowEmpty === true && !skipped.length;
        var result = { ok: count > 0 || emptyClear, count: count, message: count ? (action === 'remove' ? '已移除 ' : '已完成 ') + count + ((preset && preset.category === 'keyloop') || data.category === 'keyloop' ? ' 个属性' : ' 个图层') + (skipped.length ? '，有项目被跳过。' : '。') : (emptyClear ? '选中图层没有可清除的本类动效。' : '没有修改任何图层。' + (!skipped.length ? '未找到可移除的动效，或图层已处于循环状态。' : '')), skipped: skipped };
        if (markersUpdated) { result.message += '起止标记已同步；冲突项保留原标记。'; }
        if (count && preset && preset.type === 'ui' && data.markerTiming) { result.message += '参数在效果控件调整；旧动效可通过帮助升级。'; }
        if (notices.length) { result.message += '\n' + notices.join('\n'); }
        return result;
    }
    function dispatch(raw) {
        try {
            var request = JSON.parse(raw), comp = app.project ? app.project.activeItem : null;
            if (!(comp instanceof CompItem)) { comp = null; }
            return JSON.stringify(run(request, comp));
        } catch (e) { return JSON.stringify({ ok: false, message: e.message || String(e) }); }
    }
    return { dispatch: dispatch, run: run, version: '2.8.0' };
}());
// CEP may evaluate this file inside a short-lived evalScript function scope.
// Keep the host (and its AI session closure) alive across separate calls.
$.global.MG2023Host = MG2023Host;
