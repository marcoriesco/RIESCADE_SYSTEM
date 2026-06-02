const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const rootDir = path.join(__dirname, '..', '..')
const distSource = path.join(__dirname, '..', 'dist', 'win-unpacked')
const distDest = path.join(__dirname, '..', '..') // c:\tmp\RIESCADE_SYSTEM\emulationstation\.riescade
const rootExe = path.join(__dirname, '..', '..', '..', '..', 'RIESCADE.exe') // c:\tmp\RIESCADE_SYSTEM\RIESCADE.exe
const targetExe = path.join(distDest, 'RIESCADE.exe')
const retroBatRoot = path.dirname(rootExe)
const iconIcoSource = path.join(__dirname, '..', 'src', 'main', 'theme_default', 'assets', 'riescade.ico')
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

console.log('🚀 Starting deployment...')

// 1. Copy unpacked build to .riescade root
if (fs.existsSync(distSource)) {
  console.log(`📦 Copying build from ${distSource} to ${distDest}...`)
  copyRecursiveSync(distSource, distDest)
} else {
  console.log('⚠️ Build source not found. Make sure you ran "npm run build" first.')
  process.exit(1)
}

// 1.2 Copy/Update Default Theme in themes/default - Removed as default theme is now loaded internally
// console.log(`🎨 Deploying default theme to ${themeDest}...`)
// copyTheme(themeSource, themeDest)

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

