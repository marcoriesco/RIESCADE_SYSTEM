import { join, resolve, relative, dirname } from 'path'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { SystemsParser } from '../parsers/SystemsParser'
import { GamelistParser } from '../parsers/GamelistParser'
import { SettingsParser } from '../parsers/SettingsParser'
import { getConfigPath, getRomsPath, getRetroBatPath } from '../utils/paths'
import { System, Game } from '../../shared/types'

export class LibraryService {
  private systemsParser: SystemsParser
  private gamelistParser: GamelistParser

  constructor() {
    this.systemsParser = new SystemsParser()
    this.gamelistParser = new GamelistParser()
  }

  public getSystems(): System[] {
    const systems = this.systemsParser.parse()
    const settings = new SettingsParser()
    const sortMode = settings.getSetting('SortSystems', 'string') || 'hardware'

    // Add collections virtual system
    const customSetting = settings.getSetting('CollectionSystemsCustom', 'string') || ''
    const enabledCols = String(customSetting).split(',').map(s => s.trim()).filter(s => s.length > 0)
    const gamecount = enabledCols.length

    systems.push({
      name: 'collections',
      fullname: 'Coleções',
      path: 'virtual://collections',
      extension: '',
      command: '',
      platform: 'pc',
      theme: 'custom-collections',
      hardware: 'custom-collections',
      emulators: [],
      gamecount: gamecount
    })

    return systems.sort((sys1, sys2) => {
      const getPriority = (sys: System) => {
        const name = sys.name.toLowerCase()
        const isAuto = sys.hardware === 'auto collection'
        
        // 5. Coleções (Custom Collections)
        if (name === 'collections') return 5

        // 1. Arcade Manufacturers (z*)
        if (isAuto && name.startsWith('z')) return 1
        
        // 2. All other Auto Collections
        if (isAuto) return 2
        
        // 3. Real Game Systems (The rest)
        const isSpecial = ['library', 'magazine', 'manuals', 'retrobat', 'screenshots'].includes(name) || sys.hardware === 'system'
        if (!isSpecial) return 3

        // 4. Special / Maintenance Systems
        return 4
      }

      const p1 = getPriority(sys1)
      const p2 = getPriority(sys2)

      if (p1 !== p2) return p1 - p2

      // Within the same priority (especially priority 3), sort by hardware THEN name
      if (p1 === 3) {
        const hw1 = (sys1.hardware || 'console').toLowerCase()
        const hw2 = (sys2.hardware || 'console').toLowerCase()
        if (hw1 !== hw2) return hw1.localeCompare(hw2)
      }

      const name1 = (sys1.fullname || sys1.name).toUpperCase()
      const name2 = (sys2.fullname || sys2.name).toUpperCase()
      return name1.localeCompare(name2)
    })
  }

