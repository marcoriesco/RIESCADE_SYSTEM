import React, { useState, useEffect } from 'react'
import { ThemeElement } from '../../../../shared/types/theme'
import { getBaseStyle, resolvePath } from '../utils'

interface Props {
  element: ThemeElement
  data?: any
}

export const VideoElement: React.FC<Props> = ({ element, data }) => {
  const { path, extra } = element
  const baseStyle = getBaseStyle(element)
  const [showVideo, setShowVideo] = useState(!extra?.delay)

  useEffect(() => {
    if (extra?.delay) {
      const timer = setTimeout(() => setShowVideo(true), extra.delay * 1000)
      return () => clearTimeout(timer)
    }
  }, [extra?.delay, path])

  let rawPath = Array.isArray(path) ? path[0] : path
  
  if (!rawPath && element.name.startsWith('md_')) {
    const key = element.name.replace('md_', '')
    rawPath = data?.[key] || data?.[element.name]
  }

  const videoPath = resolvePath(rawPath || extra?.default, data)
  const snapshotPath = resolvePath(data?.[extra?.snapshotSource || 'image'] || extra?.[extra?.snapshotSource || 'image'], data)

  const style: React.CSSProperties = {
    ...baseStyle,
    objectFit: 'cover'
  }

  if (!videoPath) return null

  if (!showVideo && snapshotPath) {
    return <img src={snapshotPath} style={style} alt="snapshot" />
  }

  return (
    <video
      src={videoPath}
      style={style}
      autoPlay
      muted
      loop
      onCanPlay={(e) => (e.currentTarget.style.opacity = '1')}
      onError={() => console.log(`[Theme] Video missing for ${element.name}: ${videoPath}`)}
    />
  )
}
