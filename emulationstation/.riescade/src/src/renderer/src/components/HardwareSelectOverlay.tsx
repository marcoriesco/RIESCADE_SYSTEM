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
      <div className={`riescade-menu-overlay hardware-select ${visible ? 'visible' : ''}`}>
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

      <style dangerouslySetInnerHTML={{ __html: `
        .riescade-menu-overlay.hardware-select { 
          position: fixed; 
          top: 0; 
          left: 0; 
          right: 0; 
          bottom: 0; 
          background: rgba(0, 0, 0, 0.5); 
          z-index: 999999 !important; 
          display: flex; 
          justify-content: flex-end; 
          align-items: stretch; 
          opacity: 0; 
          transition: opacity 0.3s ease; 
          pointer-events: none; 
          padding-top: 0 !important;
        }
        .riescade-menu-overlay.hardware-select.visible { 
          opacity: 1; 
          pointer-events: auto; 
        }
        .riescade-menu-overlay.hardware-select .riescade-menu-container { 
          width: 30vw !important; 
          height: 100vh; 
          background: #dfdfdf; 
          display: flex; 
          flex-direction: column; 
          font-family: "Inter", sans-serif; 
          box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
          transform: translateX(100%); 
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); 
        }
        .riescade-menu-overlay.hardware-select.visible .riescade-menu-container { 
          transform: translateX(0); 
        }
        .riescade-menu-overlay.hardware-select .riescade-menu-header { 
          background: #eee; 
          padding: 25px; 
          text-align: center; 
        }
        .riescade-menu-overlay.hardware-select .riescade-menu-title { 
          margin: 0; 
          color: var(--theme-color, #3b82f6); 
          font-size: 1.2rem; 
          font-weight: 900; 
          letter-spacing: 3px; 
          text-transform: uppercase; 
        }
        .riescade-menu-overlay.hardware-select .riescade-menu-list-container { 
          background: #fff; 
          flex: 1;
          overflow-x: hidden;
          overflow-y: auto;
          max-height: 100% !important;
        }
          
        .riescade-menu-overlay.hardware-select .riescade-menu-list-container::-webkit-scrollbar { width: 6px; }
        .riescade-menu-overlay.hardware-select .riescade-menu-list-container::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 3px; }
        .riescade-menu-overlay.hardware-select .riescade-menu-list { max-height: 100% !important; }

        .riescade-menu-overlay.hardware-select .riescade-menu-item { 
          padding: 16px 30px; 
          display: flex; 
          flex-direction: column;
          align-items: flex-start; 
          justify-content: center; 
          border-bottom: 1px solid rgba(0,0,0,0.06); 
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); 
          color: #444; 
          cursor: pointer;
        }
        .riescade-menu-overlay.hardware-select .riescade-menu-item.selected { 
          background: var(--theme-color, #3b82f6); 
          color: #fff; 
          padding-left: 36px;
        }
        .riescade-menu-overlay.hardware-select .riescade-menu-item-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
          width: 100%;
        }
        .riescade-menu-overlay.hardware-select .riescade-menu-label { 
          font-weight: 800; 
          font-size: 1.05rem; 
          text-transform: uppercase; 
          letter-spacing: 1px;
        }
        .riescade-menu-overlay.hardware-select .riescade-menu-sublabel { 
          font-size: 1em; 
          color: #777; 
          line-height: 1.3;
          font-weight: 400;
          white-space: nowrap;
          transition: color 0.2s ease;
        }
        .riescade-menu-overlay.hardware-select .riescade-menu-item.selected .riescade-menu-sublabel { 
          color: rgba(255, 255, 255, 0.8); 
        }
        .riescade-menu-overlay.hardware-select .riescade-menu-footer { 
          background: #ddd; 
          padding: 10px 25px; 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
        }
        .riescade-menu-overlay.hardware-select .riescade-menu-footer-actions { 
          display: flex; 
          gap: 30px; 
          font-size: 0.8rem; 
          color: #444; 
          font-weight: 700; 
        }
        .riescade-menu-overlay.hardware-select .riescade-menu-footer-action { 
          display: flex; 
          align-items: center; 
          gap: 8px; 
        }
        .riescade-menu-overlay.hardware-select .riescade-menu-footer-button { 
          background: #333; 
          color: #fff; 
          border-radius: 50%; 
          width: 22px; 
          height: 22px; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-size: 12px; 
        }
        .riescade-menu-overlay.hardware-select .riescade-menu-footer-text {
          text-transform: uppercase;
        }
      ` }} />
    </>
  )
}
