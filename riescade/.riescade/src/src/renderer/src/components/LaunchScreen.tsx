import React, { useState, useEffect } from 'react'
import { WebThemeRenderer } from './theme/WebThemeRenderer'

interface LaunchScreenProps {
  game: any
  system: any
  theme: any
  themeData: any
  t: (key: string) => string
}

export const LaunchScreen: React.FC<LaunchScreenProps> = ({ game, system, theme, themeData, t }) => {
  const logo = game?.marquee || ''
  const name = game?.name || ''
  const [status, setStatus] = useState<'loading' | 'running' | 'closed'>('loading')
  const [isReady, setIsReady] = useState(false)
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    if (!theme?.isWebTheme || !theme.views?.loading) {
      setIsReady(true)
    }
  }, [theme])

  useEffect(() => {
    const unsubscribe = window.api.on('launcher-status', (event: any, data: { status: 'loading' | 'running' | 'closed' }) => {
      if (data && data.status) {
        setStatus(data.status)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (status === 'closed') {
      const fadeOutTimer = setTimeout(() => {
        setOpacity(0)
      }, 1000)
      return () => clearTimeout(fadeOutTimer)
    } else {
      setOpacity(1)
    }
  }, [status])

  const resolveFilePath = (path: string) => {
    if (!path) return ''
    const url = path.startsWith('file://') ? path : `file:///${path.replace(/\\/g, '/')}`
    const [pathPart, ...queryParts] = url.split('?')
    return [pathPart.replace(/#/g, '%23'), ...queryParts].join('?')
  }

  const isTransitioning = status === 'running' || status === 'closed'

  return (
    <div
      className="launch-screen"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isReady ? opacity : 0,
        pointerEvents: isReady && opacity > 0 ? 'auto' : 'none',
        transition: 'opacity 0.6s ease-in-out'
      }}
    >
      <div
        className="launch-screen-inner"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 1,
          transition: 'opacity 0.6s ease-in-out'
        }}
      >
        {theme?.isWebTheme && theme.views?.loading ? (
          <WebThemeRenderer
            htmlContent={theme.views.loading}
            data={themeData}
            themePath={theme.path}
            isLaunchingView={true}
            isTransitioning={isTransitioning}
            launchStatus={status}
            onReady={() => setIsReady(true)}
          />
        ) : (
          <div
            className="launch-screen-content"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              textAlign: 'center'
            }}
          >
            {logo ? (
              <img
                src={resolveFilePath(logo)}
                className="launch-screen-logo"
                alt=""
                style={{
                  maxWidth: '400px',
                  maxHeight: '200px',
                  objectFit: 'contain'
                }}
              />
            ) : (
              <h1
                className="launch-screen-title"
                style={{
                  color: '#fff',
                  fontSize: '3rem',
                  margin: 0,
                  fontWeight: 900
                }}
              >
                {name}
              </h1>
            )}
            <p
              className="launch-screen-text"
              style={{
                color: '#fff',
                opacity: 0.5,
                letterSpacing: '3px',
                fontSize: '1.2rem'
              }}
            >
              {status === 'closed'
                ? t('RETURNING')
                : status === 'running'
                ? t('GAME_RUNNING')
                : t('LOADING')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
