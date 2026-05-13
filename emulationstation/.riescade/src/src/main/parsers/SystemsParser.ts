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
    const showEmpty = settings.getSetting('ShowEmptySystems', 'bool')

    // Filter systems that have existing ROM folders and count games
    return systems.filter(s => {
      const fullPath = this.resolveRomPath(s.path)
      if (existsSync(fullPath)) {
        const count = this.countGames(fullPath)
        s.gamecount = count
        s.path = fullPath 
        
        if (count === 0 && !showEmpty) return false
        return true
      }
      return false
    })
  }

  private parseFile(filePath: string): System[] {
    try {
      const content = readFileSync(filePath, 'utf-8')
      const jsonObj = this.parser.parse(content)
      const systemList = jsonObj.systemList?.system

      if (!systemList) return []

      const list = Array.isArray(systemList) ? systemList : [systemList]

      return list.map((s: any) => ({
        name: String(s.name),
        fullname: String(s.fullname || s.name),
        path: String(s.path),
        extension: String(s.extension || ''),
        command: String(s.command || ''),
        platform: String(s.platform || ''),
        theme: String(s.theme || s.name),
        hardware: String(s.hardware || 'console'),
        emulators: this.parseEmulators(s.emulators)
      }))
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
