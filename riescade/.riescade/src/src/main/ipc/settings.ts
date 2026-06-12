import { ipcMain } from 'electron'
import { IpcContext } from './index'

export function registerSettingsIpc(context: IpcContext): void {
  const { settingsParser, featuresService } = context

  ipcMain.handle('get-settings', async () => {
    return settingsParser.getAllSettings()
  })

  ipcMain.handle('save-setting', async (_, name: string, value: any, type: 'string' | 'bool' | 'int' | 'float') => {
    return settingsParser.saveSetting(name, value, type)
  })

  ipcMain.handle('get-emulator-features', async (_, systemName: string, emulatorName: string, coreName?: string) => {
    return featuresService.getFeaturesFor(systemName, emulatorName, coreName)
  })
}
