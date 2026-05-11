import React, { useEffect, useState } from 'react'

export const WebMenuElement: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [view, setView] = useState('main') // 'main' or 'ui_settings', etc.

  const menuItems: any = {
    main: [
      { id: 'close', label: 'CONTINUE', value: '' },
      { id: 'ui_settings', label: 'UI SETTINGS', value: '>', submenu: 'ui_settings' },
      { id: 'settings_sound', label: 'SOUND SETTINGS', value: '>', submenu: 'placeholder' },
      { id: 'settings_network', label: 'NETWORK SETTINGS', value: '>', submenu: 'placeholder' },
      { id: 'scraper', label: 'SCRAPER', value: '>', submenu: 'placeholder' },
      { id: 'updates', label: 'UPDATES', value: '>', submenu: 'placeholder' },
      { id: 'quit', label: 'QUIT', value: '' }
    ],
    ui_settings: [
      { id: 'back', label: 'BACK', value: '' },
      { id: 'theme', label: 'THEME', value: 'RIESCADE DEFAULT' },
      { id: 'transition', label: 'TRANSITION STYLE', value: 'FADE' },
      { id: 'screensaver', label: 'SCREENSAVER', value: 'DIM' }
    ],
    placeholder: [
      { id: 'back', label: 'BACK', value: '' },
      { id: 'info', label: 'NOT IMPLEMENTED', value: '...' }
    ]
  }

  const currentItems = menuItems[view] || menuItems.main

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        setSelectedIndex(prev => (prev + 1) % currentItems.length)
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex(prev => (prev - 1 + currentItems.length) % currentItems.length)
      } else if (e.key === 'Backspace') {
        if (view !== 'main') {
          setView('main')
          setSelectedIndex(0)
        }
      } else if (e.key === 'Enter') {
        const selected = currentItems[selectedIndex]
        
        if (selected.id === 'back') {
          setView('main')
          setSelectedIndex(0)
        } else if (selected.submenu) {
          setView(selected.submenu)
          setSelectedIndex(0)
        } else if (selected.id === 'close') {
          // Send Space key to close the menu globally via App.tsx
          document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
        } else if (selected.id === 'quit') {
          window.close()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedIndex, view, currentItems])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {currentItems.map((item, index) => {
        const isSelected = index === selectedIndex
        return (
          <div 
            key={item.id} 
            className={`riescade-menu-item ${isSelected ? 'selected' : ''}`}
          >
            <span>{item.label}</span>
            {item.value && <span className="menu-item-value">{item.value}</span>}
          </div>
        )
      })}
    </div>
  )
}
