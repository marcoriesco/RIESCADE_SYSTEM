import React, { useState, useEffect, useCallback } from 'react'
import { WebThemeRenderer } from './theme/WebThemeRenderer'
// import { InputConfigOverlay } from './InputConfigOverlay'

const localeModules = import.meta.glob('../locales/*.json', { eager: true })
const locales: Record<string, any> = {}
Object.entries(localeModules).forEach(([path, module]: [string, any]) => {
  const lang = path.split('/').pop()?.replace('.json', '')
  if (lang) locales[lang] = module.default || module
})

interface MenuItem {
  id: string
  label: string
  onClick?: () => void
  submenu?: MenuItem[]
  type?: 'toggle' | 'select' | 'slider' | 'action' | 'info' | 'group' | 'input'
  settingName?: string
  settingType?: 'string' | 'bool' | 'int' | 'float'
  options?: { label: string; value: any }[]
  value?: any
  min?: number
  max?: number
  step?: number
  suffix?: string
  isPassword?: boolean
  showCount?: boolean
}

interface MenuProps {
  isOpen: boolean
  onClose: () => void
  theme?: any
  themeData?: any
  allSystems?: any[]
}

export const Menu: React.FC<MenuProps> = ({ isOpen, onClose, theme, themeData, allSystems = [] }) => {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [pendingSettings, setPendingSettings] = useState<Record<string, any>>({})
  const [themeSettings, setThemeSettings] = useState<Record<string, string>>({})
  const [themes, setThemes] = useState<string[]>([])
  const [activeMenuStack, setActiveMenuStack] = useState<{ items: MenuItem[]; title: string }[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [showInputConfig, setShowInputConfig] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [modalSelectedIndex, setModalSelectedIndex] = useState(0)
  const [versions, setVersions] = useState({ app: '2.0.0', es: '' })
  const [showInputModal, setShowInputModal] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [activeInputItem, setActiveInputItem] = useState<MenuItem | null>(null)

  const getSetting = (name: string, fallback: any = ''): any => {
    return (pendingSettings[name] !== undefined ? pendingSettings[name] : settings[name]?.value) ?? fallback
  }

  const currentLang = getSetting('Language', 'en_US')
  const t = (key: string): string => locales[currentLang]?.[key] || key

  const getThemeSetting = (name: string, fallback: any = ''): any => {
    return themeSettings[name] ?? fallback
  }

  const updateSetting = (name: string, value: any) => {
    const stringVal = String(value)
    if (String(getSetting(name)) === stringVal) {
      setPendingSettings(prev => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    } else {
      setPendingSettings(prev => ({ ...prev, [name]: stringVal }))
    }
  }

  const updateThemeSetting = (name: string, value: any) => {
    const stringVal = String(value)
    // For theme settings, we don't have the "original" state easily available in a single object like settings,
    // but we can check if it matches what was loaded initially.
    setThemeSettings(prev => ({ ...prev, [name]: stringVal }))
  }

  const handleSave = async () => {
    // 1. Save global settings
    for (const [name, value] of Object.entries(pendingSettings)) {
      const type = settings[name]?.type || 'string'
      await window.api.saveSetting(name, value, type)
    }

    // 2. Save theme settings
    if (theme?.name) {
      for (const [key, value] of Object.entries(themeSettings)) {
        await window.api.saveThemeSetting(theme.name, key, value)
      }
    }

    // Check if theme changed or if reload is needed
    if (pendingSettings['RIESCADE.ThemeSet']) {
      window.api.executeCommand('reload-frontend')
    } else {
      // Just close and refresh
      onClose()
      window.api.executeCommand('reload-frontend')
    }
  }

  useEffect(() => {
    if (isOpen) {
      window.api.getSettings().then(s => {
        setSettings(s)
        setPendingSettings({})
      })
      window.api.getThemes().then(setThemes)
      window.api.getVersion?.().then(setVersions)
      
      if (theme?.name) {
        window.api.getThemeSettings(theme.name).then(setThemeSettings)
      }

      setActiveMenuStack([{ items: getMainMenuItems(), title: t('MAIN MENU') }])
      setSelectedIndex(0)
      // Animate in
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
      setShowSaveModal(false)
    }
  }, [isOpen, theme?.name])

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

  // Auto-scroll to selected item
  useEffect(() => {
    if (isOpen) {
      const selectedEl = document.querySelector('.riescade-menu-item.selected')
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex, activeMenuStack, isOpen])

  const handleToggle = (item: MenuItem) => {
    if (item.settingName) {
      const fallback = (item.value !== undefined && !item.settingType) ? '' : 'false'
      const current = item.id.startsWith('theme_opt_') 
        ? getThemeSetting(item.settingName, fallback)
        : getSetting(item.settingName, fallback)
      
      // Special logic for multi-value strings (comma separated)
      if (item.type === 'toggle' && item.value !== undefined && !item.settingType) {
        const values = String(current || '').split(',').filter(v => v.trim() !== '')
        
        // Special logic for VisibleSystems: if empty, it means ALL are selected
        let currentValues = values
        if (item.settingName === 'VisibleSystems' && values.length === 0) {
          currentValues = allSystems.map((s: any) => s.name)
        }

        const isSelected = currentValues.includes(item.value)
        
        let newValues: string[]
        if (isSelected) {
          newValues = currentValues.filter(v => v !== item.value)
        } else {
          newValues = [...currentValues, item.value]
        }
        
        // If all systems are selected, we can save an empty string to keep config clean
        if (item.settingName === 'VisibleSystems' && newValues.length === allSystems.length) {
          updateSetting(item.settingName, '')
        } else {
          updateSetting(item.settingName, newValues.join(','))
        }
        return
      }

      const isOn = current === 'true' || current === true || current === '1' || current === 1
      const newVal = isOn ? 'false' : 'true'
      
      if (item.id.startsWith('theme_opt_')) updateThemeSetting(item.settingName, newVal)
      else updateSetting(item.settingName, newVal)
    }
  }

  const handleSelect = (item: MenuItem, direction: 1 | -1) => {
    if (item.options && item.options.length > 0 && item.settingName) {
      const current = item.id.startsWith('theme_opt_')
        ? getThemeSetting(item.settingName, item.options[0].value)
        : getSetting(item.settingName, item.options[0].value)
        
      let idx = item.options.findIndex(o => String(o.value) === String(current))
      if (idx === -1) idx = 0
      const next = (idx + direction + item.options.length) % item.options.length
      
      if (item.id.startsWith('theme_opt_')) updateThemeSetting(item.settingName, item.options[next].value)
      else updateSetting(item.settingName, item.options[next].value)
    }
  }

  const handleSlider = (item: MenuItem, direction: 1 | -1) => {
    if (item.settingName) {
      const min = item.min ?? 0
      const max = item.max ?? 100
      const step = item.step ?? 5
      const current = parseInt(getSetting(item.settingName, Math.floor((min + max) / 2)))
      let newVal = current + direction * step
      newVal = Math.max(min, Math.min(max, newVal))
      updateSetting(item.settingName, newVal)
    }
  }

  const getMainMenuItems = (): MenuItem[] => {
    const items: MenuItem[] = [
      {
        id: 'game_settings', label: t('GAME SETTINGS'), submenu: [
          { id: 'reload_app', label: t('UPDATE GAMELIST'), type: 'action', onClick: () => window.api.executeCommand('reload-frontend') },
          { id: 'group_accounts', label: t('CONTAS'), type: 'group' },
          { id: 'retroachievements_submenu', label: t('CONQUISTAS RETRÔ'), submenu: [
            { id: 'cheevos_enable', label: t('CONQUISTAS RETRÔ'), type: 'toggle', settingName: 'global.cheevos', settingType: 'bool' },
            { id: 'cheevos_user', label: t('USUÁRIO'), type: 'input', settingName: 'global.cheevos.username', settingType: 'string' },
            { id: 'cheevos_pass', label: t('SENHA'), type: 'input', settingName: 'global.cheevos.password', settingType: 'string', isPassword: true },
          ]},
          { id: 'group_autosave', label: t('AUTO SAVE'), type: 'group' },
          { id: 'autosave', label: t('AUTO SAVE/LOAD'), type: 'toggle', settingName: 'global.autosave', settingType: 'bool' },
          { id: 'rewind', label: t('REWIND'), type: 'toggle', settingName: 'global.rewind', settingType: 'bool' },
          { id: 'group_display', label: t('DISPLAY CONFIGURATION'), type: 'group' },
          { id: 'smooth_games', label: t('SMOOTH GAMES'), type: 'toggle', settingName: 'global.smooth', settingType: 'bool' },
          { id: 'shaders', label: t('SHADER SET'), type: 'select', settingName: 'global.shaderset', options: [
            { label: t('NONE'), value: 'none' }, 
            { label: 'RIESCADE', value: '[riescade]' },
            { label: 'CRT-NEW-PIXIE', value: 'crt-new-pixie' },
            { label: 'CRT-ROYALE', value: 'crt-royale' },
            { label: 'CURVATURE', value: 'curvature' },
            { label: 'ENHANCED', value: 'enhanced' },
            { label: 'FLATTEN-GLOW', value: 'flatten-glow' },
            { label: 'HANDHELD', value: 'handheld' },
            { label: 'NTSC', value: 'ntsc' },
            { label: 'NTSC-256PX', value: 'ntsc-256px' },
            { label: 'NTSC-320PX', value: 'ntsc-320px' },
            { label: 'NTSC-NES', value: 'ntsc-nes' },
            { label: 'NTSC-SVIDEO', value: 'ntsc-svideo' },
            { label: 'NTSC-VCR', value: 'ntsc-vcr' },
            { label: 'RETRO', value: 'retro' }, 
            { label: 'SCALEFX', value: 'scalefx' },
            { label: 'SCALEFX-AA', value: 'scalefx-aa' },
            { label: 'SCALEFX-HYBRID', value: 'scalefx-hybrid' },
            { label: 'SCALEHQ', value: 'scalehq' },
            { label: 'SCANLINES', value: 'scanlines' },
            { label: 'SINDENBORDER', value: 'sindenborder' },
            { label: 'TECHNICOLOR', value: 'technicolor' },
            { label: 'TVOUT', value: 'tvout' },
            { label: 'TVOUT-INTERLACING', value: 'tvout-interlacing' },
            { label: 'VHS', value: 'vhs' },
            { label: 'XBRZ-5X', value: 'xbrz-5x' },
            { label: 'ZFAST', value: 'zfast' }
          ]},
          { id: 'decorations', label: t('DECORATIONS'), type: 'select', settingName: 'global.bezel', options: [
            { label: t('NONE'), value: 'none' }, { label: t('AUTO'), value: 'auto' }
          ]},
          { id: 'game_ratio', label: t('GAME ASPECT RATIO'), type: 'select', settingName: 'global.ratio', options: [
            { label: t('AUTO'), value: 'auto' }, { label: '4/3', value: '4/3' }, { label: '16/9', value: '16/9' },
            { label: '16/10', value: '16/10' }, { label: 'FULL', value: 'full' }
          ]},
          { id: 'forcefullscreen', label: t('FORCE FULLSCREEN'), type: 'toggle', settingName: 'global.forcefullscreen', settingType: 'bool' },
          { id: 'exclusivefs', label: t('EXCLUSIVE FULLSCREEN'), type: 'toggle', settingName: 'global.exclusivefs', settingType: 'bool' },
          { id: 'disableautocontrollers', label: t('DISABLE AUTOCONTROLLERS'), type: 'toggle', settingName: 'global.disableautocontrollers', settingType: 'bool' },

        ]
      },
      {
        id: 'ui_settings', label: t('USER INTERFACE'), submenu: [
          { id: 'theme_set', label: t('THEME'), type: 'select', settingName: 'RIESCADE.ThemeSet',
            options: themes.length ? themes.map(t => ({ label: t.toUpperCase(), value: t })) : [{ label: 'DEFAULT', value: 'default' }]
          },
          { 
            id: 'theme_cfg_submenu', 
            label: t('THEME CONFIGURATION'), 
            // Only show options if we haven't changed the theme in the menu
            submenu: (() => {
              if (pendingSettings['RIESCADE.ThemeSet'] && pendingSettings['RIESCADE.ThemeSet'] !== theme?.name) {
                return [{ id: 'theme_cfg_pending', label: t('Save changes to see new options'), type: 'info' }] as MenuItem[]
              }
              if (!theme?.options || theme.options.length === 0) {
                return [{ id: 'theme_cfg_none', label: t('No options available for this theme'), type: 'info' }] as MenuItem[]
              }
              return theme.options.map((opt: any) => ({
                id: `theme_opt_${opt.id}`,
                label: opt.name,
                type: opt.type || 'select',
                settingName: opt.id,
                options: opt.options
              })) as MenuItem[]
            })()
          },
          { id: 'group_ui_gen', label: t('GENERAL UI'), type: 'group' },
          { id: 'screensaver_time', label: t('SCREENSAVER'), type: 'select', settingName: 'ScreenSaverTime', options: [
            { label: t('OFF'), value: '0' }, { label: t('1 MIN'), value: '60000' },
            { label: t('5 MIN'), value: '300000' }
          ]}
        ]
      },
      {
        id: 'sound_settings', label: t('SOUND'), submenu: [
          { id: 'system_volume', label: t('SYSTEM VOLUME'), type: 'slider', settingName: 'Volume', settingType: 'int', min: 0, max: 100, step: 5, suffix: '%' },
          { id: 'music_volume', label: t('MUSIC VOLUME'), type: 'slider', settingName: 'MusicVolume', settingType: 'int', min: 0, max: 100, step: 5, suffix: '%' },
          { id: 'frontend_music', label: t('FRONTEND MUSIC'), type: 'toggle', settingName: 'audio.bgmusic', settingType: 'bool' },
          { id: 'video_audio', label: t('VIDEO PREVIEW AUDIO'), type: 'toggle', settingName: 'VideoAudio', settingType: 'bool' }
        ]
      },
      {
        id: 'game_collections', label: t('GAME COLLECTIONS'), submenu: [
          { id: 'group_collections_display', label: t('COLEÇÕES A SEREM EXIBIDAS'), type: 'group' },
          { 
            id: 'systems_displayed', 
            label: t('SISTEMAS EXIBIDOS'), 
            showCount: true,
            submenu: (() => {
              const systemsSource = allSystems || []
              // Filter out auto collections and anything that isn't a "real" system
              const realSystems = systemsSource.filter((s: any) => {
                const isAuto = ['all', 'favorites', 'recent', 'neverplayed', 'retroachievements', '2players', '4players'].includes(s.name)
                const isGenre = s.name.startsWith('_')
                const isCustom = s.name.startsWith('auto-') || s.name.startsWith('custom-')
                // Real systems usually have extensions and valid paths
                const hasExtension = s.extension && s.extension.length > 0
                return !isAuto && !isGenre && !isCustom && hasExtension
              })
              
              // Group by hardware
              const groups: Record<string, any[]> = {}
              realSystems.forEach((s: any) => {
                const hw = s.hardware || t('OUTROS')
                if (!groups[hw]) groups[hw] = []
                groups[hw].push(s)
              })

              // Sort groups alphabetically, but keep 'OUTROS' at the end
              const sortedGroups = Object.keys(groups).sort((a, b) => {
                if (a === t('OUTROS')) return 1
                if (b === t('OUTROS')) return -1
                return a.localeCompare(b)
              })

              const finalItems: MenuItem[] = []

              sortedGroups.forEach(groupName => {
                finalItems.push({ id: `group_hw_${groupName}`, label: groupName.toUpperCase(), type: 'group' })
                
                // Sort systems within group alphabetically by fullName
                const sortedSystems = groups[groupName].sort((a, b) => 
                  (a.fullName || a.name).localeCompare(b.fullName || b.name)
                )

                sortedSystems.forEach(sys => {
                  finalItems.push({
                    id: `sys_vis_${sys.name}`,
                    label: sys.fullName || sys.name.toUpperCase(),
                    type: 'toggle',
                    settingName: 'VisibleSystems',
                    value: sys.name
                  })
                })
              })

              return finalItems
            })()
          },
          { id: 'auto_collections', label: t('COLEÇÕES DE JOGOS AUTOMÁTICOS'), showCount: true, submenu: [
            { id: 'group_std_cols', label: t('PADRÃO'), type: 'group' },
            { id: 'col_all', label: t('TODOS OS JOGOS'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'all' },
            { id: 'col_recent', label: t('ÚLTIMOS JOGADOS'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'recent' },
            { id: 'col_favorites', label: t('FAVORITOS'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'favorites' },
            { id: 'col_never', label: t('NUNCA JOGADOS'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'neverplayed' },
            { id: 'col_retro', label: t('RETROACHIEVEMENTS'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'retroachievements' },
            
            { id: 'group_players_cols', label: t('JOGADORES'), type: 'group' },
            { id: 'col_2p', label: t('2 JOGADORES'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '2players' },
            { id: 'col_4p', label: t('4 JOGADORES'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '4players' },

            { id: 'group_arcade_cols', label: t('ARCADE & HARDWARE'), type: 'group' },
            { id: 'col_arcade', label: t('ARCADE (GERAL)'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'arcade' },
            { id: 'col_vert', label: t('VERTICAL ARCADE'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'vertical' },
            { id: 'col_lightgun', label: t('LIGHTGUN'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'lightgun' },
            { id: 'col_wheel', label: t('WHEEL'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'wheel' },
            { id: 'col_trackball', label: t('TRACKBALL'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'trackball' },
            { id: 'col_spinner', label: t('SPINNER'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'spinner' },
            { id: 'col_zcapcom', label: t('CAPCOM'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zcapcom' },
            { id: 'col_zneogeo', label: t('NEOGEO'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zneogeo' },
            { id: 'col_zkonami', label: t('KONAMI'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zkonami' },
            { id: 'col_zsega', label: t('SEGA'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zsega' },
            { id: 'col_znintendo', label: t('NINTENDO'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'znintendo' },
            { id: 'col_ztaito', label: t('TAITO'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'ztaito' },
            { id: 'col_znamco', label: t('NAMCO'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'znamco' },
            { id: 'col_zcps1', label: t('CPS1'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zcps1' },
            { id: 'col_zcps2', label: t('CPS2'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zcps2' },
            { id: 'col_zcps3', label: t('CPS3'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zcps3' },
            { id: 'col_zcave', label: t('CAVE'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zcave' },
            { id: 'col_zmidway', label: t('MIDWAY'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zmidway' },
            { id: 'col_zirem', label: t('IREM'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zirem' },
            { id: 'col_zsnk', label: t('SNK'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zsnk' },

            { id: 'group_genres_cols', label: t('GÊNEROS'), type: 'group' },
            { id: 'col__action', label: t('ACTION'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_action' },
            { id: 'col__adult', label: t('ADULT'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_adult' },
            { id: 'col__adventure', label: t('ADVENTURE'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_adventure' },
            { id: 'col__asiaticboard', label: t('ASIATIC BOARD'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_asiaticboard' },
            { id: 'col__beatemup', label: t('BEAT\'EM UP'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_beatemup' },
            { id: 'col__casino', label: t('CASINO'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_casino' },
            { id: 'col__casual', label: t('CASUAL'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_casual' },
            { id: 'col__demo', label: t('DEMO'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_demo' },
            { id: 'col__educational', label: t('EDUCATIONAL'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_educational' },
            { id: 'col__fight', label: t('FIGHT'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_fight' },
            { id: 'col__huntingandfishing', label: t('HUNTING & FISHING'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_huntingandfishing' },
            { id: 'col__musicanddance', label: t('MUSIC & DANCE'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_musicanddance' },
            { id: 'col__pinball', label: t('PINBALL'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_pinball' },
            { id: 'col__platform', label: t('PLATFORM'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_platform' },
            { id: 'col__playingcards', label: t('PLAYING CARDS'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_playingcards' },
            { id: 'col__puzzle', label: t('PUZZLE'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_puzzle' },
            { id: 'col__quiz', label: t('QUIZ'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_quiz' },
            { id: 'col__racedriving', label: t('RACING'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_racedriving' },
            { id: 'col__reflection', label: t('REFLECTION'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_reflection' },
            { id: 'col__roleplayings', label: t('RPG'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_roleplayings' },
            { id: 'col__shootemup', label: t('SHOOT\'EM UP'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_shootemup' },
            { id: 'col__shooter', label: t('SHOOTER'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_shooter' },
            { id: 'col__simulation', label: t('SIMULATION'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_simulation' },
            { id: 'col__sports', label: t('SPORTS'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_sports' },
            { id: 'col__sportswithanimals', label: t('SPORTS WITH ANIMALS'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_sportswithanimals' },
            { id: 'col__strategy', label: t('STRATEGY'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_strategy' },
            { id: 'col__various', label: t('VARIOUS'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '_various' },
            
            { id: 'group_other_arcades', label: t('OUTROS ARCADES'), type: 'group' },
            { id: 'col_zatomiswave', label: t('ATOMISWAVE'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zatomiswave' },
            { id: 'col_znaomi', label: t('NAOMI'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'znaomi' },
            { id: 'col_zmodel2', label: t('MODEL 2'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zmodel2' },
            { id: 'col_zmodel3', label: t('MODEL 3'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zmodel3' },
            { id: 'col_zdaphne', label: t('DAPHNE'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zdaphne' },
            { id: 'col_zatari', label: t('ATARI ARCADE'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zatari' },
            { id: 'col_zatlus', label: t('ATLUS'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zatlus' },
            { id: 'col_zbanpresto', label: t('BANPRESTO'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zbanpresto' },
            { id: 'col_zdataeast', label: t('DATA EAST'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zdataeast' },
            { id: 'col_zeighting', label: t('EIGHTING'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zeighting' },
            { id: 'col_zexidy', label: t('EXIDY'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zexidy' },
            { id: 'col_zgaelco', label: t('GAELCO'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zgaelco' },
            { id: 'col_zgottlieb', label: t('GOTTLIEB'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zgottlieb' },
            { id: 'col_zigs', label: t('IGS'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zigs' },
            { id: 'col_zjaleco', label: t('JALECO'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zjaleco' },
            { id: 'col_zkaneko', label: t('KANEKO'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zkaneko' },
            { id: 'col_zmitchell', label: t('MITCHELL'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zmitchell' },
            { id: 'col_znichibutsu', label: t('NICHIBUTSU'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'znichibutsu' },
            { id: 'col_znmk', label: t('NMK'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'znmk' },
            { id: 'col_zpsikyo', label: t('PSIKYO'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zpsikyo' },
            { id: 'col_zsammy', label: t('SAMMY'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zsammy' },
            { id: 'col_zsegastv', label: t('SEGA ST-V'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zsegastv' },
            { id: 'col_zseibukaihatsu', label: t('SEIBU KAIHATSU'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zseibukaihatsu' },
            { id: 'col_zsemicom', label: t('SEMICOM'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zsemicom' },
            { id: 'col_zseta', label: t('SETA'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zseta' },
            { id: 'col_ztechnos', label: t('TECHNOS'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'ztechnos' },
            { id: 'col_ztecmo', label: t('TECMO'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'ztecmo' },
            { id: 'col_ztoaplan', label: t('TOAPLAN'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'ztoaplan' },
            { id: 'col_zuniversal', label: t('UNIVERSAL'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zuniversal' },
            { id: 'col_zvisco', label: t('VISCO'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zvisco' }
          ]},
          { id: 'custom_collections', label: t('COLEÇÕES DE JOGO PERSONALIZADOS'), type: 'select', value: '<0 selecionados>', settingName: 'CollectionSystemsCustom', options: [{ label: '<0 selecionados>', value: 'none' }] },
          { id: 'grouped_systems', label: t('SISTEMAS AGRUPADOS'), type: 'select', value: '<40 selecionados>', settingName: 'SystemsGrouped', options: [{ label: '<40 selecionados>', value: 'all' }] },
          
          { id: 'group_create_custom', label: t('CRIAR COLEÇÃO PERSONALIZADA'), type: 'group' },
          { id: 'create_editable', label: t('CRIAR NOVA COLEÇÃO EDITÁVEL'), type: 'action' },
          { id: 'create_dynamic', label: t('CRIAR NOVA COLEÇÃO DINÂMICA'), type: 'action' },

          { id: 'group_collection_options', label: t('OPÇÕES'), type: 'group' },
          { id: 'sort_systems', label: t('ORDENAÇÃO DOS SISTEMAS'), type: 'select', settingName: 'SortSystems', options: [
            { label: 'NÃO', value: '' },
            { label: 'POR ORDEM ALFABÉTICA', value: 'alpha' },
            { label: 'POR FABRICANTE', value: 'manufacturer' },
            { label: 'POR TIPO DE HARDWARE ENTÃO ALFABETICAMENTE', value: 'hardware' },
            { label: 'POR TIPO DE HARDWARE ENTÃO ANO', value: 'hardware-year' },
            { label: 'POR FABRICANTE E TIPO', value: 'subgroup' },
            { label: 'POR ANO DE LANÇAMENTO', value: 'releaseDate' }
          ]},
          { id: 'start_on_system', label: t('INICIAR NO SISTEMA'), type: 'select', settingName: 'StartupSystem', options: [
            { label: 'RESTAURAR O ÚLTIMO SELECIONADO', value: 'last' },
            { label: 'TODOS OS JOGOS', value: 'all' }
          ]},
          { id: 'start_gamelist', label: t('INICIAR NA LISTA DE JOGOS'), type: 'toggle', settingName: 'StartOnGamelist', settingType: 'bool' },
          { id: 'group_custom_themes', label: t('AGRUPAR TEMAS PERSONALIZADOS'), type: 'select', settingName: 'CustomCollectionsBundle', options: [
            { label: 'ALWAYS', value: 'true' }, 
            { label: 'NEVER', value: 'false' }
          ]},
          { id: 'show_sys_name_collections', label: t('EXIBIR NOME DO SISTEMA NAS COLEÇÕES'), type: 'toggle', settingName: 'CollectionShowSystemName', settingType: 'bool' },
          { id: 'show_hidden_games_collections', label: t('EXIBIR JOGOS DE SISTEMAS OCULTOS NAS COLEÇÕES'), type: 'toggle', settingName: 'CollectionShowHidden', settingType: 'bool' },
          { id: 'show_empty_systems', label: t('EXIBIR SISTEMAS VAZIOS'), type: 'toggle', settingName: 'LoadEmptySystems', settingType: 'bool' },
          { id: 'hide_single_system_groups', label: t('NÃO MOSTRAR GRUPOS COM APENAS UM SISTEMA'), type: 'toggle', settingName: 'HideSingleSystemGroups', settingType: 'bool' },
        ]
      },
      {
        id: 'system_settings', label: t('SYSTEM SETTINGS'), submenu: [
          { id: 'language', label: t('LANGUAGE'), type: 'select', settingName: 'Language', options: 
            Object.keys(locales).sort().map(lang => ({ 
              label: lang.toUpperCase().replace('_', '-'), 
              value: lang 
            }))
          },
          { id: 'show_fps', label: t('SHOW FRAMERATE'), type: 'toggle', settingName: 'DrawFramerate', settingType: 'bool' },
          { id: 'vram_limit', label: t('VRAM LIMIT'), type: 'slider', settingName: 'MaxVRAM', settingType: 'int', min: 40, max: 1000, step: 10, suffix: ' Mb' }
        ]
      },
      { id: 'quit', label: t('QUIT'), type: 'action', onClick: () => window.api?.executeCommand('exit-frontend') }
    ]

    return items
  }

  const currentMenu = activeMenuStack[activeMenuStack.length - 1]?.items || []
  const menuTitle = activeMenuStack[activeMenuStack.length - 1]?.title || 'MAIN MENU'

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || showInputConfig) return

      if (showSaveModal) {
        const modalButtons = [
          { label: t('Save & Apply'), action: handleSave },
          { label: t('Discard Changes'), action: onClose },
          { label: t('Cancel'), action: () => setShowSaveModal(false) }
        ]

        if (e.key === 'ArrowDown') {
          setModalSelectedIndex(prev => (prev + 1) % modalButtons.length)
        } else if (e.key === 'ArrowUp') {
          setModalSelectedIndex(prev => (prev - 1 + modalButtons.length) % modalButtons.length)
        } else if (e.key === 'Enter') {
          modalButtons[modalSelectedIndex].action()
        } else if (e.key === 'Backspace' || e.key === 'Escape') {
          setShowSaveModal(false)
        }
        return
      }

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
        } else if (item.type === 'select' && item.options) {
          // Convert options to a temporary submenu
          const optionsSubmenu: MenuItem[] = item.options.map(opt => ({
            id: `opt_${opt.value}`,
            label: `${opt.label}${String(opt.value) === String(item.id.startsWith('theme_opt_') ? getThemeSetting(item.settingName!) : getSetting(item.settingName!)) ? '  ◀' : ''}`.toUpperCase(),
            type: 'action',
            onClick: () => {
              if (item.id.startsWith('theme_opt_')) updateThemeSetting(item.settingName!, opt.value)
              else updateSetting(item.settingName!, opt.value)
              setActiveMenuStack(prev => prev.slice(0, -1))
              setSelectedIndex(selectedIndex)
            }
          }))
          setActiveMenuStack(prev => [...prev, { items: optionsSubmenu, title: item.label }])
          setSelectedIndex(0)
        } else if (item.type === 'toggle') {
          handleToggle(item)
        } else if (item.type === 'input') {
          setActiveInputItem(item)
          setInputValue(String(getSetting(item.settingName!, '')))
          setShowInputModal(true)
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
          // Check for pending changes
          const hasChanges = Object.keys(pendingSettings).length > 0 || Object.keys(themeSettings).some(k => themeSettings[k] !== themeData[`options:${k}`])
          if (hasChanges) {
            setModalSelectedIndex(0)
            setShowSaveModal(true)
          } else {
            onClose()
          }
        }
      }
    },
    [isOpen, currentMenu, selectedIndex, activeMenuStack, onClose, pendingSettings, themeSettings, settings, showSaveModal, modalSelectedIndex, themeData]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const renderItemValue = (item: MenuItem) => {
    // Priority: pendingSettings > settings > fallback
    const currentSettingVal = item.settingName 
      ? (item.id.startsWith('theme_opt_') ? getThemeSetting(item.settingName) : getSetting(item.settingName))
      : undefined

    if (item.type === 'toggle') {
      let isOn = currentSettingVal === 'true' || currentSettingVal === true || currentSettingVal === '1' || currentSettingVal === 1
      
      // Multi-toggle check (e.g. CollectionSystemsAuto which is "all,recent,favorites")
      if (item.value !== undefined && !item.settingType) {
        const values = String(currentSettingVal || '').split(',').filter(v => v.trim() !== '')
        
        if (item.settingName === 'VisibleSystems' && values.length === 0) {
          isOn = true // Default to all visible
        } else {
          isOn = values.includes(item.value)
        }
      }

      return (
        <div className={`menu-toggle ${isOn ? 'on' : 'off'}`}>
          <div className="toggle-thumb" />
        </div>
      )
    }
    if (item.type === 'select') {
      const currentVal = currentSettingVal !== undefined ? currentSettingVal : item.options?.[0]?.value
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
    if (item.type === 'input') {
      const displayVal = item.isPassword ? '••••••••' : (currentSettingVal || '')
      return <div className="menu-input-preview">{displayVal || t('EMPTY')}</div>
    }
    if (item.type === 'info') {
      return <div className="menu-info">{item.value}</div>
    }
    if (item.submenu) {
      // Calculate selected count for submenus with toggles, but only if requested
      if (item.showCount) {
        let selectedCount = 0
        item.submenu.forEach(sub => {
          if (sub.type === 'toggle' && sub.settingName) {
            const subVal = sub.id.startsWith('theme_opt_') ? getThemeSetting(sub.settingName) : getSetting(sub.settingName)
            let isSubOn = subVal === 'true' || subVal === true || subVal === '1' || subVal === 1
            if (sub.value !== undefined && !sub.settingType) {
              const values = String(subVal || '').split(',').filter(v => v.trim() !== '')
              if (sub.settingName === 'VisibleSystems' && values.length === 0) {
                isSubOn = true
              } else {
                isSubOn = values.includes(sub.value)
              }
            }
            if (isSubOn) selectedCount++
          }
        })

        if (selectedCount > 0) {
          return (
            <div className="menu-submenu-preview">
              <span className="menu-selected-count">{selectedCount} {t('SELECIONADOS')}</span>
              <span className="menu-submenu-arrow">›</span>
            </div>
          )
        }
      }

      return <span className="menu-submenu-arrow">›</span>
    }
    return null
  }

  const menuItemsNode = (
    <div className="riescade-menu-list">
      {currentMenu.map((item, index) => {
        if (item.type === 'group') {
          return (
            <div key={item.id} className="riescade-menu-group">
              {item.label}
            </div>
          )
        }
        const isMainMenu = activeMenuStack.length === 1
        return (
          <div
            key={item.id}
            className={`riescade-menu-item ${index === selectedIndex ? 'selected' : ''}`}
          >
            {isMainMenu ? (
              <div className="riescade-menu-label-container">
                <span className="riescade-menu-icon" id={item.id}></span>
                <span className="riescade-menu-label">
                  {item.label}
                </span>
              </div>
            ) : (
              <span className="riescade-menu-label">
                {item.label}
              </span>
            )}
            <div className="riescade-menu-value">{renderItemValue(item)}</div>
          </div>
        )
      })}
    </div>
  )

  if (!isOpen) return null

  return (
    <>
      <div className={`riescade-menu-overlay ${visible ? 'visible' : ''}`}>
        <div className="riescade-menu-container">
          <div className="riescade-menu-header">
            <h2 className="riescade-menu-title">{menuTitle}</h2>
          </div>

          <div className="riescade-menu-list-container">
            {menuItemsNode}
          </div>

          <div className="riescade-menu-footer">
            <div className="riescade-menu-footer-actions">
              <div className="riescade-menu-footer-action">
                <span className="riescade-menu-footer-button">A</span>
                <span className="riescade-menu-footer-text">{t('CHOOSE')}</span>
              </div>
              <div className="riescade-menu-footer-action">
                <span className="riescade-menu-footer-button">B</span>
                <span className="riescade-menu-footer-text">{t('BACK')}</span>
              </div>
            </div>
            <div className="riescade-menu-version">
              RIESCADE {versions.app} | ES {versions.es}
            </div>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <div className="riescade-modal-overlay">
          <div className="riescade-modal-container">
            <h3 className="riescade-modal-title">{t('Apply Changes?')}</h3>
            <p className="riescade-modal-message">
              {t('Settings will be saved. The app will refresh to apply changes.')}
            </p>
            <div className="riescade-modal-buttons">
              <button 
                onClick={handleSave}
                className={`riescade-modal-button-primary ${modalSelectedIndex === 0 ? 'selected' : ''}`}
              >
                {t('Save & Apply')}
              </button>
              <button 
                onClick={onClose}
                className={`riescade-modal-button-danger ${modalSelectedIndex === 1 ? 'selected' : ''}`}
              >
                {t('Discard Changes')}
              </button>
              <button 
                onClick={() => setShowSaveModal(false)}
                className={`riescade-modal-button-secondary ${modalSelectedIndex === 2 ? 'selected' : ''}`}
              >
                {t('Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .riescade-menu-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s ease; pointer-events: none; }
        .riescade-menu-overlay.visible { opacity: 1; pointer-events: auto; }
        .riescade-menu-container { width: 600px; background: #dfdfdf; display: flex; flex-direction: column; font-family: "Inter", sans-serif; transform: scale(0.95); transition: transform 0.2s ease; }
        .riescade-menu-overlay.visible .riescade-menu-container { transform: scale(1); }
        .riescade-menu-header { background: #eee; padding: 15px 25px; text-align: center; }
        .riescade-menu-title { margin: 0; color: #333; font-size: 1.2rem; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; }
        .riescade-menu-subtitle { font-size: 0.8rem; color: #666; margin-top: 5px; }
        .riescade-menu-list-container { height: auto; background: #fff; overflow-y: auto; }
        .riescade-menu-item { padding: 12px 30px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.1); transition: background 0.15s ease, color 0.15s ease; color: #444; }
        .riescade-menu-item.selected { background: #3b82f6; color: #fff; }
        .riescade-menu-label { font-weight: 500; font-size: 0.95rem; text-transform: uppercase; }
        .riescade-menu-item.selected .riescade-menu-label { font-weight: 800; }
        .riescade-menu-label-container { display: flex; align-items: center; gap: 10px; }
        .riescade-menu-icon { display: inline-block; width: 2.2em; height: 2em; background-size: contain; background-repeat: no-repeat; background-position: center; }
        .riescade-menu-group { padding: 20px 30px 10px; color: #888; font-size: 0.8rem; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; border-bottom: 1px solid rgba(0,0,0,0.05); }
        .riescade-menu-footer { background: #ddd; padding: 10px 25px; display: flex; justify-content: space-between; align-items: center; }
        .riescade-menu-footer-actions { display: flex; gap: 30px; font-size: 0.8rem; color: #444; font-weight: 700; }
        .riescade-menu-footer-action { display: flex; align-items: center; gap: 8px; }
        .riescade-menu-footer-button { background: #333; color: #fff; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 12px; }
        .riescade-menu-version { font-size: 0.7rem; color: #666; font-weight: 600; }
        
        .riescade-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 10000; display: flex; align-items: center; justify-content: center; font-family: "Inter", sans-serif; }
        .riescade-modal-container { background: #fff; padding: 40px; border-radius: 4px; text-align: center; width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
        .riescade-modal-title { margin: 0 0 20px; color: #333; font-size: 1.4rem; font-weight: 900; text-transform: uppercase; }
        .riescade-modal-message { margin: 0 0 30px; color: #666; line-height: 1.6; }
        .riescade-modal-buttons { display: flex; gap: 15px; justify-content: center; flex-direction: column; }
        .riescade-modal-button-primary { padding: 12px 30px; background: #3b82f6; color: #fff; border: none; border-radius: 4px; font-weight: 800; cursor: pointer; text-transform: uppercase; font-size: 0.9rem; border: 3px solid transparent; }
        .riescade-modal-button-primary.selected { border-color: #fff; box-shadow: 0 0 15px rgba(59, 130, 246, 0.5); }
        .riescade-modal-button-danger { padding: 12px 30px; background: #f43f5e; color: #fff; border: none; border-radius: 4px; font-weight: 800; cursor: pointer; text-transform: uppercase; font-size: 0.9rem; border: 3px solid transparent; }
        .riescade-modal-button-danger.selected { border-color: #fff; box-shadow: 0 0 15px rgba(244, 63, 94, 0.5); }
        .riescade-modal-button-secondary { padding: 12px 30px; background: #eee; color: #444; border: none; border-radius: 4px; font-weight: 800; cursor: pointer; text-transform: uppercase; font-size: 0.9rem; border: 3px solid transparent; }
        .riescade-modal-button-secondary.selected { border-color: #3b82f6; }

        .menu-toggle { width: 40px; height: 20px; background: #ccc; border-radius: 10px; position: relative; transition: background 0.15s ease; }
        .menu-toggle.on { background: #4ade80; }
        .menu-toggle.on .toggle-thumb { transform: translateX(20px); }
        .toggle-thumb { width: 16px; height: 16px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: transform 0.15s ease; }
        .menu-select { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 0.9rem; }
        .menu-select .arrow { opacity: 0.3; }
        .riescade-menu-item.selected .menu-select .arrow { opacity: 1; }
        .riescade-menu-list-container::-webkit-scrollbar { width: 6px; }
        .riescade-menu-list-container::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
        .menu-submenu-arrow { opacity: 0.5; font-size: 2em; }
        .riescade-menu-item.selected .menu-submenu-arrow { opacity: 1; }
        .menu-submenu-preview { display: flex; align-items: center; gap: 10px; }
        .menu-selected-count { font-size: 0.75rem; font-weight: 800; opacity: 0.6; text-transform: uppercase; background: rgba(0,0,0,0.05); padding: 2px 8px; border-radius: 10px; }
        .riescade-menu-item.selected .menu-selected-count { opacity: 0.9; background: rgba(255,255,255,0.2); }
      ` }} />
      {/* {showInputConfig && <InputConfigOverlay onClose={() => setShowInputConfig(false)} />} */}
      
      {showInputModal && (
        <div className="riescade-modal-overlay">
          <div className="riescade-modal-container">
            <h3 className="riescade-modal-title">{activeInputItem?.label}</h3>
            <div style={{ margin: '20px 0' }}>
              <input 
                type={activeInputItem?.isPassword ? 'password' : 'text'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateSetting(activeInputItem!.settingName!, inputValue)
                    setShowInputModal(false)
                  } else if (e.key === 'Escape') {
                    setShowInputModal(false)
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '1.2rem',
                  border: '2px solid #3b82f6',
                  borderRadius: '4px',
                  outline: 'none'
                }}
              />
            </div>
            <div className="riescade-modal-buttons">
              <button 
                className="riescade-modal-button-primary selected"
                onClick={() => {
                  updateSetting(activeInputItem!.settingName!, inputValue)
                  setShowInputModal(false)
                }}
              >
                {t('OK')}
              </button>
              <button 
                className="riescade-modal-button-secondary"
                onClick={() => setShowInputModal(false)}
              >
                {t('Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
