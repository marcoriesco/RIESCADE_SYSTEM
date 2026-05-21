import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join, dirname, extname, basename } from 'path'
import { exec } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { LibraryService } from './services/LibraryService'
import { LauncherService } from './services/LauncherService'
import { ThemeService } from './services/ThemeService'
import { SettingsParser } from './parsers/SettingsParser'
import { ThemeSettingsParser } from './parsers/ThemeSettingsParser'
import { SystemService } from './services/SystemService'
import { SassService } from './services/SassService'
import { ScraperService } from './services/ScraperService'
import { Game, System } from '../shared/types'
import { watch, FSWatcher, readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { getRetroBatPath, getConfigPath } from './utils/paths'
import { XMLParser, XMLBuilder } from 'fast-xml-parser'
import { SYSTEM_TO_SCREENSCRAPER_PLATFORM } from './services/ScraperService'

const libraryService = new LibraryService()
const launcherService = new LauncherService()
const themeService = new ThemeService()
const settingsParser = new SettingsParser()
const systemService = new SystemService(libraryService)
const sassService = new SassService()
const scraperService = new ScraperService(libraryService)

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
  ipcMain.handle('preload-library', async (_, forcePhysicalScan?: boolean) => {
    if (forcePhysicalScan) {
      LibraryService.clearCache()
    }
    await libraryService.preloadAll(forcePhysicalScan)
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

  ipcMain.handle('get-bios-information', async () => {
    const cmdPath = join(getRetroBatPath(), 'emulationstation', 'batocera-systems.exe')
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
        return readFileSync(filePath, 'utf-8')
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
      const baseDir = join(getConfigPath(), 'music')
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
    return join(getConfigPath(), 'music')
  })

  ipcMain.handle('start-scrape', async () => {
    scraperService.scrape()
    return true
  })

  ipcMain.handle('cancel-scrape', async () => {
    scraperService.cancel()
    return true
  })

  ipcMain.handle('search-game-media', async (_, systemName: string, gameName: string, databases: string[], gamePath?: string) => {
    try {
      const devid = 'retrobat'
      const devpassword = 'JRLmOtnZXwo'
      const softname = 'retrobat'

      const customUser = settingsParser.getSetting('ScreenScraperUser', 'string') || ''
      const customPass = settingsParser.getSetting('ScreenScraperPass', 'string') || ''
      const ssid = customUser || ''
      const sspassword = customPass || ''
      const preferredRegion = settingsParser.getSetting('ScraperRegion', 'string') || 'eu'
      const systemLanguage = (settingsParser.getSetting('Language', 'string') || 'pt').substring(0, 2).toLowerCase()

      const systemInfo = libraryService.getSystems().find(s => s.name === systemName)
      const systemId = SYSTEM_TO_SCREENSCRAPER_PLATFORM[systemName.toLowerCase()] || 
                       (systemInfo ? SYSTEM_TO_SCREENSCRAPER_PLATFORM[systemInfo.platform.toLowerCase()] : 0)

      let jeux: any[] = []

      // 1. Try search by romnom (ROM filename) if gamePath is provided, just like bulk scraper
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
          console.error('ScreenScraper romnom search failed, falling back to text search:', err)
        }
      }

      // 2. If no game found by romnom, search by recherche with cleaned gameName
      if (jeux.length === 0) {
        // Clean game name: remove parenthesis, brackets, extensions, hyphens/underscores
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
      for (const db of databases) {
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
            id: db === 'ScreenScraper' ? String(jeu.id) : `${db.toLowerCase()}-${jeu.id}`,
            name: gameNameParsed,
            db: db,
            releasedate: relDate,
            developer: gameDev,
            publisher: gamePub,
            genre: gameGenre,
            rating: gameRating,
            desc: gameDesc,
            players: gamePlayers,
            media: {
              image: findMediaUrl(jeu.medias, ['mixrbv2', 'mixrbv1', 'fanart', 'ss', 'sstitle']),
              thumbnail: findMediaUrl(jeu.medias, ['box-2D', 'box-3D', 'cover']),
              marquee: findMediaUrl(jeu.medias, ['wheel-hd', 'wheel', 'wheel-steel', 'wheel-carbon', 'screenmarqueesmall', 'screenmarquee', 'logo']),
              video: findMediaUrl(jeu.medias, ['video-normalized', 'video'])
            }
          })
        }
      }
      return results
    } catch (e: any) {
      console.error('search-game-media error:', e)
      return []
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


  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
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
