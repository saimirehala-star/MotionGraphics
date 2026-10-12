param(
    [ValidateSet('Monitor', 'Show')][string]$Mode = 'Monitor',
    [int]$LauncherPid = 0,
    [string]$BeforePids = '',
    [Parameter(Mandatory = $true)][string]$PidFile,
    [string]$ReadyFile = '',
    [string]$ExpectedPidFile = '',
    [string]$LogFile = ''
)
$ErrorActionPreference = 'Stop'
function Write-MonitorLog([string]$Message) {
    if ($LogFile) { Add-Content -LiteralPath $LogFile -Value (('{0:O} ' -f (Get-Date)) + $Message) -Encoding UTF8 -ErrorAction SilentlyContinue }
}
$source = @'
using System;
using System.Runtime.InteropServices;
public static class MGTemplateWindow {
    delegate bool EnumProc(IntPtr handle, IntPtr state);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr state);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
    [DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr handle, int command);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr handle, IntPtr insertAfter, int x, int y, int width, int height, uint flags);
    static uint target;
    static int command;
    static bool Visit(IntPtr handle, IntPtr state) {
        uint processId;
        GetWindowThreadProcessId(handle, out processId);
        if (processId == target) {
            const uint keepSizeOrderNoActivate = 0x0001 | 0x0004 | 0x0010 | 0x4000;
            if (command == 0) {
                SetWindowPos(handle, IntPtr.Zero, -32000, -32000, 0, 0, keepSizeOrderNoActivate);
                ShowWindowAsync(handle, 0);
            } else {
                SetWindowPos(handle, IntPtr.Zero, 120, 120, 0, 0, keepSizeOrderNoActivate);
                ShowWindowAsync(handle, command);
            }
        }
        return true;
    }
    public static void Set(int processId, int windowCommand) {
        target = (uint)processId;
        command = windowCommand;
        EnumWindows(Visit, IntPtr.Zero);
    }
}
'@
Add-Type -TypeDefinition $source -ErrorAction Stop

function Read-TrackedPids {
    $items = @()
    if (Test-Path -LiteralPath $PidFile) {
        $items += (Get-Content -LiteralPath $PidFile -Raw) -split ','
    }
    if ($LauncherPid -gt 0) { $items += $LauncherPid }
    return @($items | ForEach-Object { $number = 0; if ([int]::TryParse([string]$_, [ref]$number) -and $number -gt 0) { $number } } | Select-Object -Unique)
}

if ($Mode -eq 'Show') {
    foreach ($targetPid in Read-TrackedPids) {
        try { [void][Diagnostics.Process]::GetProcessById($targetPid); [MGTemplateWindow]::Set($targetPid, 9); [MGTemplateWindow]::Set($targetPid, 5) } catch {}
    }
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    if ($ReadyFile) { Remove-Item -LiteralPath $ReadyFile -Force -ErrorAction SilentlyContinue }
    if ($ExpectedPidFile) { Remove-Item -LiteralPath $ExpectedPidFile -Force -ErrorAction SilentlyContinue }
    exit 0
}

$excluded = @{}
foreach ($value in ($BeforePids -split ',')) { $number = 0; if ([int]::TryParse($value, [ref]$number) -and $number -gt 0) { $excluded[$number] = $true } }
$targets = New-Object 'System.Collections.Generic.HashSet[int]'
if ($LauncherPid -gt 0) { [void]$targets.Add($LauncherPid) }
Write-MonitorLog ('monitor launcher=' + $LauncherPid + ' excluded=' + ($excluded.Keys -join ','))
if ($ReadyFile) { Set-Content -LiteralPath $ReadyFile -Value 'ready' -Encoding ASCII }
$deadline = (Get-Date).AddSeconds(60)
$lastLive = Get-Date
$observed = $false
while ($true) {
    if ($ExpectedPidFile) {
        if (Test-Path -LiteralPath $ExpectedPidFile) {
            $number = 0
            if ([int]::TryParse((Get-Content -LiteralPath $ExpectedPidFile -Raw).Trim(), [ref]$number) -and $number -gt 0) { [void]$targets.Add($number) }
        }
    } else {
        foreach ($process in (Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like 'AfterFX*' -and -not $excluded.ContainsKey($_.Id) })) {
            [void]$targets.Add([int]$process.Id)
        }
    }
    $live = @()
    foreach ($targetPid in @($targets)) {
        try {
            [void][Diagnostics.Process]::GetProcessById($targetPid)
            $live += $targetPid
            [MGTemplateWindow]::Set($targetPid, 0)
        } catch { Write-MonitorLog ('process ' + $targetPid + ' unavailable: ' + $_.Exception.Message) }
    }
    if ($live.Count -gt 0) {
        $observed = $true
        $lastLive = Get-Date
        Set-Content -LiteralPath $PidFile -Value ($live -join ',') -Encoding ASCII
        Write-MonitorLog ('live=' + ($live -join ','))
    } elseif (($observed -and ((Get-Date) - $lastLive).TotalSeconds -ge 5) -or (Get-Date) -gt $deadline) {
        break
    }
    Start-Sleep -Milliseconds 40
}
