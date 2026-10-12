var MGAssetHost = (function () {
    function run(action, data, comp) {
        var selected, paths = [], i;
        if (action === 'assetChooseFiles') {
            selected = File.openDialog('选择素材；序列帧选择任意一帧', '*.*', true);
            if (selected) { for (i = 0; i < selected.length; i++) { paths.push(selected[i].fsName); } }
            return {ok:true, data:{paths:paths}};
        }
        if (action === 'assetChooseFolder') {
            selected = Folder.selectDialog('选择素材库目录（不会迁移旧库）');
            return {ok:true, data:{path:selected ? selected.fsName : ''}};
        }
        if (action === 'assetReveal') {
            selected = Folder(data.path);
            if (!selected.exists) { throw new Error('目录不存在或共享盘未连接。'); }
            selected.execute(); return {ok:true};
        }
        if (!(comp instanceof CompItem)) { throw new Error('请先打开要添加素材的合成。'); }
        if (action === 'assetTarget') { return {ok:true,data:{compId:comp.id,time:comp.time}}; }
        if (data.targetCompId !== undefined && comp.id !== data.targetCompId) { throw new Error('当前合成已切换，请在目标合成中重新点击添加。'); }
        var file = File(data.path), item = null, layer, options, time = data.targetTime !== undefined ? Number(data.targetTime) : comp.time;
        if (!isFinite(time)) { throw new Error('素材添加时间无效。'); }
        if (!file.exists) { throw new Error('素材文件不存在，请检查素材库目录。'); }
        app.beginUndoGroup('Motion Graphics · 添加素材');
        try {
            if (!data.sequence && !data.psd) {
                for (i = 1; i <= app.project.numItems; i++) {
                    selected = app.project.item(i);
                    if (selected instanceof FootageItem && selected.file && selected.file.fsName === file.fsName) { item = selected; break; }
                }
            }
            if (!item) {
                options = new ImportOptions(file);
                if (data.sequence) { options.sequence = true; options.forceAlphabetical = false; }
                if (data.psd && data.psdMode === 'layers') {
                    if (!options.canImportAs(ImportAsType.COMP_CROPPED_LAYERS)) { throw new Error('此 PSD 无法按保留图层模式导入。'); }
                    options.importAs = ImportAsType.COMP_CROPPED_LAYERS;
                } else if (options.canImportAs(ImportAsType.FOOTAGE)) { options.importAs = ImportAsType.FOOTAGE; }
                item = app.project.importFile(options);
                if (data.sequence && item instanceof FootageItem) {
                    if (!(Number(data.fps) >= 1 && Number(data.fps) <= 120)) { throw new Error('序列帧率无效。'); }
                    item.mainSource.conformFrameRate = Number(data.fps);
                }
            }
            layer = comp.layers.add(item); layer.name = data.name || item.name;
            layer.startTime = time;
            if (item instanceof FootageItem && item.mainSource.isStill) { layer.outPoint = comp.duration; }
            comp.openInViewer();
            return {ok:true, message:'已添加到合成当前时间头。'};
        } finally { app.endUndoGroup(); }
    }
    return {handles:function (action) { return /^asset(ChooseFiles|ChooseFolder|Reveal|Target|Add)$/.test(action); }, run:run};
}());
