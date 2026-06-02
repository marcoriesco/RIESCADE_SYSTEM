import React, { useState, useEffect, useCallback, useRef } from 'react'
import { WebThemeRenderer } from './theme/WebThemeRenderer'
import { InputConfigOverlay } from './InputConfigOverlay'
import { ScraperProgressModal } from './ScraperProgressModal'

const localeModules = import.meta.glob('../locales/*.json', { eager: true })
const locales: Record<string, any> = {}
Object.entries(localeModules).forEach(([path, module]: [string, any]) => {
  const lang = path.split('/').pop()?.replace('.json', '')
  if (lang) locales[lang] = module.default || module
})

const languageFriendlyNames: Record<string, string> = {
  ar: 'العربية (Arabic)',
  ca: 'Català (Catalan)',
  cs_CZ: 'Čeština (Czech)',
  cy_GB: 'Cymraeg (Welsh)',
  de: 'Deutsch (German)',
  el: 'Ελληνικά (Greek)',
  en_GB: 'English (UK)',
  en_US: 'English (US)',
  es: 'Español (Latinoamérica)',
  es_ES: 'Español (España)',
  es_MX: 'Español (México)',
  eu_ES: 'Euskara (Basque)',
  fi_FI: 'Suomi (Finnish)',
  fr: 'Français (French)',
  fr_FR: 'Français (France)',
  gl_ES: 'Galego (Galician)',
  he: 'עברית (Hebrew)',
  hu: 'Magyar (Hungarian)',
  id_ID: 'Bahasa Indonesia (Indonesian)',
  it: 'Italiano (Italian)',
  ja_JP: '日本語 (Japanese)',
  ko: '한국어 (Korean)',
  nb_NO: 'Norsk Bokmål (Norwegian Bokmål)',
  nl: 'Nederlands (Dutch)',
  nn_NO: 'Norsk Nynorsk (Norwegian Nynorsk)',
  oc_FR: 'Occitan (Occitan)',
  pl: 'Polski (Polish)',
  pt_BR: 'Português (Brasil)',
  pt_PT: 'Português (Portugal)',
  ro_RO: 'Română (Romanian)',
  ru_RU: 'Русский (Russian)',
  sk_SK: 'Slovenčina (Slovak)',
  sv_SE: 'Svenska (Swedish)',
  tr: 'Türkçe (Turkish)',
  uk_UA: 'Українська (Ukrainian)',
  vi_VN: 'Tiếng Việt (Vietnamese)',
  zh_CN: '简体中文 (Simplified Chinese)',
  zh_TW: '繁體中文 (Traditional Chinese)'
}

