import { exec } from 'child_process'
import { join } from 'path'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { Game, System } from '../../shared/types'
import { getRetroBatPath } from '../utils/paths'
import { ControllerService, ControllerInfo } from './ControllerService'

export class LauncherService {
  private controllerService: ControllerService

  constructor() {
    this.controllerService = new ControllerService()
  }

  public launch(game: Game, system: System, activeControllers: ControllerInfo[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      const retroBatPath = getRetroBatPath()
      const launcherPath = join(retroBatPath, 'emulationstation', 'emulatorLauncher.exe')
      
      const romPath = join(retroBatPath, 'roms', system.name, game.path)
      
      // 1. Create a temporary gameinfo XML as ES does
      const tempDir = join(tmpdir(), 'modern-frontend.tmp')
      if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true })
      
      const gameXmlPath = join(tempDir, 'game.xml')
      const gameXmlContent = `<?xml version="1.0"?>
<gameList>
  <game>
    <path>${game.path}</path>
    <name>${game.name}</name>
    <desc>${game.desc || ''}</desc>
    <image>${game.image || ''}</image>
    <video>${game.video || ''}</video>
    <rating>${game.rating || 0}</rating>
    <releasedate>${game.releasedate || ''}</releasedate>
    <developer>${game.developer || ''}</developer>
    <publisher>${game.publisher || ''}</publisher>
    <genre>${game.genre || ''}</genre>
    <players>${game.players || ''}</players>
  </game>
</gameList>`
      
      writeFileSync(gameXmlPath, gameXmlContent)

      // 2. Setup arguments with dynamic controller info
      const emulator = system.emulators?.[0]?.name || 'libretro'
      const core = system.emulators?.[0]?.cores?.[0] || ''

      let controllerArgs: string[] = []
      if (activeControllers.length > 0) {
        activeControllers.forEach((controller, index) => {
           const args = this.controllerService.getLauncherArgs(index, controller)
           controllerArgs = [...controllerArgs, ...args]
        })
      } else {
        // Fallback for P1 if no controllers detected
        controllerArgs = [
          '-p1index', '0',
          '-p1guid', '030000005e0400008e02000000007200',
          '-p1path', '"USB\\VID_045E&PID_028E&IG_01\\2&DEE0F28&0&01"',
          '-p1name', '"Xbox 360 Controller"',
          '-p1nbbuttons', '11',
          '-p1nbhats', '1',
          '-p1nbaxes', '6'
        ]
      }

      const args = [
        '-gameinfo', `"${gameXmlPath}"`,
        ...controllerArgs,
        '-system', system.name,
        '-emulator', emulator,
        '-core', core,
        '-rom', `"${romPath}"`
      ]

      const command = `"${launcherPath}" ${args.join(' ')}`

      console.log(`Launching with full args: ${command}`)

      exec(command, { cwd: retroBatPath }, (error) => {
        if (error) {
          console.error('Launch error:', error)
          reject(error)
          return
        }
        resolve()
      })
    })
  }
}
