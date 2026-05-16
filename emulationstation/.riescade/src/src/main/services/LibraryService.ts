import { join } from 'path'
import { existsSync } from 'fs'
import { SystemsParser } from '../parsers/SystemsParser'
import { GamelistParser } from '../parsers/GamelistParser'
import { SettingsParser } from '../parsers/SettingsParser'
import { getConfigPath, getRomsPath } from '../utils/paths'
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

    return systems.sort((sys1, sys2) => {
      const getPriority = (sys: System) => {
        const name = sys.name.toLowerCase()
        const isAuto = sys.hardware === 'auto collection'
        
        // 1. Arcade Manufacturers (z*)
        if (isAuto && name.startsWith('z')) return 1
        
        // 2. All other Auto Collections
        if (isAuto) return 2
        
        // 3. Special / Maintenance Systems
        if (['library', 'magazine', 'manuals', 'retrobat', 'screenshots'].includes(name)) return 3
        
        // 4. Real Game Systems (The rest)
        return 4
      }

      const p1 = getPriority(sys1)
      const p2 = getPriority(sys2)

      if (p1 !== p2) return p1 - p2

      // Within the same priority (especially priority 4), sort by hardware THEN name
      if (p1 === 4) {
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
    const configPath = getConfigPath()
    const gamelistPath = join(configPath, 'gamelists', systemName, 'gamelist.xml')
    const romsGamelistPath = join(getRomsPath(), systemName, 'gamelist.xml')
    
    let games: Game[] = []
    if (existsSync(gamelistPath)) {
      games = this.gamelistParser.parse(gamelistPath, systemName)
    } else if (existsSync(romsGamelistPath)) {
      games = this.gamelistParser.parse(romsGamelistPath, systemName)
    }

    return games.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
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
}