const isOptionMatch = (optVal: any, settingVal: any) => {
  if (optVal === settingVal) return true
  if (optVal !== null && optVal !== undefined && settingVal !== null && settingVal !== undefined) {
    if (String(optVal) === String(settingVal)) return true
  }
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

const findMenuItemById = (items: MenuItem[], id: string): MenuItem | undefined => {
  for (const item of items) {
    if (item.id === id) return item
    if (item.submenu) {
      const found = findMenuItemById(item.submenu, id)
      if (found) return found
    }
  }
  return undefined
}

interface BiosFile {
  status: string
  md5: string
  path: string
}

interface BiosSystem {
  name: string
  bios: BiosFile[]
}

interface System {
  name: string
  fullName: string
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
  invert?: boolean
}

interface MenuProps {
  isOpen: boolean
  onClose: () => void
  theme?: any
  themeData?: any
  allSystems?: any[]
  selectedSystem?: any
  onUpdateGamelists?: (systemName?: string) => void
}

const getGamepadGuid = (pad: Gamepad): string => {
  const id = pad.id
  const vMatch = id.match(/vendor: ([0-9a-f]{4})/i)
  const pMatch = id.match(/product: ([0-9a-f]{4})/i)
  if (vMatch && pMatch) {
    const v = vMatch[1]
    const p = pMatch[1]
    const vSwap = v.substring(2, 4) + v.substring(0, 2)
    const pSwap = p.substring(2, 4) + p.substring(0, 2)
    return `03000000${vSwap}0000${pSwap}000000000000`.toLowerCase()
  }
  if (id.toLowerCase().includes('xinput') || id.toLowerCase().includes('xbox 360')) {
    return '030000005e0400008e02000000007200'
  }
  return id
}

export const Menu: React.FC<MenuProps> = ({ isOpen, onClose, theme, themeData, allSystems = [], selectedSystem, onUpdateGamelists }) => {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [appVersion, setAppVersion] = useState('2.0.1')
  const [updateState, setUpdateState] = useState<{
    status: 'idle' | 'checking' | 'available' | 'no-update' | 'downloading' | 'error'
    version?: string
    releaseNotes?: string
    zipUrl?: string
    errorMsg?: string
  }>({ status: 'idle' })
  const [pendingSettings, setPendingSettings] = useState<Record<string, any>>({})
  const [themeSettings, setThemeSettings] = useState<Record<string, string>>({})
  const [themes, setThemes] = useState<string[]>([])
  const [connectedGamepads, setConnectedGamepads] = useState<Gamepad[]>([])
  const [configuredControllers, setConfiguredControllers] = useState<any[]>([])
  const [bluetoothDevices, setBluetoothDevices] = useState<{ name: string; id: string }[]>([])
  const [isBluetoothScanning, setIsBluetoothScanning] = useState(false)
  const [activeMenuStack, setActiveMenuStack] = useState<{ items: MenuItem[]; title: string; tabs?: string[]; activeTab?: number; parentItemId?: string; savedSelectedIndex?: number }[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Helper: find the first selectable (non-group) item index in a menu items array
  const findFirstSelectableIndex = (items: MenuItem[]): number => {
    const idx = items.findIndex(item => item.type !== 'group')
    return idx !== -1 ? idx : 0
  }
  const [visible, setVisible] = useState(false)
  const [showInputConfig, setShowInputConfig] = useState(false)
  // NEW STATES FOR MUSIC & BIOS INTEGRATION
  const [favoriteSongsList, setFavoriteSongsList] = useState<string[]>([])
  const [rawBiosData, setRawBiosData] = useState<BiosSystem[]>([])
  const [installedSystems, setInstalledSystems] = useState<System[]>([])
  const [biosViewMode, setBiosViewMode] = useState<'installed' | 'all'>('installed')
  const [showScraperProgress, setShowScraperProgress] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [modalSelectedIndex, setModalSelectedIndex] = useState(0)
  const [showInputModal, setShowInputModal] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [activeInputItem, setActiveInputItem] = useState<MenuItem | null>(null)
  const [customCollections, setCustomCollections] = useState<string[]>([])
  const [needsReload, setNeedsReload] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const [hostname, setHostname] = useState('localhost')
  const bluetoothScanTimeoutRef = useRef<any>(null)

  const pendingSettingsRef = useRef(pendingSettings)
  pendingSettingsRef.current = pendingSettings

  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const currentStackItem = activeMenuStack[activeMenuStack.length - 1]
  const currentMenu = currentStackItem ? (currentStackItem.tabs && currentStackItem.activeTab !== undefined ? currentStackItem.items.filter(item => item.tab === currentStackItem.activeTab) : currentStackItem.items) : []

  const getSetting = (name: string, fallback: any = ''): any => {
    if (name === 'bios_view_mode_temp') {
      return biosViewMode
    }
    let val = (pendingSettingsRef.current[name] !== undefined ? pendingSettingsRef.current[name] : settingsRef.current[name]?.value)
    if (val === undefined || val === null || val === '') {
      if (name.includes('.') && !name.startsWith('global.') && !name.startsWith('RIESCADE.')) {
        return 'auto'
      }
      if (name.endsWith('.emulator')) {
        return 'auto'
      }
      if (name === 'ScraperSystems' && selectedSystem) {
        return selectedSystem.name
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
    if (name === 'all') return t('ALL GAMES')
    if (name === 'favorites') return t('FAVORITES')
    if (name === 'collections') return t('COLLECTIONS')
    if (name === 'recent') return t('LAST PLAYED')
    if (name === 'neverplayed') return t('NEVER PLAYED')
    if (name === 'retroachievements') return 'RETROACHIEVEMENTS'
    return sys.fullname || sys.name.toUpperCase()
  }

  const getThemeSetting = (name: string, fallback: any = ''): any => {
    return themeSettings[name] ?? fallback
  }

  const updateSetting = (name: string, value: any) => {
    if (name === 'bios_view_mode_temp') {
      setBiosViewMode(value as 'installed' | 'all')
      return
    }
    const stringVal = String(value)

    if (name.startsWith('INPUT P') && name.endsWith('NAME')) {
      const pMatch = name.match(/INPUT P(\d+)NAME/)
      const pNum = pMatch ? pMatch[1] : null
      if (pNum) {
        const guidKey = `INPUT P${pNum}GUID`
        const pathKey = `INPUT P${pNum}PATH`
        const selectedPad = connectedGamepads.find(pad => pad.id === value)
        
        if (selectedPad) {
          const guid = getGamepadGuid(selectedPad)
          const path = String(selectedPad.index)
          const cleanName = selectedPad.id.split(' (')[0] || selectedPad.id
          
          setPendingSettings(prev => ({
            ...prev,
            [name]: cleanName,
            [guidKey]: guid,
            [pathKey]: path
          }))
        } else if (!value || value === 'DEFAULT' || value === 'null') {
          setPendingSettings(prev => ({
            ...prev,
            [name]: 'DEFAULT',
            [guidKey]: '',
            [pathKey]: ''
          }))
        } else {
          setPendingSettings(prev => ({
            ...prev,
            [name]: stringVal
          }))
        }
        return
      }
    }

    const dbValue = settingsRef.current[name]?.value ?? ''
    if (String(dbValue) === stringVal) {
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
      window.api.getVersion?.().then((res: any) => {
        if (res && res.app) setAppVersion(res.app)
      }).catch(console.error)
      window.api.getThemes().then(setThemes)
      window.api.getCustomCollections().then(setCustomCollections)
      window.api.getHostname?.().then(setHostname).catch(() => {})
      window.api.getConfiguredControllers?.().then(setConfiguredControllers).catch(console.error)
      window.api.getBluetoothDevices?.().then(setBluetoothDevices).catch(console.error)
      window.api.getMusicFiles().then(setFavoriteSongsList).catch(console.error)
      window.api.getBiosInformation().then(setRawBiosData).catch(console.error)
      window.api.getSystems().then(setInstalledSystems).catch(console.error)

      const updateGamepads = () => {
        const pads = navigator.getGamepads().filter((p): p is Gamepad => p !== null)
        setConnectedGamepads(pads)
      }
      updateGamepads()
      window.addEventListener('gamepadconnected', updateGamepads)
      window.addEventListener('gamepaddisconnected', updateGamepads)
      
      const removeThemesListener = window.api.on('themes-updated', () => {
        window.api.getThemes().then(setThemes)
      })
      
      if (theme?.name) {
        window.api.getThemeSettings(theme.name).then(setThemeSettings)
      }

      setActiveMenuStack([{ items: getMainMenuItems(), title: t('MAIN MENU') }])
      setSelectedIndex(findFirstSelectableIndex(getMainMenuItems()))
      // Animate in
      requestAnimationFrame(() => setVisible(true))

      return () => {
        window.removeEventListener('gamepadconnected', updateGamepads)
        window.removeEventListener('gamepaddisconnected', updateGamepads)
        removeThemesListener()
      }
    } else {
      setVisible(false)
      setShowSaveModal(false)
    }
  }, [isOpen, theme?.name])

  const regenerateStack = useCallback((prevStack: { items: MenuItem[]; title: string; tabs?: string[]; activeTab?: number; parentItemId?: string }[]) => {
    if (prevStack.length === 0) return []
    const mainItems = getMainMenuItems()
    const nextStack = [{ ...prevStack[0], items: mainItems }]
    
    for (let i = 1; i < prevStack.length; i++) {
      const prevItem = prevStack[i]
      if (prevItem.parentItemId) {
        const parentItem = findMenuItemById(mainItems, prevItem.parentItemId)
        if (parentItem && parentItem.submenu) {
          nextStack.push({
            ...prevItem,
            items: parentItem.submenu
          })
          continue
        }
      }
      nextStack.push(prevItem)
    }
    return nextStack
  }, [favoriteSongsList, rawBiosData, installedSystems, biosViewMode])

  // Update menu when settings/themes change
  useEffect(() => {
    if (isOpen && activeMenuStack.length > 0) {
      setActiveMenuStack(prev => regenerateStack(prev))
    }
  }, [
    settings,
    themes,
    customCollections,
    connectedGamepads,
    configuredControllers,
    bluetoothDevices,
    favoriteSongsList,
    rawBiosData,
    installedSystems,
    biosViewMode
  ])

  // Helpers for checklist selection
  const handleSelectAll = useCallback(() => {
    const checklistItems = currentMenu.filter(item => item.type === 'toggle' && item.value !== undefined)
    if (checklistItems.length === 0) return

    const settingName = checklistItems[0].settingName!
    if (settingName === 'audio.favoriteSongs') {
      const allValues = checklistItems.map(item => item.value)
      updateSetting(settingName, allValues.join(';'))
      return
    }

    if (settingName === 'DisabledManualScrapers') {
      updateSetting(settingName, '')
      return
    }

    if (settingName === 'VisibleSystems' || settingName === 'ScraperSystems') {
      updateSetting(settingName, '')
      return
    }

    const allValues = checklistItems.map(item => item.value)
    updateSetting(settingName, allValues.join(','))
  }, [currentMenu, allSystems, updateSetting])

  const handleSelectNone = useCallback(() => {
    const checklistItems = currentMenu.filter(item => item.type === 'toggle' && item.value !== undefined)
    if (checklistItems.length === 0) return

    const settingName = checklistItems[0].settingName!
    if (settingName === 'audio.favoriteSongs') {
      updateSetting(settingName, '')
      return
    }

    if (settingName === 'DisabledManualScrapers') {
      const allValues = checklistItems.map(item => item.value)
      updateSetting(settingName, allValues.join(';'))
      return
    }

    if (settingName === 'VisibleSystems' || settingName === 'ScraperSystems') {
      updateSetting(settingName, 'none')
      return
    }
    updateSetting(settingName, '')
  }, [currentMenu, updateSetting])

  const handleBackAction = useCallback(() => {
    if (activeMenuStack.length > 1) {
      handleSaveQuietly(pendingSettings)
      setActiveMenuStack(prev => prev.slice(0, -1))
      const parentItem = activeMenuStack[activeMenuStack.length - 2]
      const parentItems = parentItem?.items || []
      const savedIdx = parentItem?.savedSelectedIndex
      setSelectedIndex(savedIdx !== undefined ? savedIdx : findFirstSelectableIndex(parentItems))
    } else {
      const hasChanges = Object.keys(pendingSettings).some(k => {
        const pendingVal = pendingSettings[k]
        const originalVal = settings[k]?.value
        const normPending = pendingVal === undefined || pendingVal === null ? '' : String(pendingVal)
        const normOriginal = originalVal === undefined || originalVal === null ? '' : String(originalVal)
        return normPending !== normOriginal
      }) || Object.keys(themeSettings).some(k => {
        const themeVal = themeSettings[k]
        const originalThemeVal = themeData?.[`options:${k}`]
        const normTheme = themeVal === undefined || themeVal === null ? '' : String(themeVal)
        const normOriginalTheme = originalThemeVal === undefined || originalThemeVal === null ? '' : String(originalThemeVal)
        return normTheme !== normOriginalTheme
      })
      if (hasChanges || needsReload) {
        handleSaveQuietly(pendingSettings).then(() => {
          onClose()
          if (needsReload) {
            window.api.executeCommand('reload-frontend')
          }
        })
      } else {
        onClose()
      }
    }
  }, [activeMenuStack, pendingSettings, themeSettings, themeData, settings, needsReload, onClose])

  const getBottomButtons = useCallback((): { id: string; label: string; onClick: () => void }[] => {
    // No buttons on the main menu
    if (activeMenuStack.length <= 1) return []

    const buttons: { id: string; label: string; onClick: () => void }[] = []
    
    const checklistItems = currentMenu.filter(item => item.type === 'toggle' && item.value !== undefined)
    const isChecklist = checklistItems.length > 0

    if (isChecklist) {
      buttons.push({
        id: 'select_all',
        label: t('SELECT ALL'),
        onClick: handleSelectAll
      })
      buttons.push({
        id: 'select_none',
        label: t('SELECT NONE'),
        onClick: handleSelectNone
      })
    }

    if (currentStackItem?.parentItemId === 'scraper' && currentStackItem?.activeTab === 0) {
      buttons.push({
        id: 'scrape_now_btn',
        label: t('SCRAPE NOW'),
        onClick: () => {
          handleSaveQuietly(pendingSettings).then(() => {
            onClose()
            window.api.startScrape()
          })
        }
      })
    }

    if (currentStackItem?.parentItemId === 'missing_bios_submenu') {
      buttons.push({
        id: 'bios_refresh_btn',
        label: t('REFRESH'),
        onClick: async () => {
          const [bios, systems] = await Promise.all([
            window.api.getBiosInformation(),
            window.api.getSystems()
          ])
          setRawBiosData(bios || [])
          setInstalledSystems(systems || [])
        }
      })
    }

    buttons.push({
      id: 'back_btn',
      label: t('BACK'),
      onClick: handleBackAction
    })

    return buttons
  }, [activeMenuStack.length, currentMenu, currentStackItem, handleSelectAll, handleSelectNone, handleBackAction, t, setRawBiosData, setInstalledSystems])

  const handleItemClick = (item: MenuItem, index: number) => {
    setSelectedIndex(index)
    
    if (item.submenu) {
      const submenuItems = item.submenu!
      const filteredItems = item.tabs ? submenuItems.filter(si => si.tab === 0) : submenuItems
      setActiveMenuStack(prev => {
        const updated = [...prev]
        if (updated.length > 0) {
          updated[updated.length - 1] = { ...updated[updated.length - 1], savedSelectedIndex: index }
        }
        return [...updated, { 
          items: submenuItems, 
          title: item.label, 
          tabs: item.tabs, 
          activeTab: item.tabs ? 0 : undefined,
          parentItemId: item.id
        }]
      })
      setSelectedIndex(findFirstSelectableIndex(filteredItems))
    } else if (item.type === 'select' && item.options) {
      const currentSettingVal = item.id.startsWith('theme_opt_') ? getThemeSetting(item.settingName!) : getSetting(item.settingName!)
      const activeIndex = item.options.findIndex(opt => isOptionMatch(opt.value, currentSettingVal))

      const optionsSubmenu: MenuItem[] = item.options.map(opt => ({
        id: `opt_${opt.value}`,
        label: opt.label.toUpperCase(),
        type: 'action',
        description: opt.description,
        onClick: () => {
          if (item.id.startsWith('theme_opt_')) updateThemeSetting(item.settingName!, opt.value)
          else updateSetting(item.settingName!, opt.value)
          setActiveMenuStack(prev => prev.slice(0, -1))
          setSelectedIndex(index)
        }
      }))
      setActiveMenuStack(prev => {
        const updated = [...prev]
        if (updated.length > 0) {
          updated[updated.length - 1] = { ...updated[updated.length - 1], savedSelectedIndex: index }
        }
        return [...updated, { items: optionsSubmenu, title: item.label, parentItemId: item.id }]
      })
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
  }

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
      
      // Special logic for DisabledManualScrapers & audio.favoriteSongs (semicolon separated list of options)
      if ((item.settingName === 'DisabledManualScrapers' || item.settingName === 'audio.favoriteSongs') && item.value !== undefined) {
        const values = String(current || '').split(';').filter(v => v.trim() !== '')
        const isSelected = values.includes(item.value)
        let newValues: string[]
        if (isSelected) {
          newValues = values.filter(v => v !== item.value)
        } else {
          newValues = [...values, item.value]
        }
        
        // Save to settings
        if (item.settingName === 'audio.favoriteSongs') {
          updateSetting(item.settingName, newValues.join(';'))
          window.dispatchEvent(new CustomEvent('riescade-play-nav-sound'))
        } else {
          updateSetting(item.settingName, newValues.join(';'))
        }
        return
      }

      // Special logic for multi-value strings (comma separated)
      if (item.type === 'toggle' && item.value !== undefined && !item.settingType) {
        const values = String(current || '').split(',').filter(v => v.trim() !== '')
        
        // Filter out 'none' to get the actual selected system names
        let currentValues = values.filter(v => v !== 'none')
        
        // Special logic for VisibleSystems/ScraperSystems: if empty, it means ALL are selected
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
        
        // If all systems are selected, we can save an empty string to keep config clean.
        // If no systems are selected, we save 'none'.
        if ((item.settingName === 'VisibleSystems' || item.settingName === 'ScraperSystems') && newValues.length === allSystems.length) {
          updateSetting(item.settingName, '')
        } else if ((item.settingName === 'VisibleSystems' || item.settingName === 'ScraperSystems') && newValues.length === 0) {
          updateSetting(item.settingName, 'none')
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
      const current = parseFloat(getSetting(item.settingName, Math.floor((min + max) / 2)))
      let newVal = current + direction * step
      newVal = Math.max(min, Math.min(max, newVal))
      if (step % 1 !== 0) {
        newVal = parseFloat(newVal.toFixed(2))
      }
      updateSetting(item.settingName, newVal)
    }
  }

  const getMainMenuItems = (): MenuItem[] => {
    const isPhysicalSystem = selectedSystem && !(
      selectedSystem.name === 'collections' ||
      selectedSystem.path?.startsWith('virtual://') ||
      ['all', 'favorites', 'recent', 'neverplayed', 'retroachievements', '2players', '4players', 'vertical', 'lightgun', 'wheel', 'trackball', 'spinner'].includes(selectedSystem.name.toLowerCase())
    )

    const items: MenuItem[] = [
      {
        id: 'game_settings', label: t('GAME SETTINGS'), submenu: [
          { id: 'group_reload_app', label: t('TOOLS'), type: 'group' },
          { id: 'reload_app', label: t('UPDATE GAMELIST'), type: 'action', onClick: () => {
            if (onUpdateGamelists) {
              onUpdateGamelists()
            } else {
              window.api.executeCommand('update-gamelists')
            }
          } },
          ...(isPhysicalSystem ? [{
            id: 'reload_system',
            label: t('UPDATE GAMELIST'),
            description: getFriendlySystemName(selectedSystem).toUpperCase(),
            type: 'action' as const,
            onClick: () => {
              if (onUpdateGamelists) {
                onUpdateGamelists(selectedSystem.name)
              }
            }
          }] : []),
          { id: 'group_accounts', label: t('ACCOUNTS'), type: 'group' },
          { id: 'retroachievements_submenu', label: t('RETROACHIEVEMENTS'), submenu: [
            { id: 'cheevos_enable', label: t('RETROACHIEVEMENTS'), type: 'toggle', settingName: 'global.cheevos', settingType: 'bool' },
            { id: 'cheevos_user', label: t('USERNAME'), type: 'input', settingName: 'global.cheevos.username', settingType: 'string' },
            { id: 'cheevos_pass', label: t('PASSWORD'), type: 'input', settingName: 'global.cheevos.password', settingType: 'string', isPassword: true },
          ]},
          { id: 'netplay_submenu', label: t('NETPLAY SETTINGS'), submenu: [
            { id: 'netplay_enable', label: t('ENABLE NETPLAY'), type: 'toggle', settingName: 'global.netplay', settingType: 'bool' },
            { id: 'netplay_nickname', label: t('NICKNAME'), type: 'input', settingName: 'global.netplay.nickname', settingType: 'string' },
            { id: 'netplay_port', label: t('PORT'), type: 'input', settingName: 'global.netplay.port', settingType: 'string' }
          ]},
          { id: 'group_bios', label: t('BIOS SETTINGS'), type: 'group' },
          {
            id: 'missing_bios_submenu',
            label: t('MISSING BIOS CHECK'),
            tabs: [t('Installed systems'), t('All')],
            submenu: (() => {
              const generateTabItems = (systems: BiosSystem[], tabIndex: number): MenuItem[] => {
                const tabItems: MenuItem[] = []
                for (const sys of systems) {
                  const matched = installedSystems.find(s => s.name.toLowerCase() === sys.name.toLowerCase())
                  const systemFullName = (matched?.fullName || sys.name || 'UNKNOWN')

                  if (sys.bios && sys.bios.length > 0) {
                    tabItems.push({
                      id: `bios_group_${sys.name}_tab${tabIndex}`,
                      label: systemFullName.toUpperCase(),
                      type: 'group',
                      tab: tabIndex
                    })

                    for (const b of sys.bios) {
                      tabItems.push({
                        id: `bios_file_${sys.name}_${b.path}_tab${tabIndex}`,
                        label: b.path,
                        description: `${b.status} - MD5: ${b.md5}`,
                        type: 'info',
                        value: '',
                        tab: tabIndex
                      })
                    }
                  }
                }

                const hasAnyBios = systems.some(sys => sys.bios && sys.bios.length > 0)
                if (!hasAnyBios) {
                  tabItems.push({
                    id: `bios_empty_tab${tabIndex}`,
                    label: t('NO MISSING BIOS FILES'),
                    type: 'info',
                    value: '',
                    tab: tabIndex
                  })
                }

                return tabItems
              }

              const installedNames = new Set(installedSystems.map(s => s.name.toLowerCase()))
              const installedBiosSystems = rawBiosData.filter(sys => installedNames.has(sys.name.toLowerCase()))

              const tab0Items = generateTabItems(installedBiosSystems, 0)
              const tab1Items = generateTabItems(rawBiosData, 1)

              return [...tab0Items, ...tab1Items]
            })()
          },
          { id: 'check_bios_launch', label: t('CHECK BIOS FILES BEFORE RUNNING A GAME'), type: 'toggle', settingName: 'CheckBiosesAtLaunch', settingType: 'bool' },
          { id: 'group_autosave', label: t('SAVE STATES'), type: 'group' },
          { id: 'autosave', label: t('AUTO SAVE/LOAD'), type: 'toggle', settingName: 'global.autosave', settingType: 'bool', description: t('Loads the most recent save state when starting the game and saves the state when exiting.') },
          { 
            id: 'autosave_increment', 
            label: t('INCREMENT TYPE'), 
            type: 'select', 
            settingName: 'global.incrementalsavestates', 
            settingType: 'int',
            options: [
              { label: t('BY SAVE STATE'), value: null, description: t('Never overwrite old save states, always create new ones.') },
              { label: t('BY SAVE SLOT'), value: '0', description: t('Increments a new slot on a new game start.') },
              { label: t('DO NOT INCREMENT'), value: '2', description: t('Uses the current slot on a new game start.') }
            ]
          },
          { 
            id: 'autosave_manager', 
            label: t('SHOW MANAGER'), 
            type: 'select', 
            settingName: 'global.savestates', 
            description: t('Displays the save state manager before starting a game.'),
            options: [
              { label: t('NO'), value: '0' },
              { label: t('ALWAYS'), value: '1' },
              { label: t('IF AVAILABLE'), value: '2' }
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
            { id: 'global_tattoo', label: t('SHOW TATTOO OVER BEZEL'), type: 'toggle', settingName: 'global.tattoo', settingType: 'bool', description: t('Show a control image overlaid on top of the bezel.') },
            { id: 'global_tattoo_corner', label: t('TATTOO CORNER'), type: 'select', settingName: 'global.tattoo_corner', description: t('Select corner of the screen where the tattoo will appear.'), options: [
              { label: t('AUTO'), value: 'auto' },
              { label: t('TOP LEFT'), value: 'NW' },
              { label: t('TOP RIGHT'), value: 'NE' },
              { label: t('BOTTOM RIGHT'), value: 'SE' },
              { label: t('BOTTOM LEFT'), value: 'SW' }
            ]},
            { id: 'global_resize_tattoo', label: t('RESIZE TATTOO'), type: 'toggle', settingName: 'global.resize_tattoo', settingType: 'bool', description: t('Reduces/expands the overlay to fit inside the bezel.') }
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
          { id: 'integerscale', label: t('INTEGER SCALING (PIXEL PERFECT)'), type: 'toggle', settingName: 'global.integerscale', settingType: 'bool' },
          { id: 'smooth_games', label: t('SMOOTH GAMES (BILINEAR FILTERING)'), type: 'toggle', settingName: 'global.smooth', settingType: 'bool' },
          { id: 'discord_rich_presence', label: t('DISCORD RICH PRESENCE'), type: 'toggle', settingName: 'global.discord', settingType: 'bool', description: t('Enable Discord Rich Presence service, this will update Discord status to show the games being played.') },
          { id: 'disableautocontrollers', label: t('AUTOCONFIGURE CONTROLLERS'), type: 'toggle', settingName: 'global.disableautocontrollers', settingType: 'bool' },
          {
            id: 'switch_submenu',
            label: t('SWITCH'),
            description: t('SAVES IN RETROBAT SAVES FOLDER') + ' : ' + (getSetting('yuzu_mutualize', 'false') === 'true' ? t('ON') : t('OFF')),
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
            { label: t('AUTOMATIC'), value: 'ask' },
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
            description: t('G-SYNC/FREESYNC COMPATIBILITY') + ' : ' + (getSetting('vrr_runloop_enable', 'false') === 'true' ? t('ON') : t('OFF')),
            submenu: [
              { id: 'vrr_runloop_enable', label: t('G-SYNC/FREESYNC COMPATIBILITY'), type: 'toggle', settingName: 'vrr_runloop_enable', settingType: 'bool', description: t('Sync to exact content framerate. Only for G-Sync/FreeSync/HDMI-2.1-VRR compatible monitors.') },
              { id: 'video_vsync', label: t('VERTICAL SYNC'), type: 'select', settingName: 'video_vsync', options: [
                { label: t('NO'), value: 'false' },
                { label: t('YES'), value: 'true' },
                { label: t('ADAPTATIVE'), value: 'adaptative' }
              ]},
              { id: 'video_hard_sync', label: t('HARD SYNC'), type: 'select', settingName: 'video_hard_sync', description: t('Only compatible with OpenGL, hard-sync GPU and CPU. Reduce latency at the cost of inscreased performance requirements.'), options: [
                { label: t('NO'), value: 'false' },
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
                      { label: t('AUTOMATIC'), value: 'auto' },
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
                    label: t('SMOOTH GAMES (BILINEAR FILTERING)'),
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
          { id: 'group_appearance', label: t('APPEARANCE'), type: 'group' },
          { id: 'theme_set', label: t('THEME SET'), type: 'select', settingName: 'RIESCADE.ThemeSet',
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
          { id: 'group_mapping', label: t('SETTINGS'), type: 'group' },
          { id: 'configure_input', label: t('CONTROLLER MAPPING'), type: 'action', onClick: () => {
            setShowInputConfig(true)
          } },

          { id: 'group_bluetooth', label: t('BLUETOOTH'), type: 'group' },
          { id: 'pair_bluetooth_auto', label: t('PAIR BLUETOOTH PADS AUTOMATICALLY'), type: 'action', onClick: () => {
            setIsBluetoothScanning(true)
            window.api.executeCommand('pair-bluetooth-auto')
            bluetoothScanTimeoutRef.current = setTimeout(() => {
              setIsBluetoothScanning(false)
              bluetoothScanTimeoutRef.current = null
              // Refresh bluetooth devices after scan
              window.api.getBluetoothDevices?.().then(setBluetoothDevices).catch(console.error)
            }, 6000)
          } },
          { id: 'pair_bluetooth_manual', label: t('PAIR A BLUETOOTH DEVICE MANUALLY'), type: 'action', onClick: () => {
            window.api.executeCommand('pair-bluetooth-manual')
          } },
          { id: 'bluetooth_device_list_submenu', label: t('BLUETOOTH DEVICE LIST'), submenu: (() => {
            if (bluetoothDevices.length === 0) {
              return [{ id: 'no_bt_devices', label: t('NO BLUETOOTH DEVICES FOUND'), type: 'info' }] as MenuItem[]
            }
            return bluetoothDevices.map(dev => ({
              id: `bt_dev_${dev.id}`,
              label: dev.name,
              type: 'info'
            })) as MenuItem[]
          })() },

          { id: 'group_display_options', label: t('DISPLAY OPTIONS'), type: 'group' },
          { id: 'show_notifications', label: t('SHOW CONTROLLER NOTIFICATIONS'), type: 'toggle', settingName: 'ShowControllerNotifications', settingType: 'bool' },
          { id: 'show_activity', label: t('SHOW CONTROLLER ACTIVITY'), type: 'toggle', settingName: 'ShowControllerActivity', settingType: 'bool' },
          ...((getSetting('ShowControllerActivity') === 'true' || getSetting('ShowControllerActivity') === true || getSetting('ShowControllerActivity') === '1' || getSetting('ShowControllerActivity') === 1) ? [
            { id: 'show_battery', label: t('SHOW CONTROLLER BATTERY LEVEL'), type: 'toggle' as const, settingName: 'ShowControllerBattery', settingType: 'bool' as const } as MenuItem
          ] : []),
          { id: 'show_gun_notifications', label: t('SHOW GUN NOTIFICATIONS'), type: 'toggle', settingName: 'ShowGunNotifications', settingType: 'bool' },
          { id: 'draw_gun_crosshair', label: t('DRAW GUN CROSSHAIR'), type: 'toggle', settingName: 'DrawGunCrosshair', settingType: 'bool' },

          { id: 'group_priority', label: t('CONTROLLERS PRIORITY'), type: 'group' },
          ...Array.from({ length: 8 }, (_, i) => {
            const p = i + 1
            const nameSetting = `INPUT P${p}NAME`
            const savedName = getSetting(nameSetting)

            const options = [
              { label: t('AUTOMATIC'), value: 'DEFAULT' }
            ]

            connectedGamepads.forEach(pad => {
              const parsedName = pad.id.split(' (')[0] || pad.id
              options.push({
                // Using exact pad.id as value, display label with index
                label: `#${pad.index + 1} ${parsedName}`,
                value: pad.id
              })
            })

            if (savedName && savedName !== 'DEFAULT') {
              const alreadyListed = options.some(opt => opt.value === savedName || opt.label.endsWith(savedName))
              if (!alreadyListed) {
                options.push({
                  label: `${savedName} (${t('NOT CONNECTED')})`,
                  value: savedName
                })
              }
            }

            return {
              id: `priority_p${p}`,
              label: t(`CONTROLLER #${p}`),
              type: 'select',
              settingName: nameSetting,
              options
            } as MenuItem
          })
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
          {
            id: 'selection_favorite_songs',
            label: t('SELECTION OF FAVORITE SONGS'),
            showCount: true,
            submenu: favoriteSongsList.map(song => {
              const cleanName = song.split('/').pop() || song
              const nameWithoutExt = cleanName.substring(0, cleanName.lastIndexOf('.')) || cleanName
              const label = nameWithoutExt.toUpperCase()
              
              return {
                id: `song_${song}`,
                label,
                type: 'toggle' as const,
                settingName: 'audio.favoriteSongs',
                value: song
              }
            })
          },
          
          { id: 'group_sounds', label: t('SOUNDS'), type: 'group' },
          { id: 'enable_sounds', label: t('ENABLE NAVIGATION SOUNDS'), type: 'toggle', settingName: 'EnableSounds', settingType: 'bool' },
          { id: 'video_audio', label: t('ENABLE VIDEO PREVIEW AUDIO'), type: 'toggle', settingName: 'VideoAudio', settingType: 'bool' }
        ]
      },
      {
        id: 'game_collections', label: t('GAME COLLECTION SETTINGS'), submenu: [
          { id: 'group_collections_display', label: t('COLLECTIONS TO DISPLAY'), type: 'group' },
          { 
            id: 'systems_displayed', 
            label: t('SYSTEMS DISPLAYED'), 
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
                const hw = s.hardware || t('OTHERS')
                if (!groups[hw]) groups[hw] = []
                groups[hw].push(s)
              })

              const sortedGroups = Object.keys(groups).sort((a, b) => {
                if (a === t('OTHERS')) return 1
                if (b === t('OTHERS')) return -1
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
          { id: 'auto_collections', label: t('AUTOMATIC GAME COLLECTIONS'), showCount: true, submenu: [
            { id: 'group_std_cols', label: t('DEFAULT'), type: 'group' },
            { id: 'col_all', label: t('ALL GAMES'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'all' },
            { id: 'col_recent', label: t('LAST PLAYED'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'recent' },
            { id: 'col_favorites', label: t('FAVORITES'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'favorites' },
            { id: 'col_never', label: t('NEVER PLAYED'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'neverplayed' },
            { id: 'col_retro', label: t('RETROACHIEVEMENTS'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'retroachievements' },
            
            { id: 'group_players_cols', label: t('PLAYERS'), type: 'group' },
            { id: 'col_2p', label: t('2 JOGADORES'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '2players' },
            { id: 'col_4p', label: t('4 JOGADORES'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: '4players' },

            { id: 'group_arcade_cols', label: t('ARCADE & HARDWARE'), type: 'group' },
            { id: 'col_vert', label: t('VERTICAL ARCADE'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'vertical' },
            { id: 'col_lightgun', label: t('LIGHTGUN'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'lightgun' },
            { id: 'col_wheel', label: t('WHEEL'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'wheel' },
            { id: 'col_trackball', label: t('TRACKBALL'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'trackball' },
            { id: 'col_spinner', label: t('SPINNER'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'spinner' },
            { id: 'col_zcapcom', label: t('CAPCOM'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zcapcom' },
            { id: 'col_zkonami', label: t('KONAMI'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zkonami' },
            { id: 'col_zsega', label: t('SEGA'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zsega' },
            { id: 'col_znintendo', label: t('NINTENDO'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'znintendo' },
            { id: 'col_ztaito', label: t('TAITO'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'ztaito' },
            { id: 'col_znamco', label: t('NAMCO'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'znamco' },
            { id: 'col_zcave', label: t('CAVE'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zcave' },
            { id: 'col_zmidway', label: t('MIDWAY'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zmidway' },
            { id: 'col_zirem', label: t('IREM'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zirem' },
            { id: 'col_zsnk', label: t('SNK'), type: 'toggle', settingName: 'CollectionSystemsAuto', value: 'zsnk' },

            { id: 'group_genres_cols', label: t('GENRES'), type: 'group' },
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
            label: t('CUSTOM GAME COLLECTIONS'), 
            showCount: true,
            submenu: (() => {
              const collectionsSource = customCollections || []
              if (collectionsSource.length === 0) {
                return [{ id: 'no_collections_found', label: t('NO COLLECTIONS FOUND'), type: 'info', value: '' }]
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
            label: t('GROUPED SYSTEMS'), 
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
                return [{ id: 'no_groupable_systems', label: t('NO GROUPABLE SYSTEMS FOUND'), type: 'info', value: '' }]
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
          { id: 'group_collection_options', label: t('OPTIONS'), type: 'group' },
          { id: 'sort_systems', label: t('SYSTEM SORTING'), type: 'select', settingName: 'SortSystems', options: [
            { label: t('NO'), value: '' },
            { label: t('BY ALPHABETICAL ORDER'), value: 'alpha' },
            { label: t('BY MANUFACTURER'), value: 'manufacturer' },
            { label: t('BY HARDWARE TYPE THEN ALPHABETICALLY'), value: 'hardware' },
            { label: t('BY HARDWARE TYPE THEN YEAR'), value: 'hardware-year' },
            { label: t('BY MANUFACTURER AND TYPE'), value: 'subgroup' },
            { label: t('BY RELEASE YEAR'), value: 'releaseDate' }
          ]},
          { id: 'start_on_system', label: t('START ON SYSTEM'), type: 'select', settingName: 'StartupSystem', options: [
            { label: t('RESTORE LAST SELECTED'), value: 'last' },
            ...visibleSystems.map(sys => ({
              label: getFriendlySystemName(sys).toUpperCase(),
              value: sys.name
            }))
          ]},
          { id: 'start_gamelist', label: t('START ON GAMELIST'), type: 'toggle', settingName: 'StartOnGamelist', settingType: 'bool' },
          { id: 'show_hidden_games_collections', label: t('SHOW GAMES FROM HIDDEN SYSTEMS IN COLLECTIONS'), type: 'toggle', settingName: 'CollectionShowHidden', settingType: 'bool' },
          { id: 'show_empty_systems', label: t('SHOW EMPTY SYSTEMS'), type: 'toggle', settingName: 'LoadEmptySystems', settingType: 'bool' },
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
            { label: t('ALL GAMES'), value: 'all' },
            { label: t('GAMES MISSING ANY MEDIA'), value: 'missing' },
            { label: t('GAMES MISSING ALL MEDIA'), value: 'missing_all' }
          ]},
          { 
            id: 'scrape_ignore_recent', 
            label: t('IGNORE RECENTLY SCRAPED GAMES'), 
            type: 'select', 
            settingName: 'ScrapperIgnoreRecent', 
            tab: 0,
            options: [
              { label: t('NO'), value: '0' },
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
            { label: t('AUTOMATIC'), value: '' },
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
            { label: t('STABLE'), value: 'stable' },
            { label: t('BETA'), value: 'beta' },
            { label: t('BETA (BUTTERFLY)'), value: 'butterfly' },
            { label: t('UNSTABLE'), value: 'unstable' }
          ]},
          { id: 'group_updates_actions', label: t('ACTIONS'), type: 'group' },
          { id: 'start_update', label: t('START UPDATE'), type: 'action', onClick: () => {
            setUpdateState({ status: 'checking' })
            setModalSelectedIndex(0)
            window.api.checkForUpdates()
              .then((res: any) => {
                if (res.updateAvailable) {
                  setUpdateState({
                    status: 'available',
                    version: res.version,
                    releaseNotes: res.releaseNotes,
                    zipUrl: res.zipUrl
                  })
                } else {
                  setUpdateState({ status: 'no-update' })
                }
              })
              .catch((err: any) => {
                setUpdateState({
                  status: 'error',
                  errorMsg: err.message || String(err)
                })
              })
          }}
        ]
      },
      {
        id: 'system_settings', label: t('SYSTEM SETTINGS'), submenu: [
          { id: 'group_system', label: t('SYSTEM'), type: 'group' },
          { id: 'information_submenu', label: t('INFORMATION'), submenu: [
            { id: 'info_version', label: t('VERSION'), type: 'info', value: `RIESCADE v${appVersion}` },
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
              label: (languageFriendlyNames[lang] || lang.toUpperCase().replace('_', '-')).toUpperCase(), 
              value: lang 
            }))
          },
          { id: 'clock_mode', label: t('SHOW CLOCK IN 12-HOUR FORMAT'), type: 'toggle', settingName: 'ClockMode12', settingType: 'bool' },
          { id: 'power_saving', label: t('POWER SAVING MODE'), type: 'select', settingName: 'PowerSaverMode', description: t('Reduces power consumption when idle (useful for handhelds).'), options: [
            { label: t('DISABLED'), value: 'disabled' },
            { label: t('DEFAULT'), value: 'default' },
            { label: t('ENHANCED'), value: 'enhanced' },
            { label: t('INSTANT'), value: 'instant' }
          ]},
          { id: 'screen_reader', label: t('SCREEN READER (TEXT TO SPEECH)'), type: 'toggle', settingName: 'TTS', settingType: 'bool' },
          { id: 'ui_mode', label: t('USER INTERFACE MODE'), type: 'select', settingName: 'UIMode', description: t('Lock down certain config menus for use with guest users/kids.'), options: [
            { label: t('FULL'), value: 'Full' },
            { label: t('BASIC'), value: 'Basic' },
            { label: t('KIOSK'), value: 'Kiosk' }
          ]},
          { id: 'group_advanced', label: t('ADVANCED'), type: 'group' },
          { id: 'developer_options_submenu', label: t('FRONTEND DEVELOPER OPTIONS'), submenu: [
            // === VIDEO OPTIONS ===
            { id: 'group_dev_video', label: t('VIDEO OPTIONS'), type: 'group' },
            { id: 'vram_limit', label: t('VRAM LIMIT'), type: 'slider', settingName: 'MaxVRAM', settingType: 'int', min: 40, max: 1000, step: 10, suffix: ' Mb' },
            { id: 'show_fps', label: t('SHOW FRAMERATE'), type: 'toggle', settingName: 'DrawFramerate', settingType: 'bool', description: t("Also turns on the emulator's native FPS counter, if available.") },
            { id: 'vsync', label: t('VSYNC'), type: 'toggle', settingName: 'VSync', settingType: 'bool' },

            // === TOOLS ===
            { id: 'group_dev_tools', label: t('TOOLS'), type: 'group' },
            { 
              id: 'public_web_api', 
              label: t('ENABLE PUBLIC WEB API ACCESS'), 
              type: 'toggle', 
              settingName: 'PublicWebAccess', 
              settingType: 'bool', 
              description: t('Allow public web access API using') + ' http://' + hostname + ':1234'
            },
            { 
              id: 'log_level', 
              label: t('LOG LEVEL'), 
              type: 'select', 
              settingName: 'LogLevel', 
              settingType: 'string',
              options: [
                { label: t('DEFAULT'), value: '' },
                { label: t('DISABLED'), value: 'disabled' },
                { label: t('WARNING'), value: 'warning' },
                { label: t('ERROR'), value: 'error' },
                { label: t('DEBUG'), value: 'debug' }
              ]
            },
            { 
              id: 'clean_gamelists_action', 
              label: t('CLEAN GAMELISTS & REMOVE UNUSED MEDIA'), 
              type: 'action', 
              onClick: () => {
                if (confirm(t('Are you sure you want to clean gamelists? ROM entries that do not exist will be deleted, and missing media paths will be removed.'))) {
                  window.api.cleanGamelists().then(() => alert(t('Gamelist cleaning completed!'))).catch((err: any) => alert(t('Error:') + ' ' + err))
                }
              } 
            },
            { 
              id: 'reset_gamelist_usage_action', 
              label: t('RESET GAMELISTS USAGE DATA'), 
              type: 'action', 
              onClick: () => {
                if (confirm(t('Are you sure you want to reset play count, last played time, and game time for all games? This cannot be undone.'))) {
                  window.api.resetGamelistUsage().then(() => alert(t('Gamelist usage data reset!'))).catch((err: any) => alert(t('Error:') + ' ' + err))
                }
              } 
            },
            { 
              id: 'reset_file_extensions_action', 
              label: t('RESET FILE EXTENSIONS'), 
              type: 'action', 
              onClick: () => {
                if (confirm(t('Are you sure you want to clear custom hidden extensions config?'))) {
                  window.api.resetFileExtensions().then(() => alert(t('Hidden extensions reset!'))).catch((err: any) => alert(t('Error:') + ' ' + err))
                }
              } 
            },
            { 
              id: 'redetect_lang_region_action', 
              label: t("REDETECT ALL GAMES' LANG/REGION"), 
              type: 'action', 
              onClick: () => {
                alert(t('Language and region redetection is processed in background by EmulationStation.'))
              } 
            },
            { 
              id: 'find_netplay_achievements_action', 
              label: t('FIND ALL GAMES WITH NETPLAY/ACHIEVEMENTS'), 
              type: 'action', 
              onClick: () => {
                alert(t('Scanning games database for achievements and netplay compatibility.'))
              } 
            },
            { 
              id: 'clear_caches_action', 
              label: t('CLEAR CACHES'), 
              type: 'action', 
              onClick: () => {
                if (confirm(t('Are you sure you want to delete cache files?'))) {
                  window.api.clearCaches().then(() => alert(t('Caches cleared successfully!'))).catch((err: any) => alert(t('Error:') + ' ' + err))
                }
              } 
            },

            // === DISPLAY SETTINGS ===
            { id: 'group_dev_display', label: t('DISPLAY SETTINGS'), type: 'group' },
            { 
              id: 'menu_font_scale', 
              label: t('MENU FONT SCALE'), 
              type: 'select', 
              settingName: 'MenuFontScale', 
              settingType: 'string',
              options: [
                { label: t('AUTO'), value: '' },
                { label: '50%', value: '0.5' },
                { label: '75%', value: '0.75' },
                { label: '100%', value: '1.0' },
                { label: '110%', value: '1.1' },
                { label: '125%', value: '1.25' },
                { label: '133%', value: '1.31' },
                { label: '150%', value: '1.5' },
                { label: '175%', value: '1.75' },
                { label: '200%', value: '2' }
              ]
            },
            { 
              id: 'theme_font_scale', 
              label: t('THEME FONT SCALE'), 
              type: 'select', 
              settingName: 'FontScale', 
              settingType: 'string',
              options: [
                { label: t('AUTO'), value: '' },
                { label: '50%', value: '0.5' },
                { label: '75%', value: '0.75' },
                { label: '100%', value: '1.0' },
                { label: '110%', value: '1.1' },
                { label: '125%', value: '1.25' },
                { label: '133%', value: '1.31' },
                { label: '150%', value: '1.5' },
                { label: '175%', value: '1.75' },
                { label: '200%', value: '2' }
              ]
            },
            { 
              id: 'fullscreen_menus', 
              label: t('FULL SCREEN MENUS'), 
              type: 'select', 
              settingName: 'FullScreenMenu', 
              settingType: 'string',
              options: [
                { label: t('AUTO'), value: '' },
                { label: t('YES'), value: 'true' },
                { label: t('NO'), value: 'false' }
              ]
            },
            { 
              id: 'force_small_screen_theming', 
              label: t('FORCE SMALL SCREEN THEMING'), 
              type: 'select', 
              settingName: 'ForceSmallScreen', 
              settingType: 'string',
              options: [
                { label: t('AUTO'), value: '' },
                { label: t('YES'), value: 'true' },
                { label: t('NO'), value: 'false' }
              ]
            },

            // === DATA MANAGEMENT ===
            { id: 'group_dev_data', label: t('DATA MANAGEMENT'), type: 'group' },
            { id: 'ignore_multidisk', label: t('IGNORE MULTI-FILE DISK CONTENT (CUE/GDI/CCD/M3U)'), type: 'toggle', settingName: 'RemoveMultiDiskContent', settingType: 'bool' },
            { id: 'enable_filtering', label: t('ENABLE GAME FILTERING'), type: 'toggle', settingName: 'ForceDisableFilters', settingType: 'bool', invert: true },
            { id: 'save_metadata_exit', label: t('SAVE METADATA ON EXIT'), type: 'toggle', settingName: 'SaveGamelistsOnExit', settingType: 'bool' },
            { id: 'parse_gamelist_only', label: t('PARSE GAMELISTS ONLY'), type: 'toggle', settingName: 'ParseGamelistOnly', settingType: 'bool', description: t("Debug tool: Don't check if the ROMs actually exist. Can cause problems!") },
            { id: 'search_local_art', label: t('SEARCH FOR LOCAL ART'), type: 'toggle', settingName: 'LocalArt', settingType: 'bool', description: t("If no image is specified in the gamelist, try to find media with the same filename to use.") },

            // === USER INTERFACE ===
            { id: 'group_dev_ui', label: t('USER INTERFACE'), type: 'group' },
            { id: 'carousel_transitions', label: t('CAROUSEL TRANSITIONS'), type: 'toggle', settingName: 'MoveCarousel', settingType: 'bool' },
            { id: 'quick_system_select', label: t('QUICK SYSTEM SELECT'), type: 'toggle', settingName: 'QuickSystemSelect', settingType: 'bool' },
            { id: 'quick_jump_letter', label: t('QUICK JUMP LETTER'), type: 'toggle', settingName: 'QuickJumpLetter', settingType: 'bool' },
            { id: 'osk', label: t('ON-SCREEN KEYBOARD'), type: 'toggle', settingName: 'UseOSK', settingType: 'bool' },
            { id: 'hide_es_run', label: t('HIDE EMULATIONSTATION WHEN RUNNING A GAME'), type: 'toggle', settingName: 'HideWindow', settingType: 'bool' },
            { id: 'complete_quit_menu', label: t('COMPLETE QUIT MENU'), type: 'toggle', settingName: 'ShowOnlyExit', settingType: 'bool', invert: true },
            { 
              id: 'retroarch_menu_driver', 
              label: t('RETROARCH MENU DRIVER'), 
              type: 'select', 
              settingName: 'global.retroarch.menu_driver', 
              settingType: 'string',
              options: [
                { label: t('AUTO'), value: '' },
                { label: 'rgui', value: 'rgui' },
                { label: 'xmb', value: 'xmb' },
                { label: 'ozone', value: 'ozone' },
                { label: 'glui', value: 'glui' }
              ]
            },
            { id: 'invert_buttons', label: t('SWITCH CONFIRM & CANCEL BUTTONS IN EMULATIONSTATION'), type: 'toggle', settingName: 'InvertButtons', settingType: 'bool', description: t("Switches the South and East buttons' functionality") },
            { id: 'game_options_north', label: t('ACCESS GAME OPTIONS WITH NORTH BUTTON'), type: 'toggle', settingName: 'GameOptionsAtNorth', settingType: 'bool', description: t("Switches to short-press North for Savestates & long-press South button for Game Options") },
            { id: 'first_joystick_only', label: t('CONTROL EMULATIONSTATION WITH FIRST JOYSTICK ONLY'), type: 'toggle', settingName: 'FirstJoystickOnly', settingType: 'bool' },
            { id: 'gun_move_tolerence', label: t('GUN MOVE TOLERENCE'), type: 'slider', settingName: 'GunMoveTolerence', settingType: 'float', min: 0, max: 10, step: 0.1, suffix: '%' },
            { id: 'hid_joysticks', label: t('ENABLE HID JOYSTICK DRIVERS'), type: 'toggle', settingName: 'HidJoysticks', settingType: 'bool' },
            { id: 'show_network_indicator', label: t('SHOW NETWORK INDICATOR'), type: 'toggle', settingName: 'ShowNetworkIndicator', settingType: 'bool' },

            // === OPTIMIZATIONS ===
            { id: 'group_dev_optimizations', label: t('OPTIMIZATIONS'), type: 'group' },
            { id: 'preload_ui', label: t('PRELOAD UI ELEMENTS ON BOOT'), type: 'toggle', settingName: 'PreloadUI', settingType: 'bool', description: t("Reduces lag when entering gamelists from the system menu, increases boot time") },
            { id: 'preload_medias', label: t('PRELOAD METADATA MEDIA ON BOOT'), type: 'toggle', settingName: 'PreloadMedias', settingType: 'bool', description: t("Reduces lag when scrolling through a fully scraped gamelist, increases boot time") },
            { id: 'threaded_loading', label: t('THREADED LOADING'), type: 'toggle', settingName: 'ThreadedLoading', settingType: 'bool' },
            { id: 'async_images', label: t('ASYNC IMAGE LOADING'), type: 'toggle', settingName: 'AsyncImages', settingType: 'bool' },
            { id: 'optimize_vram', label: t('OPTIMIZE IMAGES VRAM USE'), type: 'toggle', settingName: 'OptimizeVRAM', settingType: 'bool' },
            { id: 'optimize_video', label: t('OPTIMIZE VIDEO VRAM USAGE'), type: 'toggle', settingName: 'OptimizeVideo', settingType: 'bool' },
            { id: 'use_file_cache', label: t('USE FILESYSTEM CACHE'), type: 'toggle', settingName: 'UseFileCache', settingType: 'bool' }
          ]}
        ]
      },
      { id: 'quit', label: t('QUIT'), type: 'action', onClick: () => window.api?.executeCommand('exit-frontend') }
    ]

    return items
  }

  const menuTitle = currentStackItem?.title || 'MAIN MENU'
  const bottomButtons = getBottomButtons()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || showInputConfig || showScraperProgress) return

      if (updateState.status !== 'idle') {
        const modalButtons: { label: string; action: () => void }[] = []
        if (updateState.status === 'available') {
          modalButtons.push({
            label: t('DOWNLOAD & UPDATE'),
            action: () => {
              setUpdateState(prev => ({ ...prev, status: 'downloading' }))
              window.api.downloadAndInstallUpdate(updateState.zipUrl!)
                .catch((err: any) => {
                  setUpdateState({
                    status: 'error',
                    errorMsg: err.message || String(err)
                  })
                })
            }
          })
          modalButtons.push({
            label: t('Cancel'),
            action: () => setUpdateState({ status: 'idle' })
          })
        } else if (updateState.status === 'no-update' || updateState.status === 'error') {
          modalButtons.push({
            label: t('OK'),
            action: () => setUpdateState({ status: 'idle' })
          })
        }

        if (modalButtons.length > 0) {
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            setModalSelectedIndex(prev => (prev + 1) % modalButtons.length)
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            setModalSelectedIndex(prev => (prev - 1 + modalButtons.length) % modalButtons.length)
          } else if (e.key === 'Enter' || e.key === ' ') {
            modalButtons[modalSelectedIndex]?.action()
          } else if (e.key === 'Backspace' || e.key === 'Escape') {
            setUpdateState({ status: 'idle' })
          }
        }
        return
      }

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
        } else if (e.key === 'Enter' || e.key === ' ') {
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
          setSelectedIndex(findFirstSelectableIndex(currentStackItem.items.filter(item => item.tab === newTab)))
          e.preventDefault()
          return
        } else if (e.key === 'PageDown' || e.key === 'e' || e.key === 'E') {
          const newTab = (currentStackItem.activeTab + 1) % currentStackItem.tabs.length
          setActiveMenuStack(prev => {
            const next = [...prev]
            next[next.length - 1] = { ...next[next.length - 1], activeTab: newTab }
            return next
          })
          setSelectedIndex(findFirstSelectableIndex(currentStackItem.items.filter(item => item.tab === newTab)))
          e.preventDefault()
          return
        }
      }

      if (currentMenu.length === 0) return

      const bottomButtons = getBottomButtons()
      const lastSelectableMenuIndex = (() => {
        for (let i = currentMenu.length - 1; i >= 0; i--) {
          if (currentMenu[i]?.type !== 'group') return i
        }
        return -1
      })()

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (selectedIndex >= currentMenu.length) {
          setSelectedIndex(findFirstSelectableIndex(currentMenu))
        } else if (selectedIndex === lastSelectableMenuIndex && bottomButtons.length > 0) {
          setSelectedIndex(currentMenu.length)
        } else {
          setSelectedIndex(prev => {
            let next = (prev + 1) % currentMenu.length
            while (currentMenu[next]?.type === 'group' && next !== prev) next = (next + 1) % currentMenu.length
            return next
          })
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (selectedIndex >= currentMenu.length) {
          setSelectedIndex(lastSelectableMenuIndex !== -1 ? lastSelectableMenuIndex : 0)
        } else if (selectedIndex === findFirstSelectableIndex(currentMenu) && bottomButtons.length > 0) {
          setSelectedIndex(currentMenu.length + bottomButtons.length - 1)
        } else {
          setSelectedIndex(prev => {
            let next = (prev - 1 + currentMenu.length) % currentMenu.length
            while (currentMenu[next]?.type === 'group' && next !== prev) next = (next - 1 + currentMenu.length) % currentMenu.length
            return next
          })
        }
      } else if (e.key === 'ArrowLeft') {
        if (selectedIndex >= currentMenu.length) {
          e.preventDefault()
          const currentBtnIdx = selectedIndex - currentMenu.length
          const nextBtnIdx = (currentBtnIdx - 1 + bottomButtons.length) % bottomButtons.length
          setSelectedIndex(currentMenu.length + nextBtnIdx)
          return
        }
        const item = currentMenu[selectedIndex]
        if (item.type === 'select') handleSelect(item, -1)
        else if (item.type === 'slider') handleSlider(item, -1)
      } else if (e.key === 'ArrowRight') {
        if (selectedIndex >= currentMenu.length) {
          e.preventDefault()
          const currentBtnIdx = selectedIndex - currentMenu.length
          const nextBtnIdx = (currentBtnIdx + 1) % bottomButtons.length
          setSelectedIndex(currentMenu.length + nextBtnIdx)
          return
        }
        const item = currentMenu[selectedIndex]
        if (item.type === 'select') handleSelect(item, 1)
        else if (item.type === 'slider') handleSlider(item, 1)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (selectedIndex >= currentMenu.length) {
          const btnIdx = selectedIndex - currentMenu.length
          bottomButtons[btnIdx]?.onClick()
        } else {
          const item = currentMenu[selectedIndex]
          if (item.submenu) {
            const submenuItems = item.submenu!
            const filteredItems = item.tabs ? submenuItems.filter(si => si.tab === 0) : submenuItems
            setActiveMenuStack(prev => {
              const updated = [...prev]
              if (updated.length > 0) {
                updated[updated.length - 1] = { ...updated[updated.length - 1], savedSelectedIndex: selectedIndex }
              }
              return [...updated, { 
                items: submenuItems, 
                title: item.label, 
                tabs: item.tabs, 
                activeTab: item.tabs ? 0 : undefined,
                parentItemId: item.id
              }]
            })
            setSelectedIndex(findFirstSelectableIndex(filteredItems))
          } else if (item.type === 'select' && item.options) {
            const currentSettingVal = item.id.startsWith('theme_opt_') ? getThemeSetting(item.settingName!) : getSetting(item.settingName!)
            const activeIndex = item.options.findIndex(opt => isOptionMatch(opt.value, currentSettingVal))

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
            setActiveMenuStack(prev => {
              const updated = [...prev]
              if (updated.length > 0) {
                updated[updated.length - 1] = { ...updated[updated.length - 1], savedSelectedIndex: selectedIndex }
              }
              return [...updated, { items: optionsSubmenu, title: item.label, parentItemId: item.id }]
            })
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
        }
      } else if (e.key === 'Backspace' || e.key === 'Escape') {
        e.preventDefault()
        handleBackAction()
      }
    },
    [isOpen, currentMenu, selectedIndex, activeMenuStack, onClose, pendingSettings, themeSettings, settings, showSaveModal, modalSelectedIndex, themeData, needsReload, showInputConfig, showScraperProgress, getBottomButtons, handleBackAction, updateState]
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
      if (item.invert) isOn = !isOn
      
      const isMultiCheck = item.value !== undefined && !item.settingType
      if (isMultiCheck) {
        if (item.settingName === 'DisabledManualScrapers' || item.settingName === 'audio.favoriteSongs') {
          const values = String(currentSettingVal || '').split(';').filter(v => v.trim() !== '')
          isOn = item.settingName === 'audio.favoriteSongs' ? values.includes(item.value) : !values.includes(item.value)
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
        <div className={`riescade-switch ${isOn ? 'on' : ''}`}>
          <div className="thumb toggle-thumb" />
        </div>
      )
    }
    if (item.type === 'select') {
      const currentVal = (currentSettingVal !== undefined && currentSettingVal !== null && currentSettingVal !== '') 
        ? currentSettingVal 
        : (item.options?.[0]?.value !== undefined ? item.options[0].value : '')
      const label = item.options?.find(o => isOptionMatch(o.value, currentVal))?.label || currentVal
      return (
        <div className="menu-select">
          <span 
            className="arrow-clickable" 
            onClick={(e) => {
              e.stopPropagation()
              handleSelect(item, -1)
            }}
          >
            ◁
          </span>
          <span className="value">{label}</span>
          <span 
            className="arrow-clickable" 
            onClick={(e) => {
              e.stopPropagation()
              handleSelect(item, 1)
            }}
          >
            ▷
          </span>
        </div>
      )
    }
    if (item.type === 'slider') {
      const currentVal = getSetting(item.settingName!, item.min ?? 0)
      return (
        <div className="menu-slider">
          <span 
            className="arrow-clickable" 
            onClick={(e) => {
              e.stopPropagation()
              handleSlider(item, -1)
            }}
          >
            ◁
          </span>
          <span className="value">{currentVal}{item.suffix || '%'}</span>
          <span 
            className="arrow-clickable" 
            onClick={(e) => {
              e.stopPropagation()
              handleSlider(item, 1)
            }}
          >
            ▷
          </span>
        </div>
      )
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
              if (sub.settingName === 'audio.favoriteSongs') {
                const values = String(subVal || '').split(';').filter(v => v.trim() !== '')
                isSubOn = values.includes(sub.value)
              } else {
                const values = String(subVal || '').split(',').filter(v => v.trim() !== '')
                if ((sub.settingName === 'VisibleSystems' || sub.settingName === 'ScraperSystems') && values.length === 0) {
                  isSubOn = true
                } else {
                  isSubOn = values.includes(sub.value)
                }
              }
            }
            if (sub.invert) isSubOn = !isSubOn
            if (isSubOn) selectedCount++
          }
        })

        if (selectedCount > 0) {
          return (
            <div className="menu-submenu-preview">
              <span className="menu-selected-count">{selectedCount} {t('SELECTED')}</span>
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
            onMouseMove={(e) => {
              if (e.clientX !== lastMousePos.x || e.clientY !== lastMousePos.y) {
                setLastMousePos({ x: e.clientX, y: e.clientY })
                if (selectedIndex !== index) setSelectedIndex(index)
              }
            }}
            onClick={() => handleItemClick(item, index)}
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
      <div className={`riescade-overlay riescade-menu-overlay ${visible && !showInputConfig && !showScraperProgress ? 'visible' : ''}`}>
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
                      setSelectedIndex(findFirstSelectableIndex(currentStackItem.items.filter(item => item.tab === idx)))
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

          {bottomButtons.length > 0 && (
            <div className="riescade-menu-bottom-bar">
              {bottomButtons.map((btn, btnIdx) => {
                const isSelected = selectedIndex === currentMenu.length + btnIdx
                return (
                  <button
                    key={btn.id}
                    className={`riescade-button ${isSelected ? 'selected' : ''}`}
                    onMouseMove={(e) => {
                      if (e.clientX !== lastMousePos.x || e.clientY !== lastMousePos.y) {
                        setLastMousePos({ x: e.clientX, y: e.clientY })
                        const targetIdx = currentMenu.length + btnIdx
                        if (selectedIndex !== targetIdx) setSelectedIndex(targetIdx)
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      btn.onClick()
                    }}
                  >
                    {btn.label}
                  </button>
                )
              })}
            </div>
          )}

          {activeMenuStack.length === 1 && (
            <div className="riescade-menu-footer">
              {bottomButtons.length === 0 && (
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
              )}
              {/* <div className="riescade-menu-version">
                RIESCADE {versions.app}
              </div> */}
            </div>
          )}
        </div>
      </div>

      {showSaveModal && (
        <div className="riescade-overlay riescade-modal-overlay visible">
          <div className="riescade-modal-container">
            <h3 className="riescade-modal-title">{t('Apply Changes?')}</h3>
            <p className="riescade-modal-message">
              {t('Settings will be saved. The app will refresh to apply changes.')}
            </p>
            <div className="riescade-modal-buttons">
              <button 
                onClick={handleSave}
                className={`riescade-button ${modalSelectedIndex === 0 ? 'selected' : ''}`}
              >
                {t('Save & Apply')}
              </button>
              <button 
                onClick={onClose}
                className={`riescade-button ${modalSelectedIndex === 1 ? 'selected' : ''}`}
              >
                {t('Discard Changes')}
              </button>
              <button 
                onClick={() => setShowSaveModal(false)}
                className={`riescade-button ${modalSelectedIndex === 2 ? 'selected' : ''}`}
              >
                {t('Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}


      {showInputConfig && <InputConfigOverlay onClose={() => setShowInputConfig(false)} />}

      {showScraperProgress && <ScraperProgressModal isOpen={showScraperProgress} onClose={() => setShowScraperProgress(false)} t={t} />}
      
      {isBluetoothScanning && (
        <div className="riescade-overlay riescade-modal-overlay bluetooth-scanning visible">
          <div className="riescade-modal-container bluetooth-scanning-container">
            <h3 className="riescade-modal-title bluetooth-scanning-title">{t('SCANNING BLUETOOTH')}</h3>
            <p className="riescade-modal-text bluetooth-scanning-text">{t('Searching for devices...')}</p>
            <div className="riescade-modal-spinner" />
            <button
              onClick={() => {
                if (bluetoothScanTimeoutRef.current) {
                  clearTimeout(bluetoothScanTimeoutRef.current)
                  bluetoothScanTimeoutRef.current = null
                }
                setIsBluetoothScanning(false)
              }}
              className="riescade-button"
            >
              {t('Cancel')}
            </button>
          </div>
        </div>
      )}
      
      {showInputModal && (
        <div className="riescade-overlay riescade-modal-overlay visible">
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
                className="riescade-button selected"
                onClick={() => {
                  updateSetting(activeInputItem!.settingName!, inputValue)
                  setShowInputModal(false)
                }}
              >
                {t('OK')}
              </button>
              <button 
                className="riescade-button"
                onClick={() => setShowInputModal(false)}
              >
                {t('Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {updateState.status !== 'idle' && (
        <div className="riescade-overlay riescade-modal-overlay visible">
          <div className="riescade-modal-container updater-modal-container" style={{ maxWidth: '600px', width: '90%' }}>
            <h3 className="riescade-modal-title">
              {updateState.status === 'checking' && t('CHECKING FOR UPDATES')}
              {updateState.status === 'no-update' && t('SOFTWARE UPDATES')}
              {updateState.status === 'available' && `${t('UPDATE AVAILABLE')} (v${updateState.version})`}
              {updateState.status === 'downloading' && t('DOWNLOADING UPDATE')}
              {updateState.status === 'error' && t('UPDATE ERROR')}
            </h3>

            <div className="riescade-modal-content" style={{ margin: '20px 0', maxHeight: '300px', overflowY: 'auto' }}>
              {updateState.status === 'checking' && (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div className="riescade-modal-spinner" style={{ margin: '0 auto 15px' }} />
                  <p>{t('Checking for updates...')}</p>
                </div>
              )}

              {updateState.status === 'no-update' && (
                <p style={{ textAlign: 'center', padding: '10px' }}>{t('Your software is up to date.')}</p>
              )}

              {updateState.status === 'error' && (
                <p style={{ color: '#ef4444', textAlign: 'center', padding: '10px' }}>
                  {t('An error occurred during update:')}<br/>
                  <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>{updateState.errorMsg}</span>
                </p>
              )}

              {updateState.status === 'available' && (
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>{t('Release Notes:')}</p>
                  <pre style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    fontSize: '0.95rem',
                    background: 'rgba(255,255,255,0.05)',
                    padding: '12px',
                    borderRadius: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }} className="custom-scrollbar">
                    {updateState.releaseNotes || t('No release notes provided.')}
                  </pre>
                  <p style={{ marginTop: '15px', fontSize: '0.9rem', opacity: 0.8 }}>
                    {t('The application will download the update and apply it portable.')}
                  </p>
                </div>
              )}

              {updateState.status === 'downloading' && (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div className="riescade-modal-spinner" style={{ margin: '0 auto 15px' }} />
                  <p>{t('Downloading and extracting update files...')}</p>
                  <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '10px' }}>
                    {t('The application will restart automatically when finished.')}
                  </p>
                </div>
              )}
            </div>

            <div className="riescade-modal-buttons">
              {updateState.status === 'available' && (
                <>
                  <button 
                    className={`riescade-button ${modalSelectedIndex === 0 ? 'selected' : ''}`}
                    onClick={() => {
                      setUpdateState(prev => ({ ...prev, status: 'downloading' }))
                      window.api.downloadAndInstallUpdate(updateState.zipUrl!)
                        .catch((err: any) => {
                          setUpdateState({
                            status: 'error',
                            errorMsg: err.message || String(err)
                          })
                        })
                    }}
                  >
                    {t('DOWNLOAD & UPDATE')}
                  </button>
                  <button 
                    className={`riescade-button ${modalSelectedIndex === 1 ? 'selected' : ''}`}
                    onClick={() => setUpdateState({ status: 'idle' })}
                  >
                    {t('Cancel')}
                  </button>
                </>
              )}

              {(updateState.status === 'no-update' || updateState.status === 'error') && (
                <button 
                  className={`riescade-button ${modalSelectedIndex === 0 ? 'selected' : ''}`}
                  onClick={() => setUpdateState({ status: 'idle' })}
                >
                  {t('OK')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
