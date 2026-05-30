import { app } from 'electron'
import { join, dirname, resolve } from 'path'
import { existsSync } from 'fs'

/**
 * Resolves paths relative to the application base directory.
 * In development, it uses the project root.
 * In production, it uses the directory where the executable is located.
 */
export function getRetroBatPath(): string {
  if (app.isPackaged) {
    const exeDir = dirname(app.getPath('exe'))
    // Check if we are in the root (where emulationstation/ is a subfolder)
    if (existsSync(join(exeDir, 'emulationstation'))) {
      return exeDir
    }
    // Otherwise assume we are inside emulationstation/.riescade/ folder
    return resolve(exeDir, '..', '..')
  }
  // In development, we are in emulationstation/.riescade/src/
  // Go up to RIESCADE_SYSTEM root
  return resolve(process.cwd(), '..', '..', '..')
}

export function getConfigPath(): string {
  return join(getRetroBatPath(), 'emulationstation', '.emulationstation')
}

export function getCollectionsPath(): string {
  return join(getRetroBatPath(), 'emulationstation', 'collections')
}

export function getMusicPath(): string {
  return join(getRetroBatPath(), 'emulationstation', 'music')
}

export function getRiescadePath(): string {
  return join(getRetroBatPath(), 'emulationstation', '.riescade')
}

export function getRomsPath(): string {
  return join(getRetroBatPath(), 'roms')
}

export function getEmulatorsPath(): string {
  return join(getRetroBatPath(), 'emulators')
}

/**
 * Returns the path to the bundled default theme.
 * In production: it's inside app resources (extraResources).
 * In development: it's in the source tree (src/main/theme_default).
 * Note: __dirname in dev points to out/main/ (compiled), so we use process.cwd()
 * which points to the project root (emulationstation/.riescade/src/).
 */
export function getDefaultThemePath(): string {
  return join(app.getAppPath(), 'src', 'main', 'theme_default')
}

/**
 * Returns the path to the user themes directory.
 * This is always outside the app bundle: emulationstation/.riescade/themes/
 */
export function getUserThemesPath(): string {
  return join(getRiescadePath(), 'themes')
}
