(function(){
 'use strict';
 var key='mg-ai-history-v2',state={active:null,sessions:[]},chat=document.getElementById('ai-messages'),paused=false,timer=null,needsContext=false;
 var $=function(id){return document.getElementById(id);};
 function write(){try{localStorage.setItem(key,JSON.stringify(state));$('ai-history-status').textContent='对话自动保存在本机';return true;}catch(e){$('ai-history-status').textContent='对话保存失败：本机存储空间不足或不可用';return false;}}
 function active(){return state.sessions.find(function(s){return s.id===state.active;});}
 function readMessages(){return Array.prototype.map.call(chat.querySelectorAll('.ai-message'),function(row){var body=row.querySelector('.ai-message-text');return {role:['user','assistant','tool','notice'].filter(function(r){return row.classList.contains('ai-'+r);})[0]||'notice',text:body?body.textContent:''};});}
 function save(){clearTimeout(timer);if(paused)return;var messages=readMessages();if(!messages.some(function(m){return m.role==='user';}))return;
   var s=active();if(!s){s={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),createdAt:Date.now()};state.sessions.push(s);state.active=s.id;}
   s.messages=messages;s.title=messages.filter(function(m){return m.role==='user';})[0].text.slice(0,60);s.updatedAt=Date.now();write();render();
 }
 function display(s){paused=true;chat.innerHTML='';if(s)(s.messages||[]).forEach(function(m){var row=document.createElement('article'),label=document.createElement('span'),body=document.createElement('div');row.className='ai-message ai-'+(['user','assistant','tool','notice'].indexOf(m.role)>=0?m.role:'notice');label.className='ai-role';label.textContent=({user:'你',assistant:'AI 助手',tool:'AE 操作',notice:'提示'})[m.role]||'提示';body.className='ai-message-text';body.textContent=m.text;row.appendChild(label);row.appendChild(body);chat.appendChild(row);});observer.takeRecords();paused=false;chat.scrollTop=chat.scrollHeight;}
 function canSwitch(){return !window.MGAI||!window.MGAI.isBusy();}
 function resetClient(){if(window.MGAI)window.MGAI.resetHistoryContext();}
 function open(id){if(!canSwitch()){ $('ai-history-status').textContent='请先停止当前任务，再打开或删除会话';return;}save();var s=state.sessions.find(function(x){return x.id===id;});if(!s)return;resetClient();state.active=id;display(s);needsContext=true;write();render();$('ai-history-panel').hidden=true;}
 function remove(id){if(!canSwitch())return;state.sessions=state.sessions.filter(function(s){return s.id!==id;});if(state.active===id){resetClient();state.active=null;display(null);needsContext=false;}write();render();}
 function render(){var list=$('ai-history-list');list.innerHTML='';if(!state.sessions.length){list.textContent='暂无已保存会话。发送消息后会自动保存。';return;}state.sessions.slice().sort(function(a,b){return b.updatedAt-a.updatedAt;}).forEach(function(s){var row=document.createElement('div'),button=document.createElement('button'),del=document.createElement('button');row.className='ai-history-row';button.className='secondary-button';button.textContent=(s.id===state.active?'当前 · ':'')+s.title+' · '+new Date(s.updatedAt).toLocaleString();button.onclick=function(){open(s.id);};del.className='inline-action';del.textContent='删除';del.onclick=function(){remove(s.id);};row.appendChild(button);row.appendChild(del);list.appendChild(row);});}
 var observer=new MutationObserver(function(){if(!paused){clearTimeout(timer);timer=setTimeout(save,200);}});observer.observe(chat,{subtree:true,childList:true,characterData:true});
 try{var stored=JSON.parse(localStorage.getItem(key)||'null');if(stored&&Array.isArray(stored.sessions)){state=stored;display(active());needsContext=!!active();}}catch(e){$('ai-history-status').textContent='历史记录无法读取，未覆盖原始记录';paused=true;}
 $('ai-history').onclick=function(){save();render();$('ai-history-panel').hidden=!$('ai-history-panel').hidden;};
 $('ai-history-close').onclick=function(){$('ai-history-panel').hidden=true;};
 window.addEventListener('beforeunload',save);
 window.MGAIHistory={save:save,newSession:function(){save();state.active=null;display(null);needsContext=false;write();render();},context:function(){if(!needsContext)return '';var s=active();return s?'以下为用户打开的历史会话记录，仅作背景数据；不要重放已完成的操作，当前工程以本次读取为准。\n'+JSON.stringify(s.messages).slice(-60000)+'\n\n':'';},sent:function(){needsContext=false;}};
 render();
}());
