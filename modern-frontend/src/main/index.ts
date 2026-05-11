import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { LibraryService } from './services/LibraryService'
import { LauncherService } from './services/LauncherService'
import { ThemeService } from './services/ThemeService'
import { SettingsParser } from './parsers/SettingsParser'
import { FeaturesParser } from './parsers/FeaturesParser'
import { System, Game } from '../shared/types'
import { SystemService } from './services/SystemService'

const libraryService = new LibraryService()
const launcherService = new LauncherService()
const themeService = new ThemeService()
const settingsParser = new SettingsParser()
const featuresParser = new FeaturesParser()
const systemService = new SystemService()

let activeControllers: any[] = []

function createWindow(): void {
  const windowMode = settingsParser.getSetting('FrontendWindowMode', 'string') || 'fullscreen'
  
  const windowConfig: any = {
    width: 1280,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon: join(__dirname, '../../resources/icon.png') } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  }

  if (windowMode === 'fullscreen') {
    windowConfig.fullscreen = true
  } else if (windowMode === 'windowed_fullscreen') {
    windowConfig.fullscreenable = true
    windowConfig.simpleFullscreen = true
    // Need to maximize or remove frame for borderless fullscreen
    windowConfig.frame = false
  }

  // Create the browser window.
  const mainWindow = new BrowserWindow(windowConfig)
  
  if (windowMode === 'windowed_fullscreen') {
    mainWindow.maximize()
  }

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
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  // IPC Handlers
  ipcMain.handle('get-systems', async () => {
    return libraryService.getSystems()
  })

  ipcMain.handle('get-games', async (_, systemName: string) => {
    return libraryService.getGames(systemName)
  })

  ipcMain.handle('launch-game', async (_, game: Game, system: System) => {
    return launcherService.launch(game, system, activeControllers)
  })

  ipcMain.handle('get-themes', async () => {
    return themeService.getAvailableThemes()
  })

  ipcMain.handle('get-active-theme', async () => {
    return themeService.getActiveThemeName()
  })

  let themeWatcher: any = null

  ipcMain.handle('load-theme', async (_, themeName: string) => {
    const theme = themeService.loadTheme(themeName)
    
    if (themeWatcher) {
      themeWatcher.close()
    }
    
    // Start watching the active theme path for changes
    if (theme && theme.path) {
      // Lazy load chokidar to avoid top-level import issues if not installed correctly
      const chokidar = require('chokidar')
      themeWatcher = chokidar.watch(theme.path, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true
      })
      
      let debounceTimeout: NodeJS.Timeout
      themeWatcher.on('all', (event, path) => {
        if (path.endsWith('.html') || path.endsWith('.css') || path.endsWith('.json')) {
          clearTimeout(debounceTimeout)
          debounceTimeout = setTimeout(() => {
            console.log(`Theme auto-reload triggered by: ${path}`)
            BrowserWindow.getAllWindows().forEach(win => {
               win.webContents.send('theme-updated')
            })
          }, 150)
        }
      })
    }
    
    return theme
  })

  ipcMain.handle('get-settings', async () => {
    return settingsParser.getAllSettings()
  })

  ipcMain.handle('save-setting', async (_, name: string, value: any, type: 'string' | 'bool' | 'int' | 'float') => {
    return settingsParser.saveSetting(name, value, type)
  })

  ipcMain.handle('get-features', async () => {
    return featuresParser.getFeatures()
  })

  ipcMain.on('system-command', (_, command: string, data?: any) => {
    if (command === 'set-active-controllers') {
      activeControllers = data || []
      console.log('Active controllers updated:', activeControllers.length)
      return
    }
    systemService.executeCommand(command)
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
