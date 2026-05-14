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
    <div className="riescade-menu-list">
      {options.map((item, index) => (
        <div
          key={item.id}
          className={`riescade-menu-item ${index === selectedIndex ? 'selected' : ''}`}
        >
          <span className="riescade-menu-label">
            {item.label}
          </span>
          <div className="riescade-menu-value">
            {item.type === 'toggle' ? (
              <div className={`menu-toggle ${item.value ? 'on' : 'off'}`}>
                <div className="toggle-thumb" />
              </div>
            ) : (
              <div className="menu-select">
                <span className="arrow">«</span>
                <span className="value">{item.items?.find(i => i.value === item.value)?.label || item.value}</span>
                <span className="arrow">»</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  if (!isOpen) return null

  return (
    <div className={`riescade-menu-overlay game-options ${visible ? 'visible' : ''}`}>
      <div className="riescade-menu-container">
        <div className="riescade-menu-header">
          <h2 className="riescade-menu-title">GAME OPTIONS</h2>
          <div className="riescade-menu-subtitle">{game.name}</div>
        </div>
        <div className="riescade-menu-list-container">{menuItemsNode}</div>
        <div className="riescade-menu-footer">
          <div className="riescade-menu-footer-actions">
            <div className="riescade-menu-footer-action">
              <span className="riescade-menu-footer-button">B</span>
              <span className="riescade-menu-footer-text">BACK</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
