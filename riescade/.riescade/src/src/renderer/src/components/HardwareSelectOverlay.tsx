import React, { useState, useEffect, useCallback } from 'react'
import { System } from '../App'

interface HardwareSelectProps {
  isOpen: boolean
  onClose: () => void
  systems: System[]
  onSelectSystem: (systemName: string) => void
}

export const HardwareSelectOverlay: React.FC<HardwareSelectProps> = ({
  isOpen, onClose, systems, onSelectSystem
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [visible, setVisible] = useState(false)

  const CATEGORIES_ORDER = [
    'arcade',
    'computer',
    'console',
    'extension',
    'pinball',
    'port',
    'portable',
    'system',
    'auto collection',
    'custom-collections'
  ]

  const CATEGORIES_DISPLAY: Record<string, string> = {
    'arcade': 'ARCADE',
    'computer': 'COMPUTER',
    'console': 'CONSOLE',
    'extension': 'EXTENSION',
    'pinball': 'PINBALL',
    'port': 'PORT',
    'portable': 'PORTABLE',
    'system': 'SYSTEM',
    'auto collection': 'AUTO COLLECTION',
    'custom-collections': 'CUSTOM COLLECTION'
  }

  // Group systems by hardware category
  const groups: Record<string, System[]> = {}
  systems.forEach(sys => {
    let hw = String(sys.hardware || 'console').toLowerCase()
    if (sys.name === 'collections') {
      hw = 'custom-collections'
    }
    if (!groups[hw]) groups[hw] = []
    groups[hw].push(sys)
  })

  // Build selectable categories list
  const menuItems: any[] = []
  CATEGORIES_ORDER.forEach(cat => {
    const sysList = groups[cat] || []
    if (sysList.length > 0) {
      // Sort alphabetically by fullname
      const sorted = [...sysList].sort((a, b) => 
        (a.fullname || a.name).localeCompare(b.fullname || b.name)
      )
      
      const subLabelText = sorted.map(sys => {
        if (sys.name === 'arcade' && sys.hardware === 'auto collection') {
          return 'ARCADE (GERAL)'
        }
        if (sys.name === 'auto-arcade') {
          return 'ARCADE (GERAL)'
        }
        return sys.fullname || sys.name.toUpperCase()
      }).join(', ')

      menuItems.push({
        id: `group_${cat}`,
        label: CATEGORIES_DISPLAY[cat] || cat.toUpperCase(),
        subLabel: subLabelText,
        systemName: sorted[0].name // Selecting this category points to its first system
      })
    }
  })

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0)
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [isOpen])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || menuItems.length === 0) return

      if (e.key === 'ArrowDown') {
        setSelectedIndex(prev => (prev + 1) % menuItems.length)
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex(prev => (prev - 1 + menuItems.length) % menuItems.length)
      } else if (e.key === 'Enter') {
        const item = menuItems[selectedIndex]
        if (item) {
          onSelectSystem(item.systemName)
          onClose()
        }
      } else if (e.key === 'Backspace' || e.key === 'Escape' || e.key === 'Control') {
        onClose()
      }
    },
    [isOpen, selectedIndex, menuItems, onSelectSystem, onClose]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!isOpen) return null

  return (
    <>
      <div className={`riescade-overlay riescade-menu-overlay hardware-select ${visible ? 'visible' : ''}`}>
        <div className="riescade-menu-container">
          <div className="riescade-menu-header">
            <h2 className="riescade-menu-title">IR PARA O HARDWARE</h2>
          </div>
          <div className="riescade-menu-list-container">
            <div className="riescade-menu-list">
              {menuItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`riescade-menu-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectSystem(item.systemName)
                    onClose()
                  }}
                >
                  <div className="riescade-menu-item-content">
                    <span className="riescade-menu-label">
                      {item.label}
                    </span>
                    <span className="riescade-menu-sublabel">
                      {item.subLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
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


    </>
  )
}
