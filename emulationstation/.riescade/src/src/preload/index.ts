import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Simplified API - all config is done through EmulationStation
const api = {
  // Library
  getSystems: () => ipcRenderer.invoke('get-systems'),
  getGames: (systemName: string) => ipcRenderer.invoke('get-games', systemName),
  launchGame: (game: any, system: any) => ipcRenderer.invoke('launch-game', game, system),

  // Themes
  getThemes: () => ipcRenderer.invoke('get-themes'),
  getActiveTheme: () => ipcRenderer.invoke('get-active-theme'),
  loadTheme: (themeName: string) => ipcRenderer.invoke('load-theme', themeName),

  // Settings (read from ES config, write for UI prefs)
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSetting: (name: string, value: any, type: 'string' | 'bool' | 'int' | 'float') =>
    ipcRenderer.invoke('save-setting', name, value, type),

  // Theme Settings
  getThemeSettings: (themeName: string) => ipcRenderer.invoke('get-theme-settings', themeName),
  saveThemeSetting: (themeName: string, key: string, value: string) => 
    ipcRenderer.invoke('save-theme-setting', themeName, key, value),

  // Controllers
  getConfiguredControllers: () => ipcRenderer.invoke('get-configured-controllers'),

  // System commands
  executeCommand: (command: string, data?: any) => ipcRenderer.send('system-command', command, data)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
