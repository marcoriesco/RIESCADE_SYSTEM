import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { LibraryService } from './services/LibraryService'
import { LauncherService } from './services/LauncherService'
import { ThemeService } from './services/ThemeService'
import { SettingsParser } from './parsers/SettingsParser'
import { ThemeSettingsParser } from './parsers/ThemeSettingsParser'
import { SystemService } from './services/SystemService'
import { Game, System } from '../shared/types'

const libraryService = new LibraryService()
const launcherService = new LauncherService()
const themeService = new ThemeService()
const settingsParser = new SettingsParser()
const systemService = new SystemService()

let activeControllers: any[] = []

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on vite dev server
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.riescade')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  // ─── IPC: Library ───
  ipcMain.handle('get-systems', async () => {
    return libraryService.getSystems()
  })

  ipcMain.handle('get-games', async (_, systemName: string) => {
    return libraryService.getGames(systemName)
  })

  ipcMain.handle('launch-game', async (_, game: Game, system: System) => {
    return launcherService.launch(game, system, activeControllers)
  })

  // ─── IPC: Themes ───
  ipcMain.handle('get-themes', async () => {
    return themeService.getAvailableThemes()
  })

  ipcMain.handle('get-active-theme', async () => {
    return themeService.getActiveThemeName()
  })

  ipcMain.handle('load-theme', async (_, themeName: string) => {
    return themeService.loadTheme(themeName)
  })

  // ─── IPC: Settings (read-only from ES, write for UI prefs) ───
  ipcMain.handle('get-settings', async () => {
    return settingsParser.getAllSettings()
  })

  ipcMain.handle('save-setting', async (_, name: string, value: any, type: 'string' | 'bool' | 'int' | 'float') => {
    return settingsParser.saveSetting(name, value, type)
  })

  // ─── IPC: Theme Settings ───
  ipcMain.handle('get-theme-settings', async (_, themeName: string) => {
    return ThemeSettingsParser.getThemeSettings(themeName, themeService.getThemePath(themeName))
  })

  ipcMain.handle('save-theme-setting', async (_, themeName: string, key: string, value: string) => {
    return ThemeSettingsParser.saveThemeSetting(themeName, key, value)
  })

  // ─── IPC: System Commands ───
  ipcMain.on('system-command', (_, command: string, data?: any) => {
    if (command === 'set-active-controllers') {
      activeControllers = data || []
      return
    }
    if (command === 'save-input-config') {
      // Implement later if needed, handled differently in new code
      return
    }
    systemService.executeCommand(command)
  })

  ipcMain.handle('get-configured-controllers', async () => {
    // Implement parsing es_input.cfg later if needed
    return []
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
