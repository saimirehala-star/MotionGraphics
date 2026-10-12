param([switch]$EnableDevelopmentMode)
$ErrorActionPreference = 'Stop'
$sourceDir = Join-Path $PSScriptRoot 'extension'
if (-not (Test-Path -LiteralPath $sourceDir)) { $sourceDir = Join-Path $PSScriptRoot 'MotionGraphicsUserPresets' }
if (-not (Test-Path -LiteralPath (Join-Path $sourceDir 'CSXS\manifest.xml'))) { throw '找不到 Motion Graphics 扩展文件。请完整解压后再运行。' }
$cepVersions = @('11', '12')
foreach ($cepVersion in $cepVersions) {
    $key = "HKCU:\Software\Adobe\CSXS.$cepVersion"
    $debugMode = (Get-ItemProperty -Path $key -Name 'PlayerDebugMode' -ErrorAction SilentlyContinue).PlayerDebugMode
    if ($debugMode -ne '1' -and -not $EnableDevelopmentMode) { throw '开发包需要 CEP 11/12 未签名扩展加载权限。若同意启用，请运行 .\install.ps1 -EnableDevelopmentMode；这也允许其他未签名扩展加载。' }
}
$targetRoot = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Adobe\CEP\extensions'))
$targetDir = [IO.Path]::GetFullPath((Join-Path $targetRoot 'MotionGraphicsUserPresets'))
if ($targetDir -ne (Join-Path $targetRoot 'MotionGraphicsUserPresets')) { throw 'Unsafe installation path.' }
if ((Test-Path -LiteralPath $targetRoot) -and ((Get-Item -LiteralPath $targetRoot).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Refusing a redirected installation root.' }
New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
if (Test-Path -LiteralPath $targetDir) {
    if ((Get-Item -LiteralPath $targetDir).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing a redirected installation directory.' }
    $backupRoot = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'MotionGraphics\backups'))
    $backupDir = [IO.Path]::GetFullPath((Join-Path $backupRoot (Get-Date -Format 'yyyyMMdd-HHmmss-fff')))
    if (-not $backupDir.StartsWith($backupRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe backup path.' }
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    Move-Item -LiteralPath $targetDir -Destination $backupDir
    Write-Output "旧版本已备份到：$backupDir"
}
Copy-Item -LiteralPath $sourceDir -Destination $targetDir -Recurse -Force
if ($EnableDevelopmentMode) {
    foreach ($cepVersion in $cepVersions) {
        $key = "HKCU:\Software\Adobe\CSXS.$cepVersion"
        New-Item -Path $key -Force | Out-Null
        New-ItemProperty -Path $key -Name 'PlayerDebugMode' -Value '1' -PropertyType String -Force | Out-Null
    }
}
Write-Output 'Motion Graphics Team Templates 2.8.0 已安装。请重启 AE 2023–2026，然后打开：窗口 > 扩展 > Motion Graphics · Team Templates'
