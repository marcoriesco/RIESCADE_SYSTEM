import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getSystems: () => Promise<any>
      getGames: (systemName: string) => Promise<any>
      updateGame: (systemName: string, gameData: any) => Promise<void>
      launchGame: (game: any, system: any) => Promise<any>
      getThemes: () => Promise<any>
      getActiveTheme: () => Promise<string>
      loadTheme: (themeName: string) => Promise<any>
      getSettings: () => Promise<any>
      saveSetting: (name: string, value: any, type: string) => Promise<any>
      getThemeSettings: (themeName: string) => Promise<any>
      saveThemeSetting: (themeName: string, key: string, value: string) => Promise<any>
      getConfiguredControllers: () => Promise<any>
      executeCommand: (command: string, data?: any) => void
      on: (channel: string, callback: (...args: any[]) => void) => () => void
    }
  }
}
