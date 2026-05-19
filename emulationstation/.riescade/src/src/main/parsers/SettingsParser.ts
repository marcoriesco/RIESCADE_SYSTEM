import { XMLParser, XMLBuilder } from 'fast-xml-parser'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getConfigPath } from '../utils/paths'

export class SettingsParser {
  private parser: XMLParser
  private builder: XMLBuilder

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
      ignoreDeclaration: true,
      processEntities: {
        maxTotalExpansions: 99999,
        maxExpandedLength: 1000000
      }
    })
    this.builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      suppressEmptyNode: true,
      suppressBooleanAttributes: false,
      ignoreDeclaration: true
    })
  }

  private getSettingsPath(): string {
    const cfgPath = join(getConfigPath(), 'es_settings.cfg')
    const xmlPath = join(getConfigPath(), 'es_settings.xml')
    return existsSync(cfgPath) ? cfgPath : (existsSync(xmlPath) ? xmlPath : cfgPath)
  }

  public getAllSettings(): any {
    const settingsPath = this.getSettingsPath()
    if (!existsSync(settingsPath)) return {}

    try {
      const content = readFileSync(settingsPath, 'utf-8')
      const jsonObj = this.parser.parse(content)
      const settings: any = {}

      const config = jsonObj.config || {}
      
      const processElements = (type: string) => {
        const elements = config[type]
        if (elements) {
          const list = Array.isArray(elements) ? elements : [elements]
          list.forEach((s: any) => {
            settings[s['@_name']] = { value: s['@_value'], type }
          })
        }
      }

      processElements('bool')
      processElements('string')
      processElements('int')
      processElements('float')

      return settings
    } catch (error) {
      console.error('Error parsing all settings:', error)
      return {}
    }
  }

  public getSelectedTheme(): string {
    return this.getSetting('RIESCADE.ThemeSet', 'string') || 'default'
  }

  public getSetting(settingName: string, type: 'string' | 'bool' | 'int' | 'float' = 'string'): any {
    const settings = this.getAllSettings()
    return settings[settingName]?.value ?? null
  }

  public saveSetting(name: string, value: any, type: 'string' | 'bool' | 'int' | 'float'): void {
    const settingsPath = this.getSettingsPath()
    let jsonObj: any = { config: { bool: [], string: [], int: [], float: [] } }

    if (existsSync(settingsPath)) {
      try {
        const content = readFileSync(settingsPath, 'utf-8')
        jsonObj = this.parser.parse(content)
        if (!jsonObj.config) jsonObj.config = {}
        if (!jsonObj.config.bool) jsonObj.config.bool = []
        if (!jsonObj.config.string) jsonObj.config.string = []
        if (!jsonObj.config.int) jsonObj.config.int = []
        if (!jsonObj.config.float) jsonObj.config.float = []
      } catch (e) {
        console.error('Error reading settings for save:', e)
      }
    }

    // Ensure types are arrays
    const types = ['bool', 'string', 'int', 'float']
    types.forEach(t => {
      if (jsonObj.config[t] && !Array.isArray(jsonObj.config[t])) {
        jsonObj.config[t] = [jsonObj.config[t]]
      } else if (!jsonObj.config[t]) {
        jsonObj.config[t] = []
      }
    })

    // Remove existing if present
    types.forEach(t => {
      jsonObj.config[t] = jsonObj.config[t].filter((item: any) => item['@_name'] !== name)
    })

    // Add new
    jsonObj.config[type].push({
      '@_name': name,
      '@_value': String(value)
    })

    try {
      const xmlContent = '<?xml version="1.0"?>\n' + this.builder.build(jsonObj)
      writeFileSync(settingsPath, xmlContent, 'utf-8')

      // Clear systems cache on settings change that might affect system configuration
      const affectingSettings = [
        'VisibleSystems',
        'HiddenSystems',
        'SystemsGrouped',
        'LoadEmptySystems',
        'CollectionSystemsAuto',
        'CollectionSystemsCustom'
      ]
      if (affectingSettings.includes(name)) {
        try {
          const { SystemsParser } = require('./SystemsParser')
          SystemsParser.clearCache()
        } catch (e) {}
      }
    } catch (error) {
      console.error('Error saving setting:', error)
    }
  }
}
