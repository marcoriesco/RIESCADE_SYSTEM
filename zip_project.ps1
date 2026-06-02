# Packaging script for RIESCADE SYSTEM - PORTABLE PROJECT PACKAGER
$ErrorActionPreference = 'Stop'

# Resolve paths
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrEmpty($scriptDir)) {
    $scriptDir = (Get-Item .).FullName
}
Set-Location $scriptDir

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "RIESCADE SYSTEM - PORTABLE PROJECT PACKAGER" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Packaging project into RIESCADE_SYSTEM.zip..."

$temp = Join-Path $env:TEMP 'riescade_zip_temp'
$zipPath = Join-Path $scriptDir 'RIESCADE_SYSTEM.zip'

# Clean previous temp and zip
if (Test-Path $temp) {
    Remove-Item -Path $temp -Recurse -Force
}
if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
}
New-Item -ItemType Directory -Path $temp | Out-Null

# --- ROOT FILES: only RIESCADE.exe and README.md ---
$rootFiles = @('RIESCADE.exe', 'README.md')
foreach ($file in $rootFiles) {
    $src = Join-Path $scriptDir $file
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination (Join-Path $temp $file) -Force
        Write-Host "   [OK] $file"
    } else {
        Write-Host "   [WARN] $file not found, skipping." -ForegroundColor Yellow
    }
}

# --- EMULATIONSTATION folder (complete .riescade minus src/) ---
$esSource = Join-Path $scriptDir 'emulationstation'
$esDest = Join-Path $temp 'emulationstation'
if (Test-Path $esSource) {
    Copy-Item -Path $esSource -Destination $esDest -Recurse -Force
    # Remove the development source code folder
    $srcDir = Join-Path (Join-Path $esDest '.riescade') 'src'
    if (Test-Path $srcDir) {
        Remove-Item -Path $srcDir -Recurse -Force
        Write-Host "   [OK] emulationstation/.riescade/ (src/ excluded)"
    } else {
        Write-Host "   [OK] emulationstation/"
    }
}

# --- EMPTY PLACEHOLDER FOLDERS ---
$emptyFolders = @('bios', 'emulators', 'roms', 'saves', 'screenshots')
foreach ($folder in $emptyFolders) {
    $folderPath = Join-Path $temp $folder
    New-Item -ItemType Directory -Path $folderPath -Force | Out-Null
    # Create an empty .keep file to ensure all zip tools/git preserve it
    New-Item -ItemType File -Path (Join-Path $folderPath '.keep') -Force | Out-Null
    Write-Host "   [OK] $folder/ (.keep)"
}

# --- ADDITIONAL ROOT FOLDERS (sounds, decorations, cheats, system, user) ---
$extraFolders = @('sounds', 'decorations', 'cheats', 'system', 'user')
foreach ($folder in $extraFolders) {
    $src = Join-Path $scriptDir $folder
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination (Join-Path $temp $folder) -Recurse -Force
        Write-Host "   [OK] $folder/"
    }
}

# --- Compress using .NET ZipFile to include empty folders ---
Write-Host "Creating ZIP archive..." -ForegroundColor Cyan
[System.Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem') | Out-Null
[System.IO.Compression.ZipFile]::CreateFromDirectory($temp, $zipPath)

# Cleanup
if (Test-Path $temp) {
    Remove-Item -Path $temp -Recurse -Force
}

$zipSizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "Success! Created RIESCADE_SYSTEM.zip ($zipSizeMB MB)" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
