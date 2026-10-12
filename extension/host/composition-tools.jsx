/* AE 2023 composition tools. Never remove the source project composition. */
var MGCompositionTools = (function () {
    var tag = 'MGExtractedCompMarkers';
    function fail(s) { throw new Error(s); }
    function props(group, fn) {
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i); if (!p) { continue; }
            if (p.propertyType === PropertyType.PROPERTY) { fn(p); }
            else { props(p, fn); }
        }
    }
    function selected(comp) {
        if (!(comp instanceof CompItem)) { fail('请先打开主合成并选中预合成图层。'); }
        var a = comp.selectedLayers, result = [];
        for (var i = 0; i < a.length; i++) { if (a[i].source instanceof CompItem) { result.push(a[i]); } }
        if (!result.length) { fail('请在时间线选中一个或多个预合成图层。'); }
        return result;
    }
    function markerCopy(v) {
        var n = new MarkerValue(v.comment), fields = ['chapter','url','frameTarget','cuePointName','eventCuePoint','duration','label','protectedRegion'];
        for (var i = 0; i < fields.length; i++) { try { n[fields[i]] = v[fields[i]]; } catch (_) {} }
        n.setParameters(v.getParameters()); return n;
    }
    function markersSnapshot(p) { var a = []; for (var i = 1; i <= p.numKeys; i++) { a.push({time:p.keyTime(i),value:markerCopy(p.keyValue(i))}); } return a; }
    function markersRestore(p, a) { for (var i = p.numKeys; i >= 1; i--) { p.removeKey(i); } for (i = 0; i < a.length; i++) { p.setValueAtTime(a[i].time,a[i].value); } }
    function markerPlan(layer) {
        if (layer.locked) { fail(layer.name + '：请先解锁图层。'); }
        if (layer.timeRemapEnabled) { fail(layer.name + '：时间重映射/循环片段暂不支持标记提取。'); }
        var source = layer.source.markerProperty, scale = layer.stretch / 100, result = [], i;
        for (i = 1; i <= source.numKeys; i++) {
            var v = markerCopy(source.keyValue(i)), a = layer.startTime + source.keyTime(i) * scale, b = a + v.duration * scale;
            var start = Math.min(a,b), end = Math.max(a,b);
            if (v.duration === 0) { if (start < layer.inPoint || start >= layer.outPoint) { continue; } }
            else { start = Math.max(start,layer.inPoint); end = Math.min(end,layer.outPoint); if (end <= start) { continue; } }
            v.duration = Math.max(0,end-start); var parameters = v.getParameters(); parameters[tag] = String(layer.id); v.setParameters(parameters);
            result.push({time:start,value:v});
        }
        return result;
    }
    function extractMarkers(comp) {
        var layers = selected(comp), plans = [], backups = [], count = 0, conflicts = [], i, j, track;
        for (i = 0; i < layers.length; i++) { plans.push(markerPlan(layers[i])); backups.push(markersSnapshot(layers[i].property('ADBE Marker'))); }
        app.beginUndoGroup('Motion Graphics · 标记提取');
        try {
            for (i = 0; i < layers.length; i++) {
                track = layers[i].property('ADBE Marker');
                for (j = track.numKeys; j >= 1; j--) { if (track.keyValue(j).getParameters()[tag] !== undefined) { track.removeKey(j); } }
                for (j = 0; j < plans[i].length; j++) {
                    var m = plans[i][j], occupied = false;
                    for (var k = 1; k <= track.numKeys; k++) { if (Math.abs(track.keyTime(k)-m.time) < 0.00001) { occupied = true; break; } }
                    if (occupied) { conflicts.push(layers[i].name + '：' + m.time.toFixed(3) + ' 秒已有标记，已跳过。'); }
                    else { track.setValueAtTime(m.time,m.value); count++; }
                }
            }
        } catch (e) { for (i = 0; i < layers.length; i++) { markersRestore(layers[i].property('ADBE Marker'),backups[i]); } throw e; }
        finally { app.endUndoGroup(); }
        return {ok:true,message:'已提取 / 更新 '+count+' 个标记。'+(conflicts.length?' '+conflicts.length+' 个时间冲突已跳过。':''),skipped:conflicts};
    }
    function allComps() { var a = []; for (var i = 1; i <= app.project.numItems; i++) { var x = app.project.item(i); if (x instanceof CompItem) { a.push(x); } } return a; }
    function named(comps,name) { var found=null; for (var i=0;i<comps.length;i++) { if(comps[i].name===name){if(found)fail('表达式引用的合成重名：'+name+'。请先消除歧义。');found=comps[i];} } if(!found)fail('表达式引用的合成不存在：'+name);return found; }
    function references(expression, comps, rewrite) {
        var re = /\bcomp\s*\(\s*(["'])([^"'\\\r\n]*)\1\s*\)/g;
        var stripped = expression.replace(re,'');
        if (/\bcomp\s*\(/.test(stripped)) { fail('表达式使用动态合成名称，无法保证脱钩。请改为 comp("固定名称") 后重试。'); }
        return expression.replace(re,function(match,quote,name){return rewrite(named(comps,name),match);});
    }
    function dependencies(root,comps) {
        var map={},list=[];
        function visit(c) {
            if(map[c.id])return;map[c.id]=true;list.push(c);if(list.length>1000)fail('依赖合成超过 1000 个，请拆分后复制。');
            for(var i=1;i<=c.numLayers;i++) {
                var l=c.layer(i),ep=l.essentialProperty;
                if(ep&&ep.numProperties)fail(c.name+' / '+l.name+'：包含基本属性覆盖，第一版不能保证引用脱钩。');
                if(l.source instanceof CompItem)visit(l.source);
                props(l,function(p){if(p.canSetExpression&&p.expression){references(p.expression,comps,function(ref,match){visit(ref);return match;});}});
            }
        }
        visit(root);return list;
    }
    function uniqueName(base,used) { var name=base,n=2;while(used[name]){name=base+' '+n++;}used[name]=true;return name; }
    function detachedCopy() {
        var selection=app.project.selection,roots=[],comps=allComps(),plans=[],used={},created=[],outputs=[],i,j;
        for(i=0;i<comps.length;i++)used[comps[i].name]=true;
        for(i=0;i<selection.length;i++)if(selection[i] instanceof CompItem)roots.push(selection[i]);
        if(!roots.length)fail('请在项目面板选中一个或多个合成。');
        for(i=0;i<roots.length;i++)plans.push(dependencies(roots[i],comps));
        app.beginUndoGroup('Motion Graphics · 脱钩复制');
        try{
            for(i=0;i<roots.length;i++){
                var folder=app.project.items.addFolder(uniqueName(roots[i].name+' · 独立副本',used));created.push(folder);
                var map={},solids={},plan=plans[i];
                for(j=0;j<plan.length;j++){var copy=plan[j].duplicate();created.push(copy);copy.name=uniqueName(plan[j].name+' · 副本',used);copy.parentFolder=folder;map[plan[j].id]=copy;}
                for(j=0;j<plan.length;j++){
                    var original=plan[j],fresh=map[original.id];
                    for(var k=1;k<=original.numLayers;k++){
                        var old=original.layer(k),layer=fresh.layer(k),src=old.source;
                        layer.locked=false;
                        if(src instanceof CompItem){layer.replaceSource(map[src.id],false);layer.name=old.name;}
                        else if(src instanceof FootageItem && src.mainSource instanceof SolidSource && !old.nullLayer){
                            if(!solids[src.id]){var helper=fresh.layers.addSolid(src.mainSource.color,src.name+' · 副本',src.width,src.height,src.pixelAspect,Math.max(1,fresh.duration));var solid=helper.source;created.push(solid);solid.parentFolder=folder;helper.remove();solids[src.id]=solid;}
                            layer.replaceSource(solids[src.id],false);layer.name=old.name;
                        }
                        props(layer,function(p){if(p.canSetExpression&&p.expression){var enabled=p.expressionEnabled;var rewritten=references(p.expression,comps,function(ref){return 'comp('+JSON.stringify(map[ref.id].name)+')';});if(rewritten!==p.expression){p.expression=rewritten;p.expressionEnabled=enabled;if(enabled&&p.expressionError)fail('复制后的表达式验证失败：'+p.expressionError);}}});
                        layer.locked=old.locked;
                    }
                }
                outputs.push(map[roots[i].id]);
            }
            for(i=1;i<=app.project.numItems;i++)app.project.item(i).selected=false;
            for(i=0;i<outputs.length;i++)outputs[i].selected=true;
        }catch(e){for(i=created.length-1;i>=0;i--){try{created[i].remove();}catch(_){}}throw e;}
        finally{app.endUndoGroup();}
        return {ok:true,message:'已生成 '+outputs.length+' 套独立合成副本。图片、视频仍引用原磁盘素材。'};
    }
    function extract(comp,data) {
        var layers=selected(comp),created=[],saved=[],i,j,keep=data.keepBackup!==false;
        for(i=0;i<layers.length;i++){
            if(!layers[i].source.numLayers)fail(layers[i].name+'：内部没有图层。');
            saved.push({name:layers[i].name,enabled:layers[i].enabled,audio:layers[i].audioEnabled,locked:layers[i].locked});
        }
        app.beginUndoGroup('Motion Graphics · 合成提取');
        try {
            for(i=0;i<layers.length;i++) {
                var outer=layers[i],source=outer.source,copies=[],map={};
                for(j=source.numLayers;j>=1;j--){
                    source.layer(j).copyToComp(comp);
                    var copy=comp.layer(1);created.push(copy);copies.unshift(copy);map[j]=copy;
                }
                for(j=0;j<copies.length;j++){
                    var src=source.layer(j+1),dst=copies[j],factor=outer.stretch/100;
                    dst.locked=false;dst.moveBefore(outer);
                    dst.stretch=src.stretch*factor;dst.startTime=outer.startTime+src.startTime*factor;
                    var a=outer.startTime+src.inPoint*factor,b=outer.startTime+src.outPoint*factor;
                    var start=Math.max(Math.min(a,b),outer.inPoint),end=Math.min(Math.max(a,b),outer.outPoint);
                    if(end>start){dst.inPoint=start;dst.outPoint=end;}
                    else {dst.enabled=false;if(dst instanceof AVLayer && dst.hasAudio)dst.audioEnabled=false;dst.inPoint=outer.inPoint;dst.outPoint=outer.outPoint;}
                    dst.setParentWithJump(src.parent?map[src.parent.index]:null);
                    dst.locked=src.locked;
                }
            }
            for(i=0;i<layers.length;i++){
                var original=layers[i];original.locked=false;
                if(keep){
                    // Do not set solo: AE can reject solo writes on disabled layers.
                    original.enabled=false;if(original.hasAudio)original.audioEnabled=false;
                    original.name=saved[i].name+' · 提取前备份';original.locked=true;
                }else original.remove();
            }
        }catch(e){
            for(i=0;i<layers.length;i++){try{var l=layers[i],v=saved[i];l.locked=false;l.name=v.name;l.enabled=v.enabled;if(l.hasAudio)l.audioEnabled=v.audio;l.locked=v.locked;}catch(_){}}
            for(i=created.length-1;i>=0;i--){try{created[i].locked=false;created[i].remove();}catch(_){}}
            throw e;
        }finally{app.endUndoGroup();}
        return {ok:true,message:'已提取 '+layers.length+' 个子合成的内部图层。'+(keep?'原子合成层已关闭并锁定保留。':'原子合成层已移除。')+'项目中的源合成保留。'};
    }
    function run(action,data,comp){if(action==='compositionDetach')return detachedCopy();if(action==='compositionMarkers')return extractMarkers(comp);return extract(comp,data||{});}
    return {handles:function(a){return /^(compositionExtract|compositionDetach|compositionMarkers)$/.test(a);},run:run,markerPlan:markerPlan,references:references};
}());
