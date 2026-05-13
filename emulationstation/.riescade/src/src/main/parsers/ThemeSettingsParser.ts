import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { getConfigPath } from '../utils/paths'

export class ThemeSettingsParser {
  static getSettingsPath(themeName: string): string {
    const configPath = getConfigPath()
    const themeSettingsDir = join(configPath, 'themesettings')
    if (!existsSync(themeSettingsDir)) {
      mkdirSync(themeSettingsDir, { recursive: true })
    }
    return join(themeSettingsDir, `${themeName}.cfg`)
  }

  static getThemeSettings(themeName: string, themePath: string): Record<string, string> {
    const settingsPath = this.getSettingsPath(themeName)
    const settings: Record<string, string> = {}

    // 1. Load defaults from options.json if it exists
    const optionsPath = join(themePath, 'options.json')
    if (existsSync(optionsPath)) {
      try {
        const optionsContent = readFileSync(optionsPath, 'utf8')
        const optionsData = JSON.parse(optionsContent)
        
        // options.json structure is usually a record or has subsets
        // Let's iterate and extract defaults
        if (optionsData && typeof optionsData === 'object') {
          for (const key of Object.keys(optionsData)) {
             // Basic support: assume we can parse defaults if any
             if (optionsData[key] && optionsData[key].default) {
                settings[key] = optionsData[key].default
             }
          }
        }
      } catch (e) {
        console.error('Error parsing theme options.json:', e)
      }
    }

    // 2. Override with user settings
    if (existsSync(settingsPath)) {
      try {
        const content = readFileSync(settingsPath, 'utf8')
        const lines = content.split('\n')
        for (const line of lines) {
          const match = line.match(/<string name="([^"]+)" value="([^"]+)"\s*\/>/)
          if (match) {
            settings[match[1]] = match[2]
          }
        }
      } catch (e) {
        console.error(`Error reading ${themeName}.cfg:`, e)
      }
    }

    return settings
  }

  static saveThemeSetting(themeName: string, key: string, value: string): void {
    const settingsPath = this.getSettingsPath(themeName)
    let content = ''
    if (existsSync(settingsPath)) {
      content = readFileSync(settingsPath, 'utf8')
    }

    const lines = content.split('\n').filter(l => l.trim() !== '')
    const newLines: string[] = []
    let replaced = false

    const regex = new RegExp(`<string name="${key}" value="([^"]+)"\\s*\\/>`)

    for (const line of lines) {
      if (regex.test(line)) {
        newLines.push(`  <string name="${key}" value="${value}" />`)
        replaced = true
      } else {
        newLines.push(line)
      }
    }

    if (!replaced) {
      newLines.push(`  <string name="${key}" value="${value}" />`)
    }

    const finalContent = newLines.join('\n')
    writeFileSync(settingsPath, finalContent, 'utf8')
  }
}
