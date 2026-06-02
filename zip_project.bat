@echo off
setlocal Enabledelayedexpansion
cd /d "%~dp0"
echo ===================================================
echo RIESCADE SYSTEM - PORTABLE PROJECT PACKAGER
echo ===================================================
echo.
echo Packaging project into RIESCADE_SYSTEM.zip...
echo Excluding internal files of: bios, emulators, roms, saves, screenshots.
echo Excluding entirely: .git, .gitignore, .env, src/, node_modules, and previous ZIPs.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$temp = Join-Path $env:TEMP 'riescade_zip_temp'; ^
   if (Test-Path $temp) { Remove-Item -Path $temp -Recurse -Force }; ^
   New-Item -ItemType Directory -Path $temp | Out-Null; ^
   $exclude = @('bios', 'emulators', 'roms', 'saves', 'screenshots', '.git', '.gitignore', '.env', '.env.local', 'RIESCADE_SYSTEM.zip', 'zip_project.bat', 'node_modules'); ^
   Get-ChildItem -Path . -Force | Where-Object { $_.Name -notin $exclude } | ForEach-Object { ^
       Copy-Item -Path $_.FullName -Destination $temp -Recurse -Force ^
   }; ^
   $srcDir = Join-Path (Join-Path (Join-Path $temp 'emulationstation') '.riescade') 'src'; ^
   if (Test-Path $srcDir) { Remove-Item -Path $srcDir -Recurse -Force }; ^
   $emptyFolders = @('bios', 'emulators', 'roms', 'saves', 'screenshots'); ^
   foreach ($folder in $emptyFolders) { ^
       $folderPath = Join-Path $temp $folder; ^
       New-Item -ItemType Directory -Path $folderPath -Force | Out-Null; ^
       New-Item -ItemType File -Path (Join-Path $folderPath '.keep') -Force | Out-Null ^
   }; ^
   Compress-Archive -Path (Join-Path $temp '*') -DestinationPath 'RIESCADE_SYSTEM.zip' -Force; ^
   Remove-Item -Path $temp -Recurse -Force"

echo.
echo ===================================================
echo Success! Created RIESCADE_SYSTEM.zip
echo ===================================================
pause