  public getGames(systemName: string): Game[] {
    if (systemName === 'collections') {
      const settings = new SettingsParser()
      const customSetting = settings.getSetting('CollectionSystemsCustom', 'string') || ''
      const enabledCols = String(customSetting).split(',').map(s => s.trim()).filter(s => s.length > 0)
      
      return enabledCols.map(colName => ({
        id: `collection_${colName}`,
        name: colName,
        desc: `Coleção de jogos: ${colName}`,
        path: colName,
        system: 'collections',
        favorite: false,
        hidden: false,
        playcount: 0,
        isCollectionFolder: true
      } as any))
    }

    const systems = this.systemsParser.parse()
    const system = systems.find(s => s.name.toLowerCase() === systemName.toLowerCase())

    const configPath = getConfigPath()
    let gamelistPath = join(configPath, 'gamelists', systemName, 'gamelist.xml')
    let romsGamelistPath = join(getRomsPath(), systemName, 'gamelist.xml')
    let systemGamelistPath = system ? join(system.path, 'gamelist.xml') : ''

    // Fix collision between physical arcade system and virtual auto-arcade collection
    if (systemName === 'auto-arcade') {
      gamelistPath = join(configPath, 'gamelists', 'arcade', 'gamelist.xml')
      romsGamelistPath = ''
      systemGamelistPath = ''
    } else if (systemName === 'arcade') {
      gamelistPath = '' // Physical arcade should only load roms/arcade/gamelist.xml
    }
    
    let games: Game[] = []
    let source = 'none'

    if (gamelistPath && existsSync(gamelistPath)) {
      games = this.gamelistParser.parse(gamelistPath, systemName)
      if (games.length > 0) source = 'gamelistPath'
    }
    
    if (games.length === 0 && romsGamelistPath && existsSync(romsGamelistPath)) {
      games = this.gamelistParser.parse(romsGamelistPath, systemName)
      if (games.length > 0) source = 'romsGamelistPath'
    }
    
    if (games.length === 0 && systemGamelistPath && existsSync(systemGamelistPath)) {
      games = this.gamelistParser.parse(systemGamelistPath, systemName)
      if (games.length > 0) source = 'systemGamelistPath'
    }

    // Fallback: scan physical directory if gamelist did not yield any games
    if (games.length === 0 && system && existsSync(system.path)) {
      const extensions = (system.extension || '').split(/\s+/).filter(e => e.trim().length > 0)
      games = this.scanPhysicalGames(system.path, extensions, systemName)
      if (games.length > 0) source = 'physicalScan'
    }

    try {
      const logStr = `getGames systemName: ${systemName}\n  systemFound: ${!!system}\n  systemPath: ${system ? system.path : 'N/A'}\n  gamelistPath: ${gamelistPath} (exists: ${existsSync(gamelistPath)})\n  romsGamelistPath: ${romsGamelistPath} (exists: ${romsGamelistPath ? existsSync(romsGamelistPath) : false})\n  systemGamelistPath: ${systemGamelistPath} (exists: ${systemGamelistPath ? existsSync(systemGamelistPath) : false})\n  finalSource: ${source}\n  gamesCount: ${games.length}\n\n`
      readFileSync(join(configPath, '..', '.riescade', 'src', 'debug_games.log')) // Force dependency
      const fs = require('fs')
      fs.appendFileSync(join(configPath, '..', '.riescade', 'src', 'debug_games.log'), logStr, 'utf-8')
    } catch(e) {
      try {
        const fs = require('fs')
        const logStr = `getGames systemName: ${systemName}\n  systemFound: ${!!system}\n  systemPath: ${system ? system.path : 'N/A'}\n  finalSource: ${source}\n  gamesCount: ${games.length}\n\n`
        fs.appendFileSync(join(configPath, '..', '.riescade', 'src', 'debug_games.log'), logStr, 'utf-8')
      } catch (err) {}
    }

    return games.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  }

  private scanPhysicalGames(systemPath: string, extensions: string[], systemName: string): Game[] {
    const games: Game[] = []
    const extSet = new Set(extensions.map(e => e.toLowerCase().trim()))

    const scanDir = (dir: string) => {
      if (!existsSync(dir)) return
      try {
        const files = readdirSync(dir)

        for (const file of files) {
          const fullPath = join(dir, file)
          const stat = statSync(fullPath)

          if (stat.isDirectory()) {
            scanDir(fullPath)
          } else {
            const ext = (file.includes('.') ? file.substring(file.lastIndexOf('.')) : '').toLowerCase()
            if (extSet.has(ext)) {
              const relPath = './' + relative(systemPath, fullPath).replace(/\\/g, '/')
              const displayName = file.substring(0, file.length - ext.length)

              const game: Game = {
                id: fullPath.replace(/\\/g, '/'),
                name: displayName,
                path: relPath,
                system: systemName,
                favorite: false,
                hidden: false,
                playcount: 0
              } as any

              // If it's the screenshots system, set the image property to the absolute path of the file itself!
              if (systemName === 'screenshots') {
                game.image = fullPath.replace(/\\/g, '/')
              }

              games.push(game)
            }
          }
        }
      } catch (err) {
        console.error(`Error scanning directory ${dir}:`, err)
      }
    }

    scanDir(systemPath)
    return games
  }

  public getCustomCollections(): string[] {
    const collectionsDir = join(getConfigPath(), 'collections')
    if (!existsSync(collectionsDir)) return []
    
    try {
      const files = readdirSync(collectionsDir)
      const collections: string[] = []
      files.forEach(f => {
        if (f.startsWith('custom-') && f.endsWith('.cfg')) {
          const colName = f.substring(7, f.length - 4)
          collections.push(colName)
        }
      })
      // Sort alphabetically
      return collections.sort((a, b) => a.localeCompare(b))
    } catch (e) {
      console.error('Failed to read custom collections:', e)
      return []
    }
  }

