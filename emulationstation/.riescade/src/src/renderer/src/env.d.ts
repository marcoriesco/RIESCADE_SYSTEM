/// <reference types="vite/client" />
import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      preloadLibrary: () => Promise<any>
      getSystems: () => Promise<any>
      getGames: (systemName: string) => Promise<any>
      updateGame: (systemName: string, gameData: any) => Promise<void>
      launchGame: (game: any, system: any) => Promise<any>
      getCustomCollections: () => Promise<string[]>
      getCollectionGames: (collectionName: string) => Promise<any[]>
      getThemes: () => Promise<any>
      getActiveTheme: () => Promise<string>
      loadTheme: (themeName: string) => Promise<any>
      getSettings: () => Promise<any>
      saveSetting: (name: string, value: any, type: string) => Promise<any>
      getThemeSettings: (themeName: string) => Promise<any>
      saveThemeSetting: (themeName: string, key: string, value: string) => Promise<any>
      getConfiguredControllers: () => Promise<any>
      saveInputConfig: (data: { deviceName: string; deviceGUID: string; mappings: any }) => Promise<boolean>
      getBluetoothDevices: () => Promise<any[]>
      executeCommand: (command: string, data?: any) => void
      getVersion: () => Promise<{ app: string; es: string }>
      getCollectionsForGame: (systemName: string, gamePath: string) => Promise<string[]>
      toggleGameInCollection: (collectionName: string, systemName: string, gamePath: string, action: 'add' | 'remove') => Promise<boolean>
      getFileContent: (path: string) => Promise<string | null>
      getHostname: () => Promise<string>
      cleanGamelists: () => Promise<any>
      resetGamelistUsage: () => Promise<any>
      resetFileExtensions: () => Promise<any>
      clearCaches: () => Promise<any>
      on: (channel: string, callback: (...args: any[]) => void) => () => void
    }
  }
}
