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
        opacity: isReady ? 1 : 0,
        pointerEvents: isReady ? 'auto' : 'none'
      }}
    >
      <div
        className="launch-screen-inner"
        style={{
          opacity: opacity
        }}
      >
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
          <div className="launch-screen-content">
            {logo ? (
              <img
                src={resolveFilePath(logo)}
                className="launch-screen-logo"
                alt=""
              />
            ) : (
              <h1 className="launch-screen-title">{name}</h1>
            )}
            <p className="launch-screen-text">
              LAUNCHING...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
