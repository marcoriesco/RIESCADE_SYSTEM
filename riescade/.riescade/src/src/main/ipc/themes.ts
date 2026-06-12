import { ipcMain, app } from 'electron'
import { watch } from 'fs'
import { join, basename } from 'path'
import { getDefaultThemePath } from '../utils/paths'
import { ThemeSettingsParser } from '../parsers/ThemeSettingsParser'
import { IpcContext } from './index'

export function registerThemesIpc(context: IpcContext): void {
  const { themeService, sassService, themeStoreService } = context

  ipcMain.handle('get-themes', async () => {
    return themeService.getAvailableThemes()
  })

  ipcMain.handle('get-active-theme', async () => {
    return themeService.getActiveThemeName()
  })

  ipcMain.handle('load-theme', async (_, themeName: string) => {
    // Setup watcher for the theme directory for live reload
    const prevWatcher = context.getThemeWatcher()
    if (prevWatcher) {
      prevWatcher.close()
      context.setThemeWatcher(null)
    }

    const themePath = themeService.getThemePath(themeName)
    const isDev = !app.isPackaged
    if (themePath && (themePath !== getDefaultThemePath() || isDev)) {
      sassService.compileTheme(themePath)
      try {
        const watcher = watch(themePath, { recursive: true }, (eventType, filename) => {
          if (filename) {
            const scheduleReload = () => {
              const timeout = context.getThemeReloadTimeout()
              if (timeout) clearTimeout(timeout)
              
              const newTimeout = setTimeout(() => {
                context.getMainWindow()?.webContents.send('theme-files-changed', themeName)
              }, 100)
              context.setThemeReloadTimeout(newTimeout)
            }

            // Auto-compile SCSS
            if (filename.endsWith('.scss')) {
              const fullPath = join(themePath, filename)
              if (basename(filename).startsWith('_')) {
                sassService.compileTheme(themePath)
              } else {
                sassService.compileFile(fullPath)
              }
              scheduleReload()
              return
            }

            if (filename.endsWith('.html') || filename.endsWith('.css') || filename.endsWith('.json')) {
              console.log(`Theme file changed: ${filename}. Notifying renderer...`)
              scheduleReload()
            }
          }
        })
        context.setThemeWatcher(watcher)
      } catch (e) {
        console.error('Failed to start theme watcher:', e)
      }
    }

    return themeService.loadTheme(themeName)
  })

  // Theme Settings
  ipcMain.handle('get-theme-settings', async (_, themeName: string) => {
    return ThemeSettingsParser.getThemeSettings(themeName, themeService.getThemePath(themeName))
  })

  ipcMain.handle('save-theme-setting', async (_, themeName: string, key: string, value: string) => {
    return ThemeSettingsParser.saveThemeSetting(themeName, themeService.getThemePath(themeName), key, value)
  })

  // Theme Store
  ipcMain.handle('get-official-themes', async () => {
    return themeStoreService.getOfficialThemes()
  })

  ipcMain.handle('get-community-themes', async () => {
    return themeStoreService.getCommunityThemes()
  })

  ipcMain.handle('install-theme', async (event, zipUrl: string, themeId: string) => {
    return themeStoreService.installTheme(zipUrl, themeId, (percent, status) => {
      event.sender.send('theme-install-progress', { percent, status })
    })
  })
}
