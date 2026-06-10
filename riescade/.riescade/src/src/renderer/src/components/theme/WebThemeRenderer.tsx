import React, { useMemo, useState, useEffect, useRef } from 'react'
import { resolvePath } from './utils'
import { WebCarouselElement } from './elements/WebCarouselElement'
import { WebGamelistElement } from './elements/WebGamelistElement'
import { WebClockElement } from './elements/WebClockElement'

const resolveRelativeCssPath = (cssDir: string, relativePath: string): string => {
  const cssParts = cssDir.split('/')
  const relParts = relativePath.split('/')
  for (const part of relParts) {
    if (part === '.') continue
    if (part === '..') {
      cssParts.pop()
    } else {
      cssParts.push(part)
    }
  }
  return cssParts.join('/')
}

const SafeDecodeElement: React.FC<{
  tagName: string
  props: any
  children?: React.ReactNode
}> = ({ tagName, props, children }) => {
  // Displayed values: what is currently visible (starts with initial props)
  const [displayedSrc, setDisplayedSrc] = useState(props.src || '')
  const [displayedBg, setDisplayedBg] = useState(props.style?.backgroundImage || '')
  // Fade state: controls the crossfade transition
  const [fading, setFading] = useState(false)

  const lastSrc = useRef(props.src || '')
  const lastBg = useRef(props.style?.backgroundImage || '')

  const targetSrc = props.src || ''
  const targetBg = props.style?.backgroundImage || ''

  useEffect(() => {
    let active = true

    // Crossfade for <img> src changes
    const decodeSrc = async (newSrc: string) => {
      if (!newSrc) {
        if (active) {
          setDisplayedSrc('')
          setFading(false)
        }
        return
      }
      const img = new Image()
      img.src = newSrc
      try {
        await img.decode()
        if (active) {
          setDisplayedSrc(newSrc)
          setFading(false)
        }
      } catch {
        if (active) {
          const onerrorStr = props['data-onerror']
          if (onerrorStr && onerrorStr.includes('this.src')) {
            const match = onerrorStr.match(/this\.src\s*=\s*['"]([^'"]+)['"]/)
            if (match && match[1]) {
              const fallbackSrc = match[1]
              const fallbackImg = new Image()
              fallbackImg.src = fallbackSrc
              try {
                await fallbackImg.decode()
              } catch {}
              if (active) {
                setDisplayedSrc(fallbackSrc)
                setFading(false)
              }
              return
            }
          }
          setDisplayedSrc(newSrc)
          setFading(false)
        }
      }
    }

    // Crossfade for CSS background-image changes
    const decodeBg = async (newBgUrl: string) => {
      const match = newBgUrl.match(/url\(['"]?([^'")\s]+)['"]?\)/)
      if (!match || !match[1]) {
        if (active) {
          setDisplayedBg(newBgUrl)
          setFading(false)
        }
        return
      }
      const src = match[1]
      const img = new Image()
      img.src = src
      try {
        await img.decode()
      } catch { /* ignore decode errors */ }
      if (active) {
        setDisplayedBg(newBgUrl)
        setFading(false)
      }
    }

    if (targetSrc !== lastSrc.current) {
      lastSrc.current = targetSrc
      // Start crossfade: keep old image visible, decode new one
      setFading(true)
      decodeSrc(targetSrc)
    }

    if (targetBg !== lastBg.current) {
      lastBg.current = targetBg
      setFading(true)
      decodeBg(targetBg)
    }

    return () => {
      active = false
    }
  }, [targetSrc, targetBg])

  // Determine opacity: 1 when stable, 0.99 during crossfade to trigger CSS transition
  // (We use a subtle opacity dip rather than 0 to avoid black frames)
  const displayOpacity = fading ? 0.99 : 1

  const finalProps = { ...props }
  if (targetSrc) {
    finalProps.src = displayedSrc
  }
  if (targetBg) {
    finalProps.style = {
      ...finalProps.style,
      backgroundImage: displayedBg,
      transition: 'opacity 0.3s ease-in-out',
      opacity: displayOpacity
    }
  } else if (targetSrc) {
    finalProps.style = {
      ...finalProps.style,
      transition: 'opacity 0.3s ease-in-out',
      opacity: displayOpacity
    }
  }

  return React.createElement(tagName, finalProps, children)
}


