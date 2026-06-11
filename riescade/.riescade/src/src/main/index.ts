import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join, dirname, extname, basename } from 'path'
import { exec } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { LibraryService } from './services/LibraryService'
import { LauncherService } from './services/LauncherService'
import { ThemeService } from './services/ThemeService'
import { NetplayService } from './services/NetplayService'
import { SettingsParser } from './parsers/SettingsParser'
import { ThemeSettingsParser } from './parsers/ThemeSettingsParser'
import { SystemService } from './services/SystemService'
import { SassService } from './services/SassService'
import { ScraperService } from './services/ScraperService'
import { Game, System } from '../shared/types'
import { watch, FSWatcher, readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { readFile } from 'fs/promises'
import { getRetroBatPath, getConfigPath, getDefaultThemePath, getUserThemesPath, getMusicPath } from './utils/paths'
import { XMLParser, XMLBuilder } from 'fast-xml-parser'
import { SYSTEM_TO_SCREENSCRAPER_PLATFORM } from './services/ScraperService'
import { setupLogger } from './utils/logger'
import { RomsWatcherService } from './services/RomsWatcherService'
import { FeaturesService } from './services/FeaturesService'
import { ThemeStoreService } from './services/ThemeStoreService'
import { lookup as dnsLookup } from 'dns/promises'

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

  ipcMain.handle('preload-library', async (_, forcePhysicalScan?: boolean, systemName?: string) => {
    if (systemName) {
      await libraryService.preloadSystem(systemName, forcePhysicalScan)
    } else {
      if (forcePhysicalScan) {
        LibraryService.clearCache()
      }
      await libraryService.preloadAll(forcePhysicalScan)

      // Start/stop ROMs watcher dynamically based on DB mode setting
      if (LibraryService.isDbMode()) {
        if (!romsWatcher) {
          romsWatcher = new RomsWatcherService(libraryService)
          romsWatcher.start()
        }
      } else {
        if (romsWatcher) {
          romsWatcher.stop()
          romsWatcher = null
        }
      }
    }
    return true
  })

  ipcMain.handle('get-systems', async () => {
    return libraryService.getSystems()
  })

  ipcMain.handle('get-games', async (_, systemName: string) => {
    return libraryService.getGames(systemName)
  })

  ipcMain.handle('launch-game', async (_, game: Game, system: System, saveStateSlot?: number) => {
    let targetSystem = system
    if (system.name === 'collections' || (game.system && game.system.toLowerCase() !== system.name.toLowerCase())) {
      const realSystem = libraryService.getSystems().find(s => s.name.toLowerCase() === game.system.toLowerCase())
      if (realSystem) {
        targetSystem = realSystem
      }
    }
    const result = await launcherService.launch(game, targetSystem, activeControllers, saveStateSlot)
    
    if (targetSystem.name.toLowerCase() === 'windows_installers') {
      console.log('windows_installers launched and exited, reloading library and notifying frontend...')
      LibraryService.clearCache()
      await libraryService.preloadAll(true)
      BrowserWindow.getAllWindows().forEach(win => {
        try {
          win.webContents.send('systems-updated')
        } catch (e) {
          console.error('Failed to send systems-updated to window', e)
        }
      })
    }
    
    return result
  })

  ipcMain.handle('get-netplay-lobby', async () => {
    const netplayService = new NetplayService()
    return netplayService.getLobbyList()
  })

  ipcMain.handle('launch-netplay-game', async (_, game: Game, system: System, netplayOptions: any) => {
    let targetSystem = system
    if (system.name === 'collections' || (game.system && game.system.toLowerCase() !== system.name.toLowerCase())) {
      const realSystem = libraryService.getSystems().find(s => s.name.toLowerCase() === game.system.toLowerCase())
      if (realSystem) {
        targetSystem = realSystem
      }
    }
    return launcherService.launch(game, targetSystem, activeControllers, undefined, netplayOptions)
  })

  ipcMain.handle('scan-save-states', async (_, systemName: string, gamePath: string) => {
    return libraryService.getGameSaveStates(systemName, gamePath)
  })

  ipcMain.handle('update-game', async (_, systemName: string, gameData: Game) => {
    return libraryService.updateGame(systemName, gameData)
  })

  ipcMain.handle('delete-game', async (_, systemName: string, gamePath: string, deletePhysical: boolean) => {
    return libraryService.deleteGame(systemName, gamePath, deletePhysical)
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
    const isDev = !app.isPackaged
    if (themePath && (themePath !== getDefaultThemePath() || isDev)) {
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
              if (basename(filename).startsWith('_')) {
                sassService.compileTheme(themePath)
              } else {
                sassService.compileFile(fullPath)
              }
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

  ipcMain.handle('get-emulator-features', async (_, systemName: string, emulatorName: string, coreName?: string) => {
    return featuresService.getFeaturesFor(systemName, emulatorName, coreName)
  })

  // ─── IPC: Theme Settings ───
  ipcMain.handle('get-theme-settings', async (_, themeName: string) => {
    return ThemeSettingsParser.getThemeSettings(themeName, themeService.getThemePath(themeName))
  })

  ipcMain.handle('save-theme-setting', async (_, themeName: string, key: string, value: string) => {
    return ThemeSettingsParser.saveThemeSetting(themeName, themeService.getThemePath(themeName), key, value)
  })

  // ─── IPC: Theme Store ───
  ipcMain.handle('get-official-themes', async () => {
    return themeStoreService.getOfficialThemes()
  })

  ipcMain.handle('get-community-themes', async () => {
    return themeStoreService.getCommunityThemes()
  })

  ipcMain.handle('install-theme', async (event, zipUrl: string, themeId: string) => {
    return themeStoreService.installTheme(zipUrl, themeId, (percent, status) => {
      event.sender.send('theme-install-progress', { percent, status })
    })
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
    const configPath = join(getConfigPath(), 'input.json')
    const lastConfigPath = join(getConfigPath(), 'last_input.json')

    let data: any = { inputConfigs: [] }
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8')
        data = JSON.parse(content)
        if (!data.inputConfigs) data.inputConfigs = []
      } catch (err) {
        console.error('Failed to parse input.json:', err)
      }
    }

    // Filter out existing mapping with the same GUID or Name
    data.inputConfigs = data.inputConfigs.filter(
      (cfg: any) => cfg.deviceGUID !== deviceGUID && cfg.deviceName !== deviceName
    )

    // Construct the new mapping config
    const newInputConfig = {
      type: 'joystick',
      deviceName,
      deviceGUID,
      inputs: Object.entries(mappings).map(([name, val]: [string, any]) => ({
        name,
        type: val.type,
        id: String(val.id),
        value: String(val.value)
      }))
    }

    data.inputConfigs.push(newInputConfig)

    // Build the JSON content
    try {
      writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8')

      // Also write to last_input.json containing ONLY the last configured controller
      const lastDataObj = {
        inputConfigs: [newInputConfig]
      }
      writeFileSync(lastConfigPath, JSON.stringify(lastDataObj, null, 2), 'utf-8')
      
      console.log('Successfully saved controller config for:', deviceName)
      return true
    } catch (err) {
      console.error('Failed to write input.json:', err)
      return false
    }
  })

  ipcMain.handle('get-configured-controllers', async () => {
    const configPath = join(getConfigPath(), 'input.json')
    if (!existsSync(configPath)) return []
    try {
      const content = readFileSync(configPath, 'utf-8')
      const data = JSON.parse(content)
      const configs = data.inputConfigs || []
      return configs.map((cfg: any) => ({
        name: cfg.deviceName,
        guid: cfg.deviceGUID,
        type: cfg.type
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

  ipcMain.handle('get-random-game-with-media', async (_, mediaType: 'video' | 'image') => {
    return libraryService.getRandomGameWithMedia(mediaType)
  })

  ipcMain.handle('get-network-connection-type', async () => {
    try {
      const { networkInterfaces } = require('os')
      const interfaces = networkInterfaces()
      let hasWifi = false
      let hasEthernet = false
      let hasInternet = false

      for (const [name, info] of Object.entries(interfaces)) {
        if (!info) continue
        for (const addr of info) {
          if (!addr.internal && addr.family === 'IPv4') {
            hasInternet = true
            const lowerName = name.toLowerCase()
            if (lowerName.includes('wi-fi') || lowerName.includes('wifi') || lowerName.includes('wireless') || lowerName.includes('wlan')) {
              hasWifi = true
            } else if (lowerName.includes('ethernet') || lowerName.includes('lan') || lowerName.includes('conexão local')) {
              hasEthernet = true
            }
          }
        }
      }

      if (!hasInternet) return 'none'
      if (hasWifi) return 'wifi'
      if (hasEthernet) return 'ethernet'
      return 'other'
    } catch (e) {
      return 'unknown'
    }
  })

  ipcMain.handle('get-db-stats', async () => {
    const db = LibraryService.getDatabase()
    return {
      totalGames: db.isOpen() ? db.getTotalGameCount() : 0,
      indexedSystems: db.isOpen() ? db.getIndexedSystemCount() : 0,
      systemsInfo: db.isOpen() ? db.getSystemSyncInfo() : []
    }
  })

  ipcMain.handle('rebuild-database', async () => {
    const db = LibraryService.getDatabase()
    LibraryService.clearCache()
    const win = BrowserWindow.getAllWindows()[0]
    libraryService.rebuildDatabase((sysName, current, total) => {
      if (win) {
        win.webContents.send('systems-loading-progress', Math.round((current / total) * 100), 'INDEXING_DATABASE')
      }
    })
    return true
  })

  ipcMain.handle('get-library-mode', async () => {
    return LibraryService.isDbMode() ? 'database' : 'gamelist'
  })

  ipcMain.handle('get-all-media-paths', async () => {
    const db = LibraryService.getDatabase()
    if (db.isOpen()) {
      return db.getAllMediaPaths()
    }
    return []
  })

  ipcMain.handle('get-system-information', async () => {
    const os = require('os')
    const fs = require('fs')
    const { execSync } = require('child_process')

    // 1. CPU Info
    const cpus = os.cpus()
    const cpuModel = cpus.length > 0 ? cpus[0].model.trim() : 'Unknown CPU'
    const cpuCores = `${cpus.length} threads`
    
    let cpuSpeed = 'N/A'
    if (cpus.length > 0) {
      try {
        const speedOutput = execSync('powershell -Command "Get-CimInstance Win32_Processor | Select-Object -ExpandProperty MaxClockSpeed"', { encoding: 'utf8' }).trim()
        const speedMhz = parseInt(speedOutput, 10)
        if (!isNaN(speedMhz)) {
          cpuSpeed = `${(speedMhz / 1000).toFixed(1)} GHz`
        } else {
          cpuSpeed = `${(cpus[0].speed / 1000).toFixed(1)} GHz`
        }
      } catch {
        cpuSpeed = `${(cpus[0].speed / 1000).toFixed(1)} GHz`
      }
    }

    // 2. RAM Info
    const totalRam = os.totalmem()
    const freeRam = os.freemem()
    const usedRam = totalRam - freeRam
    const ramInfo = `${(usedRam / 1024 / 1024 / 1024).toFixed(1)} GB / ${(totalRam / 1024 / 1024 / 1024).toFixed(1)} GB`

    // 3. Disks Info
    let userDisk = 'N/A'
    let sysDisk = 'N/A'
    
    try {
      const sysDrive = process.env.SystemDrive || 'C:'
      const statSys = fs.statfsSync(sysDrive)
      const totalSys = statSys.bsize * statSys.blocks
      const freeSys = statSys.bsize * statSys.bfree
      const usedSys = totalSys - freeSys
      const pctSys = Math.round((usedSys / totalSys) * 100)
      sysDisk = `${(usedSys / 1024 / 1024 / 1024).toFixed(1)} GB / ${(totalSys / 1024 / 1024 / 1024).toFixed(1)} GB (${pctSys}%)`
    } catch (e) {
      console.error('Failed to get sys disk space:', e)
    }

    try {
      const retroBatPath = getRetroBatPath()
      const userDrive = retroBatPath && retroBatPath.includes(':') ? retroBatPath.split(':')[0] + ':' : 'C:'
      const statUser = fs.statfsSync(userDrive)
      const totalUser = statUser.bsize * statUser.blocks
      const freeUser = statUser.bsize * statUser.bfree
      const usedUser = totalUser - freeUser
      const pctUser = Math.round((usedUser / totalUser) * 100)
      userDisk = `${(usedUser / 1024 / 1024 / 1024).toFixed(1)} GB / ${(totalUser / 1024 / 1024 / 1024).toFixed(1)} GB (${pctUser}%)`
    } catch (e) {
      console.error('Failed to get user disk space:', e)
    }

    // 4. GPU & Resolution & Driver
    let gpuModel = 'Unknown GPU'
    let displayRes = 'N/A'
    let videoDriver = 'N/A'

    try {
      gpuModel = execSync('powershell -Command "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"', { encoding: 'utf8' }).trim()
      if (gpuModel.includes('\n')) {
        gpuModel = gpuModel.split('\n')[0].trim()
      }
    } catch (e) {
      console.error('Failed to get GPU model:', e)
    }

    try {
      displayRes = execSync('powershell -Command "Get-CimInstance Win32_VideoController | ForEach-Object { \\"{0}x{1}@{2}Hz\\" -f $_.CurrentHorizontalResolution, $_.CurrentVerticalResolution, $_.CurrentRefreshRate }"', { encoding: 'utf8' }).trim()
      if (displayRes.includes('\n')) {
        displayRes = displayRes.split('\n')[0].trim()
      }
    } catch (e) {
      console.error('Failed to get resolution:', e)
    }

    try {
      const driverVer = execSync('powershell -Command "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty DriverVersion"', { encoding: 'utf8' }).trim()
      const vendor = gpuModel.toLowerCase().includes('nvidia') ? 'NVIDIA' : (gpuModel.toLowerCase().includes('amd') ? 'AMD' : (gpuModel.toLowerCase().includes('intel') ? 'Intel' : 'GPU'))
      videoDriver = `${vendor} v${driverVer.split('\n')[0].trim()}`
    } catch (e) {
      console.error('Failed to get video driver:', e)
    }

    return {
      cpuModel,
      cpuCores,
      cpuSpeed,
      ramInfo,
      sysDisk,
      userDisk,
      gpuModel,
      displayRes,
      videoDriver
    }
  })

  ipcMain.handle('get-bios-information', async () => {
    const cmdPath = join(getRetroBatPath(), 'riescade', 'launcher', 'batocera-systems.exe')
    return new Promise((resolve) => {
      exec(`"${cmdPath}"`, (error, stdout) => {
        if (error) {
          console.error('Error running batocera-systems:', error)
          resolve([])
          return
        }
        
        const lines = stdout.split(/\r?\n/)
        const systems: any[] = []
        let currentSystem: any = null

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          if (trimmed.startsWith('> ')) {
            if (currentSystem) {
              systems.push(currentSystem)
            }
            currentSystem = {
              name: trimmed.substring(2).trim(),
              bios: []
            }
          } else if (currentSystem) {
            const tokens = trimmed.split(/\s+/)
            if (tokens.length >= 3) {
              const status = tokens[0]
              const md5 = tokens[1]
              const path = tokens.slice(2).join(' ')
              currentSystem.bios.push({ status, md5, path })
            }
          }
        }
        if (currentSystem) {
          systems.push(currentSystem)
        }
        resolve(systems)
      })
    })
  })

  ipcMain.handle('get-file-content', async (_, filePath: string) => {
    try {
      if (existsSync(filePath)) {
        return await readFile(filePath, 'utf-8')
      }
      return null
    } catch (e) {
      console.error('Failed to read file content:', e)
      return null
    }
  })

  ipcMain.handle('get-music-files', async (_, subfolder?: string) => {
    try {
      const { readdirSync, statSync } = require('fs')
      const { extname } = require('path')
      const baseDir = getMusicPath()
      const targetDir = subfolder ? join(baseDir, subfolder) : baseDir
      
      if (!existsSync(targetDir)) return []
      
      const files = readdirSync(targetDir)
      const allowedExtensions = ['.mp3', '.ogg', '.wav', '.mp4', '.m4a', '.aac']
      
      const results: string[] = []
      for (const file of files) {
        const fullPath = join(targetDir, file)
        const stat = statSync(fullPath)
        if (stat.isFile() && allowedExtensions.includes(extname(file).toLowerCase())) {
          const relPath = subfolder ? `${subfolder}/${file}` : file
          results.push(relPath)
        }
      }
      return results
    } catch (e) {
      console.error('Failed to get music files:', e)
      return []
    }
  })

  ipcMain.handle('get-music-path', async () => {
    return getMusicPath()
  })

  ipcMain.handle('start-scrape', async () => {
    scraperService.scrape()
    return true
  })

  ipcMain.handle('cancel-scrape', async () => {
    scraperService.cancel()
    return true
  })

  // Helper functions for scrapers
  async function queryScreenScraper(
    systemName: string,
    gameName: string,
    gamePath: string | undefined,
    preferredRegion: string,
    systemLanguage: string,
    ssid: string,
    sspassword: string,
    systemId: number
  ): Promise<any[]> {
    const devid = 'retrobat'
    const devpassword = 'JRLmOtnZXwo'
    const softname = 'retrobat'

    let jeux: any[] = []

    if (gamePath) {
      const romName = basename(gamePath)
      let url = `https://api.screenscraper.fr/api2/jeuInfos.php?devid=${devid}&devpassword=${devpassword}&softname=${softname}&output=json&romnom=${encodeURIComponent(romName)}`
      if (systemId > 0) {
        url += `&systemeid=${systemId}`
      }
      if (ssid) {
        url += `&ssid=${encodeURIComponent(ssid)}`
      }
      if (sspassword) {
        url += `&sspassword=${encodeURIComponent(sspassword)}`
      }

      try {
        const response = await fetch(url)
        if (response.ok) {
          const json = await response.json()
          const jeu = json.response?.jeu
          if (jeu) {
            jeux = [jeu]
          }
        }
      } catch (err) {
        console.error('ScreenScraper romnom search failed:', err)
      }
    }

    if (jeux.length === 0) {
      let cleanedName = gameName.replace(/\.[a-zA-Z0-9]{2,4}$/, '')
      cleanedName = cleanedName.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '')
      cleanedName = cleanedName.replace(/[_-]/g, ' ')
      cleanedName = cleanedName.replace(/\s+/g, ' ').trim()
      if (!cleanedName) cleanedName = gameName

      let url = `https://api.screenscraper.fr/api2/jeuInfos.php?devid=${devid}&devpassword=${devpassword}&softname=${softname}&output=json&recherche=${encodeURIComponent(cleanedName)}`
      if (systemId > 0) {
        url += `&systemeid=${systemId}`
      }
      if (ssid) {
        url += `&ssid=${encodeURIComponent(ssid)}`
      }
      if (sspassword) {
        url += `&sspassword=${encodeURIComponent(sspassword)}`
      }

      const response = await fetch(url)
      if (response.ok) {
        const json = await response.json()
        if (json.response?.jeux) {
          jeux = Array.isArray(json.response.jeux) ? json.response.jeux : [json.response.jeux]
        } else if (json.response?.jeu) {
          jeux = Array.isArray(json.response.jeu) ? json.response.jeu : [json.response.jeu]
        }
      } else {
        throw new Error(`ScreenScraper returned status ${response.status}`)
      }
    }

    const getRipList = (imageSource: string): string[] => {
      if (imageSource === 'ss') return ['ss', 'sstitle']
      if (imageSource === 'sstitle') return ['sstitle', 'ss']
      if (imageSource === 'mixrbv1' || imageSource === 'mixrbv') return ['mixrbv1', 'mixrbv2', 'fanart', 'ss', 'sstitle']
      if (imageSource === 'mixrbv2') return ['mixrbv2', 'mixrbv1', 'fanart', 'ss', 'sstitle']
      if (imageSource === 'box-2D') return ['box-2D', 'box-3D', 'cover']
      if (imageSource === 'box-3D') return ['box-3D', 'box-2D', 'cover']
      if (imageSource === 'wheel') return ['wheel', 'wheel-hd', 'wheel-steel', 'wheel-carbon', 'screenmarqueesmall', 'screenmarquee', 'logo']
      if (imageSource === 'wheel-hd') return ['wheel-hd', 'wheel', 'wheel-steel', 'wheel-carbon', 'screenmarqueesmall', 'screenmarquee', 'logo']
      if (imageSource === 'marquee') return ['screenmarqueesmall', 'screenmarquee', 'wheel', 'wheel-hd', 'wheel-steel', 'wheel-carbon', 'logo']
      if (imageSource === 'video') return ['video-normalized', 'video']
      return [imageSource]
    }

    const imageSrc = settingsParser.getSetting('ScrapperImageSrc', 'string') || 'mixrbv2'
    const thumbSrc = settingsParser.getSetting('ScrapperThumbSrc', 'string') || 'box-2D'
    const logoSrc = settingsParser.getSetting('ScrapperLogoSrc', 'string') || 'wheel-hd'

    const findMediaUrl = (medias: any[], typeList: string[]): string | undefined => {
      if (!medias || !Array.isArray(medias)) return undefined
      const regions = [preferredRegion, 'wor', 'us', 'eu', 'jp', 'ss', '']
      for (const type of typeList) {
        for (const reg of regions) {
          const match = medias.find(m => m.type === type && (reg === '' || String(m.region || '').toLowerCase() === reg.toLowerCase()))
          if (match && match.url) {
            return match.url
          }
        }
      }
      const fallback = medias.find(m => typeList.includes(m.type) && m.url)
      return fallback ? fallback.url : undefined
    }

    const results: any[] = []
    for (const jeu of jeux) {
      const noms = jeu.noms || []
      const regions = [preferredRegion, 'wor', 'us', 'eu', 'jp', 'ss', '']
      let gameNameParsed = ''
      for (const reg of regions) {
        const nomMatch = noms.find((n: any) => reg === '' || String(n.region || '').toLowerCase() === reg.toLowerCase())
        if (nomMatch) {
          gameNameParsed = nomMatch.text
          break
        }
      }
      if (!gameNameParsed && noms.length > 0) gameNameParsed = noms[0].text
      if (!gameNameParsed) gameNameParsed = gameName

      const synopsis = jeu.synopsis || []
      const langs = [systemLanguage, 'en', 'wor']
      let gameDesc = ''
      for (const l of langs) {
        const synMatch = synopsis.find((s: any) => String(s.langue || '').toLowerCase() === l.toLowerCase())
        if (synMatch) {
          gameDesc = synMatch.text
          break
        }
      }
      if (!gameDesc && synopsis.length > 0) gameDesc = synopsis[0].text

      const gameDev = jeu.developpeur?.text || ''
      const gamePub = jeu.editeur?.text || ''

      const genresList = (jeu.genres || []).map((g: any) => {
        const synMatch = (g.noms || []).find((n: any) => String(n.langue || '').toLowerCase() === systemLanguage.toLowerCase()) || 
                         (g.noms || []).find((n: any) => String(n.langue || '').toLowerCase() === 'en')
        return synMatch ? synMatch.text : ''
      }).filter((x: string) => x !== '')
      const gameGenre = genresList.join(', ')

      const gamePlayers = jeu.joueurs?.text || ''
      const gameRating = jeu.note?.text ? parseFloat(jeu.note.text) / 20 : undefined

      const dates = jeu.dates || []
      let relDate = ''
      for (const reg of regions) {
        const dateMatch = dates.find((d: any) => reg === '' || String(d.region || '').toLowerCase() === reg.toLowerCase())
        if (dateMatch) {
          relDate = dateMatch.text
          break
        }
      }
      if (!relDate && dates.length > 0) relDate = dates[0].text
      if (relDate && relDate.includes('-')) {
        relDate = relDate.replace(/-/g, '') + 'T000000'
      }

      results.push({
        id: String(jeu.id),
        name: gameNameParsed,
        db: 'ScreenScraper',
        releasedate: relDate,
        developer: gameDev,
        publisher: gamePub,
        genre: gameGenre,
        rating: gameRating,
        desc: gameDesc,
        players: gamePlayers,
        media: {
          image: findMediaUrl(jeu.medias, getRipList(imageSrc)),
          thumbnail: findMediaUrl(jeu.medias, getRipList(thumbSrc)),
          marquee: findMediaUrl(jeu.medias, getRipList(logoSrc)),
          video: findMediaUrl(jeu.medias, getRipList('video'))
        }
      })
    }

    return results
  }

  async function queryArcadeDB(gameName: string): Promise<any[]> {
    let cleanName = gameName.replace(/\.[a-zA-Z0-9]{2,4}$/, '')
    cleanName = cleanName.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '')
    cleanName = cleanName.replace(/[_-]/g, '')
    cleanName = cleanName.replace(/[\s.]/g, '').toLowerCase().trim()
    if (!cleanName) cleanName = gameName.toLowerCase().replace(/[\s.]/g, '')

    const url = `http://adb.arcadeitalia.net/service_scraper.php?ajax=query_mame&lang=en&use_parent=1&game_name=${encodeURIComponent(cleanName)}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`ArcadeDB status ${response.status}`)
    }

    const json = await response.json()
    if (!json.result || !Array.isArray(json.result)) {
      return []
    }

    const results: any[] = []
    for (const game of json.result) {
      const gameNameParsed = game.short_title || game.title || gameName
      let relDate = ''
      if (game.year) {
        relDate = `${game.year}0101T000000`
      }

      results.push({
        id: `arcadedb-${gameNameParsed.replace(/\s+/g, '-').toLowerCase()}`,
        name: gameNameParsed,
        db: 'ArcadeDB',
        releasedate: relDate,
        developer: game.manufacturer || '',
        publisher: game.manufacturer || '',
        genre: game.genre || '',
        rating: undefined,
        desc: game.history || '',
        players: game.players ? String(game.players) : '',
        media: {
          image: game.url_image_ingame || game.url_image_flyer || '',
          thumbnail: game.url_image_flyer || game.url_image_ingame || '',
          marquee: game.url_image_marquee || game.url_image_title || '',
          video: game.url_video_shortplay_hd || game.url_video_shortplay || ''
        }
      })
    }

    return results
  }

  async function queryIGDB(gameName: string, clientID: string, secret: string): Promise<any[]> {
    if (!clientID || !secret) {
      throw new Error('CREDENCIAIS_AUSENTES: IGDB Client ID ou Client Secret ausentes.')
    }

    const authUrl = 'https://id.twitch.tv/oauth2/token'
    const tokenResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `client_id=${encodeURIComponent(clientID)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`
    })

    if (!tokenResponse.ok) {
      throw new Error(`IGDB OAuth falhou com status ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token
    if (!accessToken) {
      throw new Error('IGDB OAuth falhou em obter token de acesso.')
    }

    let cleanedName = gameName.replace(/\.[a-zA-Z0-9]{2,4}$/, '')
    cleanedName = cleanedName.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '')
    cleanedName = cleanedName.replace(/[_-]/g, ' ')
    cleanedName = cleanedName.replace(/\s+/g, ' ').trim()
    if (!cleanedName) cleanedName = gameName

    const searchUrl = 'https://api.igdb.com/v4/games'
    const query = `fields id, name, platforms.name, genres.name, game_modes.name, multiplayer_modes.offlinemax, release_dates.date, release_dates.region, release_dates.platform, cover.*, screenshots.*, artworks.*, url, summary, aggregated_rating, involved_companies.company.name, involved_companies.developer, involved_companies.publisher; search "${cleanedName}"; limit 10;`

    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Client-ID': clientID,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'text/plain',
        'Accept': 'application/json'
      },
      body: query
    })

    if (!searchResponse.ok) {
      throw new Error(`IGDB Search falhou com status ${searchResponse.status}`)
    }

    const games = await searchResponse.json()
    if (!Array.isArray(games)) return []

    const results: any[] = []
    for (const game of games) {
      let dev = ''
      let pub = ''
      if (game.involved_companies && Array.isArray(game.involved_companies)) {
        for (const comp of game.involved_companies) {
          const name = comp.company?.name
          if (name) {
            if (comp.developer) dev = name
            if (comp.publisher) pub = name
          }
        }
      }

      let relDate = ''
      if (game.release_dates && Array.isArray(game.release_dates) && game.release_dates.length > 0) {
        const timestamp = game.release_dates[0].date
        if (timestamp) {
          const dateObj = new Date(timestamp * 1000)
          relDate = dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'T000000'
        }
      }

      const genreStr = game.genres ? game.genres.map((g: any) => g.name).join(', ') : ''
      const playersStr = game.multiplayer_modes ? String(Math.max(...game.multiplayer_modes.map((m: any) => m.offlinemax || 1))) : ''
      const ratingNum = game.aggregated_rating ? game.aggregated_rating / 100 : undefined

      results.push({
        id: `igdb-${game.id}`,
        name: game.name || gameName,
        db: 'IGDB',
        releasedate: relDate,
        developer: dev,
        publisher: pub,
        genre: genreStr,
        rating: ratingNum,
        desc: game.summary || '',
        players: playersStr,
        media: {
          image: game.screenshots && game.screenshots.length > 0 ? `https://images.igdb.com/igdb/image/upload/t_screenshot_huge/${game.screenshots[0].image_id}.jpg` : '',
          thumbnail: game.cover ? `https://images.igdb.com/igdb/image/upload/t_original/${game.cover.image_id}.jpg` : '',
          marquee: game.artworks && game.artworks.length > 0 ? `https://images.igdb.com/igdb/image/upload/t_1080p/${game.artworks[0].image_id}.jpg` : '',
          video: ''
        }
      })
    }

    return results
  }

  async function queryTheGamesDB(gameName: string, apiKey: string, configPath: string): Promise<any[]> {
    if (!apiKey) {
      throw new Error('CREDENCIAIS_AUSENTES: TheGamesDB API key ausente.')
    }

    let cleanedName = gameName.replace(/\.[a-zA-Z0-9]{2,4}$/, '')
    cleanedName = cleanedName.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '')
    cleanedName = cleanedName.replace(/[_-]/g, ' ')
    cleanedName = cleanedName.replace(/\s+/g, ' ').trim()
    if (!cleanedName) cleanedName = gameName

    const url = `https://api.thegamesdb.net/v1/Games/ByGameName?apikey=${apiKey}&fields=players,publishers,genres,overview,last_updated,rating,platform,alternates&include=boxart&name=${encodeURIComponent(cleanedName)}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`TheGamesDB status ${response.status}`)
    }

    const json = await response.json()
    if (!json.data || !json.data.games || !Array.isArray(json.data.games)) {
      return []
    }

    let devMap: any = {}
    let pubMap: any = {}
    let genMap: any = {}

    try {
      const fs = require('fs')
      const joinPath = require('path').join
      const devFile = joinPath(configPath, 'scrapers', 'gamesdb_developers.json')
      const pubFile = joinPath(configPath, 'scrapers', 'gamesdb_publishers.json')
      const genFile = joinPath(configPath, 'scrapers', 'gamesdb_genres.json')

      if (fs.existsSync(devFile)) devMap = JSON.parse(fs.readFileSync(devFile, 'utf-8'))?.data?.developers || {}
      if (fs.existsSync(pubFile)) pubMap = JSON.parse(fs.readFileSync(pubFile, 'utf-8'))?.data?.publishers || {}
      if (fs.existsSync(genFile)) genMap = JSON.parse(fs.readFileSync(genFile, 'utf-8'))?.data?.genres || {}
    } catch (err) {
      console.error('Failed to parse TheGamesDB JSON maps:', err)
    }

    const getMappedNames = (ids: any[], map: any) => {
      if (!ids || !Array.isArray(ids)) return ''
      return ids.map(id => map[id]?.name || map[id] || String(id)).join(', ')
    }

    const boxartInclude = json.include?.boxart || {}
    const baseUrlLarge = boxartInclude.base_url?.large || 'https://legacy.thegamesdb.net/images/original/'

    const results: any[] = []
    for (const game of json.data.games) {
      let relDate = ''
      if (game.release_date) {
        relDate = game.release_date.replace(/-/g, '') + 'T000000'
      }

      const devStr = getMappedNames(game.developers, devMap)
      const pubStr = getMappedNames(game.publishers, pubMap)
      const genreStr = getMappedNames(game.genres, genMap)

      let frontBoxart = ''
      const gameId = String(game.id)
      if (boxartInclude.data && boxartInclude.data[gameId] && Array.isArray(boxartInclude.data[gameId])) {
        const matchFront = boxartInclude.data[gameId].find((b: any) => b.type === 'boxart' && b.side === 'front')
        const fallback = boxartInclude.data[gameId][0]
        const relativePath = matchFront ? matchFront.filename : (fallback ? fallback.filename : '')
        if (relativePath) {
          frontBoxart = `${baseUrlLarge}${relativePath}`
        }
      }

      results.push({
        id: `thegamesdb-${game.id}`,
        name: game.game_title || gameName,
        db: 'TheGamesDB',
        releasedate: relDate,
        developer: devStr,
        publisher: pubStr,
        genre: genreStr,
        rating: game.rating ? game.rating / 10 : undefined,
        desc: game.overview || '',
        players: game.players ? String(game.players) : '',
        media: {
          image: frontBoxart,
          thumbnail: frontBoxart,
          marquee: '',
          video: ''
        }
      })
    }

    return results
  }

  async function queryHfsDB(gameName: string, hfsUser: string, hfsPass: string): Promise<any[]> {
    if (!hfsUser || !hfsPass) {
      throw new Error('CREDENCIAIS_AUSENTES: HfsDB username ou password ausentes.')
    }

    const basicAuth = Buffer.from(`${hfsUser}:${hfsPass}`).toString('base64');
    const tokenResponse = await fetch('https://db.hfsplay.fr/api/v1/auth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `username=${encodeURIComponent(hfsUser)}&password=${encodeURIComponent(hfsPass)}`
    });

    if (!tokenResponse.ok) {
      throw new Error(`HfsDB Auth falhou com status ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    const token = tokenData.token
    if (!token) {
      throw new Error('HfsDB Auth falhou em obter token.')
    }

    let cleanedName = gameName.replace(/\.[a-zA-Z0-9]{2,4}$/, '')
    cleanedName = cleanedName.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '')
    cleanedName = cleanedName.replace(/[_-]/g, ' ')
    cleanedName = cleanedName.replace(/\s+/g, ' ').trim()
    if (!cleanedName) cleanedName = gameName

    const searchUrl = `https://db.hfsplay.fr/api/v1/games?search=${encodeURIComponent(cleanedName)}&limit=25`
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Token ${token}`
      }
    })

    if (!searchResponse.ok) {
      throw new Error(`HfsDB Search falhou com status ${searchResponse.status}`)
    }

    const json = await searchResponse.json()
    if (!json.results || !Array.isArray(json.results)) {
      return []
    }

    const findHfsMedia = (game: any, scrapeSource: string): string => {
      if (!game.medias || !Array.isArray(game.medias)) return '';
      const getMediaTagNames = (source: string): string[] => {
        if (source === 'ss' || source === 'mixrbv2' || source === 'mixrbv1' || source === 'mixrbv') {
          return ['screenshot/in game', 'screenshot/title', 'screenshot'];
        }
        if (source === 'sstitle') {
          return ['screenshot/title', 'screenshot/in game', 'screenshot'];
        }
        if (source === 'box-2D') {
          return ['cover2d/front', 'cover2d', 'artwork/Flyer', 'cover3d'];
        }
        if (source === 'box-3D') {
          return ['cover3d', 'cover2d/front'];
        }
        if (source === 'wheel' || source === 'wheel-hd') {
          return ['logo'];
        }
        if (source === 'marquee') {
          return ['wheel', 'artwork/Marquee'];
        }
        if (source === 'video') {
          return ['video'];
        }
        if (source === 'manual') {
          return ['manual'];
        }
        if (source === 'fanart') {
          return ['wallpaper', 'artwork'];
        }
        if (source === 'box-2D-back') {
          return ['cover2d/back'];
        }
        return [];
      };

      const tags = getMediaTagNames(scrapeSource);
      for (const tag of tags) {
        let tagName = tag;
        let tagType = '';
        const idx = tag.indexOf('/');
        if (idx !== -1) {
          tagType = tag.substring(idx + 1);
          tagName = tag.substring(0, idx);
        }

        for (const media of game.medias) {
          if (!media.type || !media.file) continue;
          if (media.type !== tagName) continue;

          if (tagType) {
            if (media.metadata && Array.isArray(media.metadata)) {
              const match = media.metadata.find((m: any) => m.name === tagName + 'type' && m.value === tagType);
              if (match) return media.file;
            }
            if (media.description === tagType) {
              return media.file;
            }
            continue;
          }
          return media.file;
        }
      }
      return '';
    }

    const results: any[] = []
    for (const game of json.results) {
      const gameNameParsed = game.name_pt || game.name_en || game.name || gameName
      const gameDesc = game.description_pt || game.description_en || game.description || ''

      let dev = ''
      let pub = ''
      let gen = ''
      let players = ''

      if (game.metadata && Array.isArray(game.metadata)) {
        for (const meta of game.metadata) {
          if (!meta.name || !meta.value) continue
          if (meta.name === 'genre') gen = meta.value
          else if (meta.name === 'editor') pub = meta.value
          else if (meta.name === 'manufacturer') pub = meta.value
          else if (meta.name === 'developer') dev = meta.value
          else if (meta.name === 'players') {
            players = meta.value
              .replace(' joueurs', '')
              .replace(' joueur', '')
              .replace('+ de ', '')
          }
        }
      }

      let relDate = ''
      for (const rel of ['released_at_WORLD', 'released_at_US', 'released_at_PAL', 'released_at_JPN']) {
        if (game[rel]) {
          relDate = game[rel].replace(/-/g, '').split('T')[0] + 'T000000'
          break
        }
      }

      results.push({
        id: `hfsdb-${game.id}`,
        name: gameNameParsed,
        db: 'HfsDB',
        releasedate: relDate,
        developer: dev,
        publisher: pub,
        genre: gen,
        rating: undefined,
        desc: gameDesc,
        players: players,
        media: {
          image: findHfsMedia(game, 'fanart') || findHfsMedia(game, 'ss'),
          thumbnail: findHfsMedia(game, 'box-2D') || findHfsMedia(game, 'box-3D'),
          marquee: findHfsMedia(game, 'wheel') || findHfsMedia(game, 'marquee'),
          video: findHfsMedia(game, 'video')
        }
      })
    }

    return results
  }

  ipcMain.handle('search-game-media', async (_, systemName: string, gameName: string, databases: string[], gamePath?: string) => {
    try {
      const preferredRegion = settingsParser.getSetting('ScraperRegion', 'string') || 'eu'
      const systemLanguage = (settingsParser.getSetting('Language', 'string') || 'pt').substring(0, 2).toLowerCase()

      const ssid = settingsParser.getSetting('ScreenScraperUser', 'string') || ''
      const sspassword = settingsParser.getSetting('ScreenScraperPass', 'string') || ''

      const systemInfo = libraryService.getSystems().find(s => s.name === systemName)
      const systemId = SYSTEM_TO_SCREENSCRAPER_PLATFORM[systemName.toLowerCase()] || 
                       (systemInfo ? SYSTEM_TO_SCREENSCRAPER_PLATFORM[systemInfo.platform.toLowerCase()] : 0)

      const promises: Promise<any[]>[] = []
      const credentialRequiredSelected: string[] = []

      for (const db of databases) {
        if (db === 'ScreenScraper') {
          promises.push(
            queryScreenScraper(systemName, gameName, gamePath, preferredRegion, systemLanguage, ssid, sspassword, systemId)
              .catch(err => {
                console.error('ScreenScraper failed:', err)
                return []
              })
          )
          credentialRequiredSelected.push('ScreenScraper')
        } else if (db === 'ArcadeDB') {
          promises.push(
            queryArcadeDB(gameName)
              .catch(err => {
                console.error('ArcadeDB failed:', err)
                return []
              })
          )
        } else if (db === 'IGDB') {
          const clientID = settingsParser.getSetting('IGDBClientID', 'string') || 'a6j303y0qtil1b4uzhmwtu7tg1s138'
          const secret = settingsParser.getSetting('IGDBSecret', 'string') || 'bj1qgz4yvsmot64j2ocn1edl0nmdec'
          promises.push(
            queryIGDB(gameName, clientID, secret)
              .catch(err => {
                console.error('IGDB failed:', err)
                return []
              })
          )
          credentialRequiredSelected.push('IGDB')
        } else if (db === 'TheGamesDB') {
          const apiKey = settingsParser.getSetting('TheGamesDBApiKey', 'string') || 'd79b07c4e5715ec00435fa10410ab2b15c2a24762af9c3e0832694a213b74a79'
          promises.push(
            queryTheGamesDB(gameName, apiKey, getConfigPath())
              .catch(err => {
                console.error('TheGamesDB failed:', err)
                return []
              })
          )
        } else if (db === 'HfsDB') {
          const hfsUser = settingsParser.getSetting('HfsDBUser', 'string') || 'riescade'
          const hfsPass = settingsParser.getSetting('HfsDBPass', 'string') || 'ZbrSya@eu8iBNyR'
          promises.push(
            queryHfsDB(gameName, hfsUser, hfsPass)
              .catch(err => {
                console.error('HfsDB failed:', err)
                return []
              })
          )
        }
      }

      const resultsListList = await Promise.all(promises)
      const results = resultsListList.flat()

      // If ONLY credential-requiring databases were selected and ALL of them failed to return any results
      if (databases.length > 0 && credentialRequiredSelected.length === databases.length && results.length === 0) {
        throw new Error('CONFIGURAÇÃO INCOMPLETA: Credenciais ausentes ou inválidas nas configurações do menu.')
      }

      return results
    } catch (e: any) {
      console.error('search-game-media error:', e)
      throw e
    }
  })

  ipcMain.handle('download-game-media', async (_, systemName: string, gamePath: string, matchData: any) => {
    try {
      const systems = libraryService.getSystems()
      const system = systems.find(s => s.name === systemName)
      if (!system) throw new Error(`System ${systemName} not found`)

      const games = libraryService.getGames(systemName)
      const game = games.find(g => g.path === gamePath)
      if (!game) throw new Error(`Game ${gamePath} not found in system ${systemName}`)

      const mediaFolder = join(system.path, 'media')
      const romName = basename(game.path)
      const romNameNoExt = romName.replace(/\.[^/.]+$/, '')

      const updatedFields: Partial<Game> = {}

      if (matchData.media?.image) {
        const destPathWithoutExt = join(mediaFolder, 'fanart', romNameNoExt)
        const ext = await downloadFile(matchData.media.image, destPathWithoutExt, 'png')
        updatedFields.image = `./media/fanart/${romNameNoExt}.${ext}`
      }

      if (matchData.media?.thumbnail) {
        const destPathWithoutExt = join(mediaFolder, 'cover', romNameNoExt)
        const ext = await downloadFile(matchData.media.thumbnail, destPathWithoutExt, 'png')
        updatedFields.thumbnail = `./media/cover/${romNameNoExt}.${ext}`
      }

      if (matchData.media?.marquee) {
        const destPathWithoutExt = join(mediaFolder, 'logo', romNameNoExt)
        const ext = await downloadFile(matchData.media.marquee, destPathWithoutExt, 'png')
        updatedFields.marquee = `./media/logo/${romNameNoExt}.${ext}`
      }

      if (matchData.media?.video) {
        const destPathWithoutExt = join(mediaFolder, 'video', romNameNoExt)
        const ext = await downloadFile(matchData.media.video, destPathWithoutExt, 'mp4')
        updatedFields.video = `./media/video/${romNameNoExt}.${ext}`
      }

      if (matchData.name) updatedFields.name = matchData.name
      if (matchData.desc) updatedFields.desc = matchData.desc
      if (matchData.developer) updatedFields.developer = matchData.developer
      if (matchData.publisher) updatedFields.publisher = matchData.publisher
      if (matchData.genre) updatedFields.genre = matchData.genre
      if (matchData.players) updatedFields.players = matchData.players
      if (matchData.rating !== undefined) updatedFields.rating = matchData.rating
      if (matchData.releasedate) updatedFields.releasedate = matchData.releasedate

      const updatedGame = { ...game, ...updatedFields }
      await libraryService.updateGame(systemName, updatedGame)
      return updatedGame
    } catch (e: any) {
      console.error('download-game-media error:', e)
      throw e
    }
  })

  ipcMain.handle('download-temp-media', async (_, url: string) => {
    try {
      if (!url || typeof url !== 'string') return ''
      const crypto = require('crypto')
      const hash = crypto.createHash('md5').update(url).digest('hex')
      const tempDir = join(app.getPath('temp'), 'riescade-scraper')
      const destPathWithoutExt = join(tempDir, hash)
      
      const fs = require('fs')
      const extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'mkv', 'webm']
      for (const ext of extensions) {
        const checkPath = `${destPathWithoutExt}.${ext}`
        if (fs.existsSync(checkPath)) {
          return checkPath
        }
      }

      const defaultExt = url.includes('.mp4') || url.includes('video') ? 'mp4' : 'png'
      const ext = await downloadFile(url, destPathWithoutExt, defaultExt)
      return `${destPathWithoutExt}.${ext}`
    } catch (e) {
      console.error('download-temp-media error:', e)
      return ''
    }
  })

  ipcMain.handle('get-version', () => {
    return { app: app.getVersion() }
  })

  ipcMain.handle('check-for-updates', async () => {
    interface DiagnosticAttempt {
      attempt: number
      success: boolean
      dnsIp: string
      dnsFamily: string
      dnsError?: string
      responseTimeMs: number
      httpStatus?: number
      errorName?: string
      errorMessage?: string
      errorCode?: string
      errorCause?: string
    }

    const getDnsDiagnostics = async (hostname: string): Promise<{ ip: string; family: string; error?: string }> => {
      try {
        const result = await dnsLookup(hostname)
        return { ip: result.address, family: result.family === 6 ? 'IPv6' : 'IPv4' }
      } catch (err: any) {
        return { ip: 'Unknown', family: 'Unknown', error: err.code || err.message }
      }
    }

    const attempts: DiagnosticAttempt[] = []
    let responseData: any = null

    for (let attempt = 1; attempt <= 3; attempt++) {
      const dnsInfo = await getDnsDiagnostics('raw.githubusercontent.com')
      const startTime = Date.now()
      let success = false
      let httpStatus: number | undefined
      let errorName: string | undefined
      let errorMessage: string | undefined
      let errorCode: string | undefined
      let errorCause: string | undefined

      try {
        const response = await fetch('https://raw.githubusercontent.com/marcoriesco/RIESCADE_SYSTEM/main/updater.json', {
          headers: {
            'User-Agent': 'RIESCADE-Updater'
          },
          signal: AbortSignal.timeout(5000)
        })

        httpStatus = response.status
        if (!response.ok) {
          throw new Error(`GitHub raw content returned status ${response.status}`)
        }
        responseData = await response.json()
        success = true
      } catch (err: any) {
        errorName = err.name
        errorMessage = err.message
        errorCode = err.code || err.cause?.code
        errorCause = err.cause ? String(err.cause) : undefined
      }

      const endTime = Date.now()
      const responseTimeMs = endTime - startTime

      attempts.push({
        attempt,
        success,
        dnsIp: dnsInfo.ip,
        dnsFamily: dnsInfo.family,
        dnsError: dnsInfo.error,
        responseTimeMs,
        httpStatus,
        errorName,
        errorMessage,
        errorCode,
        errorCause
      })

      console.warn(
        `[check-for-updates] Attempt ${attempt}: ` +
        `Success=${success}, ` +
        `DNS=${dnsInfo.ip} (${dnsInfo.family})` + (dnsInfo.error ? ` [DNS Error: ${dnsInfo.error}]` : '') + `, ` +
        `Time=${responseTimeMs}ms` + (httpStatus ? `, HTTP=${httpStatus}` : '') +
        (errorMessage ? `, Error: ${errorName} (${errorMessage})` : '')
      )

      if (success) {
        break
      }

      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    if (!responseData) {
      const dnsFail = attempts.some(a => a.dnsError)
      const isTimeout = attempts.some(a => a.errorName === 'TimeoutError' || a.errorCode === 'UND_ERR_CONNECT_TIMEOUT' || a.errorCause?.includes('timeout') || a.errorMessage?.includes('timeout'))
      const isRateLimit = attempts.some(a => a.httpStatus === 403 || a.httpStatus === 429)

      let friendlyMsg = 'Não foi possível conectar ao GitHub. Verifique VPN, firewall ou conexão com a internet.'
      if (dnsFail) {
        friendlyMsg = 'Não foi possível resolver o endereço do GitHub. Verifique sua conexão com a internet ou servidor DNS.'
      } else if (isRateLimit) {
        friendlyMsg = 'O limite de requisições ao GitHub foi excedido ou o serviço está temporariamente indisponível.'
      } else if (isTimeout) {
        friendlyMsg = 'A conexão com o GitHub expirou. Verifique VPN, firewall ou instabilidade na sua rede.'
      }

      return {
        updateAvailable: false,
        version: '',
        releaseNotes: '',
        zipUrl: null,
        error: true,
        errorMsg: friendlyMsg,
        diagnostics: attempts
      }
    }

    const releaseVersion = responseData.version || ''
    const currentVersion = app.getVersion()

    const cleanTag = releaseVersion.replace(/^v/, '')
    const cleanApp = currentVersion.replace(/^v/, '')

    const compareSemver = (v1: string, v2: string): number => {
      const a = v1.split('.').map(Number)
      const b = v2.split('.').map(Number)
      for (let i = 0; i < 3; i++) {
        const na = a[i] || 0
        const nb = b[i] || 0
        if (na > nb) return 1
        if (na < nb) return -1
      }
      return 0
    }

    const updateAvailable = compareSemver(cleanTag, cleanApp) > 0
    const zipUrl = responseData.zipUrl || null

    return {
      updateAvailable,
      version: cleanTag,
      releaseNotes: responseData.releaseNotes || '',
      zipUrl,
      diagnostics: attempts
    }
  })
  ipcMain.handle('download-and-install-update', async (event, zipUrl: string) => {
    if (!zipUrl) throw new Error('No zip URL provided')
    try {
      const fs = require('fs')
      const ext = zipUrl.endsWith('.7z') ? '.7z' : '.zip'
      const zipPath = join(app.getPath('temp'), `riescade-update${ext}`)
      const response = await fetch(zipUrl)
      if (!response.ok) {
        throw new Error(`Failed to download update: ${response.statusText}`)
      }

      const totalBytesStr = response.headers.get('content-length')
      const totalBytes = totalBytesStr ? parseInt(totalBytesStr, 10) : 0
      let downloadedBytes = 0

      const fileStream = fs.createWriteStream(zipPath)
      for await (const chunk of response.body as any) {
        fileStream.write(chunk)
        downloadedBytes += chunk.length
        const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0
        event.sender.send('update-progress', {
          status: 'downloading',
          percent,
          downloadedBytes,
          totalBytes
        })
      }
      fileStream.end()

      await new Promise((resolve, reject) => {
        fileStream.on('finish', resolve)
        fileStream.on('error', reject)
      })

      const tempExtractDir = join(app.getPath('temp'), 'rcupd')
      const currentAppDir = getRetroBatPath()
      const wrapperLauncherPath = join(currentAppDir, 'RIESCADE.exe')
      const execPath = existsSync(wrapperLauncherPath) ? wrapperLauncherPath : process.execPath

      const updaterPath = join(currentAppDir, 'riescade', 'updater', 'RIESCADEUpdater.exe')
      if (fs.existsSync(updaterPath)) {
        const { spawn } = require('child_process')
        const child = spawn(updaterPath, [zipPath, currentAppDir, execPath], {
          detached: true,
          stdio: 'ignore'
        })
        child.unref()
        app.quit()
        return
      }

      if (fs.existsSync(tempExtractDir)) {
        try {
          fs.rmSync(tempExtractDir, { recursive: true, force: true })
        } catch (err) {
          console.error('Failed to clean tempExtractDir:', err)
        }
      }
      fs.mkdirSync(tempExtractDir, { recursive: true })

      const psCommand = `Start-Sleep -s 1;
$zipPath = '${zipPath.replace(/'/g, "''")}';
$tempExtractDir = '${tempExtractDir.replace(/'/g, "''")}';
$currentAppDir = '${currentAppDir.replace(/'/g, "''")}';
$execPath = '${execPath.replace(/'/g, "''")}';

