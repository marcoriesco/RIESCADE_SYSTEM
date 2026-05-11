import { XMLParser } from 'fast-xml-parser'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getConfigPath } from '../utils/paths'

export class FeaturesParser {
  private parser: XMLParser

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true
    })
  }

  public getFeatures(): any {
    const featuresPath = join(getConfigPath(), 'es_features.cfg')
    if (!existsSync(featuresPath)) return null

    try {
      const content = readFileSync(featuresPath, 'utf-8')
      const jsonObj = this.parser.parse(content)
      return jsonObj.features
    } catch (error) {
      console.error('Error parsing features:', error)
      return null
    }
  }
}
