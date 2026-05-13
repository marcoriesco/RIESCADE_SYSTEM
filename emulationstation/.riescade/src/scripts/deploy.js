const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const rootDir = path.join(__dirname, '..', '..')
const distSource = path.join(__dirname, '..', 'dist', 'win-unpacked')
const distDest = path.join(__dirname, '..', '..') // c:\tmp\RIESCADE_SYSTEM\emulationstation\.riescade
const rootExe = path.join(__dirname, '..', '..', '..', '..', 'RIESCADE.exe') // c:\tmp\RIESCADE_SYSTEM\RIESCADE.exe
const targetExe = path.join(distDest, 'RIESCADE.exe')
const retroBatRoot = path.dirname(rootExe)
const iconIcoSource = path.join(__dirname, '..', 'src', 'main', 'theme_default', 'assets', '_parts', 'riescade.ico')
const iconIco = path.join(distDest, 'resources', 'riescade.ico')
const themeSource = path.join(__dirname, '..', 'src', 'main', 'theme_default')
const themeDest = path.join(distDest, 'themes', 'default')

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src)
  const stats = exists && fs.statSync(src)
  const isDirectory = exists && stats.isDirectory()
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest)
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName))
    })
  } else {
    const copyWithRetry = (from, to) => {
      const maxRetries = 8
      const delayMs = 150

      // Ensure destination directory exists
      const destDir = path.dirname(to)
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          fs.copyFileSync(from, to)
          return
        } catch (e) {
          const code = e?.code
          if (code !== 'EBUSY' && code !== 'EPERM') throw e
          if (attempt === maxRetries) {
            throw new Error(
              `File is locked: ${from}\nClose RIESCADE/EmulationStation and retry deploy. Original: ${e.message || e}`
            )
          }
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs)
        }
      }
    }

    copyWithRetry(src, dest)
  }
}

function copyTheme(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === 'scss') continue // Skip scss folder
      copyTheme(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

console.log('🚀 Starting deployment...')

// 1. Copy unpacked build to .riescade root
if (fs.existsSync(distSource)) {
  console.log(`📦 Copying build from ${distSource} to ${distDest}...`)
  copyRecursiveSync(distSource, distDest)
} else {
  console.log('⚠️ Build source not found. Make sure you ran "npm run build" first.')
  process.exit(1)
}

// 1.2 Copy/Update Default Theme in themes/default
console.log(`🎨 Deploying default theme to ${themeDest}...`)
copyTheme(themeSource, themeDest)

// 1.1 Cleanup accidental Electron runtime files in RetroBat root (keep only the launcher)
try {
  const runtimeEntries = fs.readdirSync(distSource, { withFileTypes: true })
  runtimeEntries.forEach((entry) => {
    if (entry.name === 'RIESCADE.exe') return
    const destPath = path.join(retroBatRoot, entry.name)
    if (!fs.existsSync(destPath)) return

    try {
      const st = fs.lstatSync(destPath)
      if (st.isDirectory()) fs.rmSync(destPath, { recursive: true, force: true })
      else fs.unlinkSync(destPath)
    } catch {}
  })
} catch {}

// 2. Create hard link/copy for RIESCADE.exe in the root
console.log(`🔗 Creating shortcut/launcher at ${rootExe}...`)
try {
  if (fs.existsSync(rootExe)) fs.unlinkSync(rootExe)
} catch {}

const escapePs = (s) => String(s).replace(/`/g, '``').replace(/"/g, '`"')

try {
  try {
    if (fs.existsSync(iconIcoSource)) fs.copyFileSync(iconIcoSource, iconIco)
  } catch {}

  const ps = `
$ErrorActionPreference = 'Stop'
$outExe = "${escapePs(rootExe)}"
$targetExe = "${escapePs(targetExe)}"
$workDir = "${escapePs(distDest)}"
$icon = "${escapePs(iconIco)}"

if (Test-Path $outExe) { Remove-Item -Force $outExe }

$rt = [System.Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
$csc = Join-Path $rt "csc.exe"
if (!(Test-Path $csc)) { throw "csc.exe not found at: $csc" }

$src = Join-Path $env:TEMP "riescade_launcher.cs"

$code = @"
using System;
using System.Diagnostics;
using System.IO;

public static class RiescadeLauncher
{
  public static int Main(string[] args)
  {
    try
    {
      string targetExe = @"${escapePs(targetExe)}";
      string workDir = @"${escapePs(distDest)}";

      if (!File.Exists(targetExe))
      {
        Console.Error.WriteLine("Missing target exe: " + targetExe);
        return 2;
      }

      var psi = new ProcessStartInfo
      {
        FileName = targetExe,
        WorkingDirectory = workDir,
        UseShellExecute = false,
      };

      Process.Start(psi);
      return 0;
    }
    catch (Exception ex)
    {
      Console.Error.WriteLine(ex.ToString());
      return 1;
    }
  }
}
"@

Set-Content -Path $src -Value $code -Encoding UTF8

$args = @(
  "/nologo",
  "/target:winexe",
  "/optimize+",
  "/out:$outExe",
  $src
)

if (Test-Path $icon) {
  $args = @("/win32icon:$icon") + $args
}

& $csc @args | Out-Null
`

  const encoded = Buffer.from(ps, 'utf16le').toString('base64')
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, { stdio: 'inherit' })
  console.log('✅ Launcher created successfully!')
} catch (e) {
  console.log('⚠️ Failed to compile launcher exe. Creating .cmd fallback...')
  const cmdPath = path.join(retroBatRoot, 'RIESCADE.cmd')
  const cmd = `@echo off\r\npushd "${distDest}"\r\nstart "" "${targetExe}"\r\npopd\r\n`
  fs.writeFileSync(cmdPath, cmd, 'utf8')
  console.log(`✅ Fallback launcher created: ${cmdPath}`)
}

console.log('🎉 Deployment complete!')
