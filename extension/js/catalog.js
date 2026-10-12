/* Shared catalog. Keep syntax compatible with ExtendScript. */
var MGReferenceCatalog = typeof MGReferencePresets !== 'undefined' ? MGReferencePresets : (typeof module !== 'undefined' && module.exports ? require('./reference-presets.js') : { list: [] });
var MGCatalog = (function () {
    var categories = [
        { id: 'in', panel: 'ui', name: '入场动画', en: 'ENTRANCE', hint: '让每一次出现，都恰到好处。', symbol: 'enter' },
        { id: 'loop', panel: 'ui', name: '循环动画', en: 'LOOP', hint: '给静止的界面，一点持续的生命力。', symbol: 'loop' },
        { id: 'out', panel: 'ui', name: '出场动画', en: 'EXIT', hint: '自然收尾，留下流畅的节奏。', symbol: 'exit' },
        { id: 'feedback', panel: 'ui', name: '交互反馈', en: 'FEEDBACK', hint: '让每一次交互，都得到回应。', symbol: 'cursor' },
        { id: 'stagger', panel: 'tools', name: '错帧排列', en: 'STAGGER', hint: '用简单的时间间隔，组织多层节奏。', symbol: 'stagger' },
        { id: 'keyloop', panel: 'tools', name: '关键帧循环', en: 'KEYFRAME LOOP', hint: '让已有关键帧，继续循环播放。', symbol: 'diamond' },
        { id: 'layerloop', panel: 'tools', name: '图层循环', en: 'LAYER LOOP', hint: '重复当前片段，延长画面。', symbol: 'film' },
        { id: 'parent', panel: 'tools', name: '空对象绑定', en: 'PARENT', hint: '建立清晰、方便控制的图层关系。', symbol: 'parent' },
        { id: 'align', panel: 'tools', name: '图层对齐', en: 'ALIGN', hint: '统一时间边界，整理时间线。', symbol: 'align' },
        { id: 'expressions', panel: 'tools', name: '表达式', en: 'EXPRESSIONS', hint: '整理团队常用表达式，查看说明并一键复制。', symbol: 'code' },
        { id: 'composition', panel: 'tools', name: '合成操作', en: 'COMPOSITIONS', hint: '提取：选时间线预合成；脱钩复制：选项目面板合成；标记提取：选时间线预合成。', symbol: 'layers' }
    ];
    var presets = [];
    function add(id, category, name, en, desc, fields, defaults) {
        presets.push({ id: id, category: category, name: name, en: en, desc: desc, fields: fields, defaults: defaults || {}, type: categoriesById(category).panel });
    }
    function categoriesById(id) { for (var i = 0; i < categories.length; i++) { if (categories[i].id === id) { return categories[i]; } } }
    add('in-fade', 'in', '淡入', 'FADE IN', '从透明到清晰，轻盈地进入画面。', ['duration']);
    add('in-slide', 'in', '滑入', 'SLIDE IN', '沿指定方向滑入，并同时淡入。', ['duration', 'direction', 'distance']);
    for (var referenceIndex = 0; referenceIndex < MGReferenceCatalog.list.length; referenceIndex++) {
        var reference = MGReferenceCatalog.list[referenceIndex];
        if (reference.category !== 'in') { continue; }
        add(reference.id, 'in', reference.name, reference.en, '来自参考工程“' + reference.name + '”；范围标记控制整体速度，原生效果参数可在效果控件调整。', ['duration'], { duration: reference.duration });
        presets[presets.length - 1].template = reference; presets[presets.length - 1].version = reference.version;
    }
    add('in-scale', 'in', '缩放进入', 'SCALE IN', '围绕图层现有锚点，从小到大展开。', ['duration']);
    add('in-elastic', 'in', '弹性进入', 'SPRING IN', '快速展开后回弹，适合卡片与弹窗。', ['duration', 'elastic'], { duration: 0.8 });
    add('in-rotate', 'in', '旋转进入', 'ROTATE IN', '旋转、缩放与透明度一起过渡。', ['duration', 'angle'], { angle: -30 });
    add('loop-breathe', 'loop', '呼吸', 'BREATHE', '缓慢放大并回到原尺寸。幅度单位为 %。', ['period', 'amount'], { amount: 6 });
    add('loop-float', 'loop', '漂浮', 'FLOAT', '柔和地上下浮动。幅度单位为像素。', ['period', 'amount'], { amount: 20 });
    add('loop-sway', 'loop', '摇摆', 'SWAY', '围绕现有锚点左右摇摆。幅度单位为度。', ['period', 'amount'], { amount: 8 });
    add('loop-spin', 'loop', '持续旋转', 'SPIN', '以恒定速度持续旋转，负角度为反向。', ['period', 'angle'], { angle: 360 });
    add('loop-blink', 'loop', '闪烁', 'BLINK', '透明度周期变化。幅度 100% 时可完全透明。', ['period', 'amount'], { amount: 85, period: 1.2 });
    add('out-fade', 'out', '淡出', 'FADE OUT', '从清晰到透明，平滑结束。', ['duration']);
    add('out-slide', 'out', '滑出', 'SLIDE OUT', '向指定方向移动，并同时淡出。', ['duration', 'direction', 'distance']);
    for (referenceIndex = 0; referenceIndex < MGReferenceCatalog.list.length; referenceIndex++) {
        reference = MGReferenceCatalog.list[referenceIndex];
        if (reference.category !== 'out') { continue; }
        add(reference.id, 'out', reference.name, reference.en, '来自出场参考工程“' + reference.name + '”；范围标记控制整体速度，原生效果参数可在效果控件调整。', ['duration'], { duration: reference.duration });
        presets[presets.length - 1].template = reference; presets[presets.length - 1].version = reference.version;
    }
    add('out-scale', 'out', '缩小消失', 'SCALE OUT', '围绕现有锚点，缩小至消失。', ['duration']);
    add('out-elastic', 'out', '弹性退出', 'SPRING OUT', '短暂回弹后收起，适合弹窗与提示。', ['duration', 'elastic'], { duration: 0.8 });
    add('out-rotate', 'out', '旋转退出', 'ROTATE OUT', '旋转并轻微缩小，逐渐离开画面。', ['duration', 'angle'], { angle: 30 });
    add('feedback-press', 'feedback', '点击按压', 'PRESS', '短暂缩小后恢复，模拟按钮按下。', ['duration', 'amount'], { duration: 0.3, amount: 12 });
    add('feedback-rebound', 'feedback', '回弹', 'REBOUND', '缩小后弹回原尺寸，增加触感。', ['duration', 'amount', 'elastic'], { amount: 20 });
    add('feedback-shake', 'feedback', '错误抖动', 'SHAKE', '快速左右抖动后停止，用于错误提示。', ['duration', 'amount', 'frequency'], { amount: 25 });
    add('feedback-bounce', 'feedback', '强调跳动', 'BOUNCE', '连续向上跳动并逐次衰减。幅度单位为像素。', ['duration', 'amount'], { amount: 55, duration: 0.8 });
    add('feedback-pop', 'feedback', '放大强调', 'POP', '短暂放大后复原，突出重要元素。', ['duration', 'amount'], { amount: 20 });
    add('stagger-forward', 'stagger', '顺序错帧', 'FORWARD', '按时间线上到下排列，让各层入点依次间隔指定帧数。移动整个图层。', ['frames'], { frames: 3 });
    add('stagger-reverse', 'stagger', '反向错帧', 'REVERSE', '按时间线下到上排列，移动整个图层，保留各层内部动画。', ['frames'], { frames: 3 });
    add('stagger-random', 'stagger', '随机错帧', 'SHUFFLE', '按固定种子打乱顺序，再按间隔排列；相同种子可复现。', ['frames', 'seed'], { frames: 3 });
    add('keyloop-cycle', 'keyloop', '重复循环', 'CYCLE', '循环选中属性的全部关键帧；仅选图层时查找其有关键帧的属性。', []);
    add('keyloop-pingpong', 'keyloop', '往返循环', 'PING PONG', '在最后一帧后反向播放，然后继续往返。', []);
    add('keyloop-offset', 'keyloop', '偏移循环', 'OFFSET', '每轮叠加首尾差值，适合持续位移或旋转。', []);
    add('layerloop-cycle', 'layerloop', '图层重复', 'REPEAT LAYER', '通过时间重映射重复当前裁切片段，并延长到合成末尾。仅视频和预合成；保留图层原有变换动画。', []);
    add('layerloop-pingpong', 'layerloop', '图层往返', 'PING PONG LAYER', '原片段正向播放到最后一个可见帧，再反向返回开头并持续往返。可与重复循环互相切换。', []);
    add('parent-group', 'parent', '绑定同一空对象', 'GROUP NULL', '创建一个空对象，统一控制选中图层；已有不同父级或混合 2D/3D 时会提示。', []);
    add('parent-each', 'parent', '分别绑定空对象', 'EACH NULL', '为每个图层创建独立空对象，插入原父级关系，保留原有变换。', []);
    add('align-in', 'align', '起点对齐', 'ALIGN START', '把所有选中图层的入点移到最早入点，整体移动，不裁切内容。', []);
    add('align-sequence', 'align', '首尾相接', 'SEQUENCE', '按时间线上到下顺序，让后一图层紧接前一图层；以最上方图层入点开始，保留各层时长。', []);
    add('composition-extract','composition','合成提取','UNPACK','展开常规二维预合成，保留源合成；复杂效果、表达式、遮罩关系等会停止并说明原因。',[]);
    add('composition-detach','composition','脱钩复制','DEEP COPY','选中项目面板合成，递归复制嵌套与固定名称表达式依赖；各顶层副本独立，磁盘素材共用。',[]);
    add('composition-markers','composition','标记提取','MARKERS','把内部合成标记显示到预合成图层，保留已有标记；再次点击更新，时间冲突跳过。',[]);
    var builtInCount = presets.length;
    var base = { duration: 0.6, distance: 120, direction: 4, elastic: 0.5, amount: 15, stretch: 55, angle: 30, period: 2, frequency: 4, frames: 3, seed: 17, delay: 0, anchor: 'auto' };
    function find(id) { for (var i = 0; i < presets.length; i++) { if (presets[i].id === id) { return presets[i]; } } return null; }
    function defaults(id) { var p = find(id), result = {}, k; for (k in base) { if (base.hasOwnProperty(k)) { result[k] = base[k]; } } if (p) { for (k in p.defaults) { if (p.defaults.hasOwnProperty(k)) { result[k] = p.defaults[k]; } } } return result; }
    function registerUser(list) {
        presets.length = builtInCount;
        list = list || [];
        for (var i = 0; i < list.length; i++) {
            var source = list[i];
            if (!source || !source.user || !source.id || !categoriesById(source.category) || categoriesById(source.category).panel !== 'ui') { continue; }
            presets.push(source);
        }
        return presets.length - builtInCount;
    }
    return { categories: categories, presets: presets, find: find, category: categoriesById, defaults: defaults, registerUser: registerUser, builtInCount: builtInCount };
}());
if (typeof module !== 'undefined' && module.exports) { module.exports = MGCatalog; }
