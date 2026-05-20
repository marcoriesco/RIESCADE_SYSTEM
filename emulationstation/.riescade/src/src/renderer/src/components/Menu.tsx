import React, { useState, useEffect, useCallback } from 'react'
import { WebThemeRenderer } from './theme/WebThemeRenderer'
// import { InputConfigOverlay } from './InputConfigOverlay'

const localeModules = import.meta.glob('../locales/*.json', { eager: true })
const locales: Record<string, any> = {}
Object.entries(localeModules).forEach(([path, module]: [string, any]) => {
  const lang = path.split('/').pop()?.replace('.json', '')
  if (lang) locales[lang] = module.default || module
})

const isOptionMatch = (optVal: any, settingVal: any) => {
  if (optVal === settingVal) return true
  const isOptNull = optVal === null || optVal === undefined || optVal === '' || optVal === 'null'
  const isSetNull = settingVal === null || settingVal === undefined || settingVal === '' || settingVal === 'null'
  return isOptNull && isSetNull
}

const findMenuItemBySettingName = (items: MenuItem[], settingName: string): MenuItem | undefined => {
  for (const item of items) {
    if (item.settingName === settingName) {
      return item
    }
    if (item.submenu) {
      const found = findMenuItemBySettingName(item.submenu, settingName)
      if (found) return found
    }
  }
  return undefined
}

