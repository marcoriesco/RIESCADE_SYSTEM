import React, { useEffect, useMemo } from 'react'
import { useLibraryStore } from '../../store/useLibraryStore'
import { ThemeRenderer } from './ThemeRenderer'

export const ModernSystemView: React.FC = () => {
  const { systems, theme, systemIndex, setSystemIndex, setSelectedSystem } = useLibraryStore()
  
  const currentSystem = systems[systemIndex]
  
  if (!currentSystem || !theme) return null

  const navigate = (dir: number) => {
    setSystemIndex((prev) => (prev + dir + systems.length) % systems.length)
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') navigate(1)
      if (e.key === 'ArrowLeft') navigate(-1)
      if (e.key === 'Enter') setSelectedSystem(systems[index])
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [index, systems])

  // Prepare data for the theme bindings
  const themeData = useMemo(() => {
    if (!currentSystem) return {}
    return {
      systems, // Needed for carousel
      'system.name': currentSystem.name,
      'system.fullName': currentSystem.fullname,
      'system.theme': currentSystem.theme,
      'system.gamecount': currentSystem.gamecount,
      'system.manufacturer': '', // Fill if available in System type
      'system.releaseYear': '',
      'system.hardwareType': '',
      // Add more as needed
      ...currentSystem
    }
  }, [currentSystem, systems])

  const viewToUse = theme.views?.system

  return (
    <div className="modern-system-view" style={{ 
      position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#000'
    }}>
      {viewToUse && (
        <ThemeRenderer view={viewToUse} data={themeData} />
      )}
      {theme.views?.screen && (
        <ThemeRenderer view={theme.views.screen} data={themeData} />
      )}

      <div className="footer-hints" style={{ position: 'absolute', bottom: '2rem', width: '100%', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem', pointerEvents: 'none' }}>
        USE ARROW KEYS TO NAVIGATE • PRESS ENTER TO SELECT
      </div>
    </div>
  )
}
