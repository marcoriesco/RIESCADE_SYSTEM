import { XMLParser } from 'fast-xml-parser'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { System } from '../../shared/types'
import { getConfigPath } from '../utils/paths'
import { SettingsParser } from './SettingsParser'

export class SystemsParser {
  private parser: XMLParser

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      processEntities: {
        maxTotalExpansions: 99999,
        maxExpandedLength: 1000000
      }
    })
  }

  public parse(): System[] {
    const configPath = getConfigPath()
    const mainSystemsPath = join(configPath, 'es_systems.cfg')
    
    // Find all es_systems*.cfg files
    const cfgFiles: string[] = []
    if (existsSync(mainSystemsPath)) cfgFiles.push(mainSystemsPath)

    if (existsSync(configPath)) {
      const files = readdirSync(configPath)
      files.forEach(f => {
        if (f.startsWith('es_systems_') && f.endsWith('.cfg')) {
          cfgFiles.push(join(configPath, f))
        }
      })
    }

    let systems: System[] = []

    for (const cfgFile of cfgFiles) {
      const fileSystems = this.parseFile(cfgFile)
      systems = this.mergeSystems(systems, fileSystems)
    }

    const settings = new SettingsParser()
    const showEmpty = settings.getSetting('LoadEmptySystems', 'bool')

    // Resolve all system paths and count games first
    const resolvedSystems = systems.map(s => {
      const fullPath = this.resolveRomPath(s.path)
      const pathExists = existsSync(fullPath)
      const count = pathExists ? this.countGames(fullPath) : 0
      
      return {
        ...s,
        path: fullPath,
        gamecount: count,
        _pathExists: pathExists
      }
    })

    try {
      const debugContent = resolvedSystems.map(s => `System: ${s.name}, Path: ${s.path}, Exists: ${s._pathExists}, Count: ${s.gamecount}`).join('\n')
      writeFileSync(join(configPath, '..', '.riescade', 'src', 'debug_systems.log'), debugContent, 'utf-8')
    } catch (e) {
      console.error('Failed to write debug_systems.log:', e)
    }

    // Filter systems that have existing ROM folders or act as master groups for systems with games
    const filteredSystems = resolvedSystems.filter(s => {
      // 1. Keep if it has a physical ROM path and contains games (or showEmpty is active)
      if (s._pathExists && (s.gamecount > 0 || showEmpty)) {
        return true
      }

      // 2. Keep if it is a group master (another system has s.group === s.name) and that system has games
      const hasGroupedChildrenWithGames = resolvedSystems.some(child => 
        child.group && 
        child.group.toLowerCase() === s.name.toLowerCase() && 
        child._pathExists && 
        child.gamecount > 0
      )

      if (hasGroupedChildrenWithGames) {
        return true
      }

      return false
    }).map(s => {
      // Clean up the temporary field
      const { _pathExists, ...rest } = s as any
      return rest
    })

    // Inject Auto Collections
    const autoColsString = settings.getSetting('CollectionSystemsAuto', 'string') || ''
    if (autoColsString) {
      const enabledCols = autoColsString.split(',').filter(c => c.trim() !== '')
      
      // Map specific collection names to their ES theme folders
      const specificThemes: Record<string, string> = {
        'all': 'auto-allgames',
        'recent': 'auto-lastplayed',
        'favorites': 'auto-favorites',
        '2players': 'auto-at2players',
        '4players': 'auto-at4players',
        'neverplayed': 'auto-neverplayed',
        'retroachievements': 'auto-retroachievements',
        'vertical': 'auto-verticalarcade',
        'lightgun': 'auto-lightgun',
        'wheel': 'auto-wheel',
        'trackball': 'auto-trackball',
        'spinner': 'auto-spinner',
        'arcade': 'arcade'
      }

      enabledCols.forEach(col => {
        let themeName = specificThemes[col] || col
        let displayName = col

        if (col.startsWith('_')) {
          // Genre collection: _action -> theme: auto-action
          themeName = `auto-${col.substring(1)}`
          displayName = col.substring(1)
        } else if (col.startsWith('z') && !specificThemes[col]) {
          // Arcade collection: znamco -> theme: namco
          themeName = col.substring(1)
          displayName = col.substring(1)
        } else if (!specificThemes[col]) {
          themeName = `auto-${col}`
          displayName = col
        }

        // Avoid duplicate system names if possible (e.g. arcade conflict)
        const isDuplicate = filteredSystems.some(s => s.name === col)
        const systemName = isDuplicate ? `auto-${col}` : col

        filteredSystems.push({
          name: systemName,
          fullname: displayName.toUpperCase(),
          path: `virtual://${col}`,
          extension: '',
          command: '',
          platform: 'pc',
          theme: themeName,
          hardware: 'auto collection',
          emulators: [],
          gamecount: 0
        })
      })
    }

    return filteredSystems
  }

  private parseFile(filePath: string): System[] {
    try {
      const content = readFileSync(filePath, 'utf-8')
      const jsonObj = this.parser.parse(content)
      const systemList = jsonObj.systemList?.system

      if (!systemList) return []

      const list = Array.isArray(systemList) ? systemList : [systemList]

      return list.map((s: any) => {
        const sName = String(s.name || '').toLowerCase()
        let sHardware = String(s.hardware || '')
        if (!sHardware) {
          if (['library', 'magazine', 'manuals', 'retrobat', 'screenshots', 'windows'].includes(sName)) {
            sHardware = 'system'
          } else {
            sHardware = 'console'
          }
        }

        return {
          name: String(s.name),
          fullname: String(s.fullname || s.name),
          path: String(s.path),
          extension: String(s.extension || ''),
          command: String(s.command || ''),
          platform: String(s.platform || ''),
          theme: String(s.theme || s.name),
          hardware: sHardware,
          group: s.group ? String(s.group) : undefined,
          emulators: this.parseEmulators(s.emulators)
        }
      })
    } catch (error) {
      console.error(`Error parsing systems file ${filePath}:`, error)
      return []
    }
  }

  private resolveRomPath(romPath: string): string {
    const configPath = getConfigPath()
    // Resolve ~ to configPath parent (RetroBat root)
    let path = romPath.replace('~', join(configPath, '..'))
    // Handle relative paths
    return resolve(configPath, path)
  }

  private countGames(path: string): number {
    try {
      if (!existsSync(path)) return 0
      return readdirSync(path).filter(f => !f.startsWith('.')).length
    } catch {
      return 0
    }
  }

  private parseEmulators(emulators: any): any[] {
    if (!emulators || !emulators.emulator) return []
    const emulatorList = Array.isArray(emulators.emulator) ? emulators.emulator : [emulators.emulator]

    return emulatorList.map((e: any) => ({
      name: e['@_name'],
      cores: this.parseCores(e.cores)
    }))
  }

  private parseCores(cores: any): string[] {
    if (!cores || !cores.core) return []
    return Array.isArray(cores.core) ? cores.core : [cores.core]
  }

  private mergeSystems(base: System[], custom: System[]): System[] {
    const map = new Map<string, System>()
    base.forEach((s) => map.set(s.name, s))
    custom.forEach((s) => map.set(s.name, s))
    return Array.from(map.values())
  }
}
