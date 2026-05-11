import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getSystems: () => ipcRenderer.invoke('get-systems'),
  getGames: (systemName: string) => ipcRenderer.invoke('get-games', systemName),
  launchGame: (game: any, system: any) => ipcRenderer.invoke('launch-game', game, system),
  getThemes: () => ipcRenderer.invoke('get-themes'),
  getActiveTheme: () => ipcRenderer.invoke('get-active-theme'),
  loadTheme: (themeName: string) => ipcRenderer.invoke('load-theme', themeName),
  onThemeUpdated: (callback: () => void) => {
    ipcRenderer.removeAllListeners('theme-updated')
    ipcRenderer.on('theme-updated', callback)
  },
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSetting: (name: string, value: any, type: 'string' | 'bool' | 'int' | 'float') => 
    ipcRenderer.invoke('save-setting', name, value, type),
  getFeatures: () => ipcRenderer.invoke('get-features'),
  executeCommand: (command: string) => ipcRenderer.send('system-command', command)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
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
