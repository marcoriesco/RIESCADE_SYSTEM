import { BrowserWindow } from 'electron'
import { LibraryService } from '../services/LibraryService'
import { LauncherService } from '../services/LauncherService'
import { ThemeService } from '../services/ThemeService'
import { SettingsParser } from '../parsers/SettingsParser'
import { SystemService } from '../services/SystemService'
import { SassService } from '../services/SassService'
import { ScraperService } from '../services/ScraperService'
import { FeaturesService } from '../services/FeaturesService'
import { ThemeStoreService } from '../services/ThemeStoreService'
import { RomsWatcherService } from '../services/RomsWatcherService'
import { FSWatcher } from 'fs'

import { registerLibraryIpc } from './library'
import { registerSystemIpc } from './system'
import { registerThemesIpc } from './themes'
import { registerSettingsIpc } from './settings'
import { registerScrapersIpc } from './scrapers'
import { registerUpdaterIpc } from './updater'

export interface IpcContext {
  getMainWindow: () => BrowserWindow | null
  libraryService: LibraryService
  launcherService: LauncherService
  themeService: ThemeService
  settingsParser: SettingsParser
  systemService: SystemService
  sassService: SassService
  scraperService: ScraperService
  featuresService: FeaturesService
  themeStoreService: ThemeStoreService
  getRomsWatcher: () => RomsWatcherService | null
  setRomsWatcher: (w: RomsWatcherService | null) => void
  getActiveControllers: () => any[]
  setActiveControllers: (c: any[]) => void
  getThemeWatcher: () => FSWatcher | null
  setThemeWatcher: (w: FSWatcher | null) => void
  getThemeReloadTimeout: () => NodeJS.Timeout | null
  setThemeReloadTimeout: (t: NodeJS.Timeout | null) => void
}

export function registerAllIpcHandlers(context: IpcContext): void {
  registerLibraryIpc(context)
  registerSystemIpc(context)
  registerThemesIpc(context)
  registerSettingsIpc(context)
  registerScrapersIpc(context)
  registerUpdaterIpc(context)
}
