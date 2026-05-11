import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ThemeElement } from '../../../../shared/types/theme'
import { getBaseStyle, resolvePath } from '../utils'

interface Props {
  element: ThemeElement
  data?: any
  onImageError?: () => void
}

export const ImageElement: React.FC<Props> = ({ element, data, onImageError }) => {
  const baseStyle = getBaseStyle(element)
  const { path, extra } = element
  
  // path can be a string or an array of strings (for fallbacks)
  const paths = Array.isArray(path) ? path : [path].filter(Boolean)
  const [currentPathIndex, setCurrentPathIndex] = useState(paths.length - 1)
  const [activePath, setActivePath] = useState('')

  useEffect(() => {
    // Reset index when data or paths change
    setCurrentPathIndex(paths.length - 1)
  }, [data, path])

  useEffect(() => {
    // If no path is provided but it has an md_ name, try to resolve from data
    let rawPath = paths[currentPathIndex]
    
    if (!rawPath && element.name.startsWith('md_')) {
      const metadataMap: Record<string, string[]> = {
        'md_image': ['image'],
        'md_marquee': ['marquee'],
        'md_video': ['video'],
        'md_thumbnail': ['thumbnail'],
        'md_fanart': ['fanart', 'image'],
        'md_titleshot': ['titleshot', 'image'],
        'md_boxart': ['boxart', 'image'],
        'md_boxback': ['boxback'],
        'md_cartridge': ['cartridge'],
        'md_wheel': ['wheel', 'marquee'],
        'md_mix': ['mix', 'image'],
        'md_bezel': ['bezel'],
        'md_manual': ['manual'],
        'md_magazine': ['magazine'],
        'md_map': ['map']
      }
      
      const keys = metadataMap[element.name] || [element.name.replace('md_', '')]
      for (const k of keys) {
        if (data?.[k]) {
          rawPath = data[k]
          break
        }
      }
    }

    if (!rawPath && !extra?.default) {
      setActivePath('')
      return
    }

    const resolved = resolvePath(rawPath || extra?.default, data)
    setActivePath(resolved)
  }, [currentPathIndex, data, extra?.default, paths, element.name])

  const isFullScreen = element.size && element.size[0] >= 0.8 && element.size[1] >= 0.8

  // Basic storyboard support (framer-motion)
  const storyboards = Array.isArray(extra?.storyboard) ? extra.storyboard : [extra?.storyboard].filter(Boolean)
  // Find activate animation or default (no event)
  const activateAnim = storyboards.find((s: any) => !s['@_event'] || !s.event || s['@_event'] === 'activate' || s.event === 'activate')

  const animations = activateAnim?.animation || []
  const animList = Array.isArray(animations) ? animations : [animations]

  const initialProps: any = { opacity: baseStyle.opacity ?? 1, scale: 1 }
  const animateProps: any = { opacity: baseStyle.opacity ?? 1, scale: 1 }
  let hasAnimation = false

  animList.forEach((a: any) => {
    if (!a) return
    hasAnimation = true
    const prop = a['@_property'] || a.property
    const to = parseFloat(a['@_to'] || a.to)
    const from = parseFloat(a['@_from'] || a.from)
    const duration = parseInt(a['@_duration'] || a.duration || '1000') / 1000

    if (prop === 'opacity') {
      if (!isNaN(from)) initialProps.opacity = from
      if (!isNaN(to)) animateProps.opacity = to
      animateProps.transition = { ...animateProps.transition, opacity: { duration } }
    }
    if (prop === 'scale') {
      if (!isNaN(from)) initialProps.scale = from
      if (!isNaN(to)) animateProps.scale = to
      animateProps.transition = { ...animateProps.transition, scale: { duration } }
    }
  })

  const style: React.CSSProperties = {
    ...baseStyle,
    objectFit: extra?.tile ? 'fill' : (isFullScreen ? 'fill' : 'contain'), // ES stretches full screen images
    backgroundImage: extra?.tile ? `url("${activePath}")` : undefined,
    backgroundRepeat: extra?.tile ? 'repeat' : 'no-repeat',
    imageRendering: 'auto',
    opacity: undefined // Controlled by motion
  }

  if (extra?.tile) {
    return <div style={style} />
  }

  if (!activePath) return null

  return (
    <motion.img 
      key={activePath}
      src={activePath} 
      style={style} 
      initial={initialProps}
      animate={animateProps}
      alt={element.name}
      onError={() => {
        if (currentPathIndex > 0) {
          // Try the next path in fallback list (moving backwards from specific to generic)
          setCurrentPathIndex(prev => prev - 1)
        } else {
          console.log(`[Theme] Asset missing for ${element.name}: ${activePath}`)
          if (onImageError) onImageError()
        }
      }}
    />
  )
}
