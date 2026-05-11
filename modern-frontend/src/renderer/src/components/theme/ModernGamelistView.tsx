import React, { useState, useEffect, useMemo } from 'react'
import { useLibraryStore } from '../../store/useLibraryStore'
import { ThemeRenderer } from './ThemeRenderer'

export const ModernGamelistView: React.FC = () => {
  const { selectedSystem, games, theme, setSelectedSystem } = useLibraryStore()
  const [index, setIndex] = useState(0)

  const currentGame = games[index]

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') setIndex(prev => (prev + 1) % games.length)
      if (e.key === 'ArrowUp') setIndex(prev => (prev - 1 + games.length) % games.length)
      if (e.key === 'Backspace' || e.key === 'Escape') setSelectedSystem(null)
      if (e.key === 'Enter' && currentGame) {
        // @ts-ignore
        window.api.launchGame(currentGame, selectedSystem)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [index, games, selectedSystem, currentGame])

  if (!selectedSystem || !theme) return null

  // Prepare data for the theme bindings
  const themeData = useMemo(() => {
    if (!currentGame) return { 
       games, 
       selectedIndex: index,
       'system.name': selectedSystem.name,
       'system.fullName': selectedSystem.fullname
    }
    return {
      ...currentGame,
      games,
      selectedIndex: index,
      'system.name': selectedSystem.name,
      'system.fullName': selectedSystem.fullname,
      'system.theme': selectedSystem.theme
    }
  }, [currentGame, games, index, selectedSystem])

  // ES views order: detailed -> video -> basic -> grid
  const viewToUse = theme.views.detailed || theme.views.video || theme.views.basic || theme.views.grid || theme.views.default

  return (
    <div className="modern-gamelist-view" style={{ 
      position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#000', color: '#fff'
    }}>
      {viewToUse && (
        <ThemeRenderer view={viewToUse} data={themeData} />
      )}
      {theme.views.screen && (
        <ThemeRenderer view={theme.views.screen} data={themeData} />
      )}

      <div style={{ position: 'absolute', bottom: '2rem', left: '5rem', opacity: 0.5, pointerEvents: 'none' }}>
         BACKSPACE: RETURN • ENTER: PLAY
      </div>
    </div>
  )
}
