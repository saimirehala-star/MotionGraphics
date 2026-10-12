param([Parameter(Mandatory=$true)][string]$LaunchFile,[Parameter(Mandatory=$true)][string]$PidFile)
$ErrorActionPreference='Stop'
$launchPath=[IO.Path]::GetFullPath($LaunchFile)
$taskFolder=Split-Path -Parent $launchPath
if ((Split-Path -Leaf $launchPath) -ne 'launch.jsx' -or (Split-Path -Leaf $taskFolder) -notmatch '^tpl-[a-z0-9-]{6,80}$' -or (Split-Path -Leaf (Split-Path -Parent $taskFolder)) -ne 'MotionGraphicsTemplateJobs') { throw 'Invalid task path' }
$workerPattern='(?i)(?:^|\s)-r\s+"?'+[regex]::Escape($launchPath)+'"?(?:\s|$)'
$monitorPattern='(?i)(?:^|\s)-PidFile\s+"?'+[regex]::Escape($PidFile)+'"?(?=\s|$)'
$stopped=@()
foreach($candidate in @(Get-CimInstance Win32_Process)) {
 $normalizedCommand=($candidate.CommandLine -replace '/', '\') -replace '\\{2,}', '\'
 $isWorker=$candidate.Name -match '^AfterFX\.(exe|com)$' -and $normalizedCommand -match $workerPattern
 $isMonitor=$candidate.Name -match '^powershell\.exe$' -and $normalizedCommand -match 'template-window-monitor\.ps1' -and $normalizedCommand -match $monitorPattern
 if (-not ($isWorker -or $isMonitor)) { continue }
 # Re-read before stopping; a stale/reused saved PID alone never authorizes a stop.
 $current=Get-CimInstance Win32_Process -Filter "ProcessId=$($candidate.ProcessId)" -ErrorAction SilentlyContinue
 if($current -and $current.CreationDate -eq $candidate.CreationDate -and $current.CommandLine -eq $candidate.CommandLine) {
  Stop-Process -Id $current.ProcessId -Force -ErrorAction Stop
  $stopped += [int]$current.ProcessId
 }
}
@{stopped=$stopped;verifiedBy='exact-command-line'} | ConvertTo-Json -Compress
