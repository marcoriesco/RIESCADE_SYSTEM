import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getConfigPath } from '../utils/paths'

export interface FeatureChoice {
  name: string
  value: string
}

export interface Feature {
  name: string
  value: string
  description?: string
  preset?: string
  submenu?: string
  group?: string
  order?: number
  choices?: FeatureChoice[]
}

export interface EmulatorFeatures {
  general: Feature[]
  advanced: Feature[]
}

export class FeaturesService {
  private featuresData: any = null

  constructor() {}

  private loadFeatures(): any {
    if (this.featuresData) return this.featuresData

    const filePath = join(getConfigPath(), 'features.json')
    if (!existsSync(filePath)) {
      console.warn(`[FeaturesService] features.json not found at ${filePath}`)
      return null
    }

    try {
      const content = readFileSync(filePath, 'utf-8')
      this.featuresData = JSON.parse(content)
      return this.featuresData
    } catch (e) {
      console.error('[FeaturesService] Error parsing features.json:', e)
      return null
    }
  }

  private resolveSharedFeature(sf: any, sharedFeaturesList: any[], globalFeaturesList: any[]): Feature {
    // Search in sharedFeatures.featuresList first
    let found = sharedFeaturesList?.find(f => f.value === sf.value)
    
    // Fallback to globalFeatures.featuresList
    if (!found) {
      found = globalFeaturesList?.find(f => f.value === sf.value)
    }

    if (found) {
      return {
        name: sf.name || found.name || found.value,
        value: found.value,
        description: found.description,
        preset: found.preset,
        submenu: sf.submenu || found.submenu,
        group: sf.group || found.group,
        order: sf.order !== undefined ? sf.order : found.order,
        choices: found.choices ? JSON.parse(JSON.stringify(found.choices)) : undefined
      }
    }

    return {
      name: sf.name || sf.value,
      value: sf.value,
      submenu: sf.submenu,
      group: sf.group,
      order: sf.order
    }
  }

  public getFeaturesFor(systemName: string, emulatorName: string, coreName?: string): EmulatorFeatures {
    const data = this.loadFeatures()
    if (!data) {
      return { general: [], advanced: [] }
    }

    const sharedList = data.sharedFeatures?.featuresList || []
    const globalList = data.globalFeatures?.featuresList || []

    // 1. Locate the emulator
    // The emulatorName can be "libretro" or "libretro:mesen", we want the emulator part
    const cleanEmulatorName = emulatorName.split(':')[0].toLowerCase().trim()
    const emulator = data.emulators?.find((emu: any) => {
      if (!emu.name) return false
      return emu.name
        .split(',')
        .map((n: string) => n.trim().toLowerCase())
        .includes(cleanEmulatorName)
    })

    if (!emulator) {
      // Return empty if emulator not found
      return { general: [], advanced: [] }
    }

    // Map to keep track of accumulated features by their "value"
    const featuresMap = new Map<string, Feature>()

    // Helper to merge features into the map
    const mergeFeatures = (featuresList: any[], sharedFeatures: any[]) => {
      // Process standard features first
      if (featuresList && Array.isArray(featuresList)) {
        featuresList.forEach(f => {
          featuresMap.set(f.value, {
            name: f.name || f.value,
            value: f.value,
            description: f.description,
            preset: f.preset,
            submenu: f.submenu,
            group: f.group,
            order: f.order,
            choices: f.choices ? JSON.parse(JSON.stringify(f.choices)) : undefined
          })
        })
      }

      // Process shared features
      if (sharedFeatures && Array.isArray(sharedFeatures)) {
        sharedFeatures.forEach(sf => {
          const resolved = this.resolveSharedFeature(sf, sharedList, globalList)
          featuresMap.set(resolved.value, resolved)
        })
      }
    }

    // 1. Add emulator-level features
    mergeFeatures(emulator.featuresList, emulator.sharedFeatures)

    // 2. Add core-level features if coreName is provided
    if (coreName && emulator.cores) {
      const cleanCoreName = String(coreName).toLowerCase().trim()
      const core = emulator.cores.find((c: any) => String(c.name || '').toLowerCase().trim() === cleanCoreName)
      if (core) {
        mergeFeatures(core.featuresList, core.sharedFeatures)

        // Core can also have system-specific overrides
        if (systemName && core.systems) {
          const cleanSystemName = systemName.toLowerCase().trim()
          const coreSystem = core.systems.find((s: any) => s.name?.toLowerCase().trim() === cleanSystemName)
          if (coreSystem) {
            mergeFeatures(coreSystem.featuresList, coreSystem.sharedFeatures)
          }
        }
      }
    }

    // 3. Add emulator-level system-specific features if systemName is provided
    if (systemName && emulator.systems) {
      const cleanSystemName = systemName.toLowerCase().trim()
      const emuSystem = emulator.systems.find((s: any) => s.name?.toLowerCase().trim() === cleanSystemName)
      if (emuSystem) {
        mergeFeatures(emuSystem.featuresList, emuSystem.sharedFeatures)
      }
    }

    // 4. Split accumulated features into general and advanced
    const general: Feature[] = []
    const advanced: Feature[] = []

    featuresMap.forEach(f => {
      const isGeneral = f.group?.toUpperCase() === 'GENERAL SETTINGS'
      if (isGeneral) {
        general.push(f)
      } else {
        advanced.push(f)
      }
    })

    // Sort features by order
    const sortByOrder = (a: Feature, b: Feature) => {
      const orderA = a.order !== undefined ? a.order : 9999
      const orderB = b.order !== undefined ? b.order : 9999
      return orderA - orderB
    }

    general.sort(sortByOrder)
    advanced.sort(sortByOrder)

    return { general, advanced }
  }
}
