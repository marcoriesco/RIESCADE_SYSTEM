import React, { useMemo, useState, useEffect } from 'react'
import { resolvePath } from './utils'
import { WebCarouselElement } from './elements/WebCarouselElement'
import { WebGamelistElement } from './elements/WebGamelistElement'
import { WebClockElement } from './elements/WebClockElement'

interface Props {
  htmlContent: string
  data: any
  themePath: string
  menuItemsNode?: React.ReactNode
  isLaunchingView?: boolean
}

const styleStringToObject = (styleString: string) => {
  if (!styleString) return {}
  return styleString.split(';').reduce((acc, style) => {
    const colonIndex = style.indexOf(':')
    if (colonIndex > -1) {
      const key = style.slice(0, colonIndex).trim()
      const value = style.slice(colonIndex + 1).trim()
      if (key.startsWith('--')) {
        acc[key] = value
      } else {
        const camelKey = key.replace(/-([a-z])/g, g => g[1].toUpperCase())
        acc[camelKey] = value
      }
    }
    return acc
  }, {} as any)
}

export const WebThemeRenderer: React.FC<Props> = ({ htmlContent, data, themePath, menuItemsNode, isLaunchingView = false }) => {
  const [loadedLinks, setLoadedLinks] = useState(0)
  const [totalLinks, setTotalLinks] = useState(0)

  // Scan HTML for link tags whenever htmlContent changes
  useEffect(() => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlContent, 'text/html')
    const links = doc.querySelectorAll('link[rel="stylesheet"]')
    setTotalLinks(links.length)
    setLoadedLinks(0)
  }, [htmlContent])

  const reactTree = useMemo(() => {
    // 1. Replace all variables and expressions in the raw HTML string
    const resolveValue = (key: string) => {
      if (!key) return undefined;
      const k = key.trim();
      
      // Handle literal strings
      if ((k.startsWith("'") && k.endsWith("'")) || (k.startsWith('"') && k.endsWith('"'))) {
        return k.substring(1, k.length - 1);
      }

      // Check for exact match in data (handles global:time, system:name etc)
      if (data[k] !== undefined) return data[k];
      if (data[k.toLowerCase()] !== undefined) return data[k.toLowerCase()];

      // Nested resolution for dots
      const parts = k.split('.');
      let current = data;
      for (const part of parts) {
        if (current === undefined || current === null || typeof current !== 'object') {
          current = undefined;
          break;
        }
        current = current[part];
      }
      if (current !== undefined) return current;

      return undefined;
    };

    const processExpression = (expr: string): string => {
      // Ternary: condition ? truePart : falsePart
      if (expr.includes('?')) {
        const qIndex = expr.indexOf('?');
        const condition = expr.substring(0, qIndex).trim();
        const rest = expr.substring(qIndex + 1);

        // Find the ':' that separates true and false parts, respecting quotes and braces
        let colonIndex = -1;
        let inQuotes = false;
        let quoteChar = '';
        let depth = 0;
        for (let i = 0; i < rest.length; i++) {
          const c = rest[i];
          if ((c === "'" || c === '"') && (i === 0 || rest[i-1] !== '\\')) {
            if (!inQuotes) { inQuotes = true; quoteChar = c; }
            else if (c === quoteChar) { inQuotes = false; }
          }
          if (!inQuotes) {
            if (c === '{') depth++;
            if (c === '}') depth--;
            if (c === ':' && depth === 0) {
              colonIndex = i;
              break;
            }
          }
        }

        if (colonIndex !== -1) {
          const truePart = rest.substring(0, colonIndex).trim();
          const falsePart = rest.substring(colonIndex + 1).trim();
          
          const condResult = (() => {
            if (condition.includes('==')) {
              const [left, right] = condition.split('==').map(s => s.trim());
              return String(resolveValue(left)) === String(resolveValue(right));
            }
            if (condition.includes('!=')) {
              const [left, right] = condition.split('!=').map(s => s.trim());
              return String(resolveValue(left)) !== String(resolveValue(right));
            }
            return resolveValue(condition);
          })();

          const selected = condResult ? truePart : falsePart;
          
          // Remove potential wrapping quotes from the result
          let final = String(selected).trim();
          if ((final.startsWith("'") && final.endsWith("'")) || (final.startsWith('"') && final.endsWith('"'))) {
            final = final.substring(1, final.length - 1);
          }

          // Recursively resolve any variables inside the selected part (${var} or {var})
          return final.replace(/(\$\{|\{)([^{}]+)\}/g, (m, prefix, k) => processExpression(k));
        }
      }

      // Standard variable resolution with date formatting support
      const parts = expr.split(':');
      const baseKey = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : expr;
      const format = parts.length > 2 ? parts.slice(2).join(':') : null

      if (baseKey === 'global:time') return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      if (baseKey === 'systems_json') return JSON.stringify(data?.systems || [])
      if (baseKey === 'games_json') return JSON.stringify(data?.games || [])

      let val = resolveValue(baseKey);
      if (val === null || val === undefined) return '';

      if (typeof val === 'string' && format) {
        // Date formatting: {game:releasedate:d/m/Y}
        if (baseKey.includes('releasedate') || baseKey.includes('lastplayed')) {
          try {
            // ES format is usually YYYYMMDDTHHMMSS or just YYYYMMDD
            const y = val.substring(0, 4)
            const m = val.substring(4, 6)
            const d = val.substring(6, 8)
            if (y && m && d) {
              return format
                .replace('d', d)
                .replace('m', m)
                .replace('Y', y)
                .replace('y', y.substring(2))
            }
          } catch (e) {
            console.error('Error formatting date variable:', e)
          }
        }
        
        if (format === 'Y' && val.length >= 4) val = val.substring(0, 4)
      }

      return String(val)
    };

    // Use a regex that supports one level of nested braces (for ternaries with internal variables)
    let processedHtml = htmlContent.replace(/\{((?:[^{}]|\{[^{}]*\})+)\}/g, (match, expr) => processExpression(expr))

    // 2. Parse processed HTML
    const parser = new DOMParser()
    const doc = parser.parseFromString(processedHtml, 'text/html')

    const resolveLocalPath = (val: string) => {
      if (!val) return ''
      const addCacheBust = (url: string) => {
        const rev = data?.['global:themeRevision']
        if (rev === undefined || rev === null) return url
        if (!url.endsWith('.css') && !url.includes('.css?')) return url
        if (url.includes('themeRev=')) return url
        return url.includes('?') ? `${url}&themeRev=${rev}` : `${url}?themeRev=${rev}`
      }

      if (val.startsWith('file://') || val.startsWith('http') || val.match(/^[a-zA-Z]:/)) {
        return addCacheBust(resolvePath(val, data))
      }
      if (val.startsWith('./') || val.startsWith('../')) {
        if (val.startsWith('./')) {
          return addCacheBust(resolvePath(`${themePath}/${val.substring(2)}`, data))
        } else {
          const parts = themePath.replace(/\\/g, '/').split('/')
          let upDirs = 0
          let p = val
          while (p.startsWith('../')) { upDirs++; p = p.substring(3) }
          const basePath = parts.slice(0, parts.length - upDirs).join('/')
          return addCacheBust(resolvePath(`${basePath}/${p}`, data))
        }
      }
      return addCacheBust(resolvePath(val, data))
    }

    const convertNode = (node: Node, index: any): React.ReactNode => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent
      if (node.nodeType !== Node.ELEMENT_NODE) return null

      const el = node as Element
      const tagName = el.tagName.toLowerCase()
      if (tagName === 'script') return null

      // Surgical Strike: Block fanart/media if we are launching a game (and not in loading view)
      if (data['game:launching'] === true && !isLaunchingView) {
        const src = el.getAttribute('src') || ''
        const style = el.getAttribute('style') || ''
        const fanart = data['game:fanart'] || ''
        const image = data['game:image'] || ''
        
        if (
          (tagName === 'img' && (src.includes(fanart) || src.includes(image))) ||
          (style.includes('background') && (style.includes(fanart) || style.includes(image)))
        ) {
          return null
        }
      }

      const props: any = { key: index }

      const isCustomElement = tagName.includes('-')

      Array.from(el.attributes).forEach(attr => {
        let name = attr.name
        let value = attr.value

        if (name === 'class' && !isCustomElement) name = 'className'
        if (name === 'src' || name === 'href') value = resolveLocalPath(value)

        // Map kebab-case SVG attributes to camelCase for React
        const svgAttrMap: Record<string, string> = {
          'stroke-width': 'strokeWidth',
          'stroke-linecap': 'strokeLinecap',
          'stroke-linejoin': 'strokeLinejoin',
          'fill-opacity': 'fillOpacity',
          'stroke-opacity': 'strokeOpacity',
          'viewbox': 'viewBox'
        }
        if (svgAttrMap[name.toLowerCase()]) {
          name = svgAttrMap[name.toLowerCase()]
        }

        if (name === 'style') {
          value = value.replace(/url\(['"]?([^'")\s]+)['"]?\)/g, (match, path) => {
            if (!path.startsWith('data:') && !path.startsWith('http')) {
              return `url('${resolveLocalPath(path)}')`
            }
            return match
          })
          props.style = styleStringToObject(value)
          return
        }

        // Skip event handler strings
        if (name.startsWith('on')) return

        // Convert kebab-case attribute names to camelCase for React props
        const kebabToCamel = (str: string) => {
          if (str === 'class' && !isCustomElement) return 'className'
          if (str.startsWith('data-') || str.startsWith('aria-') || str.startsWith('riescade-')) return str
          return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
        }

        let propName = kebabToCamel(name)
        if (propName === 'viewbox') propName = 'viewBox'
        props[propName] = value
      })

      // Tracking CSS link loads
      if (tagName === 'link' && props.rel === 'stylesheet') {
        props.onLoad = () => setLoadedLinks(prev => prev + 1)
        props.onError = () => setLoadedLinks(prev => prev + 1)
      }

      // Special handling for broken images if data-riescade-hide-on-error is present
      if (tagName === 'img' && props['data-riescade-hide-on-error']) {
        if (!props.src) {
          props.style = { ...props.style, display: 'none' }
        }
        
        const originalOnError = props.onError
        props.onError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
          e.currentTarget.style.display = 'none'
          if (originalOnError) originalOnError(e)
        }

        const originalOnLoad = props.onLoad
        props.onLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
          e.currentTarget.style.display = '' // Restore original display
          if (originalOnLoad) originalOnLoad(e)
        }
      }

      if (tagName === 'style') {
        return <style key={index} dangerouslySetInnerHTML={{ __html: el.textContent || '' }} />
      }

      const children = Array.from(el.childNodes).map((child, i) => convertNode(child, `${index}-${i}`))
      
      const { key: _, ...restProps } = props

      if (tagName === 'riescade-system-carousel') {
        return <WebCarouselElement {...restProps} key={index} isGame={false} data={data} themePath={themePath} />
      }

      if (tagName === 'riescade-game-carousel') {
        return <WebCarouselElement {...restProps} key={index} isGame={true} data={data} themePath={themePath} />
      }

      if (tagName === 'riescade-gamelist') {
        return <WebGamelistElement key={index} data={data} />
      }

      if (tagName === 'riescade-clock') {
        return <WebClockElement key={index} {...restProps} displayDate={restProps.displayDate === 'true'} />
      }

      if (tagName === 'riescade-menu-items') {
        return menuItemsNode ? React.cloneElement(menuItemsNode as React.ReactElement, { key: index }) : null
      }

      if (tagName === 'riescade-video') {
        const src = props.src || ''
        const fallback = props.fallback || ''
        if (src) return <video key={index} src={resolveLocalPath(src)} autoPlay loop muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        if (fallback) return <img key={index} src={resolveLocalPath(fallback)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        return null
      }

      const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']
      if (voidElements.includes(tagName)) {
        return React.createElement(tagName, props)
      }

      return React.createElement(tagName, props, children.length > 0 ? children : undefined)
    }

    const headChildren = Array.from(doc.head.childNodes).map((child, i) => convertNode(child, `h-${i}`))
    const bodyChildren = Array.from(doc.body.childNodes).map((child, i) => convertNode(child, `b-${i}`))

    return [...headChildren, ...bodyChildren]
  }, [htmlContent, data, themePath, menuItemsNode, isLaunchingView])

  const isReady = totalLinks === 0 || loadedLinks >= totalLinks

  return (
    <div style={{ 
      width: '100%', 
      height: '100%' 
    }}>
      {reactTree}
    </div>
  )
}
