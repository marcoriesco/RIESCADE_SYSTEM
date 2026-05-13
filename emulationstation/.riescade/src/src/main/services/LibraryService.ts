import { join } from 'path'
import { existsSync } from 'fs'
import { SystemsParser } from '../parsers/SystemsParser'
import { GamelistParser } from '../parsers/GamelistParser'
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
    
    // Sort systems: First by Hardware (alphabetical), then by Fullname (alphabetical)
    return systems.sort((a, b) => {
      const aHardware = (a.hardware || 'console').toLowerCase()
      const bHardware = (b.hardware || 'console').toLowerCase()

      if (aHardware !== bHardware) {
        return aHardware.localeCompare(bHardware)
      }
      
      return (a.fullname || a.name).localeCompare(b.fullname || b.name)
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
}
