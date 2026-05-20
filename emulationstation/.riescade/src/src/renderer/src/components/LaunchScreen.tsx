import React, { useState, useEffect } from 'react'
import { WebThemeRenderer } from './theme/WebThemeRenderer'

interface LaunchScreenProps {
  game: any
  system: any
  theme: any
  themeData: any
}

export const LaunchScreen: React.FC<LaunchScreenProps> = ({ game, system, theme, themeData }) => {
  const logo = game?.marquee || ''
  const name = game?.name || ''
  const [opacity, setOpacity] = useState(1)
  const [isReady, setIsReady] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    if (!theme?.isWebTheme || !theme.views?.loading) {
      setIsReady(true)
    }
  }, [theme])

  useEffect(() => {
    if (!isReady) return

    // Fade to pure black after 3.5 seconds so when the game closes quickly, it still returns to black instead of "Carregando"
    const timerOut = setTimeout(() => {
      setIsTransitioning(true)
      if (!theme?.isWebTheme || !theme.views?.loading) {
        setOpacity(0)
      }
    }, 3500)

    return () => {
      clearTimeout(timerOut)
    }
  }, [isReady, theme])

  const resolveFilePath = (path: string) => {
    if (!path) return ''
    if (path.startsWith('file://')) return path
    return `file:///${path.replace(/\\/g, '/')}`
  }

  return (
    <div
      className="launch-screen"
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 10000,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isReady ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: isReady ? 'auto' : 'none'
      }}
    >
      <div style={{
        width: '100%', height: '100%', 
        opacity: opacity, 
        transition: 'opacity 0.4s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {theme?.isWebTheme && theme.views?.loading ? (
          <WebThemeRenderer
            htmlContent={theme.views.loading}
            data={themeData}
            themePath={theme.path}
            isLaunchingView={true}
            isTransitioning={isTransitioning}
            onReady={() => setIsReady(true)}
          />
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            textAlign: 'center'
          }}>
            {logo ? (
              <img src={resolveFilePath(logo)} style={{ maxWidth: '400px', maxHeight: '200px', objectFit: 'contain' }} alt="" />
            ) : (
              <h1 style={{ color: '#fff', fontSize: '3rem', margin: 0, fontWeight: 900 }}>{name}</h1>
            )}
            <p style={{ color: '#fff', opacity: 0.5, letterSpacing: '3px', fontSize: '1.2rem' }}>
              LAUNCHING...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
