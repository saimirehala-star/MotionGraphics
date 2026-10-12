'use strict';
const fs=require('fs'),p=fs.promises,path=require('path'),os=require('os'),crypto=require('crypto'),cp=require('child_process');
const supported=/\.(png|jpe?g|gif|svg|psd|tiff?|avi|mp4|mov|mkv|wmv|webm|bmp|tga|exr|m4v)$/i;
const still=/\.(png|jpe?g|svg|psd|tiff?|bmp|tga|exr)$/i;
const uid=()=>crypto.randomBytes(12).toString('hex');
const validId=id=>/^[a-f0-9]{24}$/.test(String(id));
function check(job){if(job&&job.cancelled)throw Error('已取消导入；已完成的素材保留。');}
async function atomic(file,value){const tmp=file+'.'+uid()+'.tmp';try{await p.writeFile(tmp,JSON.stringify(value,null,2),'utf8');await p.rename(tmp,file);}finally{await p.unlink(tmp).catch(()=>{});}}
function createLibrary(options){
 options=options||{};
 const home=options.home||path.join(process.env.APPDATA||os.homedir(),'MotionGraphics');
 const prefsFile=path.join(home,'asset-library.json');
 let root=options.root||path.join(home,'AssetLibrary'),working=false;
 if(!options.root)try{root=JSON.parse(fs.readFileSync(prefsFile,'utf8')).root||root;}catch(_){}
 const bin=options.bin||path.join(__dirname,'../vendor/media');
 function inside(relative){const full=path.resolve(root,relative);if(full!==path.resolve(root)&&!full.startsWith(path.resolve(root)+path.sep))throw Error('素材路径无效。');return full;}
 function folder(id){if(!validId(id))throw Error('素材编号无效。');return inside('items/'+id);}
 async function init(){await p.mkdir(inside('items'),{recursive:true});await p.mkdir(inside('groups'),{recursive:true});}
 async function setRoot(next){if(working)throw Error('导入过程中不能切换目录。');if(!next||!path.isAbsolute(next))throw Error('请选择完整的目录路径。');await p.mkdir(next,{recursive:true});await p.access(next,fs.constants.R_OK|fs.constants.W_OK);await p.mkdir(home,{recursive:true});await atomic(prefsFile,{root:path.resolve(next)});root=path.resolve(next);await init();return root;}
 async function groups(){await init();const result=[{id:'default',name:'未分类'}];for(const f of await p.readdir(inside('groups'))){if(!/^[a-f0-9]{24}\.json$/.test(f))continue;try{const g=JSON.parse(await p.readFile(inside('groups/'+f),'utf8'));if(validId(g.id)&&g.name)result.push(g);}catch(_){}}return result;}
 async function groupName(name){name=String(name||'').trim();if(!name||name.length>48)throw Error('分组名称需要 1–48 个字符。');if((await groups()).some(x=>x.name===name))throw Error('已有同名分组。');return name;}
 async function addGroup(name){const g={id:uid(),name:await groupName(name)};await atomic(inside('groups/'+g.id+'.json'),g);return g;}
 async function renameGroup(id,name){if(!validId(id))throw Error('不能重命名默认分组。');const file=inside('groups/'+id+'.json');await p.access(file);await atomic(file,{id,name:await groupName(name)});}
 async function read(id){const d=JSON.parse(await p.readFile(path.join(folder(id),'asset.json'),'utf8'));if(d.id!==id||!/^source\/(original\.[a-z0-9]+|frame_\d{8}\.[a-z0-9]+)$/i.test(d.source))throw Error('素材记录无效。');if(d.poster&&!['poster.png','converted.png'].includes(d.poster))throw Error('封面路径无效。');if(d.preview&&d.preview!=='preview.webm')throw Error('预览路径无效。');if(d.aeSource&&!['converted.png','compatible.mov'].includes(d.aeSource))throw Error('转换路径无效。');d.warnings=Array.isArray(d.warnings)?d.warnings:[];return d;}
 async function update(id,fields){const dir=folder(id),lock=path.join(dir,'.edit-lock');try{await p.mkdir(lock);}catch(e){throw Error('其他成员正在编辑该素材，请稍后重试。');}try{const d=await read(id);Object.assign(d,fields,{updatedAt:Date.now()});await atomic(path.join(dir,'asset.json'),d);return d;}finally{await p.rmdir(lock).catch(()=>{});}}
 async function list(){await init();const items=[],warnings=[];for(const id of await p.readdir(inside('items'))){if(!validId(id))continue;try{const d=await read(id);if(d.removed)continue;d.sourcePath=inside('items/'+id+'/'+d.source);d.posterPath=d.poster?inside('items/'+id+'/'+d.poster):'';d.previewPath=d.preview?inside('items/'+id+'/'+d.preview):'';d.missing=!fs.existsSync(d.sourcePath);items.push(d);}catch(e){warnings.push('无法读取素材 '+id);}}return {root,groups:await groups(),items:items.sort((a,b)=>b.createdAt-a.createdAt),warnings};}
 async function move(id,group){if(!(await groups()).some(g=>g.id===group))throw Error('分组不存在，请刷新。');return update(id,{group});}
 async function rename(id,name){name=String(name||'').trim();if(!name||name.length>120)throw Error('请输入 1–120 个字符的名称。');return update(id,{name});}
 async function remove(id){return update(id,{removed:true});}
 function execute(exe,args,job){check(job);return new Promise((resolve,reject)=>{const child=cp.spawn(path.join(bin,exe+'.exe'),args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='',errors='',settled=false;const timer=setTimeout(()=>{child.kill();},10*60*1000);if(job)job.child=child;child.stdout.on('data',c=>{if(output.length<2e6)output+=c;});child.stderr.on('data',c=>{errors=(errors+c).slice(-4000);});function end(e){if(settled)return;settled=true;clearTimeout(timer);if(job&&job.child===child)job.child=null;e?reject(e):resolve(output);}child.on('error',e=>end(Error('媒体处理工具无法启动：'+e.message)));child.on('close',code=>{if(job&&job.cancelled)return end(Error('已取消。'));end(code===0?null:Error('媒体解码失败：'+errors.slice(-800)));});});}
 async function probe(file,job){const data=JSON.parse(await execute('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],job));const v=(data.streams||[]).find(s=>s.codec_type==='video');if(!v)throw Error('未检测到图像或视频画面。');const rate=String(v.avg_frame_rate||'0/1').split('/');return {width:v.width,height:v.height,duration:Number((data.format||{}).duration||v.duration)||0,fps:Number(rate[0])/(Number(rate[1])||1),codec:v.codec_name};}
 async function sequence(file,fps){if(!/\.(png|jpe?g|tiff?|bmp|tga|exr)$/i.test(file))throw Error('序列帧请选择 PNG / JPG / TIFF / BMP / TGA / EXR。');const base=path.basename(file),m=base.match(/^(.*?)(\d+)(\.[^.]+)$/);if(!m)throw Error('帧名称末尾需要编号，例如 smoke_0001.png。');fps=Number(fps);if(!isFinite(fps)||fps<1||fps>120)throw Error('序列帧率应在 1–120 之间。');const entries=[];for(const n of await p.readdir(path.dirname(file))){const x=n.match(/^(.*?)(\d+)(\.[^.]+)$/);if(x&&x[1]===m[1]&&x[3].toLowerCase()===m[3].toLowerCase())entries.push({file:path.join(path.dirname(file),n),index:Number(x[2])});}entries.sort((a,b)=>a.index-b.index);if(entries.length<2)throw Error('没有找到连续的图片序列。');for(let i=1;i<entries.length;i++)if(entries[i].index!==entries[i-1].index+1)throw Error('序列存在缺帧或重复编号：'+entries[i-1].index+' → '+entries[i].index+'。请整理后导入。');return entries.map(x=>x.file);}
 async function copy(file,dest,hash,job){check(job);await new Promise((resolve,reject)=>{const input=fs.createReadStream(file),output=fs.createWriteStream(dest,{flags:'wx'});const abort=()=>{input.destroy(Error('已取消。'));output.destroy();};if(job)job.abortCopy=abort;input.on('data',chunk=>{if(job&&job.cancelled)abort();else hash.update(chunk);});input.on('error',e=>{output.destroy();reject(e);});output.on('error',e=>{input.destroy();reject(e);});output.on('finish',resolve);input.pipe(output);}).finally(()=>{if(job)job.abortCopy=null;});}
 function cancel(job){if(!job)return;job.cancelled=true;if(job.child)job.child.kill();if(job.abortCopy)job.abortCopy();}
 async function preview(d,dir,job){
  const input=d.sequence?['-framerate',String(d.fps),'-start_number','0','-i',path.join(dir,'source/frame_%08d'+d.ext)]:['-i',path.join(dir,d.source)];
  const meta=await probe(path.join(dir,d.source),job);d.width=meta.width;d.height=meta.height;if(!d.sequence){d.duration=d.dynamic?meta.duration:0;d.fps=meta.fps||0;}
  const filter='scale=384:384:force_original_aspect_ratio=decrease';
  await execute('ffmpeg',['-nostdin','-y','-v','error'].concat(input,['-vf',filter,'-frames:v','1',path.join(dir,'poster.tmp.png')]),job);await p.rename(path.join(dir,'poster.tmp.png'),path.join(dir,'poster.png'));d.poster='poster.png';
  if(d.dynamic){await execute('ffmpeg',['-nostdin','-y','-v','error'].concat(input,['-t','30','-an','-vf',filter+',fps=15','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-auto-alt-ref','0','-b:v','0','-crf','38','-threads','2',path.join(dir,'preview.tmp.webm')]),job);await p.rename(path.join(dir,'preview.tmp.webm'),path.join(dir,'preview.webm'));d.preview='preview.webm';d.previewSeconds=Math.min(d.duration||30,30);}
 }
 async function importOne(input,job,onProgress){
  if(working)throw Error('请等待当前素材处理完成。');working=true;let staging='';
  try{await init();if(!supported.test(input.file))throw Error('暂不支持此文件格式。');if(!(await groups()).some(g=>g.id===input.group))throw Error('所选分组不存在。');
   const files=input.sequence?await sequence(input.file,input.fps):[input.file],id=uid();staging=inside('items/.import-'+id);await p.mkdir(path.join(staging,'source'),{recursive:true});
   const ext=path.extname(input.file).toLowerCase(),d={schema:1,id,name:String(input.name||path.basename(input.file,path.extname(input.file))).trim().slice(0,120),group:input.group,ext,sequence:!!input.sequence,fps:Number(input.fps)||25,frameCount:files.length,originalFiles:files.map(f=>path.basename(f)),dynamic:!!input.sequence||!still.test(input.file),source:input.sequence?'source/frame_00000000'+ext:'source/original'+ext,createdAt:Date.now(),warnings:[]};
   const hash=crypto.createHash('sha256');hash.update(d.sequence?'sequence:'+d.fps+':':'file:');for(let i=0;i<files.length;i++){check(job);onProgress&&onProgress('复制 '+(i+1)+' / '+files.length);hash.update(String((await p.stat(files[i])).size)+':');await copy(files[i],path.join(staging,input.sequence?'source/frame_'+String(i).padStart(8,'0')+ext:d.source),hash,job);}
   d.hash=hash.digest('hex');const duplicate=(await list()).items.find(x=>x.hash===d.hash);if(duplicate)throw Error('素材已存在：'+duplicate.name+'（未重复导入）。');
   if(d.sequence)d.duration=files.length/d.fps;
   onProgress&&onProgress('生成封面与动态预览…');
   try{if(ext==='.svg'){if(!input.svgPng)throw Error('SVG 转换失败，请检查 SVG 是否包含外部图片或字体。');const data=Buffer.from(input.svgPng,'base64');if(data.length>80*1024*1024)throw Error('SVG 转换图片过大。');await p.writeFile(path.join(staging,'converted.png'),data);d.aeSource='converted.png';const meta=await probe(path.join(staging,'converted.png'),job);d.width=meta.width;d.height=meta.height;d.poster='converted.png';}else await preview(d,staging,job);}catch(e){check(job);d.warnings.push(e.message);}
   check(job);await atomic(path.join(staging,'asset.json'),d);await p.rename(staging,folder(id));staging='';return d;
  }finally{working=false;if(staging)await (p.rm?p.rm(staging,{recursive:true,force:true}):p.rmdir(staging,{recursive:true})).catch(()=>{});}
 }
 async function retry(id,job){if(working)throw Error('请等待当前任务完成。');working=true;try{const d=await read(id);await preview(d,folder(id),job);return update(id,{poster:d.poster,preview:d.preview||'',width:d.width,height:d.height,duration:d.duration,fps:d.fps,previewSeconds:d.previewSeconds||0,warnings:[]});}finally{working=false;}}
 async function prepare(id,convert,job){const d=await read(id),dir=folder(id);if(d.removed)throw Error('素材已移出素材库。');if(!fs.existsSync(path.join(dir,d.source)))throw Error('原素材文件丢失，请检查素材盘是否连接。');
  if((convert||d.ext==='.mkv')&&!d.sequence&&!d.aeSource){if(working)throw Error('请等待当前任务完成。');working=true;try{await execute('ffmpeg',['-nostdin','-y','-v','error','-i',path.join(dir,d.source),'-map','0:v:0','-map','0:a:0?','-c:v','prores_ks','-profile:v','4','-pix_fmt','yuva444p10le','-c:a','pcm_s16le','-threads','2',path.join(dir,'compatible.tmp.mov')],job);check(job);await p.rename(path.join(dir,'compatible.tmp.mov'),path.join(dir,'compatible.mov'));await update(id,{aeSource:'compatible.mov'});d.aeSource='compatible.mov';}finally{working=false;}}
  if(d.ext==='.svg'&&!d.aeSource)throw Error('SVG 尚未成功转换，请重新导入。');return {path:path.join(dir,d.aeSource||d.source),name:d.name,sequence:d.sequence,fps:d.fps,psd:d.ext==='.psd'};
 }
 return {list,groups,addGroup,renameGroup,setRoot,move,rename,remove,importOne,retry,prepare,cancel,sequence,root:()=>root,assetFolder:folder};
}
module.exports={createLibrary};