  public getCollectionGames(collectionName: string): Game[] {
    const configPath = getConfigPath()
    const cfgPath = join(configPath, 'collections', `custom-${collectionName}.cfg`)
    if (!existsSync(cfgPath)) return []

    try {
      const content = readFileSync(cfgPath, 'utf-8')
      const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0)

      const allSystems = this.getSystems()
      const collectionGames: Game[] = []

      // Cache the parsed games for systems we encounter
      const parsedSystemsGames = new Map<string, Game[]>()

      for (const line of lines) {
        // E.g. line: ./roms/cps3/sfiii.zip
        let resolvedRomPath = line.replace(/^\.\//, '') // remove ./
        const absoluteRomPath = resolve(getRetroBatPath(), resolvedRomPath).replace(/\\/g, '/')

        // Extract system name from path
        const normalized = absoluteRomPath.toLowerCase()
        const match = normalized.match(/\/roms\/([^/]+)\//)
        const systemName = match ? match[1] : ''

        if (!systemName) continue

        // Get games of this system
        const sysKey = systemName.toLowerCase()
        if (!parsedSystemsGames.has(sysKey)) {
          parsedSystemsGames.set(sysKey, this.getGames(systemName))
        }
        const systemGames = parsedSystemsGames.get(sysKey) || []

        // Find the system object to get its ROMs path
        const systemObj = allSystems.find(s => s.name.toLowerCase() === sysKey)
        const systemRomDir = systemObj ? systemObj.path : join(getRomsPath(), systemName)

        // Find the game in systemGames that matches the path
        const foundGame = systemGames.find(g => {
          // Resolve both to absolute paths
          const gameAbsPath = resolve(systemRomDir, g.path).replace(/\\/g, '/')
          return gameAbsPath.toLowerCase() === absoluteRomPath.toLowerCase()
        })

        if (foundGame) {
          collectionGames.push({
            ...foundGame,
          })
        } else {
          // Create placeholder game
          const filename = absoluteRomPath.split('/').pop() || ''
          const displayName = filename.replace(/\.[^/.]+$/, '') // remove extension
          
          // Make path relative to system ROM directory
          const relativeRomPath = './' + relative(systemRomDir, absoluteRomPath).replace(/\\/g, '/')

          collectionGames.push({
            id: absoluteRomPath,
            name: displayName,
            path: relativeRomPath,
            system: systemName,
            favorite: false,
            hidden: false,
            playcount: 0
          })
        }
      }

      return collectionGames.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    } catch (e) {
      console.error(`Failed to read games for collection ${collectionName}:`, e)
      return []
    }
  }

  public updateGame(systemName: string, gameData: Game): void {
    const configPath = getConfigPath()
    const gamelistPath = join(configPath, 'gamelists', systemName, 'gamelist.xml')
    const romsGamelistPath = join(getRomsPath(), systemName, 'gamelist.xml')
    
    const targetPath = existsSync(gamelistPath) ? gamelistPath : romsGamelistPath
    if (!existsSync(targetPath)) return

    const games = this.gamelistParser.parse(targetPath, systemName)
    const index = games.findIndex(g => g.path === gameData.path)
    
    if (index !== -1) {
      games[index] = { ...games[index], ...gameData }
      this.gamelistParser.save(targetPath, games)
    }
  }

  public getCollectionsForGame(systemName: string, gamePath: string): string[] {
    const collections = this.getCustomCollections()
    const cleanGamePath = gamePath.replace(/^\.\//, '')
    const targetLine = `./roms/${systemName}/${cleanGamePath}`.toLowerCase()

    const fs = require('fs')
    const configPath = getConfigPath()
    const matching: string[] = []

    for (const col of collections) {
      const cfgPath = join(configPath, 'collections', `custom-${col}.cfg`)
      if (fs.existsSync(cfgPath)) {
        const content = fs.readFileSync(cfgPath, 'utf-8')
        const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
        if (lines.some(l => l.toLowerCase() === targetLine)) {
          matching.push(col)
        }
      }
    }

    return matching
  }

  public toggleGameInCollection(collectionName: string, systemName: string, gamePath: string, action: 'add' | 'remove'): boolean {
    const configPath = getConfigPath()
    const collectionsDir = join(configPath, 'collections')
    const fs = require('fs')
    if (!fs.existsSync(collectionsDir)) {
      fs.mkdirSync(collectionsDir, { recursive: true })
    }

    const cfgPath = join(collectionsDir, `custom-${collectionName}.cfg`)
    
    // Read existing lines
    let lines: string[] = []
    if (fs.existsSync(cfgPath)) {
      const content = fs.readFileSync(cfgPath, 'utf-8')
      lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
    }

    const cleanGamePath = gamePath.replace(/^\.\//, '')
    const targetLine = `./roms/${systemName}/${cleanGamePath}`

    const exists = lines.some(l => l.toLowerCase() === targetLine.toLowerCase())

    if (action === 'add') {
      if (!exists) {
        lines.push(targetLine)
        fs.writeFileSync(cfgPath, lines.join('\n') + '\n', 'utf-8')
        return true
      }
    } else if (action === 'remove') {
      if (exists) {
        lines = lines.filter(l => l.toLowerCase() !== targetLine.toLowerCase())
        fs.writeFileSync(cfgPath, lines.join('\n') + '\n', 'utf-8')
        return true
      }
    }
    return false
  }
}