interface MenuItem {
  id: string
  label: string
  description?: string
  onClick?: () => void
  submenu?: MenuItem[]
  type?: 'toggle' | 'select' | 'slider' | 'action' | 'info' | 'group' | 'input'
  settingName?: string
  settingType?: 'string' | 'bool' | 'int' | 'float'
  options?: { label: string; value: any; description?: string }[]
  value?: any
  min?: number
  max?: number
  step?: number
  suffix?: string
  isPassword?: boolean
  showCount?: boolean
  tabs?: string[]
  tab?: number
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
  const [activeMenuStack, setActiveMenuStack] = useState<{ items: MenuItem[]; title: string; tabs?: string[]; activeTab?: number }[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [showInputConfig, setShowInputConfig] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [modalSelectedIndex, setModalSelectedIndex] = useState(0)
  const [versions, setVersions] = useState({ app: '2.0.0', es: '' })
  const [showInputModal, setShowInputModal] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [activeInputItem, setActiveInputItem] = useState<MenuItem | null>(null)
  const [customCollections, setCustomCollections] = useState<string[]>([])
  const [needsReload, setNeedsReload] = useState(false)

  const getSetting = (name: string, fallback: any = ''): any => {
    let val = (pendingSettings[name] !== undefined ? pendingSettings[name] : settings[name]?.value)
    if (val === undefined || val === null || val === '') {
      if (name.endsWith('.emulator')) {
        return 'auto'
      }
    }
    return val ?? fallback
  }

  const currentLang = getSetting('Language', 'en_US')
  const t = (key: string): string => locales[currentLang]?.[key] || key

  const visibleSystems = React.useMemo(() => {
    const visibleSetting = getSetting('VisibleSystems', '')
    const hiddenSetting = getSetting('HiddenSystems', '')
    const autoSetting = getSetting('CollectionSystemsAuto', '')
    const groupedSetting = getSetting('SystemsGrouped', '')
    
    const visibleList = String(visibleSetting).split(',').filter(v => v.trim() !== '')
    const hiddenList = String(hiddenSetting).split(';').filter(v => v.trim() !== '')
    const autoList = String(autoSetting).split(',').filter(v => v.trim() !== '')
    const groupedList = String(groupedSetting).split(',').filter(v => v.trim() !== '')

    let baseSystems = visibleList.length > 0 
      ? allSystems.filter(s => 
        visibleList.includes(s.name) || 
        s.name === 'all' || 
        s.name === 'favorites' ||
        s.name === 'collections' ||
        autoList.includes(s.name) ||
        allSystems.some(child => 
          child.group && 
          child.group.toLowerCase() === s.name.toLowerCase() && 
          groupedList.includes(child.name) && 
          visibleList.includes(child.name)
        )
      )
      : allSystems;

    if (hiddenList.length > 0) {
      baseSystems = baseSystems.filter(s => !hiddenList.includes(s.name))
    }

    if (groupedList.length > 0) {
      baseSystems = baseSystems.filter(s => 
        !groupedList.includes(s.name) || 
        (s.group && s.group.toLowerCase() === s.name.toLowerCase())
      )
    }

    const customSetting = getSetting('CollectionSystemsCustom', '')
    const enabledCols = String(customSetting).split(',').map(s => s.trim()).filter(s => s.length > 0)
    if (enabledCols.length === 0) {
      baseSystems = baseSystems.filter(s => s.name !== 'collections')
    }

    return baseSystems.filter(s => s.name !== 'hardware' && s.theme !== 'hardware' && s.hardware !== 'hardware')
  }, [allSystems, pendingSettings, settings])

  const getFriendlySystemName = (sys: any) => {
    if (!sys) return ''
    const name = sys.name
    if (name === 'all') return t('TODOS OS JOGOS')
    if (name === 'favorites') return t('FAVORITOS')
    if (name === 'collections') return t('COLEÇÕES')
    if (name === 'recent') return t('ÚLTIMOS JOGADOS')
    if (name === 'neverplayed') return t('NUNCA JOGADOS')
    if (name === 'retroachievements') return 'RETROACHIEVEMENTS'
    if (name === 'arcade') return 'ARCADE'
    return sys.fullname || sys.name.toUpperCase()
  }

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
      setPendingSettings(prev => {
        const updated = { ...prev, [name]: stringVal }
        
        // If it requires reload, save quietly and flag that a reload is needed when exiting/going back
        const immediateReload = [
          'RIESCADE.ThemeSet',
          'Language',
          'VisibleSystems',
          'CollectionSystemsAuto',
          'CollectionSystemsCustom',
          'SystemsGrouped'
        ].includes(name)

        if (immediateReload) {
          setNeedsReload(true)
          setTimeout(async () => {
            await handleSaveQuietly(updated)
          }, 50)
        }

        return updated
      })
    }
  }

  const updateThemeSetting = (name: string, value: any) => {
    const stringVal = String(value)
    setThemeSettings(prev => {
      const updated = { ...prev, [name]: stringVal }
      
      // Theme settings usually require a reload of the frontend to apply.
      // Set reload required but do not reload immediately!
      setNeedsReload(true)
      setTimeout(async () => {
        if (theme?.name) {
          await window.api.saveThemeSetting(theme.name, name, stringVal)
        }
      }, 50)
      
      return updated
    })
  }

  const handleSaveQuietly = async (pending = pendingSettings) => {
    // 1. Save global settings
    const allItems = getMainMenuItems()
    for (const [name, value] of Object.entries(pending)) {
      const menuItem = findMenuItemBySettingName(allItems, name)
      const type = menuItem?.settingType || settings[name]?.type || 'string'
      await window.api.saveSetting(name, value, type)
    }

    // 2. Save theme settings
    if (theme?.name) {
      for (const [key, value] of Object.entries(themeSettings)) {
        await window.api.saveThemeSetting(theme.name, key, value)
      }
    }
  }

  const handleSave = async () => {
    await handleSaveQuietly(pendingSettings)
    onClose()
    window.api.executeCommand('reload-frontend')
  }

  useEffect(() => {
    if (isOpen) {
      setNeedsReload(false)
      window.api.getSettings().then(s => {
        setSettings(s)
        setPendingSettings({})
      })
      window.api.getThemes().then(setThemes)
      window.api.getVersion?.().then(setVersions)
      window.api.getCustomCollections().then(setCustomCollections)
      
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
  }, [settings, themes, customCollections])

  // Auto-scroll to selected item
  useEffect(() => {
    if (isOpen) {
      const selectedEl = document.querySelector('.riescade-menu-item.selected')
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      }
    }
  }, [selectedIndex, activeMenuStack, isOpen])

  const handleToggle = (item: MenuItem) => {
    if (item.settingName) {
      const fallback = (item.value !== undefined && !item.settingType) ? '' : 'false'
      const current = item.id.startsWith('theme_opt_') 
        ? getThemeSetting(item.settingName, fallback)
        : getSetting(item.settingName, fallback)
      
      // Special logic for DisabledManualScrapers (semicolon separated list of disabled scrapers)
      if (item.settingName === 'DisabledManualScrapers' && item.value !== undefined) {
        const values = String(current || '').split(';').filter(v => v.trim() !== '')
        const isExcluded = values.includes(item.value)
        let newValues: string[]
        if (isExcluded) {
          newValues = values.filter(v => v !== item.value)
        } else {
          newValues = [...values, item.value]
        }
        updateSetting(item.settingName, newValues.join(';'))
        return
      }

      // Special logic for multi-value strings (comma separated)
      if (item.type === 'toggle' && item.value !== undefined && !item.settingType) {
        const values = String(current || '').split(',').filter(v => v.trim() !== '')
        
        // Special logic for VisibleSystems/ScraperSystems: if empty, it means ALL are selected
        let currentValues = values
        if ((item.settingName === 'VisibleSystems' || item.settingName === 'ScraperSystems') && values.length === 0) {
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
        if ((item.settingName === 'VisibleSystems' || item.settingName === 'ScraperSystems') && newValues.length === allSystems.length) {
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
        
      let idx = item.options.findIndex(o => isOptionMatch(o.value, current))
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
          { id: 'netplay_submenu', label: t('NETPLAY SETTINGS'), submenu: [
            { id: 'netplay_enable', label: t('ENABLE NETPLAY'), type: 'toggle', settingName: 'global.netplay', settingType: 'bool' },
            { id: 'netplay_nickname', label: t('NICKNAME'), type: 'input', settingName: 'global.netplay.nickname', settingType: 'string' },
            { id: 'netplay_port', label: t('PORT'), type: 'input', settingName: 'global.netplay.port', settingType: 'string' }
          ]},
          { id: 'group_bios', label: t('BIOS SETTINGS'), type: 'group' },
          { id: 'missing_bios_submenu', label: t('MISSING BIOS CHECK'), submenu: [
            { id: 'no_missing_bios', label: t('NO MISSING BIOS FILES'), type: 'info', value: '' }
          ]},
          { id: 'check_bios_launch', label: t('CHECK BIOS FILES BEFORE RUNNING A GAME'), type: 'toggle', settingName: 'CheckBiosesAtLaunch', settingType: 'bool' },
          { id: 'group_autosave', label: t('ESTADOS DE SALVAMENTO'), type: 'group' },
          { id: 'autosave', label: t('SALVAR/CARREGAR AUTOMÁTICO'), type: 'toggle', settingName: 'global.autosave', settingType: 'bool', description: t('Carrega o estado de salvamento mais recente ao iniciar o jogo e salva o estado ao sair do jogo.') },
          { 
            id: 'autosave_increment', 
            label: t('TIPO DE INCREMENTO'), 
            type: 'select', 
            settingName: 'global.incrementalsavestates', 
            settingType: 'int',
            options: [
              { label: t('POR ESTADO DE SALVAMENTO'), value: null, description: t('Nunca sobrescreve estados de salvamento antigos, sempre crie novos.') },
              { label: t('POR ESPAÇO DE SALVAMENTO'), value: '0', description: t('Incrementa novo espaço em um novo jogo.') },
              { label: t('NÃO INCREMENTAR'), value: '2', description: t('Usa o espaço atual em um novo jogo.') }
            ]
          },
          { 
            id: 'autosave_manager', 
            label: t('EXIBIR GERENCIADOR'), 
            type: 'select', 
            settingName: 'global.savestates', 
            description: t('Exibe o gerenciador de estado de salvamento antes de iniciar um jogo.'),
            options: [
              { label: t('NÃO'), value: '0' },
              { label: t('SEMPRE'), value: '1' },
              { label: t('SE DISPONÍVEL'), value: '2' }
            ]
          },
          { id: 'group_display', label: t('DISPLAY CONFIGURATION'), type: 'group' },
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
          { id: 'tattoo_submenu', label: t('TATTOO'), submenu: [
            { id: 'global_tattoo', label: t('MOSTRAR IMAGEM SOBREPOSTA À MOLDURA'), type: 'toggle', settingName: 'global.tattoo', settingType: 'bool', description: t('Show a control image overlaid on top of the bezel.') },
            { id: 'global_tattoo_corner', label: t('POSIÇÃO DA SOBREPOSIÇÃO'), type: 'select', settingName: 'global.tattoo_corner', description: t('Select corner of the screen where the tattoo will appear.'), options: [
              { label: t('AUTO'), value: 'auto' },
              { label: t('TOP LEFT'), value: 'NW' },
              { label: t('TOP RIGHT'), value: 'NE' },
              { label: t('BOTTOM RIGHT'), value: 'SE' },
              { label: t('BOTTOM LEFT'), value: 'SW' }
            ]},
            { id: 'global_resize_tattoo', label: t('REDIMENSIONAR SOBREPOSIÇÃO'), type: 'toggle', settingName: 'global.resize_tattoo', settingType: 'bool', description: t('Reduz/expande a sobreposição para caber na borda da moldura.') }
          ]},
          {
            id: 'global_videomode',
            label: t('VIDEO MODE'),
            type: 'select',
            settingName: 'global.videomode',
            options: [
              { label: t('AUTO'), value: 'auto' },
              { label: '1080p 60Hz', value: '1920x1080@60' },
              { label: '1080p 50Hz', value: '1920x1080@50' },
              { label: '720p 60Hz', value: '1280x720@60' }
            ]
          },
          { id: 'game_ratio', label: t('GAME ASPECT RATIO'), type: 'select', settingName: 'global.ratio', options: [
            { label: t('AUTO'), value: 'auto' }, { label: '4/3', value: '4/3' }, { label: '16/9', value: '16/9' },
            { label: '16/10', value: '16/10' }, { label: 'FULL', value: 'full' }
          ]},
          { id: 'forcefullscreen', label: t('FORCE FULLSCREEN'), type: 'toggle', settingName: 'global.forcefullscreen', settingType: 'bool', description: t('Force emulator in fullscreen even if RetroBat is windowed') },
          { id: 'exclusivefs', label: t('PREFER EXCLUSIVE FULLSCREEN'), type: 'toggle', settingName: 'global.exclusivefs', settingType: 'bool', description: t('When available, prefer exclusive fullscreen for emulators.') },
          { id: 'nopauseonlostfocus', label: t('NEVER PAUSE EMULATION ON LOST FOCUS'), type: 'toggle', settingName: 'global.nopauseonlostfocus', settingType: 'bool', description: t('This setting will prevent pause in emulation when losing focus.') },
          { id: 'integerscale', label: t('ESCALA INTEIRA (PIXEL PERFEITO)'), type: 'toggle', settingName: 'global.integerscale', settingType: 'bool' },
          { id: 'smooth_games', label: t('JOGOS SUAVES (FILTRO BILINEAR)'), type: 'toggle', settingName: 'global.smooth', settingType: 'bool' },
          { id: 'discord_rich_presence', label: t('DISCORD RICH PRESENCE'), type: 'toggle', settingName: 'global.discord', settingType: 'bool', description: t('Enable Discord Rich Presence service, this will update Discord status to show the games being played.') },
          { id: 'disableautocontrollers', label: t('CONFIGURAR CONTROLES AUTOMATICAMENTE'), type: 'toggle', settingName: 'global.disableautocontrollers', settingType: 'bool' },
          {
            id: 'switch_submenu',
            label: t('SWITCH'),
            description: t('SAVES IN RETROBAT SAVES FOLDER') + ' : ' + (getSetting('yuzu_mutualize', 'false') === 'true' ? t('LIGADO') : t('DESLIGADO')),
            submenu: [
              { id: 'yuzu_mutualize', label: t('SAVES IN RETROBAT SAVES FOLDER'), type: 'toggle', settingName: 'yuzu_mutualize', settingType: 'bool', description: t('Switch on to use RetroBat saves folder for Citron and Eden saves (instead of emulator folder).') }
            ]
          },
          { id: 'group_stores', label: t('GAME STORES AND LAUNCHERS'), type: 'group' },
          { id: 'windows_games_submenu', label: t('WINDOWS GAMES'), submenu: [
            { id: 'global_scanStore', label: t('SCAN INSTALLED STORE GAMES (STEAM, EPIC...)'), type: 'toggle', settingName: 'global.scanStore', settingType: 'bool' },
            { id: 'global_scanStoreUninstalled', label: t('INCLUDE UNINSTALLED GAMES'), type: 'toggle', settingName: 'global.scanStoreUninstalled', settingType: 'bool' },
            { id: 'global_storekeep', label: t('KEEP GAMES ADDED MANUALLY'), type: 'toggle', settingName: 'global.storekeep', settingType: 'bool', description: t('By default, RetroBat keeps sync between installed games and roms folder.') },
            { id: 'global_killsteam', label: t('KILL LAUNCHER WHEN EXIT'), type: 'toggle', settingName: 'global.killsteam', settingType: 'bool', description: t('Set this to ON to quit steam or Epic Game Launcher when quitting game.') },
            { id: 'global_batexesearch', label: t('TRY TO READ EXECUTABLE IN BAT FILES'), type: 'toggle', settingName: 'global.batexesearch', settingType: 'bool', description: t('Disable this option to run directly a .bat or .cmd file without RetroBat trying to find the executable inside.') }
          ]},
          { id: 'n64_recompscan', label: t('SCAN N64 RECOMPILATION'), type: 'toggle', settingName: 'n64_recompscan', settingType: 'bool' },
          { id: 'game_launchers_submenu', label: t('GAME LAUNCHERS'), submenu: [
            { id: 'global_exodosScan', label: t('SCAN EXODOS GAMES'), type: 'toggle', settingName: 'global.exodosScan', settingType: 'bool' },
            { id: 'global_exodosPath', label: t('EXODOS EXECUTABLE PATH'), type: 'input', settingName: 'global.exodosPath', settingType: 'string', description: t('Path to the folder where ExoDos is located, mandatory for RetroBat to be able to scan ExoDOS games.') },
            { id: 'global_exowin3xScan', label: t('SCAN EXOWIN3X GAMES'), type: 'toggle', settingName: 'global.exowin3xScan', settingType: 'bool' },
            { id: 'global_exowin3xPath', label: t('EXOWIN3X EXECUTABLE PATH'), type: 'input', settingName: 'global.exowin3xPath', settingType: 'string', description: t('Path to the folder where ExoWin3x is located, mandatory for RetroBat to be able to scan ExoWin3x games.') },
            { id: 'global_exowin9xScan', label: t('SCAN EXOWIN9X GAMES'), type: 'toggle', settingName: 'global.exowin9xScan', settingType: 'bool' },
            { id: 'global_exowin9xPath', label: t('EXOWIN9X EXECUTABLE PATH'), type: 'input', settingName: 'global.exowin9xPath', settingType: 'string', description: t('Path to the folder where ExoWin9x is located, mandatory for RetroBat to be able to scan ExoWin9x games.') },
            { id: 'global_agsPath', label: t('AGS EXECUTABLE PATH'), type: 'input', settingName: 'global.agsPath', settingType: 'string', description: t('Path to the folder where AGS WinUAE is located, if filled RetroBat will add ags launcher to amiga system.') }
          ]},
          { id: 'group_compression', label: t('COMPRESSION'), type: 'group' },
          { id: 'decompressedfolders', label: t('DECOMPRESSION'), type: 'select', settingName: 'decompressedfolders', description: t('Keep or delete games files once extracted (squashfs, 7z)'), options: [
            { label: t('AUTOMÁTICO'), value: 'ask' },
            { label: t('KEEP'), value: 'keep' },
            { label: t('DELETE'), value: 'delete' }
          ]},
          { id: 'decompressedpath', label: t('DECOMPRESSION PATH'), type: 'input', settingName: 'decompressedpath', settingType: 'string', description: t('Change path for decompressed games (default is roms/.uncompressed).') },
          { id: 'nevermount', label: t('NEVER TRY TO MOUNT AS DRIVE'), type: 'toggle', settingName: 'nevermount', settingType: 'bool', description: t('Always decompress archives, even if dokan could be used to mount as a drive letter.') },
          { id: 'group_retroarch', label: t('RETROARCH OPTIONS'), type: 'group' },
          { id: 'video_submenu', label: t('VIDEO'), submenu: [
            { id: 'RotateScreen', label: t('SCREEN ORIENTATION'), type: 'select', settingName: 'RotateScreen', description: t('This setting will rotate your windows desktop, it will not be set back when exiting game.'), options: [
              { label: t('Normal'), value: '0' },
              { label: '90°', value: '1' },
              { label: '180°', value: '2' },
              { label: '270°', value: '3' }
            ]},
            { id: 'RotateVideo', label: t('VIDEO ROTATION'), type: 'select', settingName: 'RotateVideo', options: [
              { label: t('Normal'), value: '0' },
              { label: '90°', value: '1' },
              { label: '180°', value: '2' },
              { label: '270°', value: '3' }
            ]},
            { id: 'MonitorIndex', label: t('MONITOR INDEX'), type: 'select', settingName: 'MonitorIndex', description: t('Games will be displayed on the monitor corresponding to the selected index.'), options: Array.from({ length: 11 }, (_, i) => ({ label: String(i), value: String(i) })) },
            { id: 'GPUIndex', label: t('GRAPHIC CARD INDEX'), type: 'select', settingName: 'GPUIndex', description: t('Change this only if multiple GPU are used by your system.'), options: Array.from({ length: 5 }, (_, i) => ({ label: String(i), value: String(i) })) },
            { id: 'CRTSwitch', label: t('CRT SCREEN OUTPUT'), type: 'select', settingName: 'CRTSwitch', options: [
              { label: t('OFF'), value: '0' },
              { label: '15KHz', value: '1' },
              { label: '31KHz (Standard)', value: '2' },
              { label: '31KHz (120Hz)', value: '3' },
              { label: t('FROM INI FILE'), value: '4' }
            ]},
            { id: 'CRTSuperRes', label: t('CRT SCREEN RESOLUTION'), type: 'select', settingName: 'CRTSuperRes', options: [
              { label: t('Native'), value: '0' },
              { label: t('Dynamic'), value: '1' },
              { label: '1920', value: '1920' },
              { label: '2560', value: '2560' },
              { label: '3840', value: '3840' }
            ]},
            { id: 'enable_hdr', label: t('ENABLE HDR'), type: 'toggle', settingName: 'enable_hdr', settingType: 'bool', description: t('Enable HDR for HDR-compatible displays.') },
            { id: 'video_scale_integer_scaling', label: t('INTEGER SCALE TYPE'), type: 'select', settingName: 'video_scale_integer_scaling', options: [
              { label: t('UNDERSCALE'), value: '0' },
              { label: t('OVERSCALE'), value: '1' },
              { label: t('SMART'), value: '2' }
            ]}
          ]},
          { id: 'visual_rendering_submenu', label: t('VISUAL RENDERING'), submenu: [
            { id: 'use_shader_override', label: t('ALLOW GAME/CORE SHADERS OVERRIDE'), type: 'toggle', settingName: 'use_shader_override', settingType: 'bool', description: t('Enable this to enable shaders even when RetroBat has no shader set.') }
          ]},
          {
            id: 'screen_sync_submenu',
            label: t('SCREEN SYNC'),
            description: t('G-SYNC/FREESYNC COMPATIBILITY') + ' : ' + (getSetting('vrr_runloop_enable', 'false') === 'true' ? t('LIGADO') : t('DESLIGADO')),
            submenu: [
              { id: 'vrr_runloop_enable', label: t('G-SYNC/FREESYNC COMPATIBILITY'), type: 'toggle', settingName: 'vrr_runloop_enable', settingType: 'bool', description: t('Sync to exact content framerate. Only for G-Sync/FreeSync/HDMI-2.1-VRR compatible monitors.') },
              { id: 'video_vsync', label: t('VERTICAL SYNC'), type: 'select', settingName: 'video_vsync', options: [
                { label: t('NÃO'), value: 'false' },
                { label: t('SIM'), value: 'true' },
                { label: t('ADAPTATIVE'), value: 'adaptative' }
              ]},
              { id: 'video_hard_sync', label: t('HARD SYNC'), type: 'select', settingName: 'video_hard_sync', description: t('Only compatible with OpenGL, hard-sync GPU and CPU. Reduce latency at the cost of inscreased performance requirements.'), options: [
                { label: t('NÃO'), value: 'false' },
                { label: '0 frame', value: '0' },
                { label: '1 frame', value: '1' },
                { label: '2 frames', value: '2' },
                { label: '3 frames', value: '3' }
              ]},
              { id: 'video_swap_interval', label: t('SWAP INTERVAL'), type: 'select', settingName: 'video_swap_interval', description: t('Set this to effectively halve monitor refresh rate.'), options: [
                { label: '1', value: '1' },
                { label: '2', value: '2' },
                { label: '3', value: '3' },
                { label: '4', value: '4' }
              ]},
              { id: 'video_black_frame_insertion', label: t('BLACK FRAMES INSERTION'), type: 'select', settingName: 'video_black_frame_insertion', description: t('Useful on some high refresh rate screen to eliminate ghosting.'), options: [
                { label: '1', value: '1' },
                { label: '2', value: '2' },
                { label: '3', value: '3' },
                { label: '4', value: '4' }
              ]},
              { id: 'video_max_swapchain_images', label: t('MAX SWAP CHAIN IMAGES'), type: 'select', settingName: 'video_max_swapchain_images', description: t('Vulkan only: tells the video driver to use a specified buffering mode.'), options: [
                { label: '2', value: '2' },
                { label: '3', value: '3' },
                { label: '4', value: '4' }
              ]}
            ]
          },
          { id: 'audio_submenu', label: t('AUDIO'), submenu: [
            { id: 'audio_resampler', label: t('RESAMPLER'), type: 'select', settingName: 'audio_resampler', options: [
              { label: 'sinc', value: 'sinc' },
              { label: 'CC', value: 'CC' },
              { label: 'nearest', value: 'nearest' },
              { label: t('NONE'), value: 'null' }
            ]},
            { id: 'audio_resampler_quality', label: t('QUALITY'), type: 'select', settingName: 'audio_resampler_quality', options: [
              { label: t('Lowest'), value: '1' },
              { label: t('Lower'), value: '2' },
              { label: t('Normal'), value: '3' },
              { label: t('Higher'), value: '4' },
              { label: t('Highest'), value: '5' }
            ]},
            { id: 'audio_volume', label: t('VOLUME GAIN'), type: 'slider', settingName: 'audio_volume', settingType: 'int', min: -80, max: 12, step: 2, suffix: ' dB' },
            { id: 'audio_mixer_volume', label: t('MIXER VOLUME GAIN'), type: 'slider', settingName: 'audio_mixer_volume', settingType: 'int', min: -80, max: 12, step: 2, suffix: ' dB' },
            { id: 'audio_dsp_plugin', label: t('DSP PLUGIN'), type: 'select', settingName: 'audio_dsp_plugin', options: [
              { label: t('NONE'), value: 'none' },
              { label: t('BASS BOOST'), value: ':\\filters\\audio\\BassBoost.dsp' },
              { label: t('CHIPTUNE ENHANCE'), value: ':\\filters\\audio\\ChipTuneEnhance.dsp' },
              { label: t('CHORUS'), value: ':\\filters\\audio\\Chorus.dsp' },
              { label: t('CRYSTALIZER'), value: ':\\filters\\audio\\Crystalizer.dsp' },
              { label: t('ECHO'), value: ':\\filters\\audio\\Echo.dsp' },
              { label: t('ECHO REVERB'), value: ':\\filters\\audio\\EchoReverb.dsp' },
              { label: t('EQ'), value: ':\\filters\\audio\\EQ.dsp' },
              { label: t('HIGH SHELF DAMPEN'), value: ':\\filters\\audio\\HighShelfDampen.dsp' },
              { label: t('IIR'), value: ':\\filters\\audio\\IIR.dsp' },
              { label: t('LOW PASS CPS'), value: ':\\filters\\audio\\LowPassCPS.dsp' },
              { label: t('MONO'), value: ':\\filters\\audio\\Mono.dsp' },
              { label: t('PANNING'), value: ':\\filters\\audio\\Panning.dsp' },
              { label: t('PHASER'), value: ':\\filters\\audio\\Phaser.dsp' },
              { label: t('REVERB'), value: ':\\filters\\audio\\Reverb.dsp' },
              { label: t('TREMOLO'), value: ':\\filters\\audio\\Tremolo.dsp' },
              { label: t('VIBRATO'), value: ':\\filters\\audio\\Vibrato.dsp' },
              { label: t('WAHWAH'), value: ':\\filters\\audio\\WahWah.dsp' }
            ]},
            { id: 'audio_sync', label: t('AUDIO SYNC'), type: 'toggle', settingName: 'audio_sync', settingType: 'bool' }
          ]},
          { id: 'emulation_submenu', label: t('EMULATION'), submenu: [
            { id: 'rewind', label: t('REWIND'), type: 'toggle', settingName: 'rewind', settingType: 'bool' },
            { id: 'global_fastforward_ratio', label: t('FAST FORWARD RATIO'), type: 'slider', settingName: 'global.fastforward_ratio', settingType: 'int', min: 0, max: 50, step: 1, suffix: 'x' },
            { id: 'fastforward_toggle', label: t('FAST FORWARD BEHAVIOR'), type: 'select', settingName: 'fastforward_toggle', description: t('Define whether the fast-forward shortcuts acts as a toggle or needs to be held.'), options: [
              { label: t('HOLD'), value: '0' },
              { label: t('TOGGLE'), value: '1' }
            ]},
            { id: 'global_applyPatch', label: t('SOFTPATCHING'), type: 'select', settingName: 'global.applyPatch', description: t('Define if patch should be applied and where patch files are located, AUTO will apply patches if they are located near rom with same name as rom file.'), options: [
              { label: t('DISABLED'), value: 'none' },
              { label: t('PATCH IN PATCH SUBFOLDER'), value: 'patchFolder' },
              { label: t('PATCH IN ROM SUBFOLDER'), value: 'subFolder' }
            ]},
            { id: 'game_specific_options', label: t('ALLOW GAME/CORE OPTIONS OVERRIDE'), type: 'toggle', settingName: 'game_specific_options', settingType: 'bool', description: t('By default, RetroBat discards core specific option files.') }
          ]},
          { id: 'latency_reduction_submenu', label: t('LATENCY REDUCTION'), submenu: [
            { id: 'runahead', label: t('RUN-AHEAD FRAMES'), type: 'slider', settingName: 'runahead', settingType: 'int', min: 0, max: 12, step: 1, suffix: ' f' },
            { id: 'preemptive_frames', label: t('USE PREEMPTIVE FRAMES'), type: 'toggle', settingName: 'preemptive_frames', settingType: 'bool', description: t('Use preemptive frames instead of run-ahead, the run-ahead frame number applies.') },
            { id: 'secondinstance', label: t('RUN-AHEAD USE SECOND INSTANCE'), type: 'toggle', settingName: 'secondinstance', settingType: 'bool' },
            { id: 'video_frame_delay_auto', label: t('AUTOMATIC FRAME DELAY'), type: 'toggle', settingName: 'video_frame_delay_auto', settingType: 'bool', description: t('Automatically decrease frame delay temporarily to prevent frame drops. Turn off if this worsens audio/video stuttering.') },
            { id: 'input_poll_type_behavior', label: t('INPUT POLLING BEHAVIOUR'), type: 'select', settingName: 'input_poll_type_behavior', description: t('Depending on the configuration, can increase or decrease latency.'), options: [
              { label: t('EARLY'), value: '0' },
              { label: t('NORMAL'), value: '1' },
              { label: t('LATE'), value: '2' }
            ]}
          ]},
          { id: 'ai_translation_submenu', label: t('AI GAME TRANSLATION'), submenu: [
            { id: 'ai_service_enabled', label: t('ENABLE AI TRANSLATION SERVICE'), type: 'toggle', settingName: 'ai_service_enabled', settingType: 'bool' },
            { id: 'ai_target_lang', label: t('TARGET LANGUAGE'), type: 'select', settingName: 'ai_target_lang', options: [
              { label: 'Dansk', value: 'Da' },
              { label: 'Deutsch', value: 'De' },
              { label: 'English', value: 'En' },
              { label: 'Español', value: 'Es' },
              { label: 'Français', value: 'Fr' },
              { label: 'Hrvatski', value: 'Hr' },
              { label: 'Italiano', value: 'It' },
              { label: 'Magyar', value: 'Hu' },
              { label: 'Nederlands', value: 'Nl' },
              { label: 'Norsk', value: 'Nn' },
              { label: 'Polski', value: 'Po' },
              { label: 'Português', value: 'Pt' },
              { label: 'Română', value: 'Ro' },
              { label: 'Svenska', value: 'Sv' },
              { label: 'Türkçe', value: 'Tr' },
              { label: 'Čeština', value: 'Cs' },
              { label: 'Ελληνικά (Greek)', value: 'El' },
              { label: 'Русский (Russian)', value: 'Ru' },
              { label: '日本語 (Japanese)', value: 'Ja' },
              { label: '简体中文 (Chinese)', value: 'Zh' },
              { label: '한국어 (Korean)', value: 'Ko' }
            ]},
            { id: 'ai_service_url', label: t('AI TRANSLATION SERVICE URL'), type: 'input', settingName: 'ai_service_url', settingType: 'string' },
            { id: 'ai_service_pause', label: t('PAUSE ON TRANSLATED SCREEN'), type: 'toggle', settingName: 'ai_service_pause', settingType: 'bool' }
          ]},
          {
            id: 'ui_elements_submenu',
            label: t('USER INTERFACE'),
            description: t('SHOW MENU ELEMENTS') + ' : ' + String(getSetting('OptionsMenu', 'full')).toUpperCase(),
            submenu: [
              { id: 'OptionsMenu', label: t('SHOW MENU ELEMENTS'), type: 'select', settingName: 'OptionsMenu', description: t('Show or hide RetroArch settings. Auto is the recommended setting.'), options: [
                { label: t('minimal'), value: 'minimal' },
                { label: t('full'), value: 'full' }
              ]},
              { id: 'OnScreenMsg', label: t('NOTIFICATIONS'), type: 'toggle', settingName: 'OnScreenMsg', settingType: 'bool', description: t('Display or not on-screen notifications.') },
              { id: 'DrawStats', label: t('DRAW STATISTICS'), type: 'select', settingName: 'DrawStats', description: t('Display different level of information about performance statistics.'), options: [
                { label: t('FPS ONLY'), value: 'fps_only' },
                { label: t('MEMORY USAGE ONLY'), value: 'mem_only' },
                { label: t('FPS + MEMORY USAGE'), value: 'fps_mem' },
                { label: t('TECHNICAL STATS'), value: 'tech_stats' }
              ]},
              { id: 'PressTwice', label: t('PRESS HOTKEYS TWICE TO EXIT'), type: 'toggle', settingName: 'PressTwice', settingType: 'bool' },
              { id: 'input_menu_toggle_gamepad_combo', label: t('GAMEPAD MENU COMBO'), type: 'select', settingName: 'input_menu_toggle_gamepad_combo', options: [
                { label: t('NONE'), value: '0' },
                { label: 'DOWN+Y+R1+L1', value: '1' },
                { label: 'L3+R3', value: '2' },
                { label: 'L3+R1', value: '5' },
                { label: 'L1+R1', value: '6' },
                { label: 'HOLD START', value: '7' },
                { label: 'HOLD SELECT', value: '8' },
                { label: 'L2+R2', value: '10' }
              ]},
              { id: 'discord', label: t('DISCORD RICH PRESENCE'), type: 'toggle', settingName: 'discord', settingType: 'bool', description: t('Enable Discord Rich Presence service, this will update Discord status to show the games being played.') }
            ]
          },
          {
            id: 'drivers_submenu',
            label: t('DRIVERS'),
            description: t('VIDEO') + ' : ' + String(getSetting('video_driver', 'vulkan')).toUpperCase(),
            submenu: [
              { id: 'video_driver', label: t('VIDEO'), type: 'select', settingName: 'video_driver', description: t('The driver vulkan will generally offer better performance if hardware compatible. Some libretro cores will force the choosen driver.'), options: [
                { label: 'opengl', value: 'gl' },
                { label: 'opengl core', value: 'glcore' },
                { label: 'directx 12', value: 'd3d12' },
                { label: 'directx 11', value: 'd3d11' },
                { label: 'directx 10', value: 'd3d10' },
                { label: 'directx 9', value: 'd3d9' },
                { label: 'vulkan', value: 'vulkan' }
              ]},
              { id: 'audio_driver', label: t('AUDIO'), type: 'select', settingName: 'audio_driver', description: t('Choose the audio driver compatible with the hardware.'), options: [
                { label: 'xaudio', value: 'xaudio' },
                { label: 'directsound', value: 'dsound' },
                { label: 'SDL', value: 'sdl2' },
                { label: 'wasapi', value: 'wasapi' }
              ]},
              { id: 'input_driver', label: t('CONTROLLERS'), type: 'select', settingName: 'input_driver', description: t('The driver xinput will enable features like rumble effects. Choose sdl for compatibility with a wide range of controllers.'), options: [
                { label: 'SDL', value: 'sdl2' },
                { label: 'XINPUT', value: 'xinput' },
                { label: 'DINPUT', value: 'dinput' }
              ]}
            ]
          },
          {
            id: 'controls_submenu',
            label: t('CONTROLS'),
            submenu: [
              { id: 'analogDpad', label: t('DPAD AS ANALOG'), type: 'toggle', settingName: 'analogDpad', settingType: 'bool' },
              { id: 'n64_special_trigger', label: t('N64 TRIGGER INVERT'), type: 'toggle', settingName: 'n64_special_trigger', settingType: 'bool', description: t('For n64 controllers with 2 triggers, use R2 instead of L2 as Z button.') },
              { id: 'ps_controller_enhanced', label: t('PS4/PS5 ENHANCED'), type: 'toggle', settingName: 'ps_controller_enhanced', settingType: 'bool', description: t('Enable enhanced features for DS4 and DualSense, this will break compatibility with emulators using dinput until switch off.') },
              { id: 'analog_deadzone', label: t('ANALOG DEADZONE'), type: 'select', settingName: 'analog_deadzone', description: t('Ignore analog stick movement below this threshold.'), options: Array.from({ length: 11 }, (_, i) => {
                const val = (i * 0.1).toFixed(1)
                return { label: val, value: val }
              })},
              { id: 'analog_sensitivity', label: t('ANALOG SENSITIVITY'), type: 'select', settingName: 'analog_sensitivity', description: t('Sets the sensitivity of the analog sticks.'), options: Array.from({ length: 11 }, (_, i) => {
                const val = String(i - 5)
                return { label: val, value: val }
              })},
              { id: 'keyboard_arcade', label: t('CONFIGURE SPECIAL KEYBOARD STICK'), type: 'select', settingName: 'keyboard_arcade', description: t('use this option when using a pad recognized as keyboard (ipac, etc.)'), options: [
                { label: t('NONE'), value: 'null' },
                { label: 'IPAC2', value: 'ipac2' },
                { label: 'X-ARCADE TANKSTICK', value: 'tankstick' }
              ]},
              { id: 'arcade_stick', label: t('USE CUSTOM ARCADE STICK MAPPING'), type: 'toggle', settingName: 'arcade_stick', settingType: 'bool', description: t('Allows you to perform a dedicated mapping for your arcade stick based in arcade_sticks.json file.') },
              { id: 'p1_stick_index', label: t('FORCE ARCADE STICK INDEX P1'), type: 'select', settingName: 'p1_stick_index', options: Array.from({ length: 6 }, (_, i) => ({ label: String(i), value: String(i) })) },
              { id: 'p2_stick_index', label: t('FORCE ARCADE STICK INDEX P2'), type: 'select', settingName: 'p2_stick_index', options: Array.from({ length: 6 }, (_, i) => ({ label: String(i), value: String(i) })) },
              { id: 'buttonTrigger', label: t('USE BUTTON FOR TRIGGER'), type: 'toggle', settingName: 'buttonTrigger', settingType: 'bool', description: t('Force button instead of axis for triggers, can help with Sony controllers.') }
            ]
          },
          {
            id: 'guns_submenu',
            label: t('GUNS'),
            submenu: [
              { id: 'p1_gunIndex', label: t('P1 MOUSE/GUN INDEX'), type: 'select', settingName: 'p1_gunIndex', description: t('Define mouse index to use for player 1.'), options: Array.from({ length: 9 }, (_, i) => ({ label: String(i), value: String(i) })) },
              { id: 'p2_gunIndex', label: t('P2 MOUSE/GUN INDEX'), type: 'select', settingName: 'p2_gunIndex', description: t('Define mouse index to use for player 2.'), options: Array.from({ length: 9 }, (_, i) => ({ label: String(i), value: String(i) })) },
              { id: 'p3_gunIndex', label: t('P3 MOUSE/GUN INDEX'), type: 'select', settingName: 'p3_gunIndex', description: t('Define mouse index to use for player 3.'), options: Array.from({ length: 9 }, (_, i) => ({ label: String(i), value: String(i) })) },
              { id: 'p4_gunIndex', label: t('P4 MOUSE/GUN INDEX'), type: 'select', settingName: 'p4_gunIndex', description: t('Define mouse index to use for player 4.'), options: Array.from({ length: 9 }, (_, i) => ({ label: String(i), value: String(i) })) },
              { id: 'sinden_submenu', label: t('SINDEN'), submenu: [
                { id: 'global_sindenJoyMode', label: t('SINDEN BUTTONS CONFIGURATION'), type: 'select', settingName: 'global.sindenJoyMode', description: t('Define how to configure Sinden Gun.'), options: [
                  { label: t('STANDARD'), value: 'standard' },
                  { label: t('GAMEPAD MODE'), value: 'joypad' },
                  { label: t('NO CONFIGURATION'), value: 'none' }
                ]},
                { id: 'sindenKill', label: t('KILL SINDEN SOFTWARE'), type: 'toggle', settingName: 'sindenKill', settingType: 'bool', description: t('When using a Sinden gun, kill the Lightgun software when game ends.') }
              ]},
              { id: 'wiimote_submenu', label: t('WIIMOTE'), submenu: [
                { id: 'WiimoteMode', label: t('WIIMOTE CONNECTION MODE'), type: 'select', settingName: 'WiimoteMode', description: t('Define how your wiimote is connected to the DolphinBar.'), options: [
                  { label: t('MODE 2 (NORMAL)'), value: 'normal' },
                  { label: t('MODE 2 (GAME)'), value: 'game' },
                  { label: t('MODE 4 (WIIMOTEGUN)'), value: 'wiimotegun' }
                ]},
                { id: 'WiimoteKbOrder', label: t('WIIMOTE FIX ASSOCIATION'), type: 'toggle', settingName: 'WiimoteKbOrder', settingType: 'bool', description: t('For some emulators, can be used to fix wiimote keyboard and mouse association when using 2 wiimotes.') }
              ]}
            ]
          },
          { id: 'group_system_settings', label: t('SYSTEM SETTINGS'), type: 'group' },
          {
            id: 'advanced_system_settings',
            label: t('PER SYSTEM ADVANCED CONFIGURATION'),
            submenu: (() => {
              const systemsSource = allSystems || []
              const realSystems = systemsSource.filter((s: any) => {
                const isAuto = ['all', 'favorites', 'recent', 'neverplayed', 'retroachievements', '2players', '4players'].includes(s.name)
                const isGenre = s.name.startsWith('_')
                const isCustom = s.name.startsWith('auto-') || s.name.startsWith('custom-')
                const hasExtension = s.extension && s.extension.length > 0
                return !isAuto && !isGenre && !isCustom && hasExtension && s.name !== 'hardware' && s.theme !== 'hardware' && s.hardware !== 'hardware'
              })

              return realSystems.map(sys => ({
                id: `sys_adv_${sys.name}`,
                label: (sys.fullname || sys.name).toUpperCase(),
                submenu: [
                  {
                    id: `sys_adv_${sys.name}_emulator`,
                    label: t('EMULATOR'),
                    type: 'select',
                    settingName: `${sys.name}.emulator`,
                    options: [
                      { label: t('AUTOMÁTICO'), value: 'auto' },
                      ...(sys.emulators?.map((e: any) => ({
                        label: e.name.toUpperCase(),
                        value: e.name
                      })) || [])
                    ]
                  },
                  {
                    id: `sys_adv_${sys.name}_ratio`,
                    label: t('GAME ASPECT RATIO'),
                    type: 'select',
                    settingName: `${sys.name}.ratio`,
                    options: [
                      { label: t('AUTO'), value: 'auto' },
                      { label: '4/3', value: '4/3' },
                      { label: '16/9', value: '16/9' },
                      { label: '16/10', value: '16/10' },
                      { label: 'FULL', value: 'full' }
                    ]
                  },
                  {
                    id: `sys_adv_${sys.name}_shaderset`,
                    label: t('SHADER SET'),
                    type: 'select',
                    settingName: `${sys.name}.shaderset`,
                    options: [
                      { label: t('AUTO'), value: 'auto' },
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
                    ]
                  },
                  {
                    id: `sys_adv_${sys.name}_bezel`,
                    label: t('DECORATIONS'),
                    type: 'select',
                    settingName: `${sys.name}.bezel`,
                    options: [
                      { label: t('AUTO'), value: 'auto' },
                      { label: t('NONE'), value: 'none' }
                    ]
                  },
                  {
                    id: `sys_adv_${sys.name}_smooth`,
                    label: t('JOGOS SUAVES (FILTRO BILINEAR)'),
                    type: 'toggle',
                    settingName: `${sys.name}.smooth`,
                    settingType: 'bool'
                  }
                ]
              }))
            })()
          }
        ]
      },
      {
        id: 'ui_settings', label: t('USER INTERFACE SETTINGS'), submenu: [
          { id: 'theme_set', label: t('THEME'), type: 'select', settingName: 'RIESCADE.ThemeSet',
            options: themes.length ? themes.map(t => ({ label: t.toUpperCase(), value: t })) : [{ label: 'DEFAULT', value: 'default' }]
          },
          { 
            id: 'theme_cfg_submenu', 
            label: t('THEME CONFIGURATION'), 
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
        id: 'controller_settings', label: t('CONTROLLER SETTINGS'), submenu: [
          { id: 'configure_input', label: t('CONFIGURE INPUT'), type: 'action', onClick: () => {} }
        ]
      },
      {
        id: 'sound_settings', label: t('SOUND SETTINGS'), submenu: [
          { id: 'group_volume', label: t('VOLUME'), type: 'group' },
          { id: 'system_volume', label: t('SYSTEM VOLUME'), type: 'slider', settingName: 'Volume', settingType: 'int', min: 0, max: 100, step: 1, suffix: '%' },
          { id: 'music_volume', label: t('MUSIC VOLUME'), type: 'slider', settingName: 'MusicVolume', settingType: 'int', min: 0, max: 100, step: 1, suffix: '%' },
          { id: 'volume_popup', label: t('SHOW OVERLAY WHEN VOLUME CHANGES'), type: 'toggle', settingName: 'VolumePopup', settingType: 'bool' },
          
          { id: 'group_music', label: t('MUSIC'), type: 'group' },
          { id: 'frontend_music', label: t('FRONTEND MUSIC'), type: 'toggle', settingName: 'audio.bgmusic', settingType: 'bool' },
          { id: 'display_titles', label: t('DISPLAY SONG TITLES'), type: 'toggle', settingName: 'audio.display_titles', settingType: 'bool' },
          { id: 'display_titles_time', label: t('SONG TITLE DISPLAY DURATION'), type: 'slider', settingName: 'audio.display_titles_time', settingType: 'int', min: 2, max: 120, step: 2, suffix: 's' },
          { id: 'persystem', label: t('ONLY PLAY SYSTEM-SPECIFIC MUSIC FOLDER'), type: 'toggle', settingName: 'audio.persystem', settingType: 'bool' },
          { id: 'thememusics', label: t('PLAY SYSTEM-SPECIFIC MUSIC'), type: 'toggle', settingName: 'audio.thememusics', settingType: 'bool' },
          { id: 'video_lowers_music', label: t('LOWER MUSIC WHEN PLAYING VIDEO'), type: 'toggle', settingName: 'VideoLowersMusic', settingType: 'bool' },
          { id: 'use_favorite_music', label: t('PLAY ONLY SONGS FROM YOUR FAVORITES PLAYLIST'), type: 'toggle', settingName: 'audio.useFavoriteMusic', settingType: 'bool' },
          { id: 'selection_favorite_songs', label: t('SELECTION OF FAVORITE SONGS'), type: 'action', onClick: () => { alert(t('SELECTION OF FAVORITE SONGS')) } },
          
          { id: 'group_sounds', label: t('SOUNDS'), type: 'group' },
          { id: 'enable_sounds', label: t('ENABLE NAVIGATION SOUNDS'), type: 'toggle', settingName: 'EnableSounds', settingType: 'bool' },
          { id: 'video_audio', label: t('ENABLE VIDEO PREVIEW AUDIO'), type: 'toggle', settingName: 'VideoAudio', settingType: 'bool' }
        ]
      },
      {
        id: 'game_collections', label: t('GAME COLLECTION SETTINGS'), submenu: [
          { id: 'group_collections_display', label: t('COLEÇÕES A SEREM EXIBIDAS'), type: 'group' },
          { 
            id: 'systems_displayed', 
            label: t('SISTEMAS EXIBIDOS'), 
            showCount: true,
            submenu: (() => {
              const systemsSource = allSystems || []
              const realSystems = systemsSource.filter((s: any) => {
                const isAuto = ['all', 'favorites', 'recent', 'neverplayed', 'retroachievements', '2players', '4players'].includes(s.name)
                const isGenre = s.name.startsWith('_')
                const isCustom = s.name.startsWith('auto-') || s.name.startsWith('custom-')
                const hasExtension = s.extension && s.extension.length > 0
                return !isAuto && !isGenre && !isCustom && hasExtension && s.name !== 'hardware' && s.theme !== 'hardware' && s.hardware !== 'hardware'
              })
              
              const groups: Record<string, any[]> = {}
              realSystems.forEach((s: any) => {
                const hw = s.hardware || t('OUTROS')
                if (!groups[hw]) groups[hw] = []
                groups[hw].push(s)
              })

              const sortedGroups = Object.keys(groups).sort((a, b) => {
                if (a === t('OUTROS')) return 1
                if (b === t('OUTROS')) return -1
                return a.localeCompare(b)
              })

              const finalItems: MenuItem[] = []

              sortedGroups.forEach(groupName => {
                finalItems.push({ id: `group_hw_${groupName}`, label: groupName.toUpperCase(), type: 'group' })
                
                const sortedSystems = groups[groupName].sort((a, b) => 
                  (a.fullname || a.name).localeCompare(b.fullname || b.name)
                )

                sortedSystems.forEach(sys => {
                  finalItems.push({
                    id: `sys_vis_${sys.name}`,
                    label: sys.fullname || sys.name.toUpperCase(),
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
            
            { id: 'group_other_arcades', label: t('MANUFACTURERS'), type: 'group' },
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
            { id: 'col_mitchell', label: t('MITCHELL'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zmitchell' },
            { id: 'col_znichibutsu', label: t('NICHIBUTSU'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'znichibutsu' },
            { id: 'col_znk', label: t('NMK'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'znk' },
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
          { 
            id: 'custom_collections_submenu', 
            label: t('COLEÇÕES DE JOGO PERSONALIZADOS'), 
            showCount: true,
            submenu: (() => {
              const collectionsSource = customCollections || []
              if (collectionsSource.length === 0) {
                return [{ id: 'no_collections_found', label: t('NENHUMA COLEÇÃO ENCONTRADA'), type: 'info', value: '' }]
              }

              return collectionsSource.map(colName => ({
                id: `col_custom_${colName}`,
                label: colName.toUpperCase(),
                type: 'toggle',
                settingName: 'CollectionSystemsCustom',
                value: colName
              }))
            })()
          },
          { 
            id: 'grouped_systems', 
            label: t('SISTEMAS AGRUPADOS'), 
            showCount: true,
            submenu: (() => {
              const systemsSource = allSystems || []
              const realSystems = systemsSource.filter((s: any) => {
                const isAuto = ['all', 'favorites', 'recent', 'neverplayed', 'retroachievements', '2players', '4players'].includes(s.name)
                const isGenre = s.name.startsWith('_')
                const isCustom = s.name.startsWith('auto-') || s.name.startsWith('custom-')
                const hasExtension = s.extension && s.extension.length > 0
                const isMaster = s.group && s.name.toLowerCase() === s.group.toLowerCase()
                return !isAuto && !isGenre && !isCustom && hasExtension && s.group && !isMaster && s.name !== 'hardware' && s.theme !== 'hardware' && s.hardware !== 'hardware'
              })
              
              if (realSystems.length === 0) {
                return [{ id: 'no_groupable_systems', label: t('NENHUM SISTEMA AGRUPÁVEL ENCONTRADO'), type: 'info', value: '' }]
              }

              const groups: Record<string, any[]> = {}
              realSystems.forEach((s: any) => {
                const grp = String(s.group).toLowerCase()
                if (!groups[grp]) groups[grp] = []
                groups[grp].push(s)
              })

              const sortedGroups = Object.keys(groups).sort()

              const finalItems: MenuItem[] = []

              sortedGroups.forEach(groupName => {
                const masterSys = systemsSource.find((s: any) => s.name.toLowerCase() === groupName.toLowerCase())
                const displayLabel = masterSys ? (masterSys.fullname || masterSys.name) : groupName

                finalItems.push({ id: `group_grp_hw_${groupName}`, label: displayLabel.toUpperCase(), type: 'group' })
                
                const sortedSystems = groups[groupName].sort((a, b) => 
                  (a.fullname || a.name).localeCompare(b.fullname || b.name)
                )

                sortedSystems.forEach(sys => {
                  finalItems.push({
                    id: `sys_grp_${sys.name}`,
                    label: sys.fullname || sys.name.toUpperCase(),
                    type: 'toggle',
                    settingName: 'SystemsGrouped',
                    value: sys.name
                  })
                })
              })

              return finalItems
            })()
          },
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
            ...visibleSystems.map(sys => ({
              label: getFriendlySystemName(sys).toUpperCase(),
              value: sys.name
            }))
          ]},
          { id: 'start_gamelist', label: t('INICIAR NA LISTA DE JOGOS'), type: 'toggle', settingName: 'StartOnGamelist', settingType: 'bool' },
          { id: 'show_hidden_games_collections', label: t('EXIBIR JOGOS DE SISTEMAS OCULTOS NAS COLEÇÕES'), type: 'toggle', settingName: 'CollectionShowHidden', settingType: 'bool' },
          { id: 'show_empty_systems', label: t('EXIBIR SISTEMAS VAZIOS'), type: 'toggle', settingName: 'LoadEmptySystems', settingType: 'bool' },
        ]
      },
      {
        id: 'scraper', label: t('SCRAPER'), tabs: ['SCRAPE', 'OPTIONS', 'ACCOUNTS'], submenu: [
          // === TAB 0: SCRAPE ===
          { id: 'group_scrape_source', label: t('SOURCE'), type: 'group', tab: 0 },
          { id: 'scrape_from', label: t('SCRAPE FROM'), type: 'select', settingName: 'Scraper', tab: 0, options: [
            { label: 'SCREEN SCRAPER', value: 'ScreenScraper' },
            { label: 'THE GAMES DB', value: 'TheGamesDB' },
            { label: 'HFSDB', value: 'HfsDB' },
            { label: 'IGDB', value: 'IGDB' },
            { label: 'ARCADEDB', value: 'ArcadeDB' }
          ]},
          { id: 'group_scrape_filters', label: t('FILTERS'), type: 'group', tab: 0 },
          { id: 'scrape_filter', label: t('GAMES TO SCRAPE FOR'), type: 'select', settingName: 'ScrapperFilter', tab: 0, options: [
            { label: t('TODOS OS JOGOS'), value: 'all' },
            { label: t('FALTANDO QUALQUER MÍDIA'), value: 'missing' },
            { label: t('FALTANDO TODAS AS MÍDIAS'), value: 'missing_all' }
          ]},
          { 
            id: 'scrape_ignore_recent', 
            label: t('IGNORE RECENTLY SCRAPED GAMES'), 
            type: 'select', 
            settingName: 'ScrapperIgnoreRecent', 
            tab: 0,
            options: [
              { label: t('NÃO'), value: '0' },
              { label: t('LAST DAY'), value: '1' },
              { label: t('LAST WEEK'), value: '7' },
              { label: t('LAST 15 DAYS'), value: '15' },
              { label: t('LAST MONTH'), value: '31' },
              { label: t('LAST 3 MONTHS'), value: '90' },
              { label: t('LAST YEAR'), value: '365' }
            ]
          },
          {
            id: 'scraper_systems_included',
            label: t('SYSTEMS INCLUDED'),
            showCount: true,
            tab: 0,
            submenu: (() => {
              const systemsSource = allSystems || []
              const scrapableSystems = systemsSource.filter((s: any) => {
                const isAuto = ['all', 'favorites', 'recent', 'neverplayed', 'retroachievements', '2players', '4players'].includes(s.name)
                const isGenre = s.name.startsWith('_')
                const isCustom = s.name.startsWith('auto-') || s.name.startsWith('custom-')
                const hasExtension = s.extension && s.extension.length > 0
                return !isAuto && !isGenre && !isCustom && hasExtension && s.name !== 'hardware' && s.theme !== 'hardware' && s.hardware !== 'hardware'
              })

              if (scrapableSystems.length === 0) {
                return [{ id: 'no_scraper_systems', label: t('NO SYSTEMS FOUND'), type: 'info', value: '' }] as MenuItem[]
              }

              return scrapableSystems
                .sort((a, b) => (a.fullname || a.name).localeCompare(b.fullname || b.name))
                .map(sys => ({
                  id: `scraper_sys_${sys.name}`,
                  label: sys.fullname || sys.name.toUpperCase(),
                  type: 'toggle',
                  settingName: 'ScraperSystems',
                  value: sys.name
                })) as MenuItem[]
            })()
          },
          { id: 'group_scrape_actions', label: t('AÇÕES'), type: 'group', tab: 0 },
          { id: 'scrape_now', label: t('SCRAPE NOW'), type: 'action', tab: 0, onClick: () => {
            alert(t('SCRAPE NOW'))
          }},

          // === TAB 1: OPTIONS ===
          { id: 'group_scrape_settings', label: t('SETTINGS'), type: 'group', tab: 1 },
          { id: 'scrape_image_src', label: t('IMAGE SOURCE'), type: 'select', settingName: 'ScrapperImageSrc', tab: 1, options: [
            { label: t('NONE'), value: '' },
            { label: t('SCREENSHOT'), value: 'ss' },
            { label: t('TITLE SCREENSHOT'), value: 'sstitle' },
            { label: t('MIX V1'), value: 'mixrbv1' },
            { label: t('MIX V2'), value: 'mixrbv2' },
            { label: t('BOX 2D'), value: 'box-2D' },
            { label: t('BOX 3D'), value: 'box-3D' },
            { label: t('FAN ART'), value: 'fanart' }
          ]},
          { id: 'scrape_thumb_src', label: t('BOX SOURCE'), type: 'select', settingName: 'ScrapperThumbSrc', tab: 1, options: [
            { label: t('NONE'), value: '' },
            { label: t('BOX 2D'), value: 'box-2D' },
            { label: t('BOX 3D'), value: 'box-3D' }
          ]},
          { id: 'scrape_logo_src', label: t('LOGO SOURCE'), type: 'select', settingName: 'ScrapperLogoSrc', tab: 1, options: [
            { label: t('NONE'), value: '' },
            { label: t('HD WHEEL'), value: 'wheel-hd' },
            { label: t('WHEEL'), value: 'wheel' },
            { label: t('MARQUEE'), value: 'marquee' }
          ]},
          { id: 'scrape_region', label: t('PREFERED REGION'), type: 'select', settingName: 'ScraperRegion', tab: 1, options: [
            { label: t('AUTOMÁTICO'), value: '' },
            { label: t('EUROPE'), value: 'eu' },
            { label: t('USA'), value: 'us' },
            { label: t('JAPAN'), value: 'jp' },
            { label: t('WORLD'), value: 'wor' }
          ]},
          { id: 'scrape_names', label: t('OVERWRITE NAMES'), type: 'toggle', settingName: 'ScrapeNames', settingType: 'bool', tab: 1 },
          { id: 'scrape_desc', label: t('OVERWRITE DESCRIPTIONS'), type: 'toggle', settingName: 'ScrapeDescription', settingType: 'bool', tab: 1 },
          { id: 'scrape_overwrite', label: t('OVERWRITE MEDIAS'), type: 'toggle', settingName: 'ScrapeOverWrite', settingType: 'bool', tab: 1 },
          { id: 'group_scrape_for', label: t('SCRAPE FOR'), type: 'group', tab: 1 },
          { id: 'scrape_short_title', label: t('SHORT NAME'), type: 'toggle', settingName: 'ScrapeShortTitle', settingType: 'bool', tab: 1 },
          { id: 'scrape_ratings_toggle', label: t('COMMUNITY RATING'), type: 'toggle', settingName: 'ScrapeRatings', settingType: 'bool', tab: 1 },
          { id: 'scrape_videos_toggle', label: t('VIDEO'), type: 'toggle', settingName: 'ScrapeVideos', settingType: 'bool', tab: 1 },
          { id: 'scrape_fanart', label: t('FANART'), type: 'toggle', settingName: 'ScrapeFanart', settingType: 'bool', tab: 1 },
          { id: 'scrape_bezel', label: t('BEZEL (16:9)'), type: 'toggle', settingName: 'ScrapeBezel', settingType: 'bool', tab: 1 },
          { id: 'scrape_boxback', label: t('BOX BACKSIDE'), type: 'toggle', settingName: 'ScrapeBoxBack', settingType: 'bool', tab: 1 },
          { id: 'scrape_map', label: t('MAP'), type: 'toggle', settingName: 'ScrapeMap', settingType: 'bool', tab: 1 },
          { id: 'scrape_manual', label: t('MANUAL'), type: 'toggle', settingName: 'ScrapeManual', settingType: 'bool', tab: 1 },
          { id: 'scrape_padtokey', label: t('PADTOKEY SETTINGS'), type: 'toggle', settingName: 'ScrapePadToKey', settingType: 'bool', tab: 1 },
          { id: 'group_manual_scrape', label: t('MANUAL SCRAPE'), type: 'group', tab: 1 },
          {
            id: 'included_scrapers_submenu',
            label: t('INCLUDED SCRAPERS'),
            showCount: true,
            tab: 1,
            submenu: [
              { id: 'inc_scrape_screenscraper', label: 'SCREEN SCRAPER', type: 'toggle', settingName: 'DisabledManualScrapers', value: 'ScreenScraper' },
              { id: 'inc_scrape_thegamesdb', label: 'THE GAMES DB', type: 'toggle', settingName: 'DisabledManualScrapers', value: 'TheGamesDB' },
              { id: 'inc_scrape_hfsdb', label: 'HFSDB', type: 'toggle', settingName: 'DisabledManualScrapers', value: 'HfsDB' },
              { id: 'inc_scrape_igdb', label: 'IGDB', type: 'toggle', settingName: 'DisabledManualScrapers', value: 'IGDB' },
              { id: 'inc_scrape_arcadedb', label: 'ARCADEDB', type: 'toggle', settingName: 'DisabledManualScrapers', value: 'ArcadeDB' }
            ]
          },

          // === TAB 2: ACCOUNTS ===
          { id: 'group_screenscraper_account', label: t('SCREENSCRAPER'), type: 'group', tab: 2 },
          { id: 'screenscraper_user', label: t('USERNAME'), type: 'input', settingName: 'ScreenScraperUser', settingType: 'string', tab: 2 },
          { id: 'screenscraper_pass', label: t('PASSWORD'), type: 'input', settingName: 'ScreenScraperPass', settingType: 'string', isPassword: true, tab: 2 },
          { id: 'group_igdb_account', label: t('IGDB'), type: 'group', tab: 2 },
          { id: 'igdb_client_id', label: t('CLIENT ID'), type: 'input', settingName: 'IGDBClientID', settingType: 'string', tab: 2 },
          { id: 'igdb_secret', label: t('CLIENT SECRET'), type: 'input', settingName: 'IGDBSecret', settingType: 'string', isPassword: true, tab: 2 }
        ]
      },
      {
        id: 'updates_downloads', label: t('UPDATES & DOWNLOADS'), submenu: [
          { id: 'group_software_updates', label: t('SOFTWARE UPDATES'), type: 'group' },
          { id: 'updates_enabled', label: t('CHECK FOR UPDATES'), type: 'toggle', settingName: 'updates.enabled', settingType: 'bool' },
          { id: 'updates_type', label: t('UPDATE TYPE'), type: 'select', settingName: 'updates.type', options: [
            { label: t('ESTÁVEL'), value: 'stable' },
            { label: t('BETA'), value: 'beta' },
            { label: t('BETA (BUTTERFLY)'), value: 'butterfly' },
            { label: t('INSTÁVEL'), value: 'unstable' }
          ]},
          { id: 'group_updates_actions', label: t('AÇÕES'), type: 'group' },
          { id: 'start_update', label: t('START UPDATE'), type: 'action', onClick: () => {
            alert(t('START UPDATE'))
          }}
        ]
      },
      {
        id: 'system_settings', label: t('SYSTEM SETTINGS'), submenu: [
          { id: 'group_system', label: t('SYSTEM'), type: 'group' },
          { id: 'information_submenu', label: t('INFORMATION'), submenu: [
            { id: 'info_version', label: t('VERSION'), type: 'info', value: versions.es || 'RIESCADE v2.0.0' },
            { id: 'info_user_disk', label: t('USER DISK USAGE'), type: 'info', value: '142.5 GB / 476.2 GB (30%)' },
            { id: 'info_sys_disk', label: t('SYSTEM DISK USAGE'), type: 'info', value: '45.1 GB / 118.0 GB (38%)' },
            { id: 'group_info_cpu', label: t('CPU'), type: 'group' },
            { id: 'info_cpu_model', label: t('CPU MODEL'), type: 'info', value: 'AMD Ryzen 5 5600X 6-Core Processor' },
            { id: 'info_cpu_cores', label: t('CPU CORES'), type: 'info', value: '12 threads' },
            { id: 'info_cpu_speed', label: t('CPU MAX FREQUENCY'), type: 'info', value: '4.6 GHz' },
            { id: 'group_info_ram', label: t('RAM'), type: 'group' },
            { id: 'info_ram_total', label: t('AVAILABLE MEMORY'), type: 'info', value: '11.8 GB / 15.9 GB' },
            { id: 'group_info_graphics', label: t('GRAPHICS'), type: 'group' },
            { id: 'info_gpu_model', label: t('GPU MODEL'), type: 'info', value: 'NVIDIA GeForce RTX 3060' },
            { id: 'info_display_res', label: t('DISPLAY RESOLUTION'), type: 'info', value: '1920x1080@60Hz' },
            { id: 'info_video_driver', label: t('VIDEO DRIVER'), type: 'info', value: 'OpenGL v4.6 (NVIDIA 551.23)' }
          ]},
          { id: 'language', label: t('LANGUAGE (REGION)'), type: 'select', settingName: 'Language', options: 
            Object.keys(locales).sort().map(lang => ({ 
              label: lang.toUpperCase().replace('_', '-'), 
              value: lang 
            }))
          },
          { id: 'clock_mode', label: t('SHOW CLOCK IN 12-HOUR FORMAT'), type: 'toggle', settingName: 'ClockMode12', settingType: 'bool' },
          { id: 'power_saving', label: t('POWER SAVING MODE'), type: 'select', settingName: 'PowerSaverMode', options: [
            { label: t('DISABLED'), value: 'disabled' },
            { label: t('DEFAULT'), value: 'default' },
            { label: t('ENHANCED'), value: 'enhanced' },
            { label: t('INSTANT'), value: 'instant' }
          ]},
          { id: 'screen_reader', label: t('SCREEN READER (TEXT TO SPEECH)'), type: 'toggle', settingName: 'TTS', settingType: 'bool' },
          { id: 'ui_mode', label: t('USER INTERFACE MODE'), type: 'select', settingName: 'UIMode', options: [
            { label: t('FULL'), value: 'Full' },
            { label: t('BASIC'), value: 'Basic' },
            { label: t('KIOSK'), value: 'Kiosk' }
          ]},
          { id: 'group_advanced', label: t('ADVANCED'), type: 'group' },
          { id: 'developer_options_submenu', label: t('FRONTEND DEVELOPER OPTIONS'), submenu: [
            { id: 'group_dev_video', label: t('VIDEO OPTIONS'), type: 'group' },
            { id: 'vram_limit', label: t('VRAM LIMIT'), type: 'slider', settingName: 'MaxVRAM', settingType: 'int', min: 40, max: 1000, step: 10, suffix: ' Mb' },
            { id: 'show_fps', label: t('SHOW FRAMERATE'), type: 'toggle', settingName: 'DrawFramerate', settingType: 'bool' },
            { id: 'vsync', label: t('VSYNC'), type: 'toggle', settingName: 'VSync', settingType: 'bool' },
            { id: 'overscan', label: t('OVERSCAN'), type: 'toggle', settingName: 'Overscan', settingType: 'bool' }
          ]}
        ]
      },
      { id: 'quit', label: t('QUIT'), type: 'action', onClick: () => window.api?.executeCommand('exit-frontend') }
    ]

    return items
  }

  const currentStackItem = activeMenuStack[activeMenuStack.length - 1]
  const currentMenu = currentStackItem ? (currentStackItem.tabs && currentStackItem.activeTab !== undefined ? currentStackItem.items.filter(item => item.tab === currentStackItem.activeTab) : currentStackItem.items) : []
  const menuTitle = currentStackItem?.title || 'MAIN MENU'

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

      if (currentStackItem && currentStackItem.tabs && currentStackItem.tabs.length > 0 && currentStackItem.activeTab !== undefined) {
        if (e.key === 'PageUp' || e.key === 'q' || e.key === 'Q') {
          const newTab = (currentStackItem.activeTab - 1 + currentStackItem.tabs.length) % currentStackItem.tabs.length
          setActiveMenuStack(prev => {
            const next = [...prev]
            next[next.length - 1] = { ...next[next.length - 1], activeTab: newTab }
            return next
          })
          setSelectedIndex(0)
          e.preventDefault()
          return
        } else if (e.key === 'PageDown' || e.key === 'e' || e.key === 'E') {
          const newTab = (currentStackItem.activeTab + 1) % currentStackItem.tabs.length
          setActiveMenuStack(prev => {
            const next = [...prev]
            next[next.length - 1] = { ...next[next.length - 1], activeTab: newTab }
            return next
          })
          setSelectedIndex(0)
          e.preventDefault()
          return
        }
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
          setActiveMenuStack(prev => [...prev, { items: item.submenu!, title: item.label, tabs: item.tabs, activeTab: item.tabs ? 0 : undefined }])
          setSelectedIndex(0)
        } else if (item.type === 'select' && item.options) {
          const currentSettingVal = item.id.startsWith('theme_opt_') ? getThemeSetting(item.settingName!) : getSetting(item.settingName!)
          const activeIndex = item.options.findIndex(opt => isOptionMatch(opt.value, currentSettingVal))

          // Convert options to a temporary submenu
          const optionsSubmenu: MenuItem[] = item.options.map(opt => ({
            id: `opt_${opt.value}`,
            label: opt.label.toUpperCase(),
            type: 'action',
            description: opt.description,
            onClick: () => {
              if (item.id.startsWith('theme_opt_')) updateThemeSetting(item.settingName!, opt.value)
              else updateSetting(item.settingName!, opt.value)
              setActiveMenuStack(prev => prev.slice(0, -1))
              setSelectedIndex(selectedIndex)
            }
          }))
          setActiveMenuStack(prev => [...prev, { items: optionsSubmenu, title: item.label }])
          setSelectedIndex(activeIndex !== -1 ? activeIndex : 0)
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
          // Going back from a submenu: save quietly!
          handleSaveQuietly(pendingSettings)
          if (activeMenuStack.length === 2 && needsReload) {
            // Returning to the Main Menu (activeMenuStack.length becomes 1)
            // Save and reload frontend!
            setTimeout(() => {
              window.api.executeCommand('reload-frontend')
            }, 100)
          } else {
            setActiveMenuStack(prev => prev.slice(0, -1))
            setSelectedIndex(0)
          }
        } else {
          // Exiting the main menu entirely
          const hasChanges = Object.keys(pendingSettings).length > 0 || Object.keys(themeSettings).some(k => themeSettings[k] !== themeData[`options:${k}`])
          if (hasChanges || needsReload) {
            handleSaveQuietly(pendingSettings).then(() => {
              onClose()
              window.api.executeCommand('reload-frontend')
            })
          } else {
            onClose()
          }
        }
      }
    },
    [isOpen, currentMenu, selectedIndex, activeMenuStack, onClose, pendingSettings, themeSettings, settings, showSaveModal, modalSelectedIndex, themeData, needsReload]
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
      
      const isMultiCheck = item.value !== undefined && !item.settingType
      if (isMultiCheck) {
        if (item.settingName === 'DisabledManualScrapers') {
          const values = String(currentSettingVal || '').split(';').filter(v => v.trim() !== '')
          isOn = !values.includes(item.value)
        } else {
          const values = String(currentSettingVal || '').split(',').filter(v => v.trim() !== '')
          
          if ((item.settingName === 'VisibleSystems' || item.settingName === 'ScraperSystems') && values.length === 0) {
            isOn = true // Default to all selected
          } else {
            isOn = values.includes(item.value)
          }
        }

        return (
          <div className={`menu-checkbox ${isOn ? 'checked' : 'unchecked'}`}>
            {isOn && <span className="checkmark">✔</span>}
          </div>
        )
      }

      return (
        <div className={`menu-toggle ${isOn ? 'on' : 'off'}`}>
          <div className="toggle-thumb" />
        </div>
      )
    }
    if (item.type === 'select') {
      const currentVal = currentSettingVal !== undefined ? currentSettingVal : item.options?.[0]?.value
      const label = item.options?.find(o => isOptionMatch(o.value, currentVal))?.label || currentVal
      return (
        <div className="menu-select">
          <span className="arrow">◁</span>
          <span className="value">{label}</span>
          <span className="arrow">▷</span>
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
              if ((sub.settingName === 'VisibleSystems' || sub.settingName === 'ScraperSystems') && values.length === 0) {
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
                <div className="riescade-menu-text-container">
                  <span className="riescade-menu-label">
                    {item.label}
                  </span>
                  {item.description && (
                    <span className="riescade-menu-description">
                      {item.description}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="riescade-menu-text-container">
                <span className="riescade-menu-label">
                  {item.label}
                </span>
                {item.description && (
                  <span className="riescade-menu-description">
                    {item.description}
                  </span>
                )}
              </div>
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
            {currentStackItem?.tabs && currentStackItem.tabs.length > 0 && (
              <div className="riescade-menu-tabs">
                {currentStackItem.tabs.map((tab, idx) => (
                  <div
                    key={tab}
                    className={`riescade-menu-tab ${idx === currentStackItem.activeTab ? 'active' : ''}`}
                    onClick={() => {
                      setActiveMenuStack(prev => {
                        const next = [...prev]
                        next[next.length - 1] = { ...next[next.length - 1], activeTab: idx }
                        return next
                      })
                      setSelectedIndex(0)
                    }}
                  >
                    {t(tab)}
                  </div>
                ))}
              </div>
            )}
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
        .riescade-menu-header { background: #eee; padding: 15px 0; text-align: center; }
        .riescade-menu-title { margin: 0; color: #333; font-size: 1.4rem; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; }
        .riescade-menu-subtitle { font-size: 0.8rem; color: #666; margin-top: 5px; }
        .riescade-menu-list-container { height: auto; background: #fff; overflow-y: auto; }
        .riescade-menu-item { padding: 12px 30px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.1); transition: background 0.15s ease, color 0.15s ease; color: #444; }
        .riescade-menu-item.selected { background: #3b82f6; color: #fff; }
        .riescade-menu-label { font-weight: 500; font-size: 0.95rem; text-transform: uppercase; }
        .riescade-menu-item.selected .riescade-menu-label { font-weight: 800; }
        .riescade-menu-label-container { display: flex; align-items: center; gap: 10px; }
        .riescade-menu-text-container { display: flex; flex-direction: column; align-items: flex-start; text-align: left; gap: 2px; }
        .riescade-menu-description { font-size: 0.75rem; color: #777; font-weight: 400; text-transform: none; line-height: 1.3; margin-top: 2px; }
        .riescade-menu-item.selected .riescade-menu-description { color: rgba(255, 255, 255, 0.8); }
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
        .menu-checkbox { width: 20px; height: 20px; border: 2px solid #aaa; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.05); transition: all 0.15s ease; }
        .menu-checkbox.checked { background: #3b82f6; border-color: #3b82f6; color: #fff; }
        .menu-checkbox .checkmark { font-size: 12px; font-weight: bold; }
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

        .riescade-menu-tabs { width:100%; display: flex; justify-content: flex-start; gap: 0; padding: 12px 25px 0; }
        .riescade-menu-tab { width:auto; padding: 5px 20px; font-size: 1.2rem; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; cursor: pointer; color: #999; border-bottom: 3px solid transparent; transition: color 0.2s ease, border-color 0.2s ease; user-select: none; }
        .riescade-menu-tab:hover { color: var(--theme-color); }
        .riescade-menu-tab.active { color: var(--theme-color); border-bottom-color: var(--theme-color); }
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
