import React from 'react'
import { WebThemeRenderer } from './theme/WebThemeRenderer'

interface LaunchScreenProps {
  game: any
  system: any
  theme: any
  themeData: any
}

export const LaunchScreen: React.FC<LaunchScreenProps> = ({ game, system, theme, themeData }) => {
  const fanart = game?.fanart || game?.image || ''
  const logo = game?.marquee || ''
  const name = game?.name || ''

  const resolveFilePath = (path: string) => {
    if (!path) return ''
    if (path.startsWith('file://')) return path
    return `file:///${path.replace(/\\/g, '/')}`
  }

  // If theme has a loading view, use it
  if (theme?.isWebTheme && theme.views?.loading) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 10000, background: '#000' }}>
        <WebThemeRenderer
          htmlContent={theme.views.loading}
          data={themeData}
          themePath={theme.path}
        />
      </div>
    )
  }

  // Fallback launch screen (CSS animations, no framer-motion)
  return (
    <div
      className="launch-screen"
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 10000,
        background: '#111',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.3s ease forwards'
      }}
    >
      {/* Background Fanart */}
      {fanart && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          backgroundImage: `url("${resolveFilePath(fanart)}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(0.4) blur(10px)',
          transform: 'scale(1.1)'
        }} />
      )}

      {/* Content */}
      <div style={{
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
        textAlign: 'center',
        animation: 'slideUp 0.5s ease 0.2s both'
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

      {/* CSS Spinner */}
      <div style={{
        position: 'absolute',
        bottom: '40px',
        right: '40px',
        width: '48px',
        height: '48px',
        border: '3px solid rgba(255,255,255,0.2)',
        borderTop: '3px solid #fff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      ` }} />
    </div>
  )
}
