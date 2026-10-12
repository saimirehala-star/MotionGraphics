'use strict';
const cp=require('child_process');
function convert(value,decrypt){
 const script="Add-Type -AssemblyName System.Security; $v=[Console]::In.ReadToEnd(); "+(decrypt?"$b=[Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($v),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Text.Encoding]::UTF8.GetString($b))":"$b=[Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($v),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Convert]::ToBase64String($b))");
 return cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{input:value,encoding:'utf8',windowsHide:true,timeout:10000,stdio:['pipe','pipe','pipe']});
}
module.exports={protect:value=>convert(value,false),unprotect:value=>convert(value,true)};
