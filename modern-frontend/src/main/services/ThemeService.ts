import { readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { ThemeParser } from '../parsers/ThemeParser'
import { SettingsParser } from '../parsers/SettingsParser'
import { getConfigPath } from '../utils/paths'
import { ThemeConfig } from '../../shared/types/theme'

export class ThemeService {
  private themeParser: ThemeParser
  private settingsParser: SettingsParser

  constructor() {
    this.themeParser = new ThemeParser()
    this.settingsParser = new SettingsParser()
  }

  public getAvailableThemes(): string[] {
    const themesPath = join(getConfigPath(), 'themes')
    if (!existsSync(themesPath)) return []

    return readdirSync(themesPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
  }

  public getActiveThemeName(): string {
    return this.settingsParser.getSelectedTheme()
  }

  public loadTheme(themeName: string, systemVars: Record<string, string> = {}): ThemeConfig {
    let themePath = join(getConfigPath(), 'themes', themeName)
    
    if (!existsSync(themePath)) {
      console.log(`Theme folder not found: ${themePath}, falling back to es-theme-carbon`)
      themePath = join(getConfigPath(), 'themes', 'es-theme-carbon')
    }

    if (!existsSync(themePath)) {
       const themes = this.getAvailableThemes()
       if (themes.length > 0) {
         console.log(`Fallback theme not found, using first available: ${themes[0]}`)
         themePath = join(getConfigPath(), 'themes', themes[0])
       } else {
         throw new Error(`No themes found in ${join(getConfigPath(), 'themes')}`)
       }
    }

    try {
      console.log(`Loading theme from: ${themePath}`)
      
      // Check if it's a Web Theme (has theme.json)
      const themeJsonPath = join(themePath, 'theme.json')
      if (existsSync(themeJsonPath)) {
        try {
          const fs = require('fs')
          const metadata = JSON.parse(fs.readFileSync(themeJsonPath, 'utf8'))
          if (metadata.type === 'web') {
             console.log(`Detected Web Theme: ${metadata.name}`)
             return {
               name: metadata.name,
               path: themePath,
               isWebTheme: true,
               views: {
                 system: existsSync(join(themePath, 'system.html')) ? fs.readFileSync(join(themePath, 'system.html'), 'utf8') : '',
                 gamelist: existsSync(join(themePath, 'gamelist.html')) ? fs.readFileSync(join(themePath, 'gamelist.html'), 'utf8') : '',
                 menu: existsSync(join(themePath, 'menu.html')) ? fs.readFileSync(join(themePath, 'menu.html'), 'utf8') : '',
                 loading: existsSync(join(themePath, 'loading.html')) ? fs.readFileSync(join(themePath, 'loading.html'), 'utf8') : '',
                 start: existsSync(join(themePath, 'start.html')) ? fs.readFileSync(join(themePath, 'start.html'), 'utf8') : ''
               }
             } as any
          }
        } catch (e) {
          console.error("Error reading theme.json", e)
        }
      }

      const theme = this.themeParser.parse(themePath, {
        'system.name': 'all',
        'system.theme': 'auto-allgames',
        'system.fullName': 'All Games',
        'lang': 'pt',
        'subset.controls': 'arcade', 
        'subset.colors': '9f0043',
        ...systemVars
      })
      console.log(`Theme loaded: ${theme.name}, Views found: ${Object.keys(theme.views).join(', ')}`)
      return theme
    } catch (error) {
      console.error(`CRITICAL ERROR parsing theme ${themeName}:`, error)
      // Return a minimal theme to avoid total crash
      return {
        name: 'Error Fallback',
        path: themePath,
        views: {}
      }
    }
  }
}
