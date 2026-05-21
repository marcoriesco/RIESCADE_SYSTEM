import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { LibraryService } from './services/LibraryService'
import { LauncherService } from './services/LauncherService'
import { ThemeService } from './services/ThemeService'
import { SettingsParser } from './parsers/SettingsParser'
import { ThemeSettingsParser } from './parsers/ThemeSettingsParser'
import { SystemService } from './services/SystemService'
import { SassService } from './services/SassService'
import { Game, System } from '../shared/types'
import { watch, FSWatcher, readFileSync, existsSync, writeFileSync } from 'fs'
import { getRetroBatPath, getConfigPath } from './utils/paths'
import { XMLParser, XMLBuilder } from 'fast-xml-parser'

const libraryService = new LibraryService()
const launcherService = new LauncherService()
const themeService = new ThemeService()
const settingsParser = new SettingsParser()
const systemService = new SystemService()
const sassService = new SassService()

let activeControllers: any[] = []
let themeWatcher: FSWatcher | null = null
let mainWindow: BrowserWindow | null = null
let themeReloadTimeout: NodeJS.Timeout | null = null

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
  ipcMain.handle('preload-library', async () => {
    await libraryService.preloadAll()
    return true
  })

  ipcMain.handle('get-systems', async () => {
    return libraryService.getSystems()
  })

  ipcMain.handle('get-games', async (_, systemName: string) => {
    return libraryService.getGames(systemName)
  })

  ipcMain.handle('launch-game', async (_, game: Game, system: System) => {
    let targetSystem = system
    if (system.name === 'collections') {
      const realSystem = libraryService.getSystems().find(s => s.name.toLowerCase() === game.system.toLowerCase())
      if (realSystem) {
        targetSystem = realSystem
      }
    }
    return launcherService.launch(game, targetSystem, activeControllers)
  })

  ipcMain.handle('update-game', async (_, systemName: string, gameData: Game) => {
    return libraryService.updateGame(systemName, gameData)
  })

  ipcMain.handle('get-custom-collections', async () => {
    return libraryService.getCustomCollections()
  })

  ipcMain.handle('get-collection-games', async (_, collectionName: string) => {
    return libraryService.getCollectionGames(collectionName)
  })

  ipcMain.handle('get-collections-for-game', async (_, systemName: string, gamePath: string) => {
    return libraryService.getCollectionsForGame(systemName, gamePath)
  })

  ipcMain.handle('toggle-game-in-collection', async (_, collectionName: string, systemName: string, gamePath: string, action: 'add' | 'remove') => {
    return libraryService.toggleGameInCollection(collectionName, systemName, gamePath, action)
  })

  // ─── IPC: Themes ───
  ipcMain.handle('get-themes', async () => {
    return themeService.getAvailableThemes()
  })

  ipcMain.handle('get-active-theme', async () => {
    return themeService.getActiveThemeName()
  })

  ipcMain.handle('load-theme', async (_, themeName: string) => {
    // Setup watcher for the theme directory for live reload
    if (themeWatcher) {
      themeWatcher.close()
      themeWatcher = null
    }

    const themePath = themeService.getThemePath(themeName)
    if (themePath) {
      sassService.compileTheme(themePath)
      try {
        themeWatcher = watch(themePath, { recursive: true }, (eventType, filename) => {
          if (filename) {
            const scheduleReload = () => {
              if (themeReloadTimeout) clearTimeout(themeReloadTimeout)
              themeReloadTimeout = setTimeout(() => {
                mainWindow?.webContents.send('theme-files-changed', themeName)
              }, 100)
            }

            // Auto-compile SCSS
            if (filename.endsWith('.scss')) {
              const fullPath = join(themePath, filename)
              sassService.compileFile(fullPath)
              scheduleReload()
              return
            }

            if (filename.endsWith('.html') || filename.endsWith('.css') || filename.endsWith('.json')) {
              console.log(`Theme file changed: ${filename}. Notifying renderer...`)
              scheduleReload()
            }
          }
        })
      } catch (e) {
        console.error('Failed to start theme watcher:', e)
      }
    }

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
    return ThemeSettingsParser.saveThemeSetting(themeName, themeService.getThemePath(themeName), key, value)
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

  ipcMain.handle('save-input-config', async (_, { deviceName, deviceGUID, mappings }) => {
    const configPath = join(getConfigPath(), 'es_input.cfg')
    const lastConfigPath = join(getConfigPath(), 'es_last_input.cfg')

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
      ignoreDeclaration: true
    })
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      suppressEmptyNode: true,
      ignoreDeclaration: true
    })

    let jsonObj: any = { inputList: { inputConfig: [] } }
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8')
        jsonObj = parser.parse(content)
        if (!jsonObj.inputList) jsonObj.inputList = {}
        if (!jsonObj.inputList.inputConfig) jsonObj.inputList.inputConfig = []
        if (!Array.isArray(jsonObj.inputList.inputConfig)) {
          jsonObj.inputList.inputConfig = [jsonObj.inputList.inputConfig]
        }
      } catch (err) {
        console.error('Failed to parse es_input.cfg:', err)
      }
    }

    // Filter out existing mapping with the same GUID or Name
    jsonObj.inputList.inputConfig = jsonObj.inputList.inputConfig.filter(
      (cfg: any) => cfg['@_deviceGUID'] !== deviceGUID && cfg['@_deviceName'] !== deviceName
    )

    // Construct the new mapping config
    const newInputConfig: any = {
      '@_type': 'joystick',
      '@_deviceName': deviceName,
      '@_deviceGUID': deviceGUID,
      input: Object.entries(mappings).map(([name, val]: [string, any]) => ({
        '@_name': name,
        '@_type': val.type,
        '@_id': String(val.id),
        '@_value': String(val.value)
      }))
    }

    jsonObj.inputList.inputConfig.push(newInputConfig)

    // Build the XML content
    try {
      const xmlContent = '<?xml version="1.0"?>\n' + builder.build(jsonObj)
      writeFileSync(configPath, xmlContent, 'utf-8')

      // Also write to es_last_input.cfg containing ONLY the last configured controller
      const lastJsonObj = {
        inputList: {
          inputConfig: [newInputConfig]
        }
      }
      const lastXmlContent = '<?xml version="1.0"?>\n' + builder.build(lastJsonObj)
      writeFileSync(lastConfigPath, lastXmlContent, 'utf-8')
      
      console.log('Successfully saved controller config for:', deviceName)
      return true
    } catch (err) {
      console.error('Failed to write es_input.cfg:', err)
      return false
    }
  })

  ipcMain.handle('get-configured-controllers', async () => {
    const configPath = join(getConfigPath(), 'es_input.cfg')
    if (!existsSync(configPath)) return []
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: true,
        ignoreDeclaration: true
      })
      const content = readFileSync(configPath, 'utf-8')
      const jsonObj = parser.parse(content)
      const configs = jsonObj.inputList?.inputConfig
      if (!configs) return []
      const configList = Array.isArray(configs) ? configs : [configs]
      return configList.map((cfg: any) => ({
        name: cfg['@_deviceName'],
        guid: cfg['@_deviceGUID'],
        type: cfg['@_type']
      }))
    } catch (err) {
      console.error('Failed to read configured controllers:', err)
      return []
    }
  })

  ipcMain.handle('get-bluetooth-devices', async () => {
    return new Promise((resolve) => {
      const { exec } = require('child_process')
      // PowerShell command to query paired bluetooth devices
      const cmd = `powershell -Command "Get-PnpDevice -Class Bluetooth | Where-Object { $_.FriendlyName -and $_.InstanceId -like '*DEV_*' } | Select-Object -Property FriendlyName, InstanceId | ConvertTo-Json"`
      exec(cmd, (err, stdout) => {
        if (err) {
          console.error('Error running bluetooth command:', err)
          resolve([])
          return
        }
        try {
          const parsed = JSON.parse(stdout)
          const list = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : [])
          resolve(list.map((d: any) => ({
            name: d.FriendlyName || 'Unknown Bluetooth Device',
            id: d.InstanceId || ''
          })))
        } catch (e) {
          resolve([])
        }
      })
    })
  })

  ipcMain.handle('get-version', async () => {
    let esVersion = 'unknown'
    try {
      const versionFile = join(getRetroBatPath(), 'emulationstation', 'version.info')
      if (existsSync(versionFile)) {
        esVersion = readFileSync(versionFile, 'utf-8').trim()
      }
    } catch (e) {
      console.error('Failed to read version.info:', e)
    }
    
    return {
      app: app.getVersion(),
      es: esVersion
    }
  })

  ipcMain.handle('get-hostname', async () => {
    return require('os').hostname()
  })

  ipcMain.handle('clean-gamelists', async () => {
    return libraryService.cleanGamelists()
  })

  ipcMain.handle('reset-gamelist-usage', async () => {
    return libraryService.resetGamelistUsage()
  })

  ipcMain.handle('reset-file-extensions', async () => {
    return libraryService.resetFileExtensions()
  })

  ipcMain.handle('clear-caches', async () => {
    return libraryService.clearCaches()
  })

  ipcMain.handle('get-file-content', async (_, filePath: string) => {
    try {
      if (existsSync(filePath)) {
        return readFileSync(filePath, 'utf-8')
      }
      return null
    } catch (e) {
      console.error('Failed to read file content:', e)
      return null
    }
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
