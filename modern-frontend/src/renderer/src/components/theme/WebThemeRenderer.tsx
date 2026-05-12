import React, { useMemo } from 'react'
import { resolvePath } from './utils'
import { WebCarouselElement } from './elements/WebCarouselElement'
import { WebGamelistElement } from './elements/WebGamelistElement'
import { WebMenuElement } from './elements/WebMenuElement'

interface Props {
  htmlContent: string
  data: any
  themePath: string
}

const styleStringToObject = (styleString: string) => {
  if (!styleString) return {}
  return styleString.split(';').reduce((acc, style) => {
    const colonIndex = style.indexOf(':')
    if (colonIndex > -1) {
      const key = style.slice(0, colonIndex).trim()
      const value = style.slice(colonIndex + 1).trim()
      const camelKey = key.replace(/-([a-z])/g, g => g[1].toUpperCase())
      acc[camelKey] = value
    }
    return acc
  }, {} as any)
}

export const WebThemeRenderer: React.FC<Props> = ({ htmlContent, data, themePath }) => {
  
  const reactTree = useMemo(() => {
    // 1. First, replace all variables in the raw HTML string
    // This is the most robust way to handle dynamic content
    let processedHtml = htmlContent.replace(/\{([a-zA-Z0-9_:-]+)\}/g, (match, fullKey) => {
      if (fullKey === 'global:time') return new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      if (fullKey === 'systems_json') return JSON.stringify(data?.systems || [])
      if (fullKey === 'games_json') return JSON.stringify(data?.games || [])
      
      const parts = fullKey.split(':')
      const baseKey = parts.length > 2 ? `${parts[0]}:${parts[1]}` : fullKey
      const format = parts.length > 2 ? parts[2] : null

      let val = data?.[baseKey] !== undefined ? data[baseKey] : data?.[baseKey.toLowerCase()]
      if (val === null || val === undefined) return ''

      // Dynamic formatting
      if (typeof val === 'string' && format) {
        if (format === 'Y' && val.length >= 4) {
          val = val.substring(0, 4) // Extrai o ano: "19900101T000000" -> "1990"
        }
        // Futuramente podemos adicionar format === 'upper', format === 'lower', etc
      }

      return String(val)
    })

    // 2. Parse the processed HTML
    const parser = new DOMParser()
    const doc = parser.parseFromString(processedHtml, 'text/html')

    const resolveLocalPath = (val: string) => {
      if (!val) return ''
      // If it's already a full path or URL, just return it (utils.resolvePath will handle file://)
      if (val.startsWith('file://') || val.startsWith('http') || val.match(/^[a-zA-Z]:/)) {
        return resolvePath(val, data)
      }
      
      // Relative paths (from theme root)
      if (val.startsWith('./') || val.startsWith('../')) {
        if (val.startsWith('./')) {
          return resolvePath(`${themePath}/${val.substring(2)}`, data)
        } else {
          // Simplified relative path resolution
          const parts = themePath.replace(/\\/g, '/').split('/')
          let upDirs = 0
          let p = val
          while(p.startsWith('../')) { upDirs++; p = p.substring(3); }
          const basePath = parts.slice(0, parts.length - upDirs).join('/')
          return resolvePath(`${basePath}/${p}`, data)
        }
      }
      
      return resolvePath(val, data)
    }

    const convertNode = (node: Node, index: number): React.ReactNode => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element
        const tagName = el.tagName.toLowerCase()
        if (tagName === 'script') return null
        
        const props: any = { key: index }
        
        Array.from(el.attributes).forEach(attr => {
          let name = attr.name
          let value = attr.value
          
          if (name === 'class') name = 'className'
          
          if (name === 'src' || name === 'href') {
            value = resolveLocalPath(value)
          }
          
          if (name === 'style') {
            // Resolve url() paths in style strings
            value = value.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, path) => {
               // Only resolve if it looks like a local path
               if (!path.startsWith('data:') && !path.startsWith('http')) {
                  return `url('${resolveLocalPath(path)}')`
               }
               return match
            })
            props.style = styleStringToObject(value)
            return
          }
          
          // DO NOT map string-based event handlers to React props (causes crash)
          if (name.startsWith('on')) return
          
          props[name] = value
        })

        // Custom Components
        if (tagName === 'riescade-system-carousel') {
          return (
            <WebCarouselElement 
              key={index}
              type={props.type || 'horizontal'} 
              direction={props.direction || 'horizontal'}
              mediaSource={props['media-source'] || 'theme'}
              itemsCount={parseInt(props['items-count'] || '5')} 
              logoScale={props['logo-scale'] ? parseFloat(props['logo-scale']) : 0.5}
              logoSelectedScale={props['logo-selected-scale'] ? parseFloat(props['logo-selected-scale']) : 1.0}
              data={data} 
              themePath={themePath} 
              isGame={false} 
            />
          )
        }

        if (tagName === 'riescade-game-carousel') {
          return (
            <WebCarouselElement 
              key={index}
              type={props.type || 'horizontal'} 
              direction={props.direction || 'horizontal'}
              mediaSource={props['media-source'] || 'marquee'}
              itemsCount={parseInt(props['items-count'] || '5')} 
              logoScale={props['logo-scale'] ? parseFloat(props['logo-scale']) : 0.5}
              logoSelectedScale={props['logo-selected-scale'] ? parseFloat(props['logo-selected-scale']) : 1.0}
              data={data} 
              themePath={themePath} 
              isGame={true} 
            />
          )
        }

        if (tagName === 'riescade-gamelist') {
          return <WebGamelistElement key={index} data={data} />
        }

        if (tagName === 'riescade-menu-items') {
          return <WebMenuElement key={index} />
        }

        if (tagName === 'riescade-video') {
           const src = props.src || ''
           const fallback = props.fallback || ''
           if (src) {
             return <video key={index} src={resolveLocalPath(src)} autoPlay loop muted style={{width: '100%', height: '100%', objectFit: 'cover'}} />
           } else if (fallback) {
             return <img key={index} src={resolveLocalPath(fallback)} style={{width: '100%', height: '100%', objectFit: 'cover'}} alt="" />
           }
           return null
        }

        const children = Array.from(el.childNodes).map((child, i) => convertNode(child, i))
        
        if (tagName === 'link' && props.rel === 'stylesheet') {
           const { key, ...restProps } = props
           return <link key={key} {...restProps} />
        }

        const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']
        if (voidElements.includes(tagName)) {
           return React.createElement(tagName, props)
        }

        return React.createElement(tagName, props, children.length > 0 ? children : undefined)
      }
      return null
    }

    const headChildren = Array.from(doc.head.childNodes).map((child, i) => convertNode(child, `h-${i}`))
    const bodyChildren = Array.from(doc.body.childNodes).map((child, i) => convertNode(child, `b-${i}`))
    
    return (
      <>
        {headChildren}
        {bodyChildren}
      </>
    )

  }, [htmlContent, data, themePath])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {reactTree}
    </div>
  )
}
