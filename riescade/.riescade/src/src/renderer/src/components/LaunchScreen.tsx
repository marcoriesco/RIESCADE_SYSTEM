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
        opacity: isReady ? opacity : 0,
        pointerEvents: isReady && opacity > 0 ? 'auto' : 'none',
        transition: 'opacity 0.6s ease-in-out'
      }}
    >
      <div
        className="launch-screen-inner"
        style={{
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
