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

  useEffect(() => {
    // Fade to pure black after 2 seconds so when the game closes quickly, it still returns to black instead of "Carregando"
    const timerOut = setTimeout(() => {
      setOpacity(0)
    }, 10000)

    return () => {
      clearTimeout(timerOut)
    }
  }, [])

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
        justifyContent: 'center'
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
