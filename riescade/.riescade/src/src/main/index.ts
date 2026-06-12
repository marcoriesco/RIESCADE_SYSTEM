import { app, shell, BrowserWindow } from 'electron'
import { join, basename } from 'path'
import { watch, FSWatcher, existsSync, mkdirSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { LibraryService } from './services/LibraryService'
import { LauncherService } from './services/LauncherService'
import { ThemeService } from './services/ThemeService'
import { SettingsParser } from './parsers/SettingsParser'
import { SystemService } from './services/SystemService'
import { SassService } from './services/SassService'
import { ScraperService } from './services/ScraperService'
import { FeaturesService } from './services/FeaturesService'
import { ThemeStoreService } from './services/ThemeStoreService'
import { RomsWatcherService } from './services/RomsWatcherService'
import { getUserThemesPath } from './utils/paths'
import { setupLogger } from './utils/logger'
import { registerAllIpcHandlers, IpcContext } from './ipc'

setupLogger()

// Prevent Chromium from throttling when window is occluded during startup
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')

const libraryService = new LibraryService()
const launcherService = new LauncherService()
const themeService = new ThemeService()
const settingsParser = new SettingsParser()
const systemService = new SystemService(libraryService)
const sassService = new SassService()
const scraperService = new ScraperService(libraryService)
const featuresService = new FeaturesService()
const themeStoreService = new ThemeStoreService()

let activeControllers: any[] = []
let themeWatcher: FSWatcher | null = null
let mainWindow: BrowserWindow | null = null
let themeReloadTimeout: NodeJS.Timeout | null = null
let romsWatcher: RomsWatcherService | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
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
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

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

  // Watch user themes directory for new themes
  const userThemesPath = getUserThemesPath()
  try {
    if (!existsSync(userThemesPath)) {
      mkdirSync(userThemesPath, { recursive: true })
    }
    watch(userThemesPath, (eventType, filename) => {
      mainWindow?.webContents.send('themes-updated')
    })
  } catch (e) {
    console.error('Failed to watch themes directory:', e)
  }

  // Define Context for decomposed IPC Handlers
  const ipcContext: IpcContext = {
    getMainWindow: () => mainWindow,
    libraryService,
    launcherService,
    themeService,
    settingsParser,
    systemService,
    sassService,
    scraperService,
    featuresService,
    themeStoreService,
    getRomsWatcher: () => romsWatcher,
    setRomsWatcher: (w: RomsWatcherService | null) => {
      romsWatcher = w
    },
    getActiveControllers: () => activeControllers,
    setActiveControllers: (c: any[]) => {
      activeControllers = c
    },
    getThemeWatcher: () => themeWatcher,
    setThemeWatcher: (w: FSWatcher | null) => {
      themeWatcher = w
    },
    getThemeReloadTimeout: () => themeReloadTimeout,
    setThemeReloadTimeout: (t: NodeJS.Timeout | null) => {
      themeReloadTimeout = t
    }
  }

  // Register All IPC Domain Handlers
  registerAllIpcHandlers(ipcContext)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (romsWatcher) {
    romsWatcher.stop()
    romsWatcher = null
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
