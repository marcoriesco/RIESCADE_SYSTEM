import { ipcMain, BrowserWindow } from 'electron'
import { LibraryService } from '../services/LibraryService'
import { RomsWatcherService } from '../services/RomsWatcherService'
import { Game, System } from '../shared/types'
import { IpcContext } from './index'

export function registerLibraryIpc(context: IpcContext): void {
  const { libraryService, launcherService } = context

  ipcMain.handle('preload-library', async (_, forcePhysicalScan?: boolean, systemName?: string) => {
    if (systemName) {
      await libraryService.preloadSystem(systemName, forcePhysicalScan)
    } else {
      if (forcePhysicalScan) {
        LibraryService.clearCache()
      }
      await libraryService.preloadAll(forcePhysicalScan)

      // Start/stop ROMs watcher dynamically based on DB mode setting
      if (LibraryService.isDbMode()) {
        if (!context.getRomsWatcher()) {
          const watcher = new RomsWatcherService(libraryService)
          watcher.start()
          context.setRomsWatcher(watcher)
        }
      } else {
        const watcher = context.getRomsWatcher()
        if (watcher) {
          watcher.stop()
          context.setRomsWatcher(null)
        }
      }
    }
    return true
  })

  ipcMain.handle('get-systems', async () => {
    return libraryService.getSystems()
  })

  ipcMain.handle('get-games', async (_, systemName: string) => {
    return libraryService.getGames(systemName)
  })

  ipcMain.handle('launch-game', async (_, game: Game, system: System, saveStateSlot?: number) => {
    let targetSystem = system
    if (system.name === 'collections' || (game.system && game.system.toLowerCase() !== system.name.toLowerCase())) {
      const realSystem = libraryService.getSystems().find(s => s.name.toLowerCase() === game.system.toLowerCase())
      if (realSystem) {
        targetSystem = realSystem
      }
    }
    const result = await launcherService.launch(game, targetSystem, context.getActiveControllers(), saveStateSlot)
    
    if (targetSystem.name.toLowerCase() === 'windows_installers') {
      console.log('windows_installers launched and exited, reloading library and notifying frontend...')
      LibraryService.clearCache()
      await libraryService.preloadAll(true)
      BrowserWindow.getAllWindows().forEach(win => {
        try {
          win.webContents.send('systems-updated')
        } catch (e) {
          console.error('Failed to send systems-updated to window', e)
        }
      })
    }
    
    return result
  })

  ipcMain.handle('get-netplay-lobby', async () => {
    const { NetplayService } = require('../services/NetplayService')
    const netplayService = new NetplayService()
    return netplayService.getLobbyList()
  })

  ipcMain.handle('launch-netplay-game', async (_, game: Game, system: System, netplayOptions: any) => {
    let targetSystem = system
    if (system.name === 'collections' || (game.system && game.system.toLowerCase() !== system.name.toLowerCase())) {
      const realSystem = libraryService.getSystems().find(s => s.name.toLowerCase() === game.system.toLowerCase())
      if (realSystem) {
        targetSystem = realSystem
      }
    }
    return launcherService.launch(game, targetSystem, context.getActiveControllers(), undefined, netplayOptions)
  })

  ipcMain.handle('scan-save-states', async (_, systemName: string, gamePath: string) => {
    return libraryService.getGameSaveStates(systemName, gamePath)
  })

  ipcMain.handle('update-game', async (_, systemName: string, gameData: Game) => {
    return libraryService.updateGame(systemName, gameData)
  })

  ipcMain.handle('delete-game', async (_, systemName: string, gamePath: string, deletePhysical: boolean) => {
    return libraryService.deleteGame(systemName, gamePath, deletePhysical)
  })

  ipcMain.handle('get-custom-collections', async () => {
    return libraryService.getCustomCollections()
  })

  ipcMain.handle('get-collection-games', async (_, collectionName: string) => {
    return libraryService.getCollectionGames(collectionName)
  })

  ipcMain.handle('get-collections-for-game', async (_, systemName: string, gamePath: string) => {
    return libraryService.getCollectionsForGame(systemName, gamePath)
  })

  ipcMain.handle('toggle-game-in-collection', async (_, collectionName: string, systemName: string, gamePath: string, action: 'add' | 'remove') => {
    return libraryService.toggleGameInCollection(collectionName, systemName, gamePath, action)
  })

  ipcMain.handle('clean-gamelists', async () => {
    return libraryService.cleanGamelists()
  })

  ipcMain.handle('reset-gamelist-usage', async () => {
    return libraryService.resetGamelistUsage()
  })

  ipcMain.handle('reset-file-extensions', async () => {
    return libraryService.resetFileExtensions()
  })

  ipcMain.handle('clear-caches', async () => {
    return libraryService.clearCaches()
  })

  ipcMain.handle('get-random-game-with-media', async (_, mediaType: 'video' | 'image') => {
    return libraryService.getRandomGameWithMedia(mediaType)
  })

  ipcMain.handle('get-db-stats', async () => {
    const db = LibraryService.getDatabase()
    return {
      totalGames: db.isOpen() ? db.getTotalGameCount() : 0,
      indexedSystems: db.isOpen() ? db.getIndexedSystemCount() : 0,
      systemsInfo: db.isOpen() ? db.getSystemSyncInfo() : []
    }
  })

  ipcMain.handle('rebuild-database', async () => {
    const db = LibraryService.getDatabase()
    LibraryService.clearCache()
    const win = context.getMainWindow()
    libraryService.rebuildDatabase((sysName, current, total) => {
      if (win) {
        win.webContents.send('systems-loading-progress', Math.round((current / total) * 100), 'INDEXING_DATABASE')
      }
    })
    return true
  })

  ipcMain.handle('get-library-mode', async () => {
    return LibraryService.isDbMode() ? 'database' : 'gamelist'
  })

  ipcMain.handle('get-all-media-paths', async () => {
    const db = LibraryService.getDatabase()
    if (db.isOpen()) {
      return db.getAllMediaPaths()
    }
    return []
  })
}
