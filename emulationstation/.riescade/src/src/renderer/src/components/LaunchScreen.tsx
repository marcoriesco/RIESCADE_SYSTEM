import React from 'react'
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
  )
}
