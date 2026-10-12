/* Shared compatibility policy; no polling or project mutations. */
var MGCompatibility = (function(){
    function major(v){var m=/^(\d+)(?:\.|$)/.exec(String(v||''));return m?Number(m[1]):0;}
    function describe(v){var n=major(v);return {aeVersion:String(v||''),major:n,year:n?2000+n:null,supported:n>=23&&n<=26,platform:'Windows x64',validation:'requires-host-testing'};}
    function current(){return describe(app.version);}
    function requireSupported(){var info=current();if(!info.supported)throw new Error('此版本适配 AE 2023–2026（23.x–26.x），当前版本：'+app.version);return info;}
    function checkTemplate(created,currentVersion){var a=major(created),b=major(currentVersion);if(a&&b&&a>b)throw new Error('该模板由 AE '+created+' 保存，高于当前 AE '+currentVersion+'。请使用相同或更高版本，或在新版 AE 中另存为兼容工程后重新制作模板。');}
    function command(){var folder=Folder.appPackage,names=['AfterFX.com','AfterFX.exe'];for(var i=0;i<names.length;i++){var f=File(folder.fsName+'/'+names[i]);if(f.exists)return f;}throw new Error('当前 AE 安装目录中找不到后台程序：'+folder.fsName+'。不会改用其他版本。');}
    return {major:major,describe:describe,current:current,requireSupported:requireSupported,checkTemplate:checkTemplate,command:command};
}());
