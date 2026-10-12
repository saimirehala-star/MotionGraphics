var MGBridge = (function () {
    var nativeBridge=window.__adobe_cep__, queue=[], running=false;
    function process() {
        if(running||!queue.length){return;}running=true;
        var item=queue.shift();
        try {
            var extensionPath=decodeURI(nativeBridge.getSystemPath('extension')).replace(/\\/g,'/').replace(/^file:\/\//,'').replace(/^\/([A-Za-z]:\/)/,'$1');
            var script='(function(){if(!$.global.MG2023Host||$.global.MG2023Host.version!=="2.8.0"){$.evalFile(File('+JSON.stringify(extensionPath+'/host/main.jsx')+'));}return $.global.MG2023Host.dispatch('+JSON.stringify(JSON.stringify(item.payload))+');}())';
            nativeBridge.evalScript(script,function(raw){
                running=false;
                try { var result=JSON.parse(raw);item.resolve(result); }
                catch(e){item.resolve({ok:false,message:'AE 脚本未加载，请重开扩展面板。'+(raw?' '+String(raw).slice(0,100):'')});}
                process();
            });
        } catch(e){running=false;item.resolve({ok:false,message:'无法连接 AE：'+e.message});process();}
    }
    function call(action,data) {
        // MGBridge.call('listUserPresets') and MGBridge.call('listTemplates') remain the primary library reads.
        if(!nativeBridge){
            if(action==='listTemplates'){return Promise.resolve({ok:true,preview:true,message:'界面预览模式。',data:{templates:[],categories:[],folder:'Y:\\项目素材\\童话岛\\Plug\\MotionGraphics\\合成模版'}});}
            if(action==='chooseUserPresetFolder'||action==='chooseTemplateFolder'||action==='chooseExpressionFolder'){return Promise.resolve({ok:true,preview:true,message:'界面预览模式：目录选择需要连接 AE。',data:{cancelled:true}});}
            if(action==='listExpressions'){return Promise.resolve({ok:true,preview:true,message:'界面预览模式。',data:{expressions:[{id:'expr-preview',name:'弹性回弹',usage:'添加到已有两个关键帧的缩放属性。',expression:'amp = .08;\\nfreq = 2;\\ndecay = 4;'}],folder:'Y:\\项目素材\\童话岛\\Plug\\MotionGraphics\\表达式库'}});}
            if(action==='prerenderStatus'||action==='prerenderTemplates'){return Promise.resolve({ok:true,preview:true,message:'界面预览模式。',data:{comp:'童话岛标题合成',selectedCount:3,rendering:false,templates:['Lossless with Alpha','PNG Sequence'],outputFolder:'E:\\RenderCache',mode:'regular',groupCount:2,hasPreview:true,lastGroupId:'preview'}});}
            return Promise.resolve({ok:action==='status',preview:true,message:'界面预览模式：不会修改 AE 图层。',data:{version:'2023',comp:'界面预览',count:0}});
        }
        return new Promise(function(resolve){queue.push({payload:{action:action,data:data||{}},resolve:resolve});process();});
    }
    function cancelPendingAI() { queue=queue.filter(function(item){if(/^ai(?:Read|Edit|Plugin|Script)$/.test(item.payload.action)){item.resolve({ok:false,message:'任务已停止，排队操作未执行。'});return false;}return true;}); }
    return { connected:!!nativeBridge, call:call, busy:function(){return running;}, cancelPendingAI:cancelPendingAI };
}());
