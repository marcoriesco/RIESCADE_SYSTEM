import { ipcMain } from 'electron'
import * as os from 'os'
import * as fs from 'fs'
import { join, extname } from 'path'
import { exec, execSync } from 'child_process'
import { XMLParser } from 'fast-xml-parser'
import { getConfigPath, getRetroBatPath, getMusicPath } from '../utils/paths'
import { IpcContext } from './index'

interface StaticSystemInfo {
  cpuSpeed: string
  gpuModel: string
  displayRes: string
  videoDriver: string
}

let staticInfoCache: StaticSystemInfo | null = null

export function registerSystemIpc(context: IpcContext): void {
  const { systemService } = context

  // system-command event listener (ipcMain.on)
  ipcMain.on('system-command', (_, command: string, data?: any) => {
    if (command === 'set-active-controllers') {
      context.setActiveControllers(data || [])
      return
    }
    if (command === 'save-input-config') {
      return
    }
    systemService.executeCommand(command)
  })

  // 1. Get System Information (CPU, RAM, Disks, GPU, Res, Driver)
  ipcMain.handle('get-system-information', async () => {
    const cpus = os.cpus()
    const cpuModel = cpus.length > 0 ? cpus[0].model.trim() : 'Unknown CPU'
    const cpuCores = `${cpus.length} threads`

    // Execute heavy WMI/CIM queries using PowerShell ONLY ONCE and cache the static results
    if (!staticInfoCache) {
      try {
        const script = `$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1; ` +
                       `$gpus = Get-CimInstance Win32_VideoController; ` +
                       `$gpu = $gpus | Where-Object { $_.CurrentHorizontalResolution } | Select-Object -First 1; ` +
                       `if (-not $gpu) { $gpu = $gpus | Select-Object -First 1 }; ` +
                       `$cpuSpeed = if ($cpu) { $cpu.MaxClockSpeed } else { 0 }; ` +
                       `$gpuName = if ($gpu) { $gpu.Name } else { 'Unknown GPU' }; ` +
                       `$driverVer = if ($gpu) { $gpu.DriverVersion } else { 'N/A' }; ` +
                       `$resolution = if ($gpu -and $gpu.CurrentHorizontalResolution) { ` +
                       `  '{0}x{1}@{2}Hz' -f $gpu.CurrentHorizontalResolution, $gpu.CurrentVerticalResolution, $gpu.CurrentRefreshRate ` +
                       `} else { 'N/A' }; ` +
                       `@{ cpuSpeed = $cpuSpeed; gpuModel = $gpuName; driverVersion = $driverVer; displayRes = $resolution } | ConvertTo-Json`

        // Escape double quotes inside command argument for powershell
        const escapedScript = script.replace(/"/g, '\\"')
        
        // Query asynchronously to avoid blocking the Electron main thread during startup
        const psOutput = await new Promise<string>((resolve, reject) => {
          exec(`powershell -NoProfile -Command "${escapedScript}"`, { encoding: 'utf8' }, (error, stdout) => {
            if (error) {
              reject(error)
            } else {
              resolve(stdout)
            }
          })
        })

        const parsed = JSON.parse(psOutput.trim())

        let cpuSpeedStr = 'N/A'
        const speedMhz = parseInt(parsed.cpuSpeed, 10)
        if (!isNaN(speedMhz) && speedMhz > 0) {
          cpuSpeedStr = `${(speedMhz / 1000).toFixed(1)} GHz`
        } else {
          cpuSpeedStr = cpus.length > 0 ? `${(cpus[0].speed / 1000).toFixed(1)} GHz` : 'N/A'
        }

        const gpuModelStr = parsed.gpuModel || 'Unknown GPU'
        const displayResStr = parsed.displayRes || 'N/A'

        const vendor = gpuModelStr.toLowerCase().includes('nvidia') ? 'NVIDIA' : 
                       (gpuModelStr.toLowerCase().includes('amd') ? 'AMD' : 
                       (gpuModelStr.toLowerCase().includes('intel') ? 'Intel' : 'GPU'))
        const videoDriverStr = `${vendor} v${(parsed.driverVersion || 'N/A').split('\n')[0].trim()}`

        staticInfoCache = {
          cpuSpeed: cpuSpeedStr,
          gpuModel: gpuModelStr,
          displayRes: displayResStr,
          videoDriver: videoDriverStr
        }
      } catch (err) {
        console.error('Failed to query system static specs via PowerShell:', err)
        staticInfoCache = {
          cpuSpeed: cpus.length > 0 ? `${(cpus[0].speed / 1000).toFixed(1)} GHz` : 'N/A',
          gpuModel: 'Unknown GPU',
          displayRes: 'N/A',
          videoDriver: 'N/A'
        }
      }
    }

    // Dynamic specs: RAM & Disks (instantaneous native OS/FS queries)
    const totalRam = os.totalmem()
    const freeRam = os.freemem()
    const usedRam = totalRam - freeRam
    const ramInfo = `${(usedRam / 1024 / 1024 / 1024).toFixed(1)} GB / ${(totalRam / 1024 / 1024 / 1024).toFixed(1)} GB`

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

    return {
      cpuModel,
      cpuCores,
      cpuSpeed: staticInfoCache.cpuSpeed,
      ramInfo,
      sysDisk,
      userDisk,
      gpuModel: staticInfoCache.gpuModel,
      displayRes: staticInfoCache.displayRes,
      videoDriver: staticInfoCache.videoDriver
    }
  })

  // 2. Bluetooth paired devices
  ipcMain.handle('get-bluetooth-devices', async () => {
    return new Promise((resolve) => {
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

  // 3. Hostname
  ipcMain.handle('get-hostname', async () => {
    return os.hostname()
  })

  // 4. Network Connection Type
  ipcMain.handle('get-network-connection-type', async () => {
    try {
      const interfaces = os.networkInterfaces()
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

  // 5. Gamepad Input Mapping Configuration Saving
  ipcMain.handle('save-input-config', async (_, { deviceName, deviceGUID, mappings }) => {
    const configPath = join(getConfigPath(), 'es_input.cfg')
    const lastConfigPath = join(getConfigPath(), 'es_last_input.cfg')

    let existingConfigs: any[] = []
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
      ignoreDeclaration: true
    })

    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8')
        const xmlObj = parser.parse(content)
        const inputConfigRaw = xmlObj.inputList?.inputConfig
        if (inputConfigRaw) {
          existingConfigs = Array.isArray(inputConfigRaw) ? inputConfigRaw : [inputConfigRaw]
        }
      } catch (err) {
        console.error('Failed to parse es_input.cfg:', err)
      }
    }

    existingConfigs = existingConfigs.filter(
      (cfg: any) => cfg['@_deviceGUID'] !== deviceGUID && cfg['@_deviceName'] !== deviceName
    )

    const serializeInputConfig = (cfg: any): string => {
      let xml = `\t<inputConfig type="${cfg.type}" deviceName="${cfg.deviceName}" deviceGUID="${cfg.deviceGUID}">\n`
      cfg.inputs.forEach((input: any) => {
        xml += `\t\t<input name="${input.name}" type="${input.type}" id="${input.id}" value="${input.value}" />\n`
      })
      xml += `\t</inputConfig>\n`
      return xml
    }

    const newInputConfigObj = {
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

    try {
      let xmlContent = '<?xml version="1.0"?>\n<inputList>\n'
      existingConfigs.forEach((cfg: any) => {
        const type = cfg['@_type'] || 'joystick'
        const devName = cfg['@_deviceName'] || ''
        const devGUID = cfg['@_deviceGUID'] || ''
        xmlContent += `\t<inputConfig type="${type}" deviceName="${devName}" deviceGUID="${devGUID}">\n`
        const inputsRaw = cfg.input ? (Array.isArray(cfg.input) ? cfg.input : [cfg.input]) : []
        inputsRaw.forEach((input: any) => {
          xmlContent += `\t\t<input name="${input['@_name']}" type="${input['@_type']}" id="${input['@_id']}" value="${input['@_value']}" />\n`
        })
        xmlContent += `\t</inputConfig>\n`
      })

      xmlContent += serializeInputConfig(newInputConfigObj)
      xmlContent += '</inputList>\n'

      fs.writeFileSync(configPath, xmlContent, 'utf-8')

      let lastXmlContent = '<?xml version="1.0"?>\n<inputList>\n'
      lastXmlContent += serializeInputConfig(newInputConfigObj)
      lastXmlContent += '</inputList>\n'

      fs.writeFileSync(lastConfigPath, lastXmlContent, 'utf-8')

      console.log('Successfully saved controller config for:', deviceName)
      return true
    } catch (err) {
      console.error('Failed to write es_input.cfg / es_last_input.cfg:', err)
      return false
    }
  })

  // 6. Configured controllers retrieval
  ipcMain.handle('get-configured-controllers', async () => {
    const configPath = join(getConfigPath(), 'es_input.cfg')
    if (!fs.existsSync(configPath)) return []
    try {
      const content = fs.readFileSync(configPath, 'utf-8')
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: true,
        ignoreDeclaration: true
      })
      const xmlObj = parser.parse(content)
      const inputConfigRaw = xmlObj.inputList?.inputConfig
      if (!inputConfigRaw) return []
      const arr = Array.isArray(inputConfigRaw) ? inputConfigRaw : [inputConfigRaw]
      return arr.map((cfg: any) => ({
        name: cfg['@_deviceName'],
        guid: cfg['@_deviceGUID'],
        type: cfg['@_type']
      }))
    } catch (err) {
      console.error('Failed to read configured controllers:', err)
      return []
    }
  })

  // 7. Get Music files inside music folder
  ipcMain.handle('get-music-files', async (_, subfolder?: string) => {
    try {
      const baseDir = getMusicPath()
      const targetDir = subfolder ? join(baseDir, subfolder) : baseDir
      
      if (!fs.existsSync(targetDir)) return []
      
      const files = fs.readdirSync(targetDir)
      const allowedExtensions = ['.mp3', '.ogg', '.wav', '.mp4', '.m4a', '.aac']
      
      const results: string[] = []
      for (const file of files) {
        const fullPath = join(targetDir, file)
        const stat = fs.statSync(fullPath)
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

  // 8. Get music base folder path
  ipcMain.handle('get-music-path', async () => {
    return getMusicPath()
  })

  // 9. Get BIOS information by executing batocera-systems.exe
  ipcMain.handle('get-bios-information', async () => {
    const cmdPath = join(getRetroBatPath(), 'riescade', 'batocera-systems.exe')
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

  // 10. Get text file content
  ipcMain.handle('get-file-content', async (_, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        return await fs.promises.readFile(filePath, 'utf-8')
      }
      return null
    } catch (e) {
      console.error('Failed to read file content:', e)
      return null
    }
  })

  // 11. Get decorations (bezels) directory list
  ipcMain.handle('get-decorations', async () => {
    try {
      const decorationsDir = join(getRetroBatPath(), 'decorations')
      if (!fs.existsSync(decorationsDir)) return []

      const files = fs.readdirSync(decorationsDir, { withFileTypes: true })
      return files
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
    } catch (e) {
      console.error('Failed to read decorations directories:', e)
      return []
    }
  })

  // 12. Get shaders directory list
  ipcMain.handle('get-shaders', async () => {
    try {
      const shadersDir = join(getRetroBatPath(), 'system', 'shaders', 'configs')
      if (!fs.existsSync(shadersDir)) return []

      const files = fs.readdirSync(shadersDir, { withFileTypes: true })
      return files
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .sort()
    } catch (e) {
      console.error('Failed to read shaders directories:', e)
      return []
    }
  })
}
