const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const prepare = JSON.parse(fs.readFileSync(path.join(root, 'test-results', 'ae-template-prepare.json'), 'utf8'));
if (prepare.failed.length || !prepare.job) throw new Error('template prepare stage did not produce a job');
const job = prepare.job;
const monitorScript = job.windowMonitor || path.join(root, 'extension', 'host', 'template-window-monitor.ps1');
const pidFile = path.join(root, 'test-results', 'template-window-pids.txt');
const readyFile = pidFile + '.ready';
const expectedPidFile = pidFile + '.expected';
const logFile = path.join(root, 'test-results', 'template-window-monitor-debug.log');
for (const file of [pidFile, readyFile, expectedPidFile, logFile]) { try { fs.unlinkSync(file); } catch {} }

function aePids() {
  try {
    const text = String(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', '(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like "AfterFX*" } | ForEach-Object { $_.Id }) -join ","'], { windowsHide: true, encoding: 'utf8' }) || '').trim();
    return text ? text.split(',').map(Number).filter(Number.isFinite) : [];
  } catch { return []; }
}

const probeSource = 'using System;using System.Runtime.InteropServices;public static class MGWindowProbe{delegate bool EnumProc(IntPtr h,IntPtr l);[StructLayout(LayoutKind.Sequential)]struct Rect{public int L,T,R,B;}[DllImport("user32.dll")]static extern bool EnumWindows(EnumProc c,IntPtr l);[DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);[DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr h);[DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr h,out Rect r);[DllImport("user32.dll")]static extern int GetSystemMetrics(int n);static uint target;static int total;static int onScreen;static bool Visit(IntPtr h,IntPtr l){uint p;GetWindowThreadProcessId(h,out p);if(p==target){total++;Rect r;if(IsWindowVisible(h)&&GetWindowRect(h,out r)){int x=GetSystemMetrics(76),y=GetSystemMetrics(77),w=GetSystemMetrics(78),v=GetSystemMetrics(79);if(r.R>x&&r.L<x+w&&r.B>y&&r.T<y+v)onScreen++;}}return true;}public static string Probe(int p){target=(uint)p;total=0;onScreen=0;EnumWindows(Visit,IntPtr.Zero);return total+","+onScreen;}}';
function quote(value) { return "'" + String(value).replace(/'/g, "''") + "'"; }
function trackedPids() {
  try { return fs.readFileSync(pidFile, 'utf8').trim().split(',').map(Number).filter(Number.isFinite); } catch { return []; }
}
function probe(pids) {
  if (!pids.length) return [];
  const command = `$src=${quote(probeSource)};Add-Type -TypeDefinition $src -ErrorAction Stop;${pids.map(pid => `[MGWindowProbe]::Probe(${pid})`).join(';')}`;
  try {
    return String(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', command], { windowsHide: true, encoding: 'utf8' }) || '').trim().split(/\r?\n/).filter(Boolean).map(line => line.split(',').map(Number));
  } catch { return []; }
}

const before = aePids();
const monitor = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', monitorScript, '-Mode', 'Monitor', '-LauncherPid', '0', '-BeforePids', before.join(','), '-PidFile', pidFile, '-ReadyFile', readyFile, '-ExpectedPidFile', expectedPidFile, '-LogFile', logFile], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
monitor.unref();
let monitorOutput = '';
monitor.stdout.on('data', chunk => { monitorOutput += chunk; });
monitor.stderr.on('data', chunk => { monitorOutput += chunk; });
const waitArray = new Int32Array(new SharedArrayBuffer(4));
const readyDeadline = Date.now() + 5000;
while (!fs.existsSync(readyFile) && Date.now() < readyDeadline) Atomics.wait(waitArray, 0, 0, 50);
const child = spawn(job.command, ['-noui', '-m', '-r', job.launchFile], { windowsHide: true, detached: true, stdio: 'ignore' });
fs.writeFileSync(expectedPidFile, String(child.pid), 'ascii');
child.unref();

const started = Date.now();
const samples = [];
let observed = [];
let observedAe = [];
const timer = setInterval(() => {
  observedAe = Array.from(new Set(observedAe.concat(aePids().filter(pid => !before.includes(pid)))));
  const tracked = trackedPids();
  if (tracked.length) {
    observed = Array.from(new Set(observed.concat(tracked)));
    samples.push(...probe(tracked));
  }
  let status = null;
  try { status = JSON.parse(fs.readFileSync(job.statusFile, 'utf8')); } catch {}
  if (status && (status.state === 'done' || status.state === 'error')) {
    clearInterval(timer);
    try { monitor.kill(); } catch {}
    const finalTracked = trackedPids();
    observed = Array.from(new Set(observed.concat(finalTracked)));
    if (finalTracked.length) samples.push(...probe(finalTracked));
    const result = {
      launcherPid: child.pid,
      trackedPids: observed,
      observedAePids: observedAe,
      excludedPids: before,
      status,
      windowSamples: samples.length,
      windowsObserved: samples.some(item => item[0] > 0),
      onScreenWindowsAfterMonitor: samples.reduce((sum, item) => sum + item[1], 0),
      monitorReady: fs.existsSync(logFile),
      monitorOutput: monitorOutput.trim()
    };
    fs.writeFileSync(path.join(root, 'test-results', 'ae-template-window.json'), JSON.stringify(result, null, 2), 'utf8');
    console.log(JSON.stringify(result, null, 2));
    const reveal = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', monitorScript, '-Mode', 'Show', '-LauncherPid', String(child.pid), '-PidFile', pidFile, '-ReadyFile', readyFile, '-ExpectedPidFile', expectedPidFile], { windowsHide: true, stdio: 'ignore' });
    reveal.unref();
    process.exit(status.state === 'done' && observed.length > 0 && result.onScreenWindowsAfterMonitor === 0 ? 0 : 1);
  }
  if (Date.now() - started > 240000) {
    clearInterval(timer);
    try { monitor.kill(); } catch {}
    console.error('template worker timed out');
    process.exit(2);
  }
}, 700);
