/// <reference types="vite/client" />
import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      preloadLibrary: (forcePhysicalScan?: boolean, systemName?: string) => Promise<any>
      getSystems: () => Promise<any>
      getGames: (systemName: string) => Promise<any>
      updateGame: (systemName: string, gameData: any) => Promise<void>
      deleteGame: (systemName: string, gamePath: string, deletePhysical: boolean) => Promise<void>
      launchGame: (game: any, system: any, saveStateSlot?: number) => Promise<any>
      getNetplayLobby: () => Promise<any[]>
      launchNetplayGame: (game: any, system: any, netplayOptions: any) => Promise<any>
      scanSaveStates: (systemName: string, gamePath: string) => Promise<any[]>
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
      getVersion: () => Promise<{ app: string; }>
      checkForUpdates: () => Promise<{ updateAvailable: boolean; version: string; releaseNotes: string; zipUrl: string | null }>
      downloadAndInstallUpdate: (zipUrl: string) => Promise<boolean>
      getSystemInformation: () => Promise<Record<string, string>>
      getCollectionsForGame: (systemName: string, gamePath: string) => Promise<string[]>
      toggleGameInCollection: (collectionName: string, systemName: string, gamePath: string, action: 'add' | 'remove') => Promise<boolean>
      getFileContent: (path: string) => Promise<string | null>
      getHostname: () => Promise<string>
      getBiosInformation: () => Promise<any[]>
      cleanGamelists: () => Promise<any>
      resetGamelistUsage: () => Promise<any>
      resetFileExtensions: () => Promise<any>
      clearCaches: () => Promise<any>
      getRandomGameWithMedia: (mediaType: 'video' | 'image') => Promise<any>
      getNetworkConnectionType: () => Promise<'wifi' | 'ethernet' | 'none' | 'other' | 'unknown'>
      getDbStats: () => Promise<{ totalGames: number; indexedSystems: number; systemsInfo: any[] }>
      rebuildDatabase: () => Promise<boolean>
      getLibraryMode: () => Promise<'database' | 'gamelist'>
      getAllMediaPaths: () => Promise<string[]>
      getMusicFiles: (subfolder?: string) => Promise<string[]>
      getMusicPath: () => Promise<string>
      startScrape: () => Promise<boolean>
      cancelScrape: () => Promise<boolean>
      searchGameMedia: (systemName: string, gameName: string, databases: string[], gamePath?: string) => Promise<any[]>
      downloadGameMedia: (systemName: string, gamePath: string, matchData: any) => Promise<any>
      downloadTempMedia: (url: string) => Promise<string>
      on: (channel: string, callback: (...args: any[]) => void) => () => void
    }
  }
}
