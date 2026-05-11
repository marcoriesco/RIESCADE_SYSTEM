import { join } from 'path'
import { SystemsParser } from '../parsers/SystemsParser'
import { GamelistParser } from '../parsers/GamelistParser'
import { getConfigPath, getRomsPath } from '../utils/paths'
import { System, Game } from '../../shared/types'
import { ScannerService } from './ScannerService'
import { db } from '../database/db'

export class LibraryService {
  private systemsParser: SystemsParser
  private gamelistParser: GamelistParser
  private scannerService: ScannerService

  constructor() {
    this.systemsParser = new SystemsParser()
    this.gamelistParser = new GamelistParser()
    this.scannerService = new ScannerService()
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
      
      // If same hardware group, sort alphabetically by fullname
      return (a.fullname || a.name).localeCompare(b.fullname || b.name)
    })
  }

  public getGames(systemName: string): Game[] {
    // 1. Try to get from database first
    let games = db.prepare('SELECT * FROM games WHERE system_name = ?').all(systemName) as any[]
    
    // 2. If DB is empty, perform a scan for this system specifically (Lazy Scan)
    if (games.length === 0) {
      const systems = this.getSystems()
      const system = systems.find(s => s.name === systemName)
      if (system) {
        this.scannerService.scanSystem(system)
        games = db.prepare('SELECT * FROM games WHERE system_name = ?').all(systemName) as any[]
      }
    }
    
    if (games.length > 0) {
      const mapped = games.map(g => ({
        ...g,
        favorite: !!g.favorite,
        hidden: !!g.hidden
      }))
      // Sort games alphabetically by name
      const sorted = mapped.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      if (sorted.length > 0) {
        console.log(`[DEBUG] First game in ${systemName}: "${sorted[0].name}" Marquee: "${sorted[0].marquee}"`)
      }
      return sorted
    }

    // Fallback to XML parsing if DB is empty
    const xmlGames = this.getGamesFromXml(systemName)
    return xmlGames.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }

  private getGamesFromXml(systemName: string): Game[] {
    const configPath = getConfigPath()
    const gamelistPath = join(configPath, 'gamelists', systemName, 'gamelist.xml')
    const romsGamelistPath = join(getRomsPath(), systemName, 'gamelist.xml')
    
    let games: Game[] = []
    if (require('fs').existsSync(gamelistPath)) {
      games = this.gamelistParser.parse(gamelistPath, systemName)
    } else if (require('fs').existsSync(romsGamelistPath)) {
      games = this.gamelistParser.parse(romsGamelistPath, systemName)
    }
    return games
  }
}
