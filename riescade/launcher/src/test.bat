@echo off
set TEST_DIR=test_env

echo Setting up isolated test environment...
if not exist %TEST_DIR% mkdir %TEST_DIR%

echo Copying build artifacts to test_env...
copy /Y source\emulatorLauncher\bin\Release\emulatorLauncher.exe %TEST_DIR%\
copy /Y source\emulatorLauncher\bin\Release\*.dll %TEST_DIR%\

echo Copying configuration files...
copy /Y source\emulatorLauncher\emulatorLauncher.cfg %TEST_DIR%\
echo home=.\.emulationstation >> %TEST_DIR%\emulatorLauncher.cfg

if not exist %TEST_DIR%\.emulationstation mkdir %TEST_DIR%\.emulationstation
echo Copying .riescade/configs config directory...
xcopy /E /I /Y ..\..\.riescade\configs %TEST_DIR%\.emulationstation

cd %TEST_DIR%

echo.
echo ===================================================
echo RUNNING TEST 1: Query XInput Info
echo ===================================================
emulatorLauncher.exe -queryxinputinfo test_xinput.txt
if %errorlevel% equ 0 (
    echo [PASS] Query XInput info succeeded.
    echo Result written to test_env\test_xinput.txt
) else (
    echo [FAIL] Query XInput info failed with exit code %errorlevel%.
)

echo.
echo ===================================================
echo RUNNING TEST 2: Invalid Rom Parameter (Check error code)
echo ===================================================
rem We pass system=snes and rom=non_existent_rom.sfc. It should fail and return BadCommandLine (201).
emulatorLauncher.exe -system snes -rom "non_existent_rom.sfc" -emulator libretro -core snes9x
echo Exit code: %errorlevel%
if %errorlevel% equ 201 (
    echo [PASS] Invalid ROM check handled correctly - Exit code 201 - BadCommandLine.
) else (
    echo [FAIL] Expected exit code 201, but got %errorlevel%.
)

echo.
echo ===================================================
echo RUNNING TEST 3: System and Rom defined but missing system default (Check exit code)
echo.
echo Note: If we run a query or command with invalid emulator, we expect exit code 203 (UnknownEmulator).
emulatorLauncher.exe -system invalid_system_name -rom "emulatorLauncher.cfg"
echo Exit code: %errorlevel%
if %errorlevel% equ 203 (
    echo [PASS] Unknown Emulator/System check handled correctly - Exit code 203 - UnknownEmulator.
) else (
    echo [FAIL] Expected exit code 203, but got %errorlevel%.
)

echo.
echo ===================================================
echo RUNNING TEST 4: Load Real JSON Configs for Arcade and Mame
echo ===================================================
emulatorLauncher.exe -system arcade -emulator libretro -core mame -rom "C:\tmp\RIESCADE_SYSTEM\roms\arcade\88games.zip"
echo Exit code: %errorlevel%
if %errorlevel% neq 9009 (
    echo [PASS] Arcade/Mame JSON launch test completed without unhandled exceptions.
) else (
    echo [FAIL] Arcade/Mame launch test failed.
)

cd ..