interface Props {
  htmlContent: string
  data: any
  themePath: string
  menuItemsNode?: React.ReactNode
  isLaunchingView?: boolean
  isTransitioning?: boolean
  onReady?: () => void
  launchStatus?: 'loading' | 'running' | 'closed'
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

export const WebThemeRenderer: React.FC<Props> = ({ htmlContent, data, themePath, menuItemsNode, isLaunchingView = false, isTransitioning = false, onReady, launchStatus = 'loading' }) => {
  const [cssMap, setCssMap] = useState<Record<string, string>>({})
  const [cssLoaded, setCssLoaded] = useState(false)

  const isGamelistLoading = data?.['gamelist:loading'] || data?.['gamelist.loading']
  const isViewReady = cssLoaded && !isGamelistLoading

  useEffect(() => {
    if (isViewReady && onReady) {
      onReady()
    }
  }, [isViewReady, onReady])

  useEffect(() => {
    let cancelled = false
    setCssLoaded(false)

    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlContent, 'text/html')
    const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
    
    if (links.length === 0) {
      setCssLoaded(true)
      return
    }

    const resolveLocalPath = (val: string) => {
      if (!val) return ''
      if (val.startsWith('file://') || val.startsWith('http') || val.match(/^[a-zA-Z]:/)) {
        return resolvePath(val, data)
      }
      if (val.startsWith('./') || val.startsWith('../')) {
        if (val.startsWith('./')) {
          return resolvePath(`${themePath}/${val.substring(2)}`, data)
        } else {
          const parts = themePath.replace(/\\/g, '/').split('/')
          let upDirs = 0
          let p = val
          while (p.startsWith('../')) { upDirs++; p = p.substring(3) }
          const basePath = parts.slice(0, parts.length - upDirs).join('/')
          return resolvePath(`${basePath}/${p}`, data)
        }
      }
      return resolvePath(val, data)
    }

    let loadedCount = 0;
    const newCssMap: Record<string, string> = {}

    links.forEach(link => {
      const href = link.getAttribute('href')
      if (href) {
        const resolved = resolveLocalPath(href)
        const localPath = resolved.replace('file:///', '')
        
        const localPathClean = localPath.replace(/\\/g, '/').split('?')[0].split('#')[0]
        window.api.getFileContent(localPathClean).then((content: string) => {
          if (cancelled) return
          
          if (!content) {
            loadedCount++
            if (loadedCount === links.length) {
              setCssMap(newCssMap)
              setCssLoaded(true)
            }
            return
          }
          
          const cssDir = localPathClean.substring(0, localPathClean.lastIndexOf('/'))
          const processedContent = content.replace(/url\(['"]?([^'")\s]+)['"]?\)/g, (match, urlPath) => {
            if (urlPath.startsWith('data:') || urlPath.startsWith('http') || urlPath.startsWith('file:///')) {
              return match
            }
            const resolvedPath = resolveRelativeCssPath(cssDir, urlPath)
            const formattedUrl = resolvedPath.startsWith('/') ? `file://${resolvedPath}` : `file:///${resolvedPath}`
            return `url('${formattedUrl}')`
          })
          
          newCssMap[href] = processedContent
          loadedCount++
          if (loadedCount === links.length) {
            setCssMap(newCssMap)
            setCssLoaded(true)
          }
        }).catch((err: any) => {
          if (cancelled) return
          console.error("Failed to load CSS:", localPath, err)
          loadedCount++
          if (loadedCount === links.length) {
            setCssMap(newCssMap)
            setCssLoaded(true)
          }
        })
      } else {
        loadedCount++
        if (loadedCount === links.length) {
          if (cancelled) return
          setCssMap(newCssMap)
          setCssLoaded(true)
        }
      }
    })

    return () => {
      cancelled = true
    }
  }, [htmlContent, themePath])

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