// 2. Create portable launcher for RIESCADE.exe in the root
// The launcher resolves paths RELATIVE to its own location at runtime,
// so the entire folder can be moved anywhere and it still works.
const relTargetExe = path.relative(retroBatRoot, targetExe).replace(/\//g, '\\')
const relWorkDir = path.relative(retroBatRoot, distDest).replace(/\//g, '\\')
const relIcon = path.relative(retroBatRoot, iconIco).replace(/\//g, '\\')

console.log(`🔗 Creating portable launcher at ${rootExe}...`)
console.log(`   Relative target: ${relTargetExe}`)
console.log(`   Relative workdir: ${relWorkDir}`)
try {
  if (fs.existsSync(rootExe)) fs.unlinkSync(rootExe)
} catch {}

const escapePs = (s) => String(s).replace(/`/g, '``').replace(/\"/g, '`"')
const escapeCs = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')

try {
  try {
    if (fs.existsSync(iconIcoSource)) fs.copyFileSync(iconIcoSource, iconIco)
  } catch {}

  const ps = `
$ErrorActionPreference = 'Stop'
$outExe = "${escapePs(rootExe)}"
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
using System.Reflection;

public static class RiescadeLauncher
{
  public static int Main(string[] args)
  {
    try
    {
      // Resolve paths relative to the launcher exe location (portable)
      string launcherDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
      string targetExe = Path.GetFullPath(Path.Combine(launcherDir, "${escapeCs(relTargetExe)}"));
      string workDir = Path.GetFullPath(Path.Combine(launcherDir, "${escapeCs(relWorkDir)}"));

      if (!File.Exists(targetExe))
      {
        System.Windows.Forms.MessageBox.Show(
          "RIESCADE.exe not found at:\\n" + targetExe + "\\n\\nMake sure the folder structure is intact.",
          "RIESCADE - Error",
          System.Windows.Forms.MessageBoxButtons.OK,
          System.Windows.Forms.MessageBoxIcon.Error);
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
      System.Windows.Forms.MessageBox.Show(
        "Failed to start RIESCADE:\\n" + ex.Message,
        "RIESCADE - Error",
        System.Windows.Forms.MessageBoxButtons.OK,
        System.Windows.Forms.MessageBoxIcon.Error);
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
  "/reference:System.Windows.Forms.dll",
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
  console.log('✅ Portable launcher created successfully!')
} catch (e) {
  console.log('⚠️ Failed to compile launcher exe. Creating .cmd fallback...')
  const cmdPath = path.join(retroBatRoot, 'RIESCADE.cmd')
  // Fallback also uses relative paths for portability
  const cmd = `@echo off\r\nset "LAUNCHER_DIR=%~dp0"\r\npushd "%LAUNCHER_DIR%${relWorkDir}"\r\nstart "" "%LAUNCHER_DIR%${relTargetExe}"\r\npopd\r\n`
  fs.writeFileSync(cmdPath, cmd, 'utf8')
  console.log(`✅ Fallback launcher created: ${cmdPath}`)
}

// 3. Create RIESCADEUpdater.exe inside emulationstation/ folder
const updaterExe = path.join(retroBatRoot, 'emulationstation', 'RIESCADEUpdater.exe')
console.log(`🔗 Creating updater at ${updaterExe}...`)
try {
  if (fs.existsSync(updaterExe)) fs.unlinkSync(updaterExe)
} catch {}

try {
  const tempDir = process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp'
  const updaterCsPath = path.join(tempDir, 'riescade_updater.cs')
  
  const updaterCode = `using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

public static class RiescadeUpdater
{
    public static int Main(string[] args)
    {
        if (args.Length < 3)
        {
            MessageBox.Show(
                "Usage: RIESCADEUpdater.exe <zipPath> <currentAppDir> <execPath>",
                "RIESCADE Updater Error",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }

        string zipPath = args[0];
        string currentAppDir = args[1];
        string execPath = args[2];

        // Cleanup any .old files from previous runs
        try
        {
            string selfPath = Assembly.GetExecutingAssembly().Location;
            string oldSelf = selfPath + ".old";
            if (File.Exists(oldSelf))
            {
                File.Delete(oldSelf);
            }
        }
        catch {}

        try
        {
            // 1. Wait for RIESCADE processes to close
            Thread.Sleep(2000);
            var currentPid = Process.GetCurrentProcess().Id;
            foreach (var process in Process.GetProcessesByName("RIESCADE"))
            {
                if (process.Id != currentPid)
                {
                    try
                    {
                        if (!process.HasExited)
                        {
                            process.WaitForExit(5000);
                        }
                    }
                    catch {}
                }
            }

            foreach (var process in Process.GetProcessesByName("riescade"))
            {
                if (process.Id != currentPid)
                {
                    try
                    {
                        if (!process.HasExited)
                        {
                            process.WaitForExit(5000);
                        }
                    }
                    catch {}
                }
            }

            // 2. Prepare temp extraction directory
            string tempExtractDir = Path.Combine(Path.GetTempPath(), "rcupd");
            if (Directory.Exists(tempExtractDir))
            {
                Directory.Delete(tempExtractDir, true);
            }
            Directory.CreateDirectory(tempExtractDir);

            // 3. Extract the ZIP / 7Z
            if (!File.Exists(zipPath))
            {
                throw new FileNotFoundException("Update file not found: " + zipPath);
            }
            
            string extension = Path.GetExtension(zipPath).ToLower();
            if (extension == ".7z")
            {
                string selfDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
                string sevenZipExe = Path.Combine(selfDir, "7z.exe");
                if (!File.Exists(sevenZipExe))
                {
                    sevenZipExe = "7z.exe"; // Fallback to PATH
                    if (!File.Exists(sevenZipExe) && File.Exists("C:\\\\Program Files\\\\7-Zip\\\\7z.exe"))
                    {
                        sevenZipExe = "C:\\\\Program Files\\\\7-Zip\\\\7z.exe";
                    }
                }

                var startInfo = new ProcessStartInfo
                {
                    FileName = sevenZipExe,
                    Arguments = string.Format("x \\"{0}\\" -o\\"{1}\\" -y", zipPath, tempExtractDir),
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };

                using (var process = Process.Start(startInfo))
                {
                    process.WaitForExit();
                    if (process.ExitCode != 0)
                    {
                        string err = process.StandardError.ReadToEnd();
                        string opt = process.StandardOutput.ReadToEnd();
                        throw new Exception("7-Zip extraction failed with exit code " + process.ExitCode + "\\nOutput: " + opt + "\\nError: " + err);
                    }
                }
            }
            else
            {
                ZipFile.ExtractToDirectory(zipPath, tempExtractDir);
            }

            // 4. Find the source directory to copy from
            string srcDir = tempExtractDir;
            string[] foundExes = Directory.GetFiles(tempExtractDir, "RIESCADE.exe", SearchOption.AllDirectories);
            if (foundExes.Length > 0)
            {
                Array.Sort(foundExes, (a, b) => a.Length.CompareTo(b.Length));
                srcDir = Path.GetDirectoryName(foundExes[0]);
            }

            // 5. Recursively copy files to currentAppDir
            CopyDirectory(srcDir, currentAppDir);

            // 6. Clean up
            try
            {
                Directory.Delete(tempExtractDir, true);
            }
            catch {}
            try
            {
                File.Delete(zipPath);
            }
            catch {}

            // 7. Re-launch RIESCADE.exe
            if (File.Exists(execPath))
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = execPath,
                    WorkingDirectory = Path.GetDirectoryName(execPath),
                    UseShellExecute = true
                });
            }
            else
            {
                MessageBox.Show(
                    "Update completed, but launcher executable was not found:\\n" + execPath,
                    "RIESCADE Updater Warning",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
            }

            return 0;
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "An error occurred during update installation:\\n\\n" + ex.Message + "\\n\\n" + ex.StackTrace,
                "RIESCADE Updater Error",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }
    }

    private static void CopyDirectory(string sourceDir, string destDir)
    {
        if (!Directory.Exists(destDir))
        {
            Directory.CreateDirectory(destDir);
        }

        foreach (string file in Directory.GetFiles(sourceDir))
        {
            string destFile = Path.Combine(destDir, Path.GetFileName(file));
            
            // Check if we are trying to copy RIESCADEUpdater.exe (ourselves)
            if (string.Equals(Path.GetFileName(file), "RIESCADEUpdater.exe", StringComparison.OrdinalIgnoreCase))
            {
                if (File.Exists(destFile))
                {
                    try
                    {
                        string oldFile = destFile + ".old";
                        if (File.Exists(oldFile))
                        {
                            File.Delete(oldFile);
                        }
                        File.Move(destFile, oldFile);
                    }
                    catch
                    {
                        // If rename fails, skip copying this file to prevent updater crash
                        continue;
                    }
                }
            }

            int attempts = 0;
            while (true)
            {
                try
                {
                    File.Copy(file, destFile, true);
                    break;
                }
                catch (Exception)
                {
                    attempts++;
                    if (attempts >= 20)
                    {
                        throw;
                    }
                    Thread.Sleep(1000);
                }
            }
        }

        foreach (string subDir in Directory.GetDirectories(sourceDir))
        {
            string destSubDir = Path.Combine(destDir, Path.GetFileName(subDir));
            CopyDirectory(subDir, destSubDir);
        }
    }
}
`

  fs.writeFileSync(updaterCsPath, updaterCode, 'utf8')

  const psUpdater = `
$ErrorActionPreference = 'Stop'
$outExe = "${escapePs(updaterExe)}"

if (Test-Path $outExe) { Remove-Item -Force $outExe }

$rt = [System.Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
$csc = Join-Path $rt "csc.exe"
if (!(Test-Path $csc)) { throw "csc.exe not found at: $csc" }

$args = @(
  "/nologo",
  "/target:winexe",
  "/optimize+",
  "/reference:System.Windows.Forms.dll",
  "/reference:System.IO.Compression.dll",
  "/reference:System.IO.Compression.FileSystem.dll",
  "/out:$outExe",
  "${escapePs(updaterCsPath)}"
)

& $csc @args | Out-Null
`

  const encodedUpdater = Buffer.from(psUpdater, 'utf16le').toString('base64')
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedUpdater}`, { stdio: 'inherit' })
  console.log('✅ Updater compiled successfully!')

  try {
    fs.unlinkSync(updaterCsPath)
  } catch {}
} catch (e) {
  console.error('❌ Failed to compile RIESCADEUpdater.exe:', e.message || e)
}

console.log('🎉 Deployment complete!')
