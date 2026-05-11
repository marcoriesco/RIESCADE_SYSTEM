import { app } from 'electron'
import { join, dirname, resolve } from 'path'

/**
 * Resolves paths relative to the application base directory.
 * In development, it uses the project root.
 * In production, it uses the directory where the executable is located.
 */
export function getRetroBatPath(): string {
  if (app.isPackaged) {
    const exeDir = dirname(app.getPath('exe'))
    // Check if we are in the root (where emulationstation/ is a subfolder)
    if (require('fs').existsSync(join(exeDir, 'emulationstation'))) {
      return exeDir
    }
    // Otherwise assume we are inside emulationstation/ folder
    return resolve(exeDir, '..')
  }
  // In development, assume we are running from a subfolder of the root
  return resolve(process.cwd(), '..')
}

export function getConfigPath(): string {
  return join(getRetroBatPath(), 'emulationstation', '.emulationstation')
}

export function getRomsPath(): string {
  return join(getRetroBatPath(), 'roms')
}

export function getEmulatorsPath(): string {
  return join(getRetroBatPath(), 'emulators')
}
