import { ThemeElement } from '../../../../shared/types/theme'

export const getBaseStyle = (element: ThemeElement): React.CSSProperties => {
  const { pos = [0, 0], size, maxSize, origin = [0, 0], extra = {} } = element
  const rotation = parseFloat(extra?.rotation || '0')

  // EXACT EmulationStation math:
  // Position is the anchor point on the screen.
  // Origin is the point within the element that sits on that position.
  let width = 'auto'
  let height = 'auto'
  let maxWidth = undefined
  let maxHeight = undefined

  if (size) {
    width = size[0] === 0 ? 'auto' : `${size[0] * 100}%`
    height = size[1] === 0 ? 'auto' : `${size[1] * 100}%`
  }

  if (maxSize) {
    maxWidth = maxSize[0] === 0 ? 'none' : `${maxSize[0] * 100}%`
    maxHeight = maxSize[1] === 0 ? 'none' : `${maxSize[1] * 100}%`
    // In ES, if maxSize is used, the image maintains aspect ratio and fits inside the box.
    // The actual width/height should be auto to allow it to shrink.
    if (!size) {
       width = 'auto'
       height = 'auto'
    }
  }

  return {
    position: 'absolute',
    left: `${pos[0] * 100}%`,
    top: `${pos[1] * 100}%`,
    width: width,
    height: height,
    maxWidth: maxWidth,
    maxHeight: maxHeight,
    // translate(-originX, -originY) anchors the element correctly
    transform: `translate(${-origin[0] * 100}%, ${-origin[1] * 100}%) rotate(${rotation}deg)`,
    transformOrigin: 'center center', // Rotation usually happens around the center in CSS when translated
    zIndex: parseInt(extra?.zIndex || '0'),
    opacity: extra?.opacity !== undefined ? parseFloat(extra.opacity) : 1,
    color: extra?.color ? `#${String(extra.color)}` : 'inherit',
    backgroundColor: (element.type === 'carousel' || element.type === 'gamecarousel' || element.type === 'container')
      ? (extra?.color ? `#${String(extra.color)}` : 'transparent') 
      : 'transparent',
    pointerEvents: 'none',
    visibility: extra?.visible === 'false' || extra?.visible === 0 ? 'hidden' : 'visible'
  }
}

export const resolvePath = (path: string | undefined, data?: any): string => {
  if (!path) return ''
  
  // Resolve variables like ${system.theme}
  let resolved = path.replace(/\${(.*?)}/g, (_, name) => {
    return data?.[name] || ''
  })

  // Resolve dynamic bindings like {system:name}
  resolved = resolved.replace(/{(.*?)}/g, (_, name) => {
    return data?.[name] !== undefined ? data[name] : ''
  })

  // Handle EmulationStation md_ metadata mapping if path is just the variable or starts with md_
  // ES tags often come as md_image, md_marquee etc.
  if (resolved.startsWith('md_') && data) {
    const key = resolved.replace('md_', '')
    // Map md_ desc to desc, md_ image to image, etc.
    const metadataValue = data[key] || data[resolved]
    if (metadataValue) resolved = metadataValue
  }

  // If it's already a file:// or http URL, return it
  if (resolved.startsWith('file://') || resolved.startsWith('http')) {
    return resolved
  }

  // Ensure it's a file:/// URL for Electron if it's an absolute path
  if (resolved.match(/^[a-zA-Z]:[\\\/]/) || resolved.startsWith('/') || resolved.startsWith('\\')) {
    // Replace backslashes with forward slashes and ensure proper prefixing
    const normalized = resolved.replace(/\\/g, '/')
    // Windows absolute path usually starts with drive letter
    if (normalized.match(/^[a-zA-Z]:/)) {
      return `file:///${normalized}`
    }
    return `file://${normalized}`
  }

  return resolved
}
