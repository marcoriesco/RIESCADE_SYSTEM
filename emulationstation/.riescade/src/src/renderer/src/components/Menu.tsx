import React, { useState, useEffect, useCallback } from 'react'
import { WebThemeRenderer } from './theme/WebThemeRenderer'
import { InputConfigOverlay } from './InputConfigOverlay'

interface MenuItem {
  id: string
  label: string
  onClick?: () => void
  submenu?: MenuItem[]
  type?: 'toggle' | 'select' | 'slider' | 'action' | 'info' | 'group'
  settingName?: string
  settingType?: 'string' | 'bool' | 'int' | 'float'
  options?: { label: string; value: any }[]
  value?: any
  min?: number
  max?: number
  step?: number
  suffix?: string
}

interface MenuProps {
  isOpen: boolean
  onClose: () => void
  theme?: any
  themeData?: any
}

export const Menu: React.FC<MenuProps> = ({ isOpen, onClose, theme, themeData }) => {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [themes, setThemes] = useState<string[]>([])
  const [activeMenuStack, setActiveMenuStack] = useState<{ items: MenuItem[]; title: string }[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [showInputConfig, setShowInputConfig] = useState(false)

  const getSetting = (name: string, fallback: any = ''): any => {
    return settings[name]?.value ?? fallback
  }

  const saveSetting = async (name: string, value: any, type: string) => {
    await window.api.saveSetting(name, value, type)
    setSettings(prev => ({
      ...prev,
      [name]: { value: String(value), type }
    }))
  }

  useEffect(() => {
    if (isOpen) {
      window.api.getSettings().then(setSettings)
      window.api.getThemes().then(setThemes)
      setActiveMenuStack([{ items: getMainMenuItems(), title: 'MAIN MENU' }])
      setSelectedIndex(0)
      // Animate in
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [isOpen])

  // Update menu when settings/themes change
  useEffect(() => {
    if (isOpen && activeMenuStack.length > 0) {
      setActiveMenuStack(prev => {
        const updated = [...prev]
        updated[0] = { ...updated[0], items: getMainMenuItems() }
        return updated
      })
    }
  }, [settings, themes])

  const handleToggle = (item: MenuItem) => {
    if (item.settingName && item.settingType === 'bool') {
      const current = getSetting(item.settingName, 'false')
      const newVal = current === 'true' || current === true ? 'false' : 'true'
      saveSetting(item.settingName, newVal, 'bool')
    }
  }

  const handleSelect = (item: MenuItem, direction: 1 | -1) => {
    if (item.options && item.options.length > 0 && item.settingName) {
      const current = getSetting(item.settingName, item.options[0].value)
      let idx = item.options.findIndex(o => o.value === current)
      if (idx === -1) idx = 0
      const next = (idx + direction + item.options.length) % item.options.length
      saveSetting(item.settingName, item.options[next].value, item.settingType || 'string')
    }
  }

  const handleSlider = (item: MenuItem, direction: 1 | -1) => {
    if (item.settingName && item.settingType === 'int') {
      const min = item.min ?? 0
      const max = item.max ?? 100
      const step = item.step ?? 5
      const current = parseInt(getSetting(item.settingName, Math.floor((min + max) / 2)))
      let newVal = current + direction * step
      newVal = Math.max(min, Math.min(max, newVal))
      saveSetting(item.settingName, newVal, 'int')
    }
  }

  const getMainMenuItems = (): MenuItem[] => [
    {
      id: 'game_settings', label: 'GAME SETTINGS', submenu: [
        { id: 'game_ratio', label: 'GAME ASPECT RATIO', type: 'select', settingName: 'global.ratio', options: [
          { label: 'AUTO', value: 'auto' }, { label: '4/3', value: '4/3' }, { label: '16/9', value: '16/9' },
          { label: '16/10', value: '16/10' }, { label: 'FULL', value: 'full' }
        ]},
        { id: 'smooth_games', label: 'SMOOTH GAMES', type: 'toggle', settingName: 'global.smooth', settingType: 'bool' },
        { id: 'rewind', label: 'REWIND', type: 'toggle', settingName: 'global.rewind', settingType: 'bool' },
        { id: 'autosave', label: 'AUTO SAVE/LOAD', type: 'toggle', settingName: 'global.autosave', settingType: 'bool' },
        { id: 'shaders', label: 'SHADER SET', type: 'select', settingName: 'global.shaderset', options: [
          { label: 'NONE', value: 'none' }, { label: 'RIESCADE', value: '[riescade]' },
          { label: 'RETRO', value: 'retro' }, { label: 'SCANLINES', value: 'scanlines' }
        ]},
        { id: 'decorations', label: 'DECORATIONS', type: 'select', settingName: 'global.bezel', options: [
          { label: 'NONE', value: 'none' }, { label: 'AUTO', value: 'auto' },
          { label: 'THE BEZEL PROJECT', value: 'thebezelproject' }
        ]}
      ]
    },
    {
      id: 'ui_settings', label: 'USER INTERFACE', submenu: [
        { id: 'theme_set', label: 'THEME', type: 'select', settingName: 'ThemeSet',
          options: themes.length ? themes.map(t => ({ label: t.toUpperCase(), value: t })) : [{ label: 'DEFAULT', value: 'default' }]
        },
        { id: 'language', label: 'LANGUAGE', type: 'select', settingName: 'Language', options: [
          { label: 'ENGLISH', value: 'en_US' }, { label: 'PORTUGUÊS', value: 'pt_BR' },
          { label: 'ESPAÑOL', value: 'es_ES' }, { label: 'FRANÇAIS', value: 'fr_FR' }
        ]},
        { id: 'screensaver_time', label: 'SCREENSAVER', type: 'select', settingName: 'ScreenSaverTime', options: [
          { label: 'OFF', value: '0' }, { label: '1 MIN', value: '60000' },
          { label: '5 MIN', value: '300000' }
        ]}
      ]
    },
    {
      id: 'sound_settings', label: 'SOUND', submenu: [
        { id: 'system_volume', label: 'SYSTEM VOLUME', type: 'slider', settingName: 'Volume', settingType: 'int', min: 0, max: 100, step: 5, suffix: '%' },
        { id: 'music_volume', label: 'MUSIC VOLUME', type: 'slider', settingName: 'MusicVolume', settingType: 'int', min: 0, max: 100, step: 5, suffix: '%' },
        { id: 'frontend_music', label: 'FRONTEND MUSIC', type: 'toggle', settingName: 'audio.bgmusic', settingType: 'bool' },
        { id: 'video_audio', label: 'VIDEO PREVIEW AUDIO', type: 'toggle', settingName: 'VideoAudio', settingType: 'bool' }
      ]
    },
    {
      id: 'system_settings', label: 'SYSTEM', submenu: [
        { id: 'clock_format', label: '12-HOUR CLOCK', type: 'toggle', settingName: 'ClockMode12', settingType: 'bool' },
        { id: 'show_fps', label: 'SHOW FRAMERATE', type: 'toggle', settingName: 'DrawFramerate', settingType: 'bool' },
        { id: 'vram_limit', label: 'VRAM LIMIT', type: 'slider', settingName: 'MaxVRAM', settingType: 'int', min: 40, max: 1000, step: 10, suffix: ' Mb' }
      ]
    },
    {
      id: 'controller_settings', label: 'CONTROLLERS', submenu: [
        { id: 'configure_input', label: 'CONFIGURE INPUT', type: 'action', onClick: () => setShowInputConfig(true) }
      ]
    },
    { id: 'quit', label: 'QUIT', type: 'action', onClick: () => window.api?.executeCommand('exit-frontend') }
  ]

  const currentMenu = activeMenuStack[activeMenuStack.length - 1]?.items || []
  const menuTitle = activeMenuStack[activeMenuStack.length - 1]?.title || 'MAIN MENU'

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || showInputConfig) return
      if (currentMenu.length === 0) return

      if (e.key === 'ArrowDown') {
        setSelectedIndex(prev => {
          let next = (prev + 1) % currentMenu.length
          while (currentMenu[next]?.type === 'group' && next !== prev) next = (next + 1) % currentMenu.length
          return next
        })
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex(prev => {
          let next = (prev - 1 + currentMenu.length) % currentMenu.length
          while (currentMenu[next]?.type === 'group' && next !== prev) next = (next - 1 + currentMenu.length) % currentMenu.length
          return next
        })
      } else if (e.key === 'Enter') {
        const item = currentMenu[selectedIndex]
        if (item.submenu) {
          setActiveMenuStack(prev => [...prev, { items: item.submenu!, title: item.label }])
          setSelectedIndex(0)
        } else if (item.type === 'toggle') {
          handleToggle(item)
        } else if (item.onClick) {
          item.onClick()
        }
      } else if (e.key === 'ArrowRight') {
        const item = currentMenu[selectedIndex]
        if (item.type === 'select') handleSelect(item, 1)
        else if (item.type === 'slider') handleSlider(item, 1)
      } else if (e.key === 'ArrowLeft') {
        const item = currentMenu[selectedIndex]
        if (item.type === 'select') handleSelect(item, -1)
        else if (item.type === 'slider') handleSlider(item, -1)
      } else if (e.key === 'Backspace' || e.key === 'Escape') {
        if (activeMenuStack.length > 1) {
          setActiveMenuStack(prev => prev.slice(0, -1))
          setSelectedIndex(0)
        } else {
          onClose()
        }
      }
    },
    [isOpen, currentMenu, selectedIndex, activeMenuStack, onClose, settings]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const renderItemValue = (item: MenuItem) => {
    const val = item.value !== undefined ? item.value : (item.settingName ? getSetting(item.settingName, false) : undefined)

    if (item.type === 'toggle') {
      const isOn = val === 'true' || val === true
      return (
        <div className={`menu-toggle ${isOn ? 'on' : 'off'}`}>
          <div className="toggle-thumb" />
        </div>
      )
    }
    if (item.type === 'select') {
      const currentVal = val !== undefined ? val : item.options?.[0]?.value
      const label = item.options?.find(o => o.value === currentVal)?.label || currentVal
      return (
        <div className="menu-select">
          <span className="arrow">«</span>
          <span className="value">{label}</span>
          <span className="arrow">»</span>
        </div>
      )
    }
    if (item.type === 'slider') {
      return <div className="menu-slider">{getSetting(item.settingName!, item.min ?? 0)}{item.suffix || '%'}</div>
    }
    if (item.type === 'info') {
      return <div className="menu-info">{item.value}</div>
    }
    if (item.submenu) {
      return <span style={{ opacity: 0.5, fontSize: '1.2em' }}>›</span>
    }
    return null
  }

  const menuItemsNode = (
    <div className="menu-list" style={{ padding: 0, background: 'transparent', height: '100%', overflowY: 'auto' }}>
      {currentMenu.map((item, index) => {
        if (item.type === 'group') {
          return (
            <div key={item.id} className="menu-group" style={{
              padding: '20px 30px 10px', color: '#888', fontSize: '0.8rem',
              fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase',
              borderBottom: '1px solid rgba(0,0,0,0.05)'
            }}>
              {item.label}
            </div>
          )
        }
        return (
          <div
            key={item.id}
            className={`menu-item ${index === selectedIndex ? 'selected' : ''}`}
            style={{
              padding: '12px 30px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', cursor: 'pointer',
              background: index === selectedIndex ? '#3b82f6' : 'transparent',
              color: index === selectedIndex ? '#fff' : '#444',
              borderBottom: '1px solid rgba(0,0,0,0.1)',
              transition: 'background 0.15s ease, color 0.15s ease'
            }}
          >
            <span style={{ fontWeight: index === selectedIndex ? 800 : 500, fontSize: '0.95rem', textTransform: 'uppercase' }}>
              {item.label}
            </span>
            <div className="menu-value">{renderItemValue(item)}</div>
          </div>
        )
      })}
    </div>
  )

  if (!isOpen) return null

  return (
    <>
      <div
        className="menu-overlay"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: theme?.views?.menu ? 'transparent' : 'rgba(0,0,0,0.85)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.2s ease'
        }}
      >
        {theme?.isWebTheme && theme.views?.menu ? (
          <div style={{ width: '100%', height: '100%' }}>
            <WebThemeRenderer
              htmlContent={theme.views.menu}
              data={{ ...themeData, menuTitle }}
              themePath={theme.path}
              menuItemsNode={menuItemsNode}
            />
          </div>
        ) : (
          <div
            className="menu-container"
            style={{
              width: '600px', background: '#dfdfdf', borderRadius: 0,
              boxShadow: '0 40px 100px rgba(0,0,0,0.9)',
              display: 'flex', flexDirection: 'column',
              border: '4px solid #fff', fontFamily: '"Inter", sans-serif',
              transform: visible ? 'scale(1)' : 'scale(0.95)',
              opacity: visible ? 1 : 0,
              transition: 'transform 0.2s ease, opacity 0.2s ease'
            }}
          >
            <div style={{
              background: '#eee', padding: '15px 25px',
              borderBottom: '2px solid #aaa', textAlign: 'center'
            }}>
              <h2 style={{ margin: 0, color: '#333', fontSize: '1.2rem', fontWeight: 900, letterSpacing: '3px', textTransform: 'uppercase' }}>
                {menuTitle}
              </h2>
            </div>

            <div style={{ height: '60vh', background: '#fff' }}>
              {menuItemsNode}
            </div>

            <div style={{
              background: '#ddd', padding: '10px 25px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderTop: '2px solid #aaa'
            }}>
              <div style={{ display: 'flex', gap: '30px', fontSize: '0.8rem', color: '#444', fontWeight: 700 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#333', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>A</span> CHOOSE
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#333', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>B</span> BACK
                </div>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 600 }}>
                RIESCADE 2.0
              </div>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .menu-toggle { width: 40px; height: 20px; background: #ccc; border-radius: 10px; position: relative; transition: background 0.15s ease; }
        .menu-toggle.on { background: #4ade80; }
        .menu-toggle.on .toggle-thumb { transform: translateX(20px); }
        .toggle-thumb { width: 16px; height: 16px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: transform 0.15s ease; }
        .menu-select { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 0.9rem; }
        .menu-select .arrow { opacity: 0.3; }
        .menu-item.selected .menu-select .arrow { opacity: 1; }
        .menu-list::-webkit-scrollbar { width: 6px; }
        .menu-list::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
      ` }} />
      {showInputConfig && <InputConfigOverlay onClose={() => setShowInputConfig(false)} />}
    </>
  )
}
