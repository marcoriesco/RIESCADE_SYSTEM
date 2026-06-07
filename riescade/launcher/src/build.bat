@echo off
set MSBUILD_PATH="C:\Windows\Microsoft.NET\Framework\v4.0.30319\MSBuild.exe"
if not exist %MSBUILD_PATH% (
    echo MSBuild not found at %MSBUILD_PATH%
    exit /b 1
)

echo Building solution in Release configuration...
set ROSLYN_PATH=c:\tmp\RIESCADE_SYSTEM\riescade\launcher\src\packages\Microsoft.Net.Compilers.2.10.0\tools
%MSBUILD_PATH% "source\batocera-ports.sln" /p:Configuration=Release /p:Platform="Any CPU" /p:CscToolPath="%ROSLYN_PATH%" /p:CscToolExe="csc.exe" /p:LangVersion=latest /t:Rebuild /m
if %errorlevel% neq 0 (
    echo Build failed!
    exit /b %errorlevel%
)

echo Build succeeded!

echo Copying built artifacts to launcher directory...
copy /Y "source\emulatorLauncher\bin\Release\emulatorLauncher.exe" "..\emulatorLauncher.exe"
copy /Y "source\emulatorLauncher\bin\Release\*.dll" "..\"
copy /Y "source\batocera-bluetooth\bin\Release\batocera-bluetooth.exe" "..\batocera-bluetooth.exe"
copy /Y "source\batocera-retroachievements-info\bin\Release\batocera-retroachievements-info.exe" "..\batocera-retroachievements-info.exe"
copy /Y "source\batocera-store\bin\Release\batocera-store.exe" "..\batocera-store.exe"
copy /Y "source\batocera-systems\bin\Release\batocera-systems.exe" "..\batocera-systems.exe"
copy /Y "source\es-checkversion\bin\Release\es-checkversion.exe" "..\es-checkversion.exe"
copy /Y "source\es-update\bin\Release\es-update.exe" "..\es-update.exe"
copy /Y "source\mount\bin\Release\mount.exe" "..\mount.exe"
copy /Y "source\x64controllers\bin\Release\x64controllers.exe" "..\x64controllers.exe"

