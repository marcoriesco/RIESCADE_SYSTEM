import chokidar from 'chokidar'
import { join } from 'path'
import { existsSync } from 'fs'
import { db } from '../database/db'
import { getRetroBatPath, getConfigPath } from '../utils/paths'
import { GamelistParser } from '../parsers/GamelistParser'
import { System } from '../../shared/types'

export class ScannerService {
  private watchers: Map<string, chokidar.FSWatcher> = new Map()
  private gamelistParser: GamelistParser

  constructor() {
    this.gamelistParser = new GamelistParser()
  }

  public async scanAll(systems: System[]) {
    for (const system of systems) {
      this.scanSystem(system)
    }
  }

  public scanSystem(system: System) {
    // 1. Ensure system exists in DB to avoid Foreign Key constraint failure
    const upsertSystem = db.prepare(`
      INSERT OR REPLACE INTO systems (name, fullname, path, extension, platform, theme)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    upsertSystem.run(system.name, system.fullname, system.path, system.extension, system.platform, system.theme)

    const configPath = getConfigPath()
    const gamelistPath = join(configPath, 'gamelists', system.name, 'gamelist.xml')
    const romsGamelistPath = join(getRetroBatPath(), 'roms', system.name, 'gamelist.xml')
    
    const actualGamelistPath = existsSync(gamelistPath) ? gamelistPath : romsGamelistPath

    const upsertGame = db.prepare(`
      INSERT OR REPLACE INTO games (id, system_name, path, name, desc, image, video, marquee, thumbnail, rating, releasedate, developer, publisher, genre, players, favorite, hidden, fanart, wheel, titleshot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    if (existsSync(actualGamelistPath)) {
      const games = this.gamelistParser.parse(actualGamelistPath, system.name)
      const transaction = db.transaction(() => {
        for (const game of games) {
          upsertGame.run(
            `${system.name}-${game.path}`,
            system.name,
            game.path,
            game.name,
            game.desc,
            game.image,
            game.video,
            game.marquee,
            game.thumbnail,
            game.rating,
            game.releasedate,
            game.developer,
            game.publisher,
            game.genre,
            game.players,
            game.favorite ? 1 : 0,
            game.hidden ? 1 : 0,
            game.fanart,
            game.wheel,
            game.titleshot
          )
        }
      })
      transaction()
    }

    // Setup watcher for live updates
    if (this.watchers.has(system.name)) {
      this.watchers.get(system.name)?.close()
    }

    const romsPath = join(getRetroBatPath(), 'roms', system.name)
    if (existsSync(romsPath)) {
        const watcher = chokidar.watch(romsPath, {
          ignored: /(^|[\/\\])\../, 
          persistent: true,
          ignoreInitial: true
        })

        watcher.on('add', (path) => {
          console.log(`File ${path} has been added`)
        })

        watcher.on('unlink', (path) => {
          console.log(`File ${path} has been removed`)
        })

        this.watchers.set(system.name, watcher)
    }
  }
}
