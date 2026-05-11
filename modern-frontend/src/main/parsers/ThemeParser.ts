import { XMLParser } from 'fast-xml-parser'
import { readFileSync, existsSync } from 'fs'
import { join, dirname, basename } from 'path'
import { ThemeConfig, ThemeView, ThemeElement } from '../../shared/types/theme'

export class ThemeParser {
  private parser: XMLParser
  private variables: Record<string, string> = {}

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false,
      parseAttributeValue: false,
      allowBooleanAttributes: true
    })
  }

  public parse(themePath: string, systemVariables: Record<string, string> = {}): ThemeConfig {
    const mainXmlPath = join(themePath, 'theme.xml')
    if (!existsSync(mainXmlPath)) {
      throw new Error(`Theme file not found: ${mainXmlPath}`)
    }

    // Initialize variables with system variables and some defaults
    this.variables = { 
      'lang': 'en',
      ...systemVariables 
    }

    const theme: ThemeConfig = {
      name: basename(themePath) || 'Unknown',
      path: themePath,
      defaultView: undefined,
      views: {}
    }

    this.parseXmlRecursive(mainXmlPath, theme, themePath)

    return theme
  }

  private resolveVars(str: string): string {
    if (typeof str !== 'string') return str
    return str.replace(/\${(.*?)}/g, (match, name) => {
      // Don't resolve system.* variables at parse time, keep them for renderer
      if (name.startsWith('system.')) return match
      return this.variables[name] !== undefined ? this.variables[name] : match
    })
  }

  private evaluateCondition(condition: string): boolean {
    if (!condition) return true
    
    // If condition contains dynamic variables, we can't evaluate it now.
    // We'll treat it as true for now and let the renderer handle it if needed.
    // But ES usually expects the parser to handle theme-level conditions.
    if (condition.includes('system.') || condition.includes('game.')) return true

    let evalStr = condition
    // Replace variables in condition
    evalStr = evalStr.replace(/\${(.*?)}/g, (_, name) => {
      const val = this.variables[name] || ''
      return typeof val === 'string' ? `'${val}'` : val
    })

    // Very basic evaluation for equality
    try {
      if (evalStr.includes(' == ')) {
        const [left, right] = evalStr.split(' == ').map(s => s.trim().replace(/^'|'$/g, ''))
        return left === right
      }
      if (evalStr.includes(' != ')) {
        const [left, right] = evalStr.split(' != ').map(s => s.trim().replace(/^'|'$/g, ''))
        return left !== right
      }
      return true
    } catch (e) {
      return true
    }
  }

  private parseXmlRecursive(xmlPath: string, theme: ThemeConfig, themeRoot: string) {
    if (!existsSync(xmlPath)) {
      // Don't warn for system-specific includes that might not exist
      if (!xmlPath.includes('${')) {
         // console.warn(`Theme include not found: ${xmlPath}`)
      }
      return
    }

    try {
      const content = readFileSync(xmlPath, 'utf-8')
      const jsonObj = this.parser.parse(content)
      const themeNode = jsonObj.theme

      if (!themeNode) return

      if (themeNode['@_defaultView']) {
        theme.defaultView = themeNode['@_defaultView']
      }

      // 0. Handle variables
      if (themeNode.variables) {
        const vars = Array.isArray(themeNode.variables) ? themeNode.variables : [themeNode.variables]
        vars.forEach((vObj: any) => {
          Object.entries(vObj).forEach(([key, val]) => {
            if (key.startsWith('@_')) return
            // Handle conditional variables
            const condition = vObj[`@_if`]
            if (condition && !this.evaluateCondition(condition)) return
            
            this.variables[key] = this.resolveVars(val)
          })
        })
      }

      // 0.5 Handle subsets (set default variables for subsets)
      if (themeNode.subset) {
        const subsets = Array.isArray(themeNode.subset) ? themeNode.subset : [themeNode.subset]
        subsets.forEach((s: any) => {
          const subsetName = s['@_name']
          if (!subsetName) return
          // Grab the first include as the default value if the user hasn't selected one
          const includes = s.include
          if (includes) {
             const firstInc = Array.isArray(includes) ? includes[0] : includes
             if (firstInc && firstInc['@_name']) {
               this.variables[`subset.${subsetName}`] = firstInc['@_name']
             }
          }
        })
      }

      // 1. Handle includes
      if (themeNode.include) {
        const includes = Array.isArray(themeNode.include) ? themeNode.include : [themeNode.include]
        includes.forEach((inc: any) => {
          let incPath = inc['#text'] || inc
          if (typeof incPath === 'string') {
            const condition = inc['@_if']
            if (condition && !this.evaluateCondition(condition)) return

            incPath = this.resolveVars(incPath)
            if (incPath.startsWith('./')) incPath = incPath.substring(2)
            const fullIncPath = join(dirname(xmlPath), incPath)
            this.parseXmlRecursive(fullIncPath, theme, themeRoot)
          }
        })
      }

      // 2. Handle views and customViews
      const parseViewNode = (v: any) => {
        const viewNames = v['@_name']?.split(/[\s,]+/) || ['default']
        const inherits = v['@_inherits']
        
        viewNames.forEach((name: string) => {
          const cleanName = name.trim()
          if (!cleanName) return
          
          if (!theme.views[cleanName]) {
            theme.views[cleanName] = { name: cleanName, elements: [] }
          }
          
          // Handle inheritance
          if (inherits && theme.views[inherits]) {
            // Copy elements from inherited view, but avoid duplicates if we are merging
            const parentElements = theme.views[inherits].elements
            parentElements.forEach(pe => {
               // If element already exists in current view (maybe from a previous include), 
               // we should probably merge or overwrite. ES merges.
               const existing = theme.views[cleanName].elements.find(e => e.name === pe.name)
               if (!existing) {
                  theme.views[cleanName].elements.push({ ...pe })
               }
            })
          }
          
          this.parseElementsRecursive(v, theme.views[cleanName], themeRoot)
        })
      }

      if (themeNode.view) {
        const views = Array.isArray(themeNode.view) ? themeNode.view : [themeNode.view]
        views.forEach(parseViewNode)
      }

      if (themeNode.customView) {
        const customViews = Array.isArray(themeNode.customView) ? themeNode.customView : [themeNode.customView]
        customViews.forEach(parseViewNode)
      }
    } catch (error) {
      console.error(`Error parsing theme XML ${xmlPath}:`, error)
    }
  }

  private parseElementsRecursive(node: any, view: ThemeView, themeRoot: string) {
    // Structural keys to skip at the top level
    const topLevelSkipKeys = ['variables', 'include', 'view', 'customView', 'formatVersion']
    const containerTypes = ['container', 'stackpanel']
    
    Object.keys(node).forEach(key => {
      if (key.startsWith('@_')) return // Skip attributes
      if (topLevelSkipKeys.includes(key)) return
      
      const components = node[key]
      if (typeof components !== 'object') return // Must be an object/array to be an element
      
      const list = Array.isArray(components) ? components : [components]
      
      list.forEach((c: any) => {
        // Elements in ES themes almost always have a 'name' attribute or are containers.
        // If it doesn't have a name and isn't a container, it's likely a property like <pos>.
        if (typeof c !== 'object' || c === null) return
        if (!c['@_name'] && !containerTypes.includes(key) && !key.includes('container') && !key.includes('panel')) return
        
        // Check if/lang conditions
        if (c['@_if'] && !this.evaluateCondition(c['@_if'])) return
        if (c['@_lang'] && c['@_lang'] !== this.variables['lang']) return

        // Parse as element
        const element = this.parseElement(key as any, c, themeRoot)
        
        // Check if element with this name already exists in view
        const existing = view.elements.find(e => e.name === element.name && e.name !== 'unnamed')
        
        if (existing) {
           // Merge properties into existing element
           existing.extra = { ...existing.extra, ...element.extra }
           if (element.pos) existing.pos = element.pos
           if (element.size) existing.size = element.size
           if (element.origin) existing.origin = element.origin
           if (element.path) existing.path = element.path
           if (element.color) existing.color = element.color
           if (element.fontPath) existing.fontPath = element.fontPath
           if (element.fontSize) existing.fontSize = element.fontSize
           if (element.alignment) existing.alignment = element.alignment
        } else {
           view.elements.push(element)
        }

        // Recursively parse children ONLY for container types
        if (containerTypes.includes(key) || key.includes('container') || key.includes('panel')) {
           this.parseElementsRecursive(c, view, themeRoot)
        }
      })
    })
  }

  private parseElement(type: ThemeElement['type'], c: any, themeRoot: string): ThemeElement {
    const resolvePath = (p: any) => {
      if (!p || typeof p !== 'string') return p
      let resolved = this.resolveVars(p)
      if (resolved.startsWith('~')) return join(themeRoot, resolved.substring(1))
      if (resolved.startsWith('./')) return join(themeRoot, resolved.substring(2))
      if (!resolved.includes(':') && !resolved.startsWith('/') && !resolved.startsWith('\\')) {
         return join(themeRoot, resolved)
      }
      return resolved
    }

    const element: ThemeElement = {
      type,
      name: c['@_name'] || 'unnamed',
      pos: this.parseVector(c.pos),
      size: this.parseVector(c.size),
      maxSize: this.parseVector(c.maxSize),
      origin: this.parseVector(c.origin),
      // If multiple paths, keep them as an array for fallback logic
      path: c.path ? (Array.isArray(c.path) ? c.path.map(p => resolvePath(this.resolveVars(this.getBestValue(p)))) : resolvePath(this.getBestValue(c.path))) : undefined,
      color: c.color ? this.resolveVars(this.getBestValue(c.color)) : undefined,
      fontPath: c.fontPath ? resolvePath(this.getBestValue(c.fontPath)) : undefined,
      fontSize: c.fontSize ? parseFloat(this.resolveVars(this.getBestValue(c.fontSize))) : undefined,
      alignment: c.alignment ? this.resolveVars(this.getBestValue(c.alignment)) as any : undefined,
      extra: this.resolveExtra(c, themeRoot)
    }

    return element
  }

  // Handles multiple tags with the same name but different conditions (if/lang)
  private getBestValue(val: any): any {
    if (Array.isArray(val)) {
      // ES reads top-to-bottom, so later elements OVERRIDE earlier ones.
      // We should check from bottom-to-top (last to first).
      for (let i = val.length - 1; i >= 0; i--) {
        const item = val[i]
        if (typeof item === 'object' && item['@_if']) {
          if (this.evaluateCondition(item['@_if'])) return item['#text'] || item.text || item.path
        } else if (typeof item === 'object' && item['@_lang']) {
          return item['#text'] || item.text || item.path
        } else if (typeof item === 'string') {
          return item // A default string with no condition
        } else if (typeof item === 'object') {
          return item['#text'] || item.text || item.path
        }
      }
      return val[val.length - 1] // Fallback
    }
    
    if (typeof val === 'object' && val !== null) {
      return val['#text'] || val.text || val.path || val
    }
    
    return val
  }

  private resolveExtra(c: any, themeRoot: string): Record<string, any> {
    const extra: Record<string, any> = {}
    Object.entries(c).forEach(([key, val]) => {
      if (key.startsWith('@_')) {
        extra[key.substring(2)] = this.resolveVars(val)
      } else if (typeof val === 'object' && val !== null) {
        // Keep objects (like storyboard) as-is for the renderer to handle
        extra[key] = val
      } else {
        extra[key] = this.resolveVars(this.getBestValue(val))
      }
    })
    return extra
  }

  private parseVector(val: any): [number, number] | undefined {
    const bestVal = this.getBestValue(val)
    if (bestVal === undefined || bestVal === null) return undefined
    const strVal = this.resolveVars(String(bestVal))
    const parts = strVal.trim().split(/\s+/).filter(Boolean).map(parseFloat)
    if (parts.length === 0 || isNaN(parts[0])) return undefined
    // ES uses 0 for the missing dimension to preserve aspect ratio
    return [parts[0], parts.length > 1 && !isNaN(parts[1]) ? parts[1] : 0]
  }
}
