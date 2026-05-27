import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { SettingsParser } from '../parsers/SettingsParser'
import { ThemeSettingsParser } from '../parsers/ThemeSettingsParser'
import { getDefaultThemePath, getUserThemesPath } from '../utils/paths'

export interface WebThemeConfig {
  name: string
  displayName?: string
  path: string
  isWebTheme: true
  isDefault: boolean
  views: {
    system: string
    gamelist: string
    loading: string
    start: string
  }
  options?: any[]
  settings?: Record<string, string>
}

export class ThemeService {
  private settingsParser: SettingsParser

  constructor() {
    this.settingsParser = new SettingsParser()
  }

  /**
   * Returns list of available theme names.
   * Always includes 'default' first, then user themes.
   */
  public getAvailableThemes(): string[] {
    const themes: string[] = ['default']
    const userThemesPath = getUserThemesPath()
    
    if (existsSync(userThemesPath)) {
      const dirs = readdirSync(userThemesPath, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== 'default')
        .map(d => d.name)
        .sort((a, b) => a.localeCompare(b))
      themes.push(...dirs)
    }

    return themes
  }

  /**
   * Returns the currently selected theme name from ES settings.
   */
  public getActiveThemeName(): string {
    return this.settingsParser.getSetting('RIESCADE.ThemeSet', 'string') || 'default'
  }

  public getThemePath(themeName: string): string {
    if (themeName === 'default') {
      return getDefaultThemePath()
    }
    const themePath = join(getUserThemesPath(), themeName)
    if (!existsSync(themePath)) {
      return getDefaultThemePath()
    }
    return themePath
  }

  /**
   * Loads a web theme by name.
   * 'default' → bundled theme from app resources
   * anything else → user themes directory
   */
  public loadTheme(themeName: string): WebThemeConfig {
    let themePath: string
    let isDefault = false

    if (themeName === 'default') {
      themePath = getDefaultThemePath()
      isDefault = true
    } else {
      themePath = join(getUserThemesPath(), themeName)
      
      // Fallback to default if user theme not found
      if (!existsSync(themePath)) {
        console.warn(`Theme "${themeName}" not found, falling back to default`)
        themePath = getDefaultThemePath()
        isDefault = true
      }
    }

    console.log(`Loading theme from: ${themePath}`)

    const themeJsonPath = join(themePath, 'theme.json')
    let metadata: any = { name: themeName, type: 'web', templates: {} }

    if (existsSync(themeJsonPath)) {
      try {
        metadata = JSON.parse(readFileSync(themeJsonPath, 'utf8'))
      } catch (e) {
        console.error('Error reading theme.json:', e)
      }
    }

    const getTemplate = (key: string, defaultFile: string): string => {
      const fileName = metadata.templates?.[key] || defaultFile
      const filePath = join(themePath, fileName)
      return existsSync(filePath) ? readFileSync(filePath, 'utf8') : ''
    }

    // Load options if available
    let options: any[] = []
    const optionsPath = join(themePath, 'options.json')
    if (existsSync(optionsPath)) {
      try {
        options = JSON.parse(readFileSync(optionsPath, 'utf8'))
      } catch (e) {
        console.error('Error reading options.json:', e)
      }
    }

    return {
      name: themeName,
      displayName: metadata.name || themeName,
      path: themePath,
      isWebTheme: true,
      isDefault,
      views: {
        system: getTemplate('system', 'system.html'),
        gamelist: getTemplate('gamelist', 'gamelist.html'),
        loading: getTemplate('loading', 'loading.html'),
        start: getTemplate('start', 'start.html')
      },
      options,
      settings: ThemeSettingsParser.getThemeSettings(themeName, themePath)
    }
  }
}
