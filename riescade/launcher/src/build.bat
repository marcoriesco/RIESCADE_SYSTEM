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

