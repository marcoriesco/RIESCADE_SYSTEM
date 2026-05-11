import { join } from 'path'
import { readFileSync, existsSync } from 'fs'
import { XMLParser } from 'fast-xml-parser'
import { getConfigPath } from '../utils/paths'

export interface ControllerInfo {
  name: string
  guid: string
  path?: string
  buttons: number
  axes: number
  hats: number
}

export class ControllerService {
  private parser: XMLParser

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: ''
    })
  }

  public getControllerConfig(deviceName: string, deviceGuid: string): any {
    const configPath = getConfigPath()
    const inputCfgPath = join(configPath, 'es_input.cfg')

    if (!existsSync(inputCfgPath)) return null

    try {
      const xmlData = readFileSync(inputCfgPath, 'utf-8')
      const result = this.parser.parse(xmlData)
      const inputConfigs = result.inputList?.inputConfig

      if (!inputConfigs) return null

      // Find by GUID first, then by Name
      const configs = Array.isArray(inputConfigs) ? inputConfigs : [inputConfigs]
      const config = configs.find((c: any) => c.deviceGUID === deviceGuid) || 
                     configs.find((c: any) => c.deviceName === deviceName)

      return config
    } catch (error) {
      console.error('Error parsing es_input.cfg:', error)
      return null
    }
  }

  /**
   * Returns formatted arguments for emulatorLauncher.exe for a given controller
   */
  public getLauncherArgs(index: number, controller: ControllerInfo): string[] {
    const p = `p${index + 1}`
    return [
      `-${p}index`, index.toString(),
      `-${p}guid`, controller.guid,
      `-${p}name`, `"${controller.name}"`,
      `-${p}nbbuttons`, controller.buttons.toString(),
      `-${p}nbaxes`, controller.axes.toString(),
      `-${p}nbhats`, controller.hats.toString(),
      `-${p}path`, controller.path ? `"${controller.path}"` : '""'
    ]
  }
}
