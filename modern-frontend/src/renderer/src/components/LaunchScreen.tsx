import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { WebThemeRenderer } from './theme/WebThemeRenderer'
import { ThemeConfig } from '../../../shared/types/theme'

interface LaunchScreenProps {
  game: any
  system: any
  theme: ThemeConfig | null
  themeData: any
}

export const LaunchScreen: React.FC<LaunchScreenProps> = ({ game, system, theme, themeData }) => {
  const fanart = game?.fanart || game?.image || ''
  const logo = game?.marquee || ''
  const name = game?.name || ''

  const resolvePath = (path: string) => {
    if (!path) return ''
    if (path.startsWith('file://')) return path
    return `file:///${path.replace(/\\/g, '/')}`
  }

  // If it's a Web Theme and has a loading view, use it
  if (theme?.isWebTheme && theme.views.loading) {
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

  // Fallback for Legacy XML or Missing Loading HTML
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 10000,
          background: '#111',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Background Fanart */}
        {fanart && (
          <motion.div
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            style={{
              position: 'absolute',
              top: 0, left: 0, width: '100%', height: '100%',
              backgroundImage: `url("${resolvePath(fanart)}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'brightness(0.4) blur(10px)'
            }}
          />
        )}

        {/* Content */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            textAlign: 'center'
          }}
        >
          {logo ? (
            <img src={resolvePath(logo)} style={{ maxWidth: '400px', maxHeight: '200px', objectFit: 'contain' }} alt="" />
          ) : (
            <h1 style={{ color: '#fff', fontSize: '3rem', margin: 0, fontWeight: 900 }}>{name}</h1>
          )}
          <p style={{ color: '#fff', opacity: 0.5, letterSpacing: '3px', fontSize: '1.2rem' }}>
            LAUNCHING...
          </p>
        </motion.div>

        {/* System Independent Loader */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '40px',
            color: '#fff'
          }}
        >
          <Loader2 size={48} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