      // Translation key: {t:KEY}
      if (expr.trim().startsWith('t:')) {
        const key = expr.trim().substring(2);
        return data[`t:${key}`] || key;
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

      // Map SVG lowercased tags back to camelCase for React
      const svgTagMap: Record<string, string> = {
        lineargradient: 'linearGradient',
        radialgradient: 'radialGradient',
        clippath: 'clipPath',
        textpath: 'textPath'
      }
      const reactTagName = svgTagMap[tagName] || tagName

      // Surgical Strike block removed: we keep the gamelist intact and visible with its fanart/images until the loading screen overlay fades in.

      let key = index
      const keyAttr = el.getAttribute('data-riescade-key')
      if (keyAttr === 'game' && (data.id || data['game:name'] || data.path)) {
        key = `${index}-${data.id || data['game:name'] || data.path}`
      } else if (keyAttr === 'system' && (data['system:name'] || data['system.name'])) {
        key = `${index}-${data['system:name'] || data['system.name']}`
      }

      const props: any = { key }

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

        if (name.toLowerCase() === 'onerror') {
          // Resolve any relative src paths in the onerror script string
          let resolvedValue = value
          if (value.includes('this.src =')) {
            resolvedValue = value.replace(/(this\.src\s*=\s*['"])([^'"]+)(['"])/g, (match, prefix, path, suffix) => {
              return prefix + resolveLocalPath(path) + suffix
            })
          }
          props['data-onerror'] = resolvedValue
          return
        }

        // Skip other event handler strings
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

      if (props['data-onerror']) {
        const onerrorStr = props['data-onerror']
        props.onError = (e: React.SyntheticEvent<HTMLElement, Event>) => {
          const el = e.currentTarget
          const s = onerrorStr.trim()
          
          if (s.includes('this.src') && s.includes('=')) {
            const match = s.match(/this\.src\s*=\s*['"]([^'"]+)['"]/i)
            if (match && match[1]) {
              ;(el as HTMLImageElement).src = match[1]
              return
            }
          }
          if (s.includes('this.style.display') && s.includes('none')) {
            el.style.display = 'none'
            return
          }
          if ((s.includes('this.class') || s.includes('this.className')) && s.includes('hide')) {
            el.className = (el.className + ' hide').trim()
            return
          }
          
          // Unrecognized fallback: hide the broken element
          el.style.display = 'none'
        }
      }

      // Tracking CSS link loads (no longer needed, but keeping props clean)
      if (tagName === 'link' && props.rel === 'stylesheet') {
        // removed tracking
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
      let finalChildren = children

      if (isLaunchingView) {
        const hasHide = el.hasAttribute('hideloadingelement') || el.hasAttribute('hideLoadingElement')
        const keepTextVal = el.getAttribute('keeploadingelementtext') || el.getAttribute('keepLoadingElementText')

        if (hasHide) {
          const existingStyle = props.style || {}
          const shouldHide = launchStatus === 'running' || launchStatus === 'closed'
          props.style = {
            ...existingStyle,
            transition: 'opacity 0.5s ease-in-out',
            opacity: shouldHide ? 0 : (existingStyle.opacity !== undefined ? existingStyle.opacity : 1),
            pointerEvents: shouldHide ? 'none' : (existingStyle.pointerEvents || 'auto')
          }
        }

        if (keepTextVal) {
          if (launchStatus === 'running') {
            finalChildren = [data['t:GAME_RUNNING'] || 'Jogo em execução...']
          } else if (launchStatus === 'closed') {
            finalChildren = [keepTextVal]
          }
        }
      }
      
      const { key: _, ...restProps } = props

      if (tagName === 'riescade-systems') {
        return <WebCarouselElement {...restProps} key={index} isGame={false} data={data} themePath={themePath} />
      }

      if (tagName === 'riescade-gamelists') {
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
      
      // Inline pre-fetched CSS to guarantee synchronous layout and zero FOUC
      if (tagName === 'link' && props.rel === 'stylesheet') {
        const originalHref = el.getAttribute('href') || ''
        if (cssMap[originalHref]) {
          return <style key={key} dangerouslySetInnerHTML={{ __html: cssMap[originalHref] }} />
        }
      }

      const hasBgImage = props.style?.backgroundImage && props.style.backgroundImage !== 'none'
      if (tagName === 'img' || hasBgImage) {
        return (
          <SafeDecodeElement tagName={reactTagName} props={props} key={key}>
            {finalChildren.length > 0 ? finalChildren : undefined}
          </SafeDecodeElement>
        )
      }

      if (voidElements.includes(tagName)) {
        return React.createElement(reactTagName, props)
      }

      return React.createElement(reactTagName, props, finalChildren.length > 0 ? finalChildren : undefined)
    }

    const headChildren = Array.from(doc.head.childNodes).map((child, i) => convertNode(child, `h-${i}`))
    const bodyChildren = Array.from(doc.body.childNodes).map((child, i) => convertNode(child, `b-${i}`))

    return [...headChildren, ...bodyChildren]
  }, [htmlContent, data, themePath, menuItemsNode, isLaunchingView, cssMap, isTransitioning, launchStatus])

  if (!cssLoaded) return null; // Wait for CSS to be fully fetched before returning any DOM

  const showWithOpacity = isLaunchingView ? 1 : (isViewReady ? 1 : 0)
  const transitionStyle = isLaunchingView ? 'none' : (isViewReady ? 'opacity 0.25s ease-in-out' : 'none')

  return (
    <div style={{ 
      width: '100%', 
      height: '100%',
      opacity: showWithOpacity,
      transition: transitionStyle
    }}>
      {reactTree}
    </div>
  )
}
