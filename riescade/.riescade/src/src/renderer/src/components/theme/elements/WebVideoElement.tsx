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
  children?: React.ReactNode
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
  fallback,
  children
}) => {
  // activeSrc is only set AFTER the delay has elapsed for the current videoSrc.
  // This prevents the video from playing during the delay window, even across re-renders.
  const [activeSrc, setActiveSrc] = useState('')
  const [fileExists, setFileExists] = useState<boolean | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Find source from children
  let childSrc = ''
  if (children) {
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && (child.type === 'source' || (typeof child.type === 'string' && child.type.toLowerCase() === 'source'))) {
        const childProps = child.props as any
        if (childProps && childProps.src) {
          childSrc = childProps.src
        }
      }
    })
  }

  const videoSrc = src || childSrc || data['game:video'] || ''
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

  // Check if file exists on disk
  useEffect(() => {
    let active = true

    if (!videoSrc) {
      setFileExists(false)
      return
    }

    if (videoSrc.startsWith('http://') || videoSrc.startsWith('https://') || videoSrc.startsWith('data:')) {
      setFileExists(true)
      return
    }

    if (window.api && typeof window.api.fileExists === 'function') {
      window.api.fileExists(videoSrc).then((exists) => {
        if (active) {
          setFileExists(exists)
        }
      }).catch((err) => {
        console.error('Error verifying video file existence:', err)
        if (active) {
          setFileExists(false)
        }
      })
    } else {
      setFileExists(true)
    }

    return () => {
      active = false
    }
  }, [videoSrc])

  useEffect(() => {
    // Immediately clear the active source — the video stops until the delay elapses
    setActiveSrc('')

    if (!videoSrc || !isVideoEnabled || fileExists === false) return

    if (delayMs > 0) {
      const timer = setTimeout(() => {
        setActiveSrc(videoSrc)
      }, delayMs)
      return () => clearTimeout(timer)
    } else {
      setActiveSrc(videoSrc)
    }
  }, [videoSrc, isVideoEnabled, delayMs, fileExists])

  if (!isVideoEnabled || fileExists === false || fileExists === null) {
    return null
  }

  // While waiting for delay or if there is no video, show fallback/placeholder
  if (!activeSrc) {
    if (fallback) {
      return (
        <img
          className={finalClassName}
          src={fallback}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            ...style
          }}
          alt=""
        />
      )
    }
    return null
  }

  const isMuted = !(data['VideoAudio'] === true || data['VideoAudio'] === 'true')
  const isAutoplay = autoplay === true || autoplay === 'true' || autoplay === '' || autoplay === 'autoplay'
  const isLoop = loop === true || loop === 'true' || loop === '' || loop === 'loop'

  return (
    <video
      key={activeSrc}
      ref={videoRef}
      className={`riescade-video ${finalClassName}`}
      src={activeSrc}
      autoPlay={isAutoplay}
      loop={isLoop}
      muted={isMuted}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        ...style
      }}
      disablePictureInPicture
      disableRemotePlayback
    />
  )
}
