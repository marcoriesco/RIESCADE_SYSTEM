import React, { useState, useEffect, useCallback } from 'react'
import { WebThemeRenderer } from './theme/WebThemeRenderer'
import { Game, System } from '../../shared/types'

interface GameOptionsProps {
  isOpen: boolean
  onClose: () => void
  game: Game
  system: System
  theme?: any
  themeData?: any
  onUpdate: (updatedGame: Game) => void
}

export const GameOptionsOverlay: React.FC<GameOptionsProps> = ({ 
  isOpen, onClose, game, system, theme, themeData, onUpdate 
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [draftGame, setDraftGame] = useState<Game>(game)

  const options = [
    { 
      id: 'favorite', 
      label: 'FAVORITE', 
      type: 'toggle', 
      value: draftGame.favorite 
    },
    { 
      id: 'emulator', 
      label: 'EMULATOR', 
      type: 'select', 
      value: draftGame.emulator || system.emulators?.[0]?.name || 'DEFAULT',
      items: system.emulators?.map(e => ({ label: e.name.toUpperCase(), value: e.name })) || []
    }
  ]

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0)
      setDraftGame(game)
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [isOpen])

  const handleToggle = () => {
    const item = options[selectedIndex]
    if (item.id === 'favorite') {
      const updated = { ...draftGame, favorite: !draftGame.favorite }
      setDraftGame(updated)
      onUpdate(updated)
    }
  }

  const handleSelect = (direction: 1 | -1) => {
    const item = options[selectedIndex]
    if (item.id === 'emulator' && item.items) {
      const currentIdx = item.items.findIndex(i => i.value === item.value)
      const nextIdx = (currentIdx + direction + item.items.length) % item.items.length
      const updated = { ...draftGame, emulator: item.items[nextIdx].value, core: undefined }
      setDraftGame(updated)
      onUpdate(updated)
    }
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'ArrowDown') {
        setSelectedIndex(prev => (prev + 1) % options.length)
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex(prev => (prev - 1 + options.length) % options.length)
      } else if (e.key === 'Enter') {
        if (options[selectedIndex].type === 'toggle') handleToggle()
      } else if (e.key === 'ArrowRight') {
        if (options[selectedIndex].type === 'select') handleSelect(1)
      } else if (e.key === 'ArrowLeft') {
        if (options[selectedIndex].type === 'select') handleSelect(-1)
      } else if (e.key === 'Backspace' || e.key === 'Escape' || e.key === 'Control') {
        onClose()
      }
    },
    [isOpen, selectedIndex, game, options, onClose, onUpdate]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const menuItemsNode = (
    <div className="menu-list" style={{ padding: 0, background: 'transparent' }}>
      {options.map((item, index) => (
        <div
          key={item.id}
          className={`menu-item ${index === selectedIndex ? 'selected' : ''}`}
          style={{
            padding: '12px 30px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', cursor: 'pointer',
            background: index === selectedIndex ? '#3b82f6' : 'transparent',
            color: index === selectedIndex ? '#fff' : '#444',
            borderBottom: '1px solid rgba(0,0,0,0.1)',
            transition: 'background 0.15s ease'
          }}
        >
          <span style={{ fontWeight: index === selectedIndex ? 800 : 500, fontSize: '0.95rem', textTransform: 'uppercase' }}>
            {item.label}
          </span>
          <div className="menu-value">
            {item.type === 'toggle' ? (
              <div className={`menu-toggle ${item.value ? 'on' : 'off'}`} style={{
                width: 40, height: 20, background: item.value ? '#4ade80' : '#ccc',
                borderRadius: 10, position: 'relative'
              }}>
                <div style={{
                  width: 16, height: 16, background: '#fff', borderRadius: '50%',
                  position: 'absolute', top: 2, left: item.value ? 22 : 2,
                  transition: 'left 0.15s ease'
                }} />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800 }}>
                <span style={{ opacity: index === selectedIndex ? 1 : 0.3 }}>«</span>
                <span>{item.items?.find(i => i.value === item.value)?.label || item.value}</span>
                <span style={{ opacity: index === selectedIndex ? 1 : 0.3 }}>»</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  if (!isOpen) return null

  return (
    <div
      className="game-options-overlay"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.85)', zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: visible ? 1 : 0, transition: 'opacity 0.2s ease'
      }}
    >
      {theme?.isWebTheme && theme.views?.menu ? (
        <div style={{ width: '100%', height: '100%' }}>
          <WebThemeRenderer
            htmlContent={theme.views.menu}
            data={{ ...themeData, menuTitle: 'GAME OPTIONS', 'game:name': game.name }}
            themePath={theme.path}
            menuItemsNode={menuItemsNode}
          />
        </div>
      ) : (
        <div
          style={{
            width: '500px', background: '#dfdfdf', border: '4px solid #fff',
            display: 'flex', flexDirection: 'column',
            transform: visible ? 'scale(1)' : 'scale(0.95)',
            transition: 'transform 0.2s ease'
          }}
        >
          <div style={{ background: '#eee', padding: '15px 25px', borderBottom: '2px solid #aaa' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase' }}>GAME OPTIONS</h2>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>{game.name}</div>
          </div>
          <div style={{ background: '#fff' }}>{menuItemsNode}</div>
          <div style={{ background: '#ddd', padding: '10px 25px', fontSize: '0.8rem', fontWeight: 700 }}>
            PRESS B TO CLOSE
          </div>
        </div>
      )}
    </div>
  )
}
