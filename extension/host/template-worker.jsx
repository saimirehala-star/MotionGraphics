/* Runs only in a separate After Effects instance. The live user project is never opened here. */
app.exitCode = 91;
app.exitAfterLaunchAndEval = true;
(function () {
    var extensionRoot = File($.fileName).parent.parent;
    $.evalFile(File(extensionRoot.fsName + '/vendor/json2.js'));
    var jobFile = File($.global.MGTemplateJobFile || ''), job = null, statusFile = null, opened = false, destination = null;
    function fail(message) { throw new Error(message); }
    function readText(file) { file.encoding = 'UTF-8'; if (!file.exists || !file.open('r')) { fail('无法读取文件：' + file.fsName); } var text = file.read(); file.close(); return text; }
    function writeText(file, text) { file.encoding = 'UTF-8'; file.lineFeed = 'Unix'; if (!file.open('w')) { fail('无法写入：' + file.fsName); } var ok = file.write(text); file.close(); if (!ok) { fail('写入失败：' + file.fsName); } }
    function writeJSON(file, data) {
        var temp = File(file.fsName + '.tmp'); if (temp.exists) { temp.remove(); } writeText(temp, JSON.stringify(data, null, 2));
        if (file.exists && !file.remove()) { temp.remove(); fail('无法更新任务状态。'); }
        if (!temp.rename(file.name)) { temp.remove(); fail('无法完成任务状态。'); }
    }
    function checkCancelled(){if(job && File(job.staging+'.cancelled').exists)fail('用户已终止模版保存。');}
    function status(state, progress, message, extra) {
        if(state!=='error')checkCancelled();
        if (!statusFile) { return; } var data = { schemaVersion: 2, id: job.id, state: state, progress: progress, message: message }, key;
        if (extra) { for (key in extra) { if (extra.hasOwnProperty(key)) { data[key] = extra[key]; } } }
        writeJSON(statusFile, data);
    }
    function ensureFolder(folder, label) { if (!folder.exists && !folder.create()) { fail('无法创建' + label + '：' + folder.fsName); } return folder; }
    function removeTree(folder) { if (!folder || !folder.exists) { return; } var entries = folder.getFiles(), i; for (i = 0; i < entries.length; i++) { if (entries[i] instanceof Folder) { removeTree(entries[i]); } else { entries[i].remove(); } } folder.remove(); }
    function findComp(id, name) {
        var fallback = null, i, item;
        for (i = 1; i <= app.project.numItems; i++) { item = app.project.item(i); if (item instanceof CompItem) { if (item.id === id) { return item; } if (!fallback && item.name === name) { fallback = item; } } }
        return fallback;
    }
    function findItemByName(name, type) {
        var i, item; for (i = 1; i <= app.project.numItems; i++) { item = app.project.item(i); if (item.name === name && ((!type) || item instanceof type)) { return item; } } return null;
    }
    function walkProperties(group, callback) {
        var i, property; if (!group || group.propertyType === PropertyType.PROPERTY) { if (group) { callback(group); } return; }
        for (i = 1; i <= group.numProperties; i++) { property = group.property(i); if (property.propertyType === PropertyType.PROPERTY) { callback(property); } else { walkProperties(property, callback); } }
    }
    function dependencyItems(rootComp, warnings) {
        var keep = [rootComp], seenComp = {}, scanned = {}, dynamicWarnings = {}, cursor = 0, i, layer, source, expression, match, referenced;
        seenComp[rootComp.id] = true;
        function addComp(comp) { if (comp && !seenComp[comp.id]) { seenComp[comp.id] = true; keep.push(comp); } }
        function addItem(item) { if (!item) { return; } for (var n = 0; n < keep.length; n++) { if (keep[n].id === item.id) { return; } } keep.push(item); }
        while (cursor < keep.length) {
            var current = keep[cursor++]; if (!(current instanceof CompItem) || scanned[current.id]) { continue; } scanned[current.id] = true;
            for (i = 1; i <= current.numLayers; i++) {
                layer = current.layer(i); source = layer.source; if (source instanceof CompItem) { addComp(source); }
                walkProperties(layer, function (candidate) {
                    if (!candidate.canSetExpression || !candidate.expression) { return; }
                    expression = candidate.expression;
                    var compRegex = /\bcomp\s*\(\s*(["'])([^"']+)\1\s*\)/g, footageRegex = /\bfootage\s*\(\s*(["'])([^"']+)\1\s*\)/g, literalCount = 0;
                    while ((match = compRegex.exec(expression)) !== null) { literalCount++; referenced = findItemByName(match[2], CompItem); if (referenced) { addComp(referenced); } else { warnings.push(current.name + ' / ' + layer.name + '：表达式引用的合成不存在：' + match[2]); } }
                    while ((match = footageRegex.exec(expression)) !== null) { literalCount++; referenced = findItemByName(match[2], FootageItem); if (referenced) { addItem(referenced); } else { warnings.push(current.name + ' / ' + layer.name + '：表达式引用的素材不存在：' + match[2]); } }
                    if ((/\bcomp\s*\(/.test(expression) || /\bfootage\s*\(/.test(expression)) && !literalCount && !dynamicWarnings[current.id + '-' + layer.id]) { dynamicWarnings[current.id + '-' + layer.id] = true; warnings.push(current.name + ' / ' + layer.name + '：动态表达式依赖无法自动识别，请导入后检查。'); }
                });
            }
        }
        return keep;
    }
    function extension(file) { var match = /\.([^.]+)$/.exec(file.name); return match ? match[1].toLowerCase() : ''; }
    function imageExtension(file) { return /^(png|jpg|jpeg|exr|tif|tiff|tga|dpx|cin|bmp|webp)$/.test(extension(file)); }
    function sequenceMembers(file) {
        var match = /^(.*?)(\d+)(\.[^.]+)$/.exec(file.name), output = [], entries, i, itemMatch;
        if (!match) { return output; } entries = file.parent.getFiles();
        for (i = 0; i < entries.length; i++) { if (!(entries[i] instanceof File)) { continue; } itemMatch = /^(.*?)(\d+)(\.[^.]+)$/.exec(entries[i].name); if (itemMatch && itemMatch[1] === match[1] && itemMatch[2].length === match[2].length && itemMatch[3].toLowerCase() === match[3].toLowerCase()) { output.push(entries[i]); } }
        output.sort(function (a, b) { var am = /([0-9]+)(\.[^.]+)$/.exec(a.name), bm = /([0-9]+)(\.[^.]+)$/.exec(b.name); return Number(am[1]) - Number(bm[1]); }); return output;
    }
    function pathKey(file, sequence) { return file.fsName.replace(/\//g, '\\').toLowerCase() + (sequence ? '|sequence' : '|file'); }
    function copyOne(source, destinationFile, totals) { if (!source.exists) { fail('源文件不存在：' + source.fsName); } if (!source.copy(destinationFile.fsName)) { fail('无法复制素材：' + source.fsName + ' · ' + source.error); } totals.fileCount++; totals.bytes += source.length; }
    function collectSource(sourceObject, resources, totals, warnings, label) {
        var source = sourceObject && sourceObject.file ? sourceObject.file : null;
        if (!source || !source.exists) { warnings.push(label + '：源素材缺失，模版中会保留占位状态。'); return; }
        var sequence = !sourceObject.isStill && imageExtension(source), key = pathKey(source, sequence), existing = totals.byPath[key], members, folder, target, i, selectedTarget = null, folderKey, mapping;
        totals.itemReferences++;
        if (existing) { existing.references++; return; }
        if (sequence) {
            folderKey = source.parent.fsName.replace(/\//g, '\\').toLowerCase(); mapping = totals.sequenceFolders[folderKey];
            if (!mapping) {
                folder = ensureFolder(Folder(resources.fsName + '/asset-' + String(totals.assets.length + 1)), '素材目录');
                mapping = { sourcePath: source.parent.fsName, destinationPath: folder.fsName, sequence: true, references: 0 };
                totals.sequenceFolders[folderKey] = mapping; totals.assets.push(mapping);
            } else { folder = Folder(mapping.destinationPath); }
            members = sequenceMembers(source); if (!members.length) { fail('无法识别图片序列：' + source.fsName); }
            for (i = 0; i < members.length; i++) { target = File(folder.fsName + '/' + members[i].name); if (!target.exists) { copyOne(members[i], target, totals); } if (members[i].name === source.name) { selectedTarget = target; } }
            if (!selectedTarget) { fail('图片序列当前帧未找到：' + source.name); } totals.sequenceCount++;
        } else {
            folder = ensureFolder(Folder(resources.fsName + '/asset-' + String(totals.assets.length + 1)), '素材目录');
            selectedTarget = File(folder.fsName + '/' + source.name); copyOne(source, selectedTarget, totals);
            mapping = { sourcePath: source.fsName, destinationPath: selectedTarget.fsName, sequence: false, references: 0 }; totals.assets.push(mapping);
        }
        totals.logicalAssets++; mapping.references++; totals.byPath[key] = { mapping: mapping, references: 1 };
    }
    function collectResources(resources, warnings) {
        var totals = { fileCount: 0, bytes: 0, sequenceCount: 0, itemReferences: 0, logicalAssets: 0, assets: [], byPath: {}, sequenceFolders: {} }, i, item;
        for (i = 1; i <= app.project.numItems; i++) { item = app.project.item(i); if (item instanceof FootageItem && item.file) { collectSource(item.mainSource, resources, totals, warnings, item.name); } }
        for (i = 1; i <= app.project.numItems; i++) { item = app.project.item(i); if ((item instanceof FootageItem || item instanceof CompItem) && item.useProxy && item.proxySource && item.proxySource.file) { collectSource(item.proxySource, resources, totals, warnings, item.name + '（代理）'); } }
        return totals;
    }
    function xmlEscape(value) { return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;'); }
    function replaceAll(text, source, destinationPath) { var parts = text.split(source); return { text: parts.join(destinationPath), count: parts.length - 1 }; }
    function rebaseAepx(sourceFile, destinationFile, assets, warnings) {
        var xml = readText(sourceFile), i, source, destinationPath, changed, total = 0;
        for (i = 0; i < assets.length; i++) {
            source = 'fullpath="' + xmlEscape(assets[i].sourcePath) + '"'; destinationPath = 'fullpath="' + xmlEscape(assets[i].destinationPath) + '"'; changed = replaceAll(xml, source, destinationPath);
            if (!changed.count) { changed = replaceAll(xml, source.replace(/\\/g, '/'), destinationPath.replace(/\\/g, '/')); }
            xml = changed.text; total += changed.count; if (!changed.count) { warnings.push('工程路径没有找到对应素材引用：' + assets[i].sourcePath); }
        }
        writeText(destinationFile, xml); return total;
    }
    function waitForStableFile(file, timeout) {
        var until = new Date().getTime() + timeout, last = -1, stable = 0, size;
        while (new Date().getTime() < until) { size = file.exists ? file.length : 0; if (size > 0 && size === last) { stable++; if (stable >= 4) { return true; } } else { stable = 0; last = size; } $.sleep(250); }
        return file.exists && file.length > 0;
    }
    function clampPreviewTime(comp, time) {
        var end = comp.duration - comp.frameDuration;
        return Math.max(0, Math.min(Number(time), end));
    }
    function addPreviewCandidate(candidates, comp, time) {
        var value = clampPreviewTime(comp, time), i;
        if (!isFinite(value)) { return; }
        for (i = 0; i < candidates.length; i++) { if (Math.abs(candidates[i] - value) < comp.frameDuration * .5) { return; } }
        candidates.push(value);
    }
    function mostActiveLayerTime(comp) {
        var start = 0, end = comp.duration - comp.frameDuration, points = [], i, j, layer, from, to, score, bestScore = -1, best = comp.duration * .5;
        for (i = 1; i <= comp.numLayers; i++) {
            layer = comp.layer(i); if (!layer.enabled || !layer.hasVideo || layer.nullLayer) { continue; }
            from = Math.max(start, layer.inPoint); to = Math.min(end, layer.outPoint - comp.frameDuration);
            if (to < from) { continue; } points.push(from + (to - from) * .5); points.push(from);
        }
        for (i = 0; i < points.length; i++) {
            score = 0;
            for (j = 1; j <= comp.numLayers; j++) { layer = comp.layer(j); if (layer.enabled && layer.hasVideo && !layer.nullLayer && points[i] >= layer.inPoint && points[i] < layer.outPoint) { score++; } }
            if (score > bestScore) { bestScore = score; best = points[i]; }
        }
        return best;
    }
    function readBinary(file) {
        file.encoding = 'BINARY'; if (!file.open('r')) { fail('无法读取 PNG：' + file.fsName); } var data = file.read(); file.close(); return data;
    }
    function pngImageData(file) {
        var data = readBinary(file), offset = 8, chunks = [], length, type;
        function pngByte(position) { return data.charCodeAt(position) & 255; }
        while (offset + 12 <= data.length) {
            length = pngByte(offset) * 16777216 + pngByte(offset + 1) * 65536 + pngByte(offset + 2) * 256 + pngByte(offset + 3); type = data.substr(offset + 4, 4);
            if (length < 0 || offset + 12 + length > data.length) { return null; }
            if (type === 'IDAT') { chunks.push(data.substr(offset + 8, length)); }
            offset += 12 + length; if (type === 'IEND') { break; }
        }
        return chunks.length ? chunks.join('') : null;
    }
    function previewHasVisiblePixels(file, blankFile, warnings) {
        try { var imageData = pngImageData(file), blankData = pngImageData(blankFile); return imageData === null || blankData === null ? null : imageData !== blankData; }
        catch (error) { warnings.push('静帧透明度检测失败：' + (error.message || error)); return null; }
    }
    function renderBlankPreview(comp, factor, file) {
        var blank = null;
        try {
            blank = app.project.items.addComp('__MG_PREVIEW_BLANK__', comp.width, comp.height, comp.pixelAspect, 1, 1); blank.bgColor = comp.bgColor; blank.resolutionFactor = [factor, factor];
            if (file.exists) { file.remove(); } blank.saveFrameToPng(0, file); return waitForStableFile(file, 300000);
        } finally { try { if (blank) { blank.remove(); } } catch (removeBlankError) {} }
    }
    function renderPreview(comp, requestedTime, preview, warnings) {
        var originalResolution = comp.resolutionFactor, factor = Math.max(1, Math.min(16, Math.ceil(Math.max(comp.width, comp.height) / 720))), candidates = [], start = 0, blankFile = File(preview.parent.fsName + '/preview-blank.png'), i, candidate, visible, selected = null;
        addPreviewCandidate(candidates, comp, requestedTime);
        addPreviewCandidate(candidates, comp, mostActiveLayerTime(comp));
        if (comp.workAreaDuration > 0) { addPreviewCandidate(candidates, comp, comp.workAreaStart + comp.workAreaDuration * .5); }
        addPreviewCandidate(candidates, comp, start + comp.duration * .5);
        addPreviewCandidate(candidates, comp, start + comp.duration * .25);
        addPreviewCandidate(candidates, comp, start + comp.duration * .75);
        try {
            if (!renderBlankPreview(comp, factor, blankFile)) { warnings.push('无法生成透明度对照帧，将仅检查预览文件是否存在。'); }
            comp.resolutionFactor = [factor, factor];
            for (i = 0; i < candidates.length; i++) {
                candidate = File(preview.parent.fsName + '/preview-candidate-' + String(i + 1) + '.png'); if (candidate.exists) { candidate.remove(); }
                if (typeof comp.saveFrameToPng !== 'function') { break; }
                comp.saveFrameToPng(candidates[i], candidate); if (!waitForStableFile(candidate, 300000)) { if (candidate.exists) { candidate.remove(); } continue; }
                visible = blankFile.exists ? previewHasVisiblePixels(candidate, blankFile, warnings) : null;
                if (visible === true || (visible === null && i === 0)) { selected = { file: candidate, time: candidates[i], fallback: i > 0, visibilityKnown: visible !== null }; break; }
                candidate.remove();
            }
        } catch (error) { warnings.push('静帧预览生成失败：' + (error.message || error)); }
        finally { try { comp.resolutionFactor = originalResolution; } catch (ignored) {} try { if (blankFile.exists) { blankFile.remove(); } } catch (removeBlankFileError) {} }
        if (!selected) { warnings.push('合成中没有检测到可见画面，模版卡片将显示默认图标。'); return { ready: false, time: clampPreviewTime(comp, requestedTime), fallback: false }; }
        if (preview.exists) { preview.remove(); }
        if (!selected.file.copy(preview.fsName)) { warnings.push('静帧已生成，但无法完成本机预览文件。'); selected.file.remove(); return { ready: false, time: selected.time, fallback: selected.fallback }; }
        selected.file.remove();
        if (selected.fallback) { warnings.push('当前时间头画面完全透明，静帧预览已自动选择有可见内容的时间。'); }
        return { ready: true, time: selected.time, fallback: selected.fallback };
    }
    function verifyRelink(resources) {
        var prefix = resources.fsName.toLowerCase() + '\\', i, item, file;
        for (i = 1; i <= app.project.numItems; i++) { item = app.project.item(i); if (item instanceof FootageItem && item.file && item.file.exists) { file = item.file.fsName.toLowerCase(); if (file.indexOf(prefix) !== 0) { fail('素材未重定向到模版目录：' + item.name); } } }
    }
    try {
        if (!jobFile.exists) { fail('没有找到合成模版任务。'); }
        job = JSON.parse(readText(jobFile)); if (!job || Number(job.schemaVersion) !== 2 || !/^tpl-[a-z0-9-]{6,80}$/.test(job.id)) { fail('合成模版任务格式无效。'); }
        statusFile = File(job.statusFile); destination = Folder(job.destination); if (destination.exists) { fail('团队模版目标目录已存在。'); }
        status('opening', 8, '正在本地打开工程副本…'); if (!File(job.sourceProject).exists) { fail('工程副本不存在。'); }
        if (job.sourceAEVersion && String(job.sourceAEVersion) !== String(app.version)) { fail('后台 AE 版本与发起任务的 AE 不一致，已停止保存。'); }
        app.open(File(job.sourceProject)); opened = true;
        var comp = findComp(Number(job.compId), String(job.compName || '')); if (!comp) { fail('工程副本中没有找到目标合成：' + job.compName); }
        var warnings = [], keep = dependencyItems(comp, warnings); status('reducing', 18, '正在剔除非本合成资源…'); app.project.reduceProject(keep);
        comp = findComp(Number(job.compId), String(job.compName || '')); if (!comp) { fail('精简工程后主合成丢失。'); }
        var templateTag = '[MotionGraphicsTemplate:' + job.id + ']'; if (String(comp.comment || '').indexOf(templateTag) < 0) { comp.comment = String(comp.comment || '') + '\n' + templateTag; }
        var preview = File(job.staging + '/preview.png'), requestedPreviewTime = clampPreviewTime(comp, Number(job.previewTime));
        status('preview', 28, '正在本地查找可见的静帧预览…'); var previewResult = renderPreview(comp, requestedPreviewTime, preview, warnings), previewReady = previewResult.ready, previewTime = previewResult.time;
        var workingAepx = File(job.staging + '/working.aepx'); status('savingXml', 42, '正在保存关系安全的工程副本…'); app.project.save(workingAepx); app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); opened = false;

        if (!destination.create()) { fail('无法创建团队模版目录：' + destination.fsName); }
        var resources = ensureFolder(Folder(destination.fsName + '/Resources'), '团队素材目录');
        status('collecting', 53, '正在去重并复制使用中的素材…');
        app.open(workingAepx); opened = true; comp = findComp(Number(job.compId), String(job.compName || '')); if (!comp) { fail('工程副本中没有找到主合成。'); }
        var totals = collectResources(resources, warnings); app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); opened = false;

        var portableAepx = File(job.staging + '/portable.aepx'); status('rebasing', 74, '正在保留 PSD/AI 图层关系并更新素材路径…');
        var referenceCount = rebaseAepx(workingAepx, portableAepx, totals.assets, warnings); app.open(portableAepx); opened = true;
        comp = findComp(Number(job.compId), String(job.compName || '')); if (!comp) { fail('路径更新后主合成丢失。'); } verifyRelink(resources);
        var templateFile = File(destination.fsName + '/template.aep'); status('saving', 84, '正在保存最终模版工程…'); app.project.save(templateFile);
        var manifest = {
            schemaVersion: 2, id: job.id, name: job.name, category: job.category || '未分类', description: job.description || '', createdAt: job.createdAt, createdAtEpoch: Number(job.createdAtEpoch || 0), aeVersion: app.version,
            mainCompName: comp.name, width: comp.width, height: comp.height, duration: comp.duration, frameRate: comp.frameRate,
            displayStartTime: comp.displayStartTime, requestedPreviewTime: requestedPreviewTime, requestedPreviewDisplayTime: requestedPreviewTime + comp.displayStartTime, previewTime: previewTime, previewDisplayTime: previewTime + comp.displayStartTime, previewFallback: !!previewResult.fallback, preview: previewReady ? 'preview.png' : '', project: 'template.aep', resourceFolder: 'Resources',
            resourceCount: totals.fileCount, resourceBytes: totals.bytes, uniqueAssetCount: totals.logicalAssets, sourceItemCount: totals.itemReferences,
            duplicateReferencesRemoved: Math.max(0, totals.itemReferences - totals.logicalAssets), sequenceCount: totals.sequenceCount, rebasedReferenceCount: referenceCount, warnings: warnings
        };
        app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); opened = false;
        if (previewReady && !preview.copy(File(destination.fsName + '/preview.png').fsName)) { warnings.push('静帧已生成，但无法复制到团队模版目录。'); manifest.preview = ''; }
        checkCancelled(); writeJSON(File(destination.fsName + '/manifest.json'), manifest); checkCancelled(); writeText(File(destination.fsName + '/ready'), 'Motion Graphics Template ' + job.id + '\n');
        status('done', 100, '合成模版“' + job.name + '”已保存。', { templateId: job.id, warnings: warnings, resourceCount: totals.fileCount, resourceBytes: totals.bytes, uniqueAssetCount: totals.logicalAssets, duplicateReferencesRemoved: manifest.duplicateReferencesRemoved });
        try { removeTree(Folder(job.staging)); } catch (cleanupWarning) { /* The finished shared package is already complete. */ }
        app.exitCode = 0;
    } catch (error) {
        try { status('error', 100, '合成模版保存失败：' + (error.message || error), { line: error.line || 0 }); } catch (statusError) { /* No writable status path. */ }
        try { if (opened && app.project) { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } } catch (closeError) {}
        try { if (destination && destination.exists && !File(destination.fsName + '/ready').exists) { removeTree(destination); } } catch (destinationError) {}
        try { if (job && job.staging) { removeTree(Folder(job.staging)); } } catch (cleanupError) {}
        app.exitCode = 92;
    }
}());
