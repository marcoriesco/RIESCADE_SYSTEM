import React, { useState, useEffect, useRef } from 'react'

interface Props {
  autoplay?: boolean | string
  loop?: boolean | string
  delay?: number | string
  data: any
  className?: string
  class?: string
  style?: React.CSSProperties
  src?: string
  fallback?: string
}

export const WebVideoElement: React.FC<Props> = ({
  autoplay = true,
  loop = true,
  delay = 0,
  data,
  className = '',
  class: classAttr = '',
  style = {},
  src,
  fallback
}) => {
  const [shouldPlay, setShouldPlay] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const videoSrc = src || data['game:video'] || ''
  const isVideoEnabled = data['gamelist_video'] !== false && data['gamelist_video'] !== 'false'

  // Combine className (React style) and class (WebComponent style)
  const finalClassName = [className, classAttr].filter(Boolean).join(' ')

  // Parse delay value (e.g. "2" or "2s" or number 2)
  const getDelayMs = (d: number | string): number => {
    if (typeof d === 'number') return d * 1000
    const clean = String(d).trim().toLowerCase()
    const num = parseFloat(clean)
    if (isNaN(num)) return 0
    if (clean.endsWith('ms')) return num
    // Default to seconds if it ends with 's' or has no unit
    return num * 1000
  }

  const delayMs = getDelayMs(delay)

  useEffect(() => {
    setShouldPlay(false)
    if (!videoSrc || !isVideoEnabled) return

    if (delayMs > 0) {
      const timer = setTimeout(() => {
        setShouldPlay(true)
      }, delayMs)
      return () => clearTimeout(timer)
    } else {
      setShouldPlay(true)
    }
  }, [videoSrc, isVideoEnabled, delayMs])

  if (!isVideoEnabled) {
    return null
  }

  const isMuted = !(data['VideoAudio'] === true || data['VideoAudio'] === 'true')
  const isAutoplay = autoplay === true || autoplay === 'true' || autoplay === '' || autoplay === 'autoplay'
  const isLoop = loop === true || loop === 'true' || loop === '' || loop === 'loop'

  return (
    <video
      ref={videoRef}
      className={`riescade-video ${finalClassName}`}
      src={videoSrc}
      autoPlay={isAutoplay}
      loop={isLoop}
      muted={isMuted}
      style={style}
      disablePictureInPicture
      disableRemotePlayback
    />
  )
}
