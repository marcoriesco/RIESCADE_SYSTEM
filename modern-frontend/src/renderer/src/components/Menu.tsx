import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettingsStore } from '../store/useSettingsStore'
import { useLibraryStore } from '../store/useLibraryStore'
import { ChevronRight } from 'lucide-react'

interface MenuItem {
  id: string
  label: string
  onClick?: () => void
  submenu?: MenuItem[]
  type?: 'toggle' | 'select' | 'slider' | 'action' | 'info' | 'group'
  settingName?: string
  settingType?: 'string' | 'bool' | 'int' | 'float'
  options?: { label: string, value: any }[]
  value?: any
  description?: string
}

interface MenuProps {
  isOpen: boolean
  onClose: () => void
}

export const Menu: React.FC<MenuProps> = ({ isOpen, onClose }) => {
  const { settings, fetchSettings, saveSetting, getSetting } = useSettingsStore()
  const { themes, fetchThemes } = useLibraryStore()
  const [activeMenuStack, setActiveMenuStack] = useState<{ items: MenuItem[], title: string }[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (isOpen) {
      fetchSettings()
      fetchThemes()
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Update menu stack when themes or settings are loaded
  useEffect(() => {
    if (isOpen && activeMenuStack.length <= 1) {
      setActiveMenuStack([{ items: getMainMenuItems(), title: 'MAIN MENU' }])
    }
  }, [isOpen, themes, settings])

  const handleToggle = (item: MenuItem) => {
    if (item.settingName && item.settingType === 'bool') {
      const currentValue = getSetting(item.settingName, false)
      saveSetting(item.settingName, !currentValue, 'bool')
    }
  }

  const handleSelect = (item: MenuItem, direction: 1 | -1) => {
    if (item.settingName && item.options && item.options.length > 0) {
      const currentValue = getSetting(item.settingName, item.options[0].value)
      const currentIndex = item.options.findIndex(o => o.value === currentValue)
      const nextIndex = (currentIndex + direction + item.options.length) % item.options.length
      saveSetting(item.settingName, item.options[nextIndex].value, item.settingType as any || 'string')
    }
  }

  const getMainMenuItems = (): MenuItem[] => [
    { id: 'scraper', label: 'SCRAPER', submenu: [
      { id: 'scrape_from', label: 'SCRAPE FROM', type: 'select', settingName: 'Scraper', options: [
        { label: 'SCREEN SCRAPER', value: 'ScreenScraper' },
        { label: 'THE GAMES DB', value: 'TheGamesDB' }
      ]},
      { id: 'scrape_ratings', label: 'SCRAPE RATINGS', type: 'toggle', settingName: 'ScraperRatings', settingType: 'bool' },
      { id: 'scrape_now', label: 'SCRAPE NOW', type: 'action', onClick: () => console.log('Scrape now') }
    ]},
    { id: 'updates', label: 'UPDATES & DOWNLOADS', submenu: [
      { id: 'content_downloader', label: 'CONTENT DOWNLOADER', type: 'action' },
      { id: 'themes_installer', label: 'THEMES', type: 'action' },
      { id: 'bezel_project', label: 'THE BEZEL PROJECT', type: 'action' },
      { id: 'check_updates', label: 'CHECK FOR UPDATES', type: 'toggle', settingName: 'updates.enabled', settingType: 'bool' },
      { id: 'update_type', label: 'UPDATE TYPE', type: 'select', settingName: 'updates.type', options: [
        { label: 'STABLE', value: 'stable' },
        { label: 'BETA', value: 'beta' }
      ]}
    ]},
    { id: 'sound_settings', label: 'SOUND SETTINGS', submenu: [
      { id: 'system_volume', label: 'SYSTEM VOLUME', type: 'slider', settingName: 'Volume', settingType: 'int' },
      { id: 'music_volume', label: 'MUSIC VOLUME', type: 'slider', settingName: 'MusicVolume', settingType: 'int' },
      { id: 'frontend_music', label: 'FRONTEND MUSIC', type: 'toggle', settingName: 'audio.bgmusic', settingType: 'bool' },
      { id: 'display_titles', label: 'DISPLAY SONG TITLES', type: 'toggle', settingName: 'audio.display_titles', settingType: 'bool' },
      { id: 'navigation_sounds', label: 'ENABLE NAVIGATION SOUNDS', type: 'toggle', settingName: 'EnableSounds', settingType: 'bool' },
      { id: 'video_audio', label: 'ENABLE VIDEO PREVIEW AUDIO', type: 'toggle', settingName: 'VideoAudio', settingType: 'bool' }
    ]},
    { id: 'ui_settings', label: 'USER INTERFACE SETTINGS', submenu: [
      { id: 'theme_set', label: 'THEME SET', type: 'select', settingName: 'ThemeSet', options: themes.map(t => ({ label: t.toUpperCase(), value: t })) },
      { id: 'menu_font_scale', label: 'MENU FONT SCALE', type: 'select', settingName: 'MenuFontScale', options: [
        { label: 'AUTO', value: '' }, { label: '50%', value: '0.5' }, { label: '100%', value: '1.0' }, { label: '150%', value: '1.5' }, { label: '200%', value: '2.0' }
      ]},
      { id: 'fullscreen_menus', label: 'FULL SCREEN MENUS', type: 'select', settingName: 'FullScreenMenu', options: [
        { label: 'AUTO', value: '' }, { label: 'YES', value: 'true' }, { label: 'NO', value: 'false' }
      ]},
      { id: 'carousel_transitions', label: 'CAROUSEL TRANSITIONS', type: 'toggle', settingName: 'MoveCarousel', settingType: 'bool' },
      { id: 'quick_system_select', label: 'QUICK SYSTEM SELECT', type: 'toggle', settingName: 'QuickSystemSelect', settingType: 'bool' },
      { id: 'onscreen_keyboard', label: 'ON-SCREEN KEYBOARD', type: 'toggle', settingName: 'UseOSK', settingType: 'bool' }
    ]},
    { id: 'game_settings', label: 'GAME SETTINGS', submenu: [
      { id: 'update_gamelists', label: 'UPDATE GAMELISTS', type: 'action', onClick: () => window.api.executeCommand('update-gamelists') },
      { id: 'autosave', label: 'AUTO SAVE/LOAD', type: 'toggle', settingName: 'global.autosave', settingType: 'bool' },
      { id: 'game_ratio', label: 'GAME ASPECT RATIO', type: 'select', settingName: 'global.ratio', options: [
        { label: 'AUTO', value: 'auto' }, { label: '4/3', value: '4/3' }, { label: '16/9', value: '16/9' }, { label: '21/9', value: '21/9' }, { label: 'FULL', value: 'full' }
      ]},
      { id: 'video_mode', label: 'VIDEO MODE', type: 'select', settingName: 'global.videomode', options: [
        { label: 'AUTO', value: 'auto' }, { label: '1080P', value: '1920x1080' }, { label: '720P', value: '1280x720' }
      ]},
      { id: 'smooth_games', label: 'SMOOTH GAMES (BILINEAR)', type: 'toggle', settingName: 'global.smooth', settingType: 'bool' },
      { id: 'rewind', label: 'REWIND', type: 'toggle', settingName: 'global.rewind', settingType: 'bool' },
      { id: 'integerscale', label: 'INTEGER SCALING', type: 'toggle', settingName: 'global.integerscale', settingType: 'bool' },
      { id: 'latency_reduction', label: 'LATENCY REDUCTION', submenu: [
        { id: 'runahead', label: 'RUN-AHEAD FRAMES', type: 'select', settingName: 'global.runahead', options: [
            { label: 'AUTO', value: '' }, { label: 'NONE', value: '0' }, { label: '1', value: '1' }, { label: '2', value: '2' }
        ]}
      ]}
    ]},
    { id: 'retroachievements', label: 'RETROACHIEVEMENTS', submenu: [
      { id: 'ra_enabled', label: 'ENABLE RETROACHIEVEMENTS', type: 'toggle', settingName: 'global.retroachievements', settingType: 'bool' },
      { id: 'ra_user', label: 'USERNAME', type: 'info', value: getSetting('global.retroachievements.username', 'NOT SET') },
      { id: 'ra_hardcore', label: 'HARDCORE MODE', type: 'toggle', settingName: 'global.retroachievements.hardcore', settingType: 'bool' }
    ]},
    { id: 'controllers', label: 'CONTROLLER & BLUETOOTH SETTINGS', submenu: [
      { id: 'configure_input', label: 'CONFIGURE INPUT', type: 'action' },
      { id: 'pair_bluetooth', label: 'PAIR A BLUETOOTH DEVICE', type: 'action' },
      { id: 'p1_controller', label: 'P1 CONTROLLER', type: 'select', settingName: 'p1controller', options: [{ label: 'AUTO', value: 'auto' }] }
    ]},
    { id: 'network', label: 'NETWORK SETTINGS', submenu: [
        { id: 'ip_address', label: 'IP ADDRESS', type: 'info', value: '192.168.1.15' },
        { id: 'status', label: 'INTERNET STATUS', type: 'info', value: 'CONNECTED' },
        { id: 'wifi_enabled', label: 'ENABLE WIFI', type: 'toggle', settingName: 'wifi.enabled', settingType: 'bool' },
        { id: 'wifi_ssid', label: 'WIFI SSID', type: 'select', settingName: 'wifi.ssid', options: [{ label: 'HOME-WIFI', value: 'home' }] }
    ]},
    { id: 'system_settings', label: 'SYSTEM SETTINGS', submenu: [
      { id: 'information', label: 'INFORMATION', type: 'action' },
      { id: 'brightness', label: 'BRIGHTNESS', type: 'slider', settingName: 'display.brightness', settingType: 'int' },
      { id: 'language', label: 'LANGUAGE', type: 'select', settingName: 'system.language', options: [
        { label: 'ENGLISH', value: 'en_US' }, { label: 'PORTUGUÊS (BR)', value: 'pt_BR' }, { label: 'ESPAÑOL', value: 'es_ES' }, { label: 'FRANÇAIS', value: 'fr_FR' }
      ]},
      { id: 'timezone', label: 'TIME ZONE', type: 'select', settingName: 'system.timezone', options: [{ label: 'AUTO', value: 'auto' }] },
      { id: 'clock_format', label: 'SHOW CLOCK IN 12-HOUR FORMAT', type: 'toggle', settingName: 'ClockMode12', settingType: 'bool' },
      { id: 'storage_device', label: 'STORAGE DEVICE', type: 'select', settingName: 'StorageDevice', options: [
        { label: 'INTERNAL', value: 'internal' }, { label: 'ANY EXTERNAL', value: 'external' }
      ]}
    ]},
    { id: 'developer', label: 'FRONTEND DEVELOPER OPTIONS', submenu: [
      { id: 'vram_limit', label: 'VRAM LIMIT', type: 'slider', settingName: 'MaxVRAM', settingType: 'int' },
      { id: 'show_fps', label: 'SHOW FPS', type: 'toggle', settingName: 'DrawFramerate', settingType: 'bool' },
      { id: 'log_level', label: 'LOG LEVEL', type: 'select', settingName: 'LogLevel', options: [
        { label: 'DEFAULT', value: 'default' }, { label: 'DEBUG', value: 'debug' }, { label: 'WARNING', value: 'warning' }
      ]}
    ]},
    { id: 'quit', label: 'QUIT', type: 'action', onClick: () => window.api.executeCommand('exit-frontend') }
  ]

  const currentMenu = activeMenuStack[activeMenuStack.length - 1]?.items || []
  const menuTitle = activeMenuStack[activeMenuStack.length - 1]?.title || 'MAIN MENU'

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return
    if (currentMenu.length === 0) return

    if (e.key === 'ArrowDown') {
      setSelectedIndex(prev => (prev + 1) % currentMenu.length)
    } else if (e.key === 'ArrowUp') {
      setSelectedIndex(prev => (prev - 1 + currentMenu.length) % currentMenu.length)
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
        if (item.type === 'select') {
            handleSelect(item, 1)
        }
    } else if (e.key === 'ArrowLeft') {
        const item = currentMenu[selectedIndex]
        if (item.type === 'select') {
            handleSelect(item, -1)
        }
    } else if (e.key === 'Backspace' || e.key === 'Escape') {
      if (activeMenuStack.length > 1) {
        setActiveMenuStack(prev => prev.slice(0, -1))
        setSelectedIndex(0)
      } else {
        onClose()
      }
    }
  }, [isOpen, currentMenu, selectedIndex, activeMenuStack, onClose, getSetting, saveSetting])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const renderItemValue = (item: MenuItem) => {
    if (item.type === 'toggle') {
      return (
        <div className={`menu-toggle ${getSetting(item.settingName!, false) ? 'on' : 'off'}`}>
          <div className="toggle-thumb" />
        </div>
      )
    }
    if (item.type === 'select') {
      const val = getSetting(item.settingName!, item.options?.[0]?.value)
      const label = item.options?.find(o => o.value === val)?.label || val
      return (
        <div className="menu-select">
          <span className="arrow">«</span>
          <span className="value">{label}</span>
          <span className="arrow">»</span>
        </div>
      )
    }
    if (item.type === 'slider') {
        return <div className="menu-slider">{getSetting(item.settingName!, 50)}%</div>
    }
    if (item.type === 'info') {
        return <div className="menu-info">{item.value}</div>
    }
    if (item.submenu) {
      return <ChevronRight size={18} opacity={0.5} />
    }
    return null
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="menu-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <motion.div 
            className="menu-container"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            style={{
              width: '600px',
              background: '#dfdfdf',
              borderRadius: '0px',
              boxShadow: '0 40px 100px rgba(0,0,0,0.9)',
              display: 'flex',
              flexDirection: 'column',
              border: '4px solid #ffffff',
              fontFamily: '"Inter", sans-serif'
            }}
          >
            <div className="menu-header" style={{
              background: '#eeeeee',
              padding: '15px 25px',
              borderBottom: '2px solid #aaaaaa',
              textAlign: 'center'
            }}>
              <h2 style={{ margin: 0, color: '#333333', fontSize: '1.2rem', fontWeight: 900, letterSpacing: '3px', textTransform: 'uppercase' }}>
                {menuTitle}
              </h2>
            </div>

            <div className="menu-list" style={{ padding: '0', background: '#ffffff', maxHeight: '70vh', overflowY: 'auto' }}>
              {currentMenu.map((item, index) => (
                <div 
                  key={item.id}
                  className={`menu-item ${index === selectedIndex ? 'selected' : ''}`}
                  style={{
                    padding: '12px 30px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: index === selectedIndex ? '#3b82f6' : 'transparent',
                    color: index === selectedIndex ? '#ffffff' : '#444444',
                    borderBottom: '1px solid #eeeeee'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ fontWeight: index === selectedIndex ? 800 : 500, fontSize: '0.95rem', textTransform: 'uppercase' }}>
                        {item.label}
                    </span>
                  </div>
                  <div className="menu-value">
                    {renderItemValue(item)}
                  </div>
                </div>
              ))}
            </div>

            <div className="menu-footer" style={{
              background: '#dddddd',
              padding: '10px 25px',
              display: 'flex',
              gap: '30px',
              fontSize: '0.8rem',
              color: '#444444',
              fontWeight: 700,
              borderTop: '2px solid #aaaaaa'
            }}>
              <div className="help-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: '#333', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>A</span> SELECT
              </div>
              <div className="help-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: '#333', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>B</span> BACK
              </div>
            </div>
          </motion.div>

          <style dangerouslySetInnerHTML={{ __html: `
            .menu-toggle {
              width: 40px;
              height: 20px;
              background: #cccccc;
              border-radius: 10px;
              position: relative;
            }
            .menu-toggle.on { background: #4ade80; }
            .menu-toggle.on .toggle-thumb { transform: translateX(20px); }
            .toggle-thumb {
              width: 16px;
              height: 16px;
              background: #ffffff;
              border-radius: 50%;
              position: absolute;
              top: 2px;
              left: 2px;
              transition: transform 0.1s ease-out;
            }
            
            .menu-select {
              display: flex;
              align-items: center;
              gap: 10px;
              font-weight: 800;
              font-size: 0.9rem;
            }
            .menu-select .arrow { opacity: 0.3; }
            .menu-item.selected .menu-select .arrow { opacity: 1; }
            
            .menu-list::-webkit-scrollbar { width: 6px; }
            .menu-list::-webkit-scrollbar-thumb { background: #cccccc; border-radius: 3px; }
            
            .menu-item.selected {
              box-shadow: inset 0 0 10px rgba(0,0,0,0.1);
            }
          `}} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