try {
    if ($zipPath.EndsWith('.7z')) {
        $sevenZip = Join-Path $currentAppDir "riescade\\launcher\\7z.exe";
        if (!(Test-Path $sevenZip)) { $sevenZip = "C:\\Program Files\\7-Zip\\7z.exe"; }
        if (!(Test-Path $sevenZip)) { $sevenZip = "7z"; }
        & $sevenZip x $zipPath "-o$tempExtractDir" -y | Out-Null;
    } else {
        Expand-Archive -Path $zipPath -DestinationPath $tempExtractDir -Force;
    }
    $exes = Get-ChildItem -Path $tempExtractDir -Filter "RIESCADE.exe" -Recurse | Sort-Object {$_.FullName.Length};
    $exe = if ($exes) { $exes[0] } else { $null };
    $srcDir = if ($exe) { $exe.DirectoryName } else { $tempExtractDir };

    # Retry copying up to 20 times (with 1s sleep in between) to allow file locks to clear
    $copied = $false;
    for ($i = 1; $i -le 20; $i++) {
        try {
            Copy-Item -Path "$srcDir\\*" -Destination $currentAppDir -Recurse -Force -ErrorAction Stop;
            $copied = $true;
            break;
        } catch {
            Start-Sleep -s 1;
        }
    }

    if ($copied) {
        Start-Process -FilePath $execPath;
    } else {
        Out-File -FilePath "$currentAppDir\\update_error.log" -InputObject "Failed to copy update files after 20 attempts. File locks might still be active." -Encoding UTF8;
    }
} catch {
    Out-File -FilePath "$currentAppDir\\update_error.log" -InputObject $_.Exception.Message -Encoding UTF8;
} finally {
    if (Test-Path $tempExtractDir) { Remove-Item -Path $tempExtractDir -Recurse -Force; }
    if (Test-Path $zipPath) { Remove-Item -Path $zipPath -Force; }
}
`

      const { spawn } = require('child_process')
      const child = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-Command', psCommand
      ], {
        detached: true,
        stdio: 'ignore'
      })
      child.unref()

      app.quit()
    } catch (e: any) {
      const isNetworkError =
        e.name === 'TimeoutError' ||
        e.message?.includes('fetch failed') ||
        e.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        e.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        e.cause?.message?.includes('timeout') ||
        e.cause?.code === 'ENOTFOUND' ||
        e.cause?.code === 'EAI_AGAIN';

      if (isNetworkError) {
        console.warn('download-and-install-update: Network error or offline. Could not download update zip.')
        throw new Error('Failed to download update file. Please check your internet connection.')
      }

      console.error('download-and-install-update error:', e)
      throw e
    }
  })
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

async function downloadFile(url: string, destPathWithoutExt: string, defaultExt: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`)
  }

  let ext = defaultExt
  const contentType = response.headers.get('content-type')
  if (contentType) {
    const mime = contentType.toLowerCase().split(';')[0].trim()
    if (mime === 'image/png') ext = 'png'
    else if (mime === 'image/jpeg' || mime === 'image/jpg') ext = 'jpg'
    else if (mime === 'image/gif') ext = 'gif'
    else if (mime === 'image/webp') ext = 'webp'
    else if (mime === 'video/mp4') ext = 'mp4'
    else if (mime === 'video/mkv') ext = 'mkv'
    else if (mime === 'video/webm') ext = 'webm'
    else {
      const parts = mime.split('/')
      if (parts.length === 2 && (parts[0] === 'image' || parts[0] === 'video')) {
        const temp = parts[1]
        if (temp && temp.length > 0 && temp !== 'octet-stream') {
          ext = temp
        }
      }
    }
  } else {
    try {
      const parsed = new URL(url)
      const pathExt = extname(parsed.pathname)
      if (pathExt && pathExt.length > 1) {
        const temp = pathExt.substring(1).toLowerCase()
        if (temp !== 'php') {
          ext = temp
        }
      }
    } catch (e) {}
  }

  if (!ext || ext.length > 5 || ext === 'php') {
    ext = defaultExt
  }

  const destPath = `${destPathWithoutExt}.${ext}`
  const dir = dirname(destPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  writeFileSync(destPath, buffer)
  return ext
}
