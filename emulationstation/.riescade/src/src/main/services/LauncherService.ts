import { exec } from 'child_process'
import { join } from 'path'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { Game, System } from '../../shared/types'
import { getRetroBatPath } from '../utils/paths'

interface ControllerInfo {
  name: string
  guid: string
  path?: string
  buttons: number
  axes: number
  hats: number
}

export class LauncherService {
  public launch(game: Game, system: System, activeControllers: ControllerInfo[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      const retroBatPath = getRetroBatPath()
      const launcherPath = join(retroBatPath, 'emulationstation', 'emulatorLauncher.exe')
      
      const romPath = join(retroBatPath, 'roms', system.name, game.path)
      
      // Create a temporary gameinfo XML as ES does
      const tempDir = join(tmpdir(), 'riescade.tmp')
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

      // Setup arguments
      let emulator = game.emulator || system.emulators?.[0]?.name || 'libretro'
      let core = ''

      // If we are using the game-specific emulator, find its core
      const selectedEmulator = system.emulators?.find(e => e.name === emulator)
      if (selectedEmulator) {
        core = selectedEmulator.cores?.[0] || ''
      } else if (system.emulators?.[0]) {
        core = system.emulators[0].cores?.[0] || ''
      }

      let controllerArgs: string[] = []
      
      if (activeControllers.length > 0) {
        // Try to get a list of HID device IDs to match paths
        let devicePaths: string[] = []
        try {
          // Broaden search to find any device with VID/PID
          const stdout = require('child_process').execSync('powershell -Command "Get-PnpDevice -Status \'OK\' | Where-Object { $_.InstanceId -like \'*VID_*\' -and $_.InstanceId -like \'*PID_*\' } | Select-Object -ExpandProperty InstanceId"', { encoding: 'utf8' })
          devicePaths = stdout.split('\n').map(s => s.trim()).filter(s => s.length > 0)
        } catch (e) {
          console.error('Failed to get device paths via PowerShell', e)
        }

        activeControllers.forEach((controller, index) => {
          const p = `p${index + 1}`
          
          // Try to find the path for this controller
          // GUID format (SDL2): 03000000vVsS0000pPsS0000... (swapped bytes)
          let discoveredPath = ""
          if (controller.guid.length >= 20) {
            const vSwap = controller.guid.substring(8, 12)
            const pSwap = controller.guid.substring(16, 20)
            const vidMatch = vSwap.substring(2, 4) + vSwap.substring(0, 2)
            const pidMatch = pSwap.substring(2, 4) + pSwap.substring(0, 2)
            
            if (vidMatch && pidMatch) {
              // Find paths matching this VID/PID
              const matches = devicePaths.filter(dp => 
                dp.toUpperCase().includes(`VID_${vidMatch.toUpperCase()}`) && 
                dp.toUpperCase().includes(`PID_${pidMatch.toUpperCase()}`)
              )
              // Use the index to pick the correct one if multiple are connected
              if (matches.length > 0) {
                discoveredPath = matches[index] || matches[0]
              }
            }
          }

          // If still empty, use the provided path or default
          const finalPath = discoveredPath || controller.path || ""

          controllerArgs.push(
            `-${p}index`, index.toString(),
            `-${p}guid`, controller.guid,
            `-${p}name`, `"${controller.name}"`,
            `-${p}nbbuttons`, controller.buttons.toString(),
            `-${p}nbaxes`, controller.axes.toString(),
            `-${p}nbhats`, (controller.hats || 1).toString(),
            `-${p}path`, `"${finalPath}"`
          )
        })
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
      console.log(`Launching: ${command}`)

      exec(command, { cwd: retroBatPath }, (error) => {
        if (error) {
          console.warn('Launcher exited with code:', error.code)
        }
        resolve()
      })
    })
  }
}
