(function () {
    'use strict';
    var $ = function(id){return document.getElementById(id);}, client=null, module=null, token='', busy=false, pendingApproval=null, serial=Promise.resolve(), rows={}, selectedModel='gpt-6-astra', connectionPromise=null, stopping=false;
    var chat=$('ai-messages');
    function isThird(){return false;}
    function dropClient(){if(client){client.removeAllListeners();client.close();client=null;}}
    function status(text,error){$('ai-status').textContent=text;$('ai-status').classList.toggle('error',!!error);}
    function add(role,text,id){
        var row=document.createElement('article');row.className='ai-message ai-'+role;
        var label=document.createElement('span');label.className='ai-role';label.textContent=({user:'你',assistant:'AI 助手',tool:'AE 操作',notice:'提示'})[role]||role;
        var body=document.createElement('div');body.className='ai-message-text';body.textContent=text;row.appendChild(label);row.appendChild(body);chat.appendChild(row);
        if(id)rows[id]=body;
        while(chat.children.length>150)chat.removeChild(chat.firstChild);
        chat.scrollTop=chat.scrollHeight;return body;
    }
    function setBusy(value){busy=value;$('ai-send').disabled=value;$('ai-stop').disabled=!value;$('ai-new').disabled=value;$('ai-model').disabled=value;$('ai-connect').disabled=value;$('ai-login').disabled=value;$('ai-logout').disabled=value;$('ai-read-context').disabled=value;['ai-provider','ai-codex-path'].forEach(function(id){$(id).disabled=value;});}
    function error(e){status(e.message||String(e),true);add('notice',e.message||String(e));}
    function nodeRequire(name){return window.cep_node&&window.cep_node.require?window.cep_node.require(name):(typeof require==='function'?require(name):null);}
    function loadRuntime(){
        if(module)return;
        if(!MGBridge.connected)throw new Error('当前是界面预览，AI 连接与 AE 操作需要在 AE 2023–2026 扩展中使用。');
        var extension=decodeURI(window.__adobe_cep__.getSystemPath('extension')).replace(/^file:\/\//,'').replace(/^\/([A-Za-z]:\/)/,'$1');
        module=nodeRequire(extension+'/node/ai-client.cjs');
        if(!module)throw new Error('CEP Node 运行环境不可用。请检查扩展安装。');
    }
    async function account(){
        var r=await client.account(), a=r.account;
        if(a){status(a.type==='apiKey'?'已连接 · API 计费':'已连接 · ChatGPT 账号');$('ai-account').textContent=a.email||a.type||'已登录';}
        else if(!isThird()&&client.configuredProvider){var provider=client.configuredProvider();if(provider.configured){status('已连接 · '+provider.id+' provider · '+(provider.baseUrl||'使用 Codex 当前认证'));$('ai-account').textContent=provider.id+' · 已配置';$('ai-login').hidden=true;$('ai-auth-link').hidden=true;return {type:'provider',id:provider.id};}}
        else{status('Codex 已连接，请登录账号');$('ai-account').textContent='未登录';}
        return a;
    }
    async function modelList(){
        var list=await client.models();$('ai-model').innerHTML='';
        if(!isThird()&&client.configuredModel){var configured=client.configuredModel();if(configured)selectedModel=configured;}
        list.forEach(function(m){var option=document.createElement('option');option.value=m.model||m.id;option.textContent=m.displayName||option.value;$('ai-model').appendChild(option);});
        var exists=list.some(function(m){return (m.model||m.id)===selectedModel;});
        if(!exists){var custom=document.createElement('option');custom.value=selectedModel;custom.textContent=selectedModel+'（未在可用列表中，调用可能失败）';$('ai-model').appendChild(custom);}
        $('ai-model').value=selectedModel;
    }
    function connect(){
        if(connectionPromise)return connectionPromise;
        connectionPromise=connectNow().then(function(r){connectionPromise=null;return r;},function(e){connectionPromise=null;throw e;});
        return connectionPromise;
    }
    function bindClient(){
        client.toolHandler=function(name,args){var next=serial.then(function(){return handleTool(name,args);});serial=next.catch(function(){});return next;};
        client.on('delta',function(e){var row=rows[e.id]||add('assistant','',e.id);row.textContent+=e.text;chat.scrollTop=chat.scrollHeight;});
        client.on('message',function(e){var row=rows[e.id];if(row)row.textContent=e.text;else add('assistant',e.text,e.id);});
        client.on('notice',function(s){add('notice',s);status(s,true);});
        client.on('done',function(turn){serial.then(function(){endScope();setBusy(false);status(turn.status==='completed'?'本轮已完成':turn.status==='interrupted'?'已停止后续操作':'本轮未完成',turn.status==='failed');if(turn.error)add('notice',turn.error.message||'执行失败');});});
        client.on('disconnected',function(s){rejectApproval();endScope();setBusy(false);status(s,true);});
        client.on('login',function(p){if(p.success){$('ai-auth-link').hidden=true;account().then(modelList).catch(error);}else error(new Error(p.error||'登录未完成'));});
    }
    async function connectNow(){
        if(client && client.child){await account();return;}
        loadRuntime();client=new module.AIClient();
        bindClient();
        status('正在连接当前 Codex 配置（含 CC Switch 的供应商、代理和重试设置）…');await client.connect($('ai-codex-path').value.trim());
        try{localStorage.setItem('mg-ai-codex-path',$('ai-codex-path').value.trim());}catch(_){}
        await account();await modelList();
    }
    async function login(mode){
        if(busy)return;setBusy(true);
        try{await connect();
            var r=await client.login('chatgpt');
            if(r.authUrl){var url=new URL(r.authUrl);if(url.protocol!=='https:' || !/(^|\.)openai\.com$|(^|\.)chatgpt\.com$/.test(url.hostname))throw new Error('登录地址校验失败。');var link=$('ai-auth-link');link.href=r.authUrl;link.hidden=false;status('请在浏览器完成登录，再回到这里。');window.cep.util.openURLInDefaultBrowser(r.authUrl);}
            else{await account();await modelList();}
        }catch(e){error(e);}finally{setBusy(false);}
    }
    function approve(title,body,script){
        return new Promise(function(resolve){pendingApproval=resolve;$('ai-approval-title').textContent=title;$('ai-approval-body').textContent=body;$('ai-approval-code').textContent=script||'';$('ai-approval-code').hidden=!script;$('ai-script-warning').hidden=!script;$('ai-approval').hidden=false;$('ai-approve').focus();});
    }
    function answerApproval(value){var resolve=pendingApproval;pendingApproval=null;$('ai-approval').hidden=true;if(resolve)resolve(value);}
    function rejectApproval(){answerApproval(false);}
    function needsApproval(name,args){
        if(name==='ae_script')return !$('ai-auto-script').checked;
        if($('ai-review-edits').checked && name!=='ae_read')return true;
        if(name==='ae_edit')return (args.operations||[]).some(function(o){return o.op==='remove'||o.clearKeys===true||o.expression!==undefined;});
        return name==='ae_plugin' && /^(remove|prerenderRender|prerenderUpdate|prerenderReturnCache)$/.test(args.action);
    }
    async function handleTool(name,args){
        if(!busy || !client || client.stopped)return {ok:false,message:'任务已停止，未执行。'};
        if(typeof args==='string')args=JSON.parse(args);
        var actions={ae_read:'aiRead',ae_edit:'aiEdit',ae_plugin:'aiPlugin',ae_script:'aiScript'};
        if(!actions[name])return {ok:false,message:'未知工具。'};
        if(name==='ae_script'&&!$('ai-allow-script').checked&&!$('ai-auto-script').checked)return {ok:false,message:'用户未开启自由 JSX。请使用结构化 AE 工具，或向用户解释并等待其启用。'};
        var approved=name==='ae_script'&&$('ai-auto-script').checked;
        if(needsApproval(name,args)){
            approved=await approve(name==='ae_script'?'执行 AI 生成的 JSX':'确认本次 AE 修改',(args.summary||name)+'\n\n'+(name==='ae_script'?'目标：'+$('ai-target').textContent:JSON.stringify(args,null,2)),name==='ae_script'?args.code:'');
            if(!approved)return {ok:false,message:'用户拒绝了本次操作。不得通过其他工具绕过。'};
        }
        if(!busy||client.stopped)return {ok:false,message:'任务已停止，未执行。'};
        var row=add('tool',(args.summary||args.query||name)+' · 执行中');
        var r=await MGBridge.call(actions[name],{token:token,args:args,approved:approved});
        row.textContent=(args.summary||args.query||name)+' · '+(r.ok?'完成':'未完成')+(r.message?'\n'+r.message:'');
        if(r.data&&r.data.context)target(r.data.context);
        return r;
    }
    function target(c){$('ai-target').textContent=c&&c.comp?c.comp.name+' · '+c.selectedLayerIds.length+' 个选中图层':'当前无合成 · 可新建合成';}
    function endScope(){if(token){var old=token;token='';MGBridge.call('aiEnd',{token:old});}}
    async function send(event){
        event.preventDefault();if(busy)return;var text=$('ai-input').value.trim();if(!text)return;
        setBusy(true);stopping=false;
        try{await connect();if(!await account())throw new Error('请先登录 ChatGPT，或确认 CC Switch / Codex provider 已配置。');
            if(stopping){setBusy(false);return;}
            var start=await MGBridge.call('aiBegin');if(!start.ok)throw new Error(start.message);token=start.data.token;target(start.data.context);
            if(stopping){endScope();setBusy(false);return;}
            document.querySelector('.ai-settings').open=false;
            add('user',text);$('ai-input').value='';var model=$('ai-model').value;status('AI 正在处理…');var historyPrefix=window.MGAIHistory?window.MGAIHistory.context():'';await client.start(historyPrefix+text,start.data.context,model);if(window.MGAIHistory)window.MGAIHistory.sent();
        }catch(e){endScope();setBusy(false);error(e);}
    }
    async function stop(){stopping=true;rejectApproval();if(client){client.stopped=true;if(MGBridge.cancelPendingAI)MGBridge.cancelPendingAI();status('正在停止后续步骤；已进入 AE 的脚本需等待返回。');try{await client.stop();}catch(e){error(e);}}}
    $('ai-connect').addEventListener('click',async function(){if(busy)return;setBusy(true);try{await connect();}catch(e){error(e);}finally{setBusy(false);}});
    $('ai-login').addEventListener('click',function(){login('chatgpt');});
    $('ai-logout').addEventListener('click',function(){if(client)client.logout().then(account).catch(error);});
    $('ai-form').addEventListener('submit',send);$('ai-stop').addEventListener('click',stop);
    $('ai-new').addEventListener('click',function(){if(busy)return;if(window.MGAIHistory)window.MGAIHistory.newSession();if(client)client.newChat();chat.innerHTML='';rows={};endScope();add('notice','已开始新对话。发送时读取当前合成与选中图层。');});
    $('ai-read-context').addEventListener('click',async function(){if(!MGBridge.connected){error(new Error('请在 AE 中打开扩展。'));return;}var r=await MGBridge.call('aiBegin');if(r.ok){target(r.data.context);add('notice',JSON.stringify(r.data.context,null,2));await MGBridge.call('aiEnd',{token:r.data.token});}else error(new Error(r.message));});
    $('ai-auto-script').addEventListener('change',function(){if(this.checked){$('ai-allow-script').checked=false;add('notice','已开启自由 JSX 无需确认：AI 可直接执行任意 AE 脚本，也可能读写文件。仅在本次面板会话生效，请使用可信模型和测试工程。');}});
    $('ai-allow-script').addEventListener('change',function(){if(this.checked)$('ai-auto-script').checked=false;});
    $('ai-approve').addEventListener('click',function(){answerApproval(true);});$('ai-decline').addEventListener('click',rejectApproval);
    $('ai-model').addEventListener('change',function(){selectedModel=this.value;if(client)client.newChat();rows={};add('notice','已切换模型，下一条消息使用新对话。');});
    $('ai-input').addEventListener('keydown',function(e){if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();$('ai-form').dispatchEvent(new Event('submit',{cancelable:true}));}});
    document.querySelectorAll('[data-ai-prompt]').forEach(function(b){b.addEventListener('click',function(){$('ai-input').value=b.dataset.aiPrompt;$('ai-input').focus();});});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&pendingApproval)rejectApproval();});
    window.addEventListener('beforeunload',function(){rejectApproval();if(MGBridge.cancelPendingAI)MGBridge.cancelPendingAI();endScope();if(client)client.close();});
    try{$('ai-codex-path').value=localStorage.getItem('mg-ai-codex-path')||'';}catch(_){}
    window.MGAI={isBusy:function(){return busy;},resetHistoryContext:function(){if(busy)return;rejectApproval();endScope();if(client)client.newChat();rows={};serial=Promise.resolve();}};
    setBusy(false);
}());












