import React, { useState, useEffect, useCallback } from 'react'
import { Dialog, Box, Flex, Heading, Text, Button, Switch, Checkbox, Tabs, Grid, Spinner } from '@radix-ui/themes'
import { Game, System } from '../../../shared/types'
import { GameMediaOverlay } from './GameMediaOverlay'
import { VirtualKeyboard } from './VirtualKeyboard'


const escapeFileUrl = (url: string): string => {
  if (url.startsWith('file://')) {
    const [pathPart, ...queryParts] = url.split('?')
    return [pathPart.replace(/#/g, '%23'), ...queryParts].join('?')
  }
  return url
}

const getRomFileName = (path: string): string => {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || ''
}

const getRomDisplayPath = (path: string): string => {
  const parts = path.replace(/\\/g, '/').split('/')
  if (parts.length >= 2) {
    const secondLast = parts[parts.length - 2]
    const last = parts[parts.length - 1]
    if (secondLast === '.' || secondLast === '') return last
    return `${secondLast}/${last}`
  }
  return parts[parts.length - 1] || ''
}

const getStarsString = (ratingVal: any): string => {
  const ratingNum = typeof ratingVal === 'number' ? ratingVal : parseFloat(ratingVal || '0')
  const filledStars = Math.round(ratingNum * 5)
  return '★'.repeat(filledStars) + '☆'.repeat(5 - filledStars)
}

const formatDateForDisplay = (dateStr?: string, fallback = ''): string => {
  if (!dateStr) return fallback
  const clean = dateStr.trim()
  
  // 1. Matches YYYYMMDDT000000 or YYYYMMDD
  const matchYmd = clean.match(/^(\d{4})(\d{2})(\d{2})/)
  if (matchYmd) {
    return `${matchYmd[3]}/${matchYmd[2]}/${matchYmd[1]}`
  }
  
  // 2. Matches YYYY-MM-DD
  const matchHyphen = clean.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (matchHyphen) {
    return `${matchHyphen[3]}/${matchHyphen[2]}/${matchHyphen[1]}`
  }
  
  // 3. Matches DD/MM/YYYY
  const matchDmy = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (matchDmy) {
    return `${matchDmy[1].padStart(2, '0')}/${matchDmy[2].padStart(2, '0')}/${matchDmy[3]}`
  }

  // 4. Matches just YYYY
  const matchYear = clean.match(/^(\d{4})/)
  if (matchYear) {
    return `01/01/${matchYear[1]}`
  }
  
  return clean
}

const parseDateForDb = (dateStr?: string): string => {
  if (!dateStr) return ''
  const clean = dateStr.trim()
  
  // 1. Matches DD/MM/YYYY
  const matchDmy = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (matchDmy) {
    const d = matchDmy[1].padStart(2, '0')
    const m = matchDmy[2].padStart(2, '0')
    const y = matchDmy[3]
    return `${y}${m}${d}T000000`
  }
  
  // 2. Matches YYYY-MM-DD
  const matchYmd = clean.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (matchYmd) {
    const y = matchYmd[1]
    const m = matchYmd[2]
    const d = matchYmd[3]
    return `${y}${m}${d}T000000`
  }
  
  // 3. Matches YYYYMMDD
  const matchRaw = clean.match(/^(\d{4})(\d{2})(\d{2})/)
  if (matchRaw) {
    return `${matchRaw[1]}${matchRaw[2]}${matchRaw[3]}T000000`
  }
  
  // 4. Matches just YYYY
  const matchYear = clean.match(/^(\d{4})/)
  if (matchYear) {
    return `${matchYear[1]}0101T000000`
  }
  
  return clean
}

const getEmulatorValue = (
  emulator: string | undefined,
  core: string | undefined,
  emulators: any[] | undefined,
  autoValue: string = ''
): string => {
  if (!emulator || emulator === 'auto' || emulator === '') return autoValue
  
  const foundEmulator = emulators?.find(e => e.name.toLowerCase() === emulator.toLowerCase())
  if (foundEmulator && foundEmulator.cores && foundEmulator.cores.length > 0) {
    if (core && core !== 'auto' && core !== '') {
      const matchedCore = foundEmulator.cores.find((c: any) => String(c).toLowerCase() === core.toLowerCase())
      if (matchedCore) {
        return `${foundEmulator.name}:${matchedCore}`
      }
    }
    return `${foundEmulator.name}:${foundEmulator.cores[0]}`
  }
  
  return foundEmulator ? foundEmulator.name : emulator
}

const fields = [
  { key: 'name', label: 'NAME' },
  { key: 'desc', label: 'DESCRIPTION' },
  { key: 'tags', label: 'TAGS' },
  { key: 'sortname', label: 'SORT NAME' },
  { key: 'image', label: 'IMAGE' },
  { key: 'video', label: 'VIDEO' },
  { key: 'marquee', label: 'LOGO' },
  { key: 'thumbnail', label: 'BOX' },
  { key: 'fanart', label: 'FAN ART' },
  { key: 'titleshot', label: 'TITLE SHOT' },
  { key: 'manual', label: 'MANUAL' },
  { key: 'magazine', label: 'MAGAZINE' },
  { key: 'map', label: 'MAP' },
  { key: 'bezel', label: 'BEZEL (16:9)' },
  { key: 'boxback', label: 'BOX BACKSIDE' },
  { key: 'rating', label: 'RATING', type: 'rating' },
  { key: 'releasedate', label: 'RELEASE DATE' },
  { key: 'developer', label: 'DEVELOPER' },
  { key: 'publisher', label: 'PUBLISHER' },
  { key: 'gamefamily', label: 'GAME FAMILY' },
  { key: 'genre', label: 'GENRES' },
  { key: 'arcadesystem', label: 'ARCADE SYSTEM' },
  { key: 'players', label: 'PLAYERS' },
  { key: 'favorite', label: 'FAVORITE', type: 'bool' },
  { key: 'hidden', label: 'HIDDEN', type: 'bool' },
  { key: 'kidgame', label: 'KIDGAME', type: 'bool' },
  { key: 'languages', label: 'LANGUAGES' },
  { key: 'region', label: 'REGION' }
]

interface GameOptionsProps {
  isOpen: boolean
  onClose: () => void
  game: Game
  system: System
  theme?: any
  themeData?: any
  onUpdate: (updatedGame: Game) => void | Promise<any>
  addNotification?: (message: string, type: 'info' | 'success' | 'warning', category?: 'controller' | 'scraper' | 'general') => void
  onUpdateGamelists?: (systemName?: string) => void
  onLaunch?: () => void
  onOpenSaveStates?: () => void
  isSaveStateManagerOpen?: boolean
  t: (key: string) => string
  isFilteredRelated?: boolean
  onFilterRelated?: (genre: string | null) => void
  allSystems?: System[]
  onLaunchNetplay?: (netplayOptions: any) => void
}

export const GameOptionsOverlay: React.FC<GameOptionsProps> = ({ 
  isOpen, onClose, game, system, theme, themeData, onUpdate, addNotification, onUpdateGamelists, onLaunch, onOpenSaveStates, isSaveStateManagerOpen, t,
  isFilteredRelated = false, onFilterRelated, allSystems = [], onLaunchNetplay
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [draftGame, setDraftGame] = useState<Game>(game)
  const [customCollections, setCustomCollections] = useState<string[]>([])
  const [gameCollections, setGameCollections] = useState<string[]>([])
  const [activeMenuStack, setActiveMenuStack] = useState<{ items: any[]; title: string; tabs?: string[]; activeTab?: number; parentItemId?: string; savedSelectedIndex?: number }[]>([])
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [netplayPublic, setNetplayPublic] = useState(true)
  const [netplayPassword, setNetplayPassword] = useState('')
  const [netplaySpectatorPassword, setNetplaySpectatorPassword] = useState('')

  const updateNetplayMenuItemValue = (id: string, value: string) => {
    setActiveMenuStack(prev => {
      const next = [...prev]
      const current = next[next.length - 1]
      if (current) {
        current.items = current.items.map(it => 
          it.id === id ? { ...it, value } : it
        )
      }
      return next
    })
  }

  // Single game scraper states
  const [scraperStage, setScraperStage] = useState<0 | 1 | 2>(0) // 0: closed, 1: database checklist, 2: matches
  const [scraperDbs, setScraperDbs] = useState<Record<string, boolean>>({
    ScreenScraper: true,
    ArcadeDB: true,
    TheGamesDB: true,
    HfsDB: true,
    IGDB: true
  })
  const [scraperDbSelectedIndex, setScraperDbSelectedIndex] = useState(0) // 0-3: DB checkboxes, 4: BUSCAR, 5: CANCELAR
  const [scraperIsSearching, setScraperIsSearching] = useState(false)
  const [scraperMatches, setScraperMatches] = useState<any[]>([])
  const [scraperMatchSelectedIndex, setScraperMatchSelectedIndex] = useState(0)
  const [tempMediaUrls, setTempMediaUrls] = useState<Record<string, string>>({})
  const [tempMediaLoading, setTempMediaLoading] = useState(false)

  // REMOVER JOGO states
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [deleteModalSelectedIndex, setDeleteModalSelectedIndex] = useState(1) // Default to "NÃO" for safety

  // METADATA EDITOR states
  const [showMetadataEditor, setShowMetadataEditor] = useState(false)
  const [draftMetadata, setDraftMetadata] = useState<Game>(game)
  const [metadataSelectedIndex, setMetadataSelectedIndex] = useState(0)
  const [showInputModal, setShowInputModal] = useState(false)
  const [showOSK, setShowOSK] = useState(false)
  
  // Scraper options & navigation states
  const [activeSection, setActiveSection] = useState<'matches' | 'checkboxes' | 'buttons'>('matches')
  const [focusedCheckboxIndex, setFocusedCheckboxIndex] = useState(0)
  const [focusedButtonIndex, setFocusedButtonIndex] = useState(0)
  const [scraperQuery, setScraperQuery] = useState(game.name)
  const [scrapeOptions, setScrapeOptions] = useState({
    title: true,
    desc: true,
    fanart: true,
    logo: true,
    cover: true,
    video: true
  })

  const [activeInputField, setActiveInputField] = useState<string>('')
  const [inputValue, setInputValue] = useState('')
  const [gameDynamicFeatures, setGameDynamicFeatures] = useState<{ general: any[]; advanced: any[] } | null>(null)
  const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false)

  const loadFeaturesForGameEmulator = useCallback((g: Game, currentSettings: Record<string, any>) => {
    let resolvedEmulator = ''
    let resolvedCore = ''
    const activeEmulator = g.emulator || 'auto'
    if (activeEmulator !== 'auto') {
      if (activeEmulator.includes(':')) {
        const parts = activeEmulator.split(':')
        resolvedEmulator = parts[0]
        resolvedCore = parts[1] || ''
      } else {
        resolvedEmulator = activeEmulator
        resolvedCore = g.core || ''
      }
    } else {
      // Fall back to system-level or default emulator
      const sysEmulator = currentSettings[`${system.name}.emulator`]?.value || ''
      const sysCore = currentSettings[`${system.name}.core`]?.value || ''
      if (sysEmulator && sysEmulator !== 'auto') {
        resolvedEmulator = sysEmulator
        resolvedCore = sysCore || ''
      } else if (system.emulators?.[0]) {
        resolvedEmulator = system.emulators[0].name
        const rawCore = system.emulators[0].cores?.[0]
        resolvedCore = rawCore ? (typeof rawCore === 'string' ? rawCore : ((rawCore as any)?.name || String(rawCore))) : ''
      }
    }

    if (resolvedEmulator) {
      window.api.getEmulatorFeatures(system.name, resolvedEmulator, resolvedCore || undefined)
        .then((result: { general: any[]; advanced: any[] }) => {
          setGameDynamicFeatures(result)
        })
        .catch((err: any) => {
          console.error('[GameOptions] Failed to load features:', err)
          setGameDynamicFeatures({ general: [], advanced: [] })
        })
    } else {
      setGameDynamicFeatures({ general: [], advanced: [] })
    }
  }, [system])

  useEffect(() => {
    if (scraperStage !== 2 || scraperMatches.length === 0) return

    const selectedMatch = scraperMatches[scraperMatchSelectedIndex]
    if (!selectedMatch) return

    const matchId = selectedMatch.id
    
    // Check if we already have the temp media url for this match
    if (tempMediaUrls[matchId]) return

    // Priority order for preview: BOX/thumbnail → IMAGE → LOGO/marquee → VIDEO
    const boxUrl = selectedMatch.media?.thumbnail || selectedMatch.thumbnail
    const imageUrl = selectedMatch.media?.image || selectedMatch.image
    const logoUrl = selectedMatch.media?.marquee
    const videoUrl = selectedMatch.media?.video || selectedMatch.video

    // Pick the single highest-priority source
    const bestImageUrl = boxUrl || imageUrl || logoUrl
    const bestUrl = bestImageUrl || videoUrl

    if (!bestUrl) {
      setTempMediaUrls(prev => ({
        ...prev,
        [matchId]: '{}'
      }))
      return
    }

    const downloadTemp = async () => {
      setTempMediaLoading(true)
      const updates: Record<string, string> = {}
      try {
        if (bestImageUrl && bestImageUrl.startsWith('http')) {
          const localPath = await window.api.downloadTempMedia(bestImageUrl)
          if (localPath) {
            updates.image = escapeFileUrl(`file:///${localPath.replace(/\\/g, '/')}`)
          }
        } else if (videoUrl && videoUrl.startsWith('http')) {
          // Only download video if no image-type source is available
          const localPath = await window.api.downloadTempMedia(videoUrl)
          if (localPath) {
            updates.video = escapeFileUrl(`file:///${localPath.replace(/\\/g, '/')}`)
          }
        }
      } catch (err) {
        console.error('Error downloading temp media:', err)
      } finally {
        setTempMediaUrls(prev => ({
          ...prev,
          [matchId]: JSON.stringify(updates)
        }))
        setTempMediaLoading(false)
      }
    }

    downloadTemp()
  }, [scraperMatchSelectedIndex, scraperMatches, scraperStage])

  useEffect(() => {
    if (!isOpen) {
      setTempMediaUrls({})
    }
  }, [isOpen])

  const getFirstSelectableIndex = (items: any[]): number => {
    const idx = items.findIndex(item => item.type !== 'group')
    return idx !== -1 ? idx : 0
  }

  const getMarqueeUrl = () => {
    if (!game.marquee) return null
    let url = game.marquee
    if (!game.marquee.startsWith('http') && !game.marquee.startsWith('file://') && !game.marquee.startsWith('data:')) {
      const normalized = game.marquee.replace(/\\/g, '/')
      if (normalized.match(/^[a-zA-Z]:/) || normalized.startsWith('/')) {
        url = `file:///${normalized.replace(/^\/+/, '')}`
      } else {
        const systemPath = (system.path || '').replace(/\\/g, '/')
        url = `file:///${systemPath}/${normalized.replace(/^\.\//, '')}`
      }
    }
    return escapeFileUrl(url)
  }

  const getGameSettingKey = (settingName: string) => {
    const romFileName = getRomFileName(game.path)
    const cleanRomName = romFileName.replace(/[#=]/g, '')
    return `${system.name}["${cleanRomName}"].${settingName}`
  }

  const getRootItems = (currentGame: Game, gameCols: string[], sys: System, allCols: string[], currentSettings: Record<string, any>) => {
    const items: any[] = []

    const isLibretro = (() => {
      const activeEmulator = currentGame.emulator || 'auto'
      if (activeEmulator !== 'auto') {
        return activeEmulator.toLowerCase() === 'libretro'
      }
      const systemWideEmulator = currentSettings[`${sys.name}.emulator`]?.value || 'auto'
      if (systemWideEmulator !== 'auto') {
        return systemWideEmulator.toLowerCase() === 'libretro'
      }
      const defaultEmulator = sys.emulators?.[0]?.name || ''
      return defaultEmulator.toLowerCase() === 'libretro' || !sys.emulators || sys.emulators.length === 0
    })()

    // 1. Group: GAMES
    items.push({ id: 'group_games', label: t('GAME'), type: 'group' })
    items.push({
      id: 'launch_game',
      label: t('LAUNCH'),
      type: 'action',
      actionType: 'launch'
    })
    if (isLibretro) {
      items.push({
        id: 'save_states',
        label: t('SAVE STATES'),
        type: 'action',
        actionType: 'save_states'
      })
    }
    const netplayEnabled = (() => {
      const val = currentSettings['global.netplay']?.value
      return val === true || val === 'true' || val === '1' || val === 1 || String(val).toLowerCase() === 'on'
    })()

    if (isLibretro && netplayEnabled) {
      items.push({
        id: 'netplay_game',
        label: t('START ONLINE GAME'),
        type: 'action',
        actionType: 'netplay_game'
      })
    }
    items.push({
      id: 'related_games',
      label: isFilteredRelated ? t('CLEAR RELATED GAMES') : t('RELATED GAMES'),
      type: 'action',
      actionType: 'related_games'
    })
    items.push({
      id: 'delete_game',
      label: t('DELETE GAME'),
      type: 'action',
      actionType: 'delete'
    })

    // 2. Group: COLEÇÕES
    items.push({ id: 'group_collections', label: t('COLLECTIONS'), type: 'group' })
    items.push({ 
      id: 'favorite', 
      label: currentGame.favorite ? t('REMOVE FROM FAVORITES') : t('ADD TO FAVORITES'), 
      type: 'toggle', 
      value: currentGame.favorite 
    })

    // Submenu: ADICIONAR A COLEÇÃO
    const addColSubmenu: any[] = [
      ...allCols.map(col => ({
        id: `add_col_${col}`,
        label: col.toUpperCase(),
        type: 'action',
        collectionName: col,
        actionType: 'add'
      })),
      {
        id: 'back_collection',
        label: t('BACK'),
        type: 'action',
        actionType: 'back'
      }
    ]

    items.push({
      id: 'add_to_collection',
      label: t('ADD TO CUSTOM COLLECTION...'),
      type: 'submenu',
      submenu: addColSubmenu
    })

    // Dynamic "REMOVER DE [COL]" actions for each collection the game is in
    gameCols.forEach(col => {
      items.push({
        id: `remove_col_${col}`,
        label: `${t('REMOVE FROM')} ${col.toUpperCase()}`,
        type: 'action',
        collectionName: col,
        actionType: 'remove'
      })
    })

    // 3. Group: MEDIA
    items.push({ id: 'group_media', label: t('MEDIA'), type: 'group' })
    items.push({
      id: 'media_video',
      label: t('VIEW GAME MEDIA'),
      type: 'action',
      actionType: 'view_media'
    })

    // 4. Group: OPTIONS
    items.push({ id: 'group_options', label: t('OPTIONS'), type: 'group' })
    items.push({
      id: 'scrape_this_game',
      label: t('SCRAPE'),
      type: 'action',
      actionType: 'scrape'
    })

    const getGameSettingValue = (settingName: string, fallback: any) => {
      const key = getGameSettingKey(settingName)
      return currentSettings[key]?.value !== undefined ? currentSettings[key].value : fallback
    }

    // Submenu: OPÇÕES AVANÇADAS DO JOGO
    const advancedSubmenu: any[] = [
      {
        id: 'game_emulator',
        label: 'EMULATOR',
        type: 'select',
        settingName: 'emulator',
        value: getEmulatorValue(currentGame.emulator, currentGame.core, sys.emulators, 'auto'),
        items: (() => {
          const opts = [{ label: 'AUTO', value: 'auto' }]
          sys.emulators?.forEach(e => {
            if (e.cores && e.cores.length > 0) {
              e.cores.forEach((c: any) => {
                opts.push({
                  label: `${e.name.toUpperCase()}: ${String(c).toUpperCase()}`,
                  value: `${e.name}:${c}`
                })
              })
            } else {
              opts.push({
                label: e.name.toUpperCase(),
                value: e.name
              })
            }
          })
          return opts
        })()
      }
    ]

    const featureToMenuItem = (f: any) => {
      const featureSettingName = f.value.startsWith('global.') 
        ? f.value.replace('global.', '')
        : f.value

      const description = f.description ? (t(f.description) || f.description) : undefined

      if (f.preset === 'switch') {
        return {
          id: `game_feat_${f.value}`,
          label: t(f.name) || f.name,
          type: 'toggle' as const,
          settingName: featureSettingName,
          description,
          value: getGameSettingValue(featureSettingName, 'auto') === 'true' || getGameSettingValue(featureSettingName, 'auto') === true
        }
      } else if (f.preset === 'switchauto') {
        return {
          id: `game_feat_${f.value}`,
          label: t(f.name) || f.name,
          type: 'select' as const,
          settingName: featureSettingName,
          description,
          value: getGameSettingValue(featureSettingName, 'auto'),
          items: [
            { label: t('AUTO'), value: 'auto' },
            { label: t('ON'), value: 'true' },
            { label: t('OFF'), value: 'false' }
          ]
        }
      } else if (f.choices && f.choices.length > 0) {
        return {
          id: `game_feat_${f.value}`,
          label: t(f.name) || f.name,
          type: 'select' as const,
          settingName: featureSettingName,
          description,
          value: getGameSettingValue(featureSettingName, 'auto'),
          items: [
            { label: t('AUTO'), value: 'auto' },
            ...f.choices.map((c: any) => ({
              label: String(t(c.name) || c.name || c.value || '').toUpperCase(),
              value: String(c.value ?? '')
            }))
          ]
        }
      } else {
        return {
          id: `game_feat_${f.value}`,
          label: t(f.name) || f.name,
          type: 'toggle' as const,
          settingName: featureSettingName,
          description,
          value: getGameSettingValue(featureSettingName, 'auto') === 'true' || getGameSettingValue(featureSettingName, 'auto') === true
        }
      }
    }

    // Add dynamic features from features.json
    if (gameDynamicFeatures) {
      const generalFeatures = gameDynamicFeatures.general || []
      if (generalFeatures.length > 0) {
        advancedSubmenu.push({
          id: 'group_general_settings',
          label: t('GENERAL SETTINGS') || 'GENERAL SETTINGS',
          type: 'group'
        })
        generalFeatures.forEach((f: any) => {
          const item = featureToMenuItem(f)
          if (item) advancedSubmenu.push(item)
        })
      }

      const advancedFeatures = gameDynamicFeatures.advanced || []
      if (advancedFeatures.length > 0) {
        advancedSubmenu.push({
          id: 'group_advanced_settings',
          label: t('ADVANCED SETTINGS') || 'ADVANCED SETTINGS',
          type: 'group'
        })

        // Group advanced features by submenu
        const submenusMap: Record<string, any[]> = {}
        const directAdvancedFeatures: any[] = []

        advancedFeatures.forEach((f: any) => {
          if (f.submenu) {
            const subName = f.submenu
            if (!submenusMap[subName]) {
              submenusMap[subName] = []
            }
            submenusMap[subName].push(f)
          } else {
            directAdvancedFeatures.push(f)
          }
        })

        // Gather submenus in order of appearance
        const submenuOrder: string[] = []
        advancedFeatures.forEach((f: any) => {
          if (f.submenu && !submenuOrder.includes(f.submenu)) {
            submenuOrder.push(f.submenu)
          }
        })

        submenuOrder.forEach((subName) => {
          const subFeatures = submenusMap[subName]
          const subItems: any[] = []
          subFeatures.forEach((f: any) => {
            const item = featureToMenuItem(f)
            if (item) subItems.push(item)
          })

          if (subItems.length > 0) {
            advancedSubmenu.push({
              id: `game_submenu_${subName.toLowerCase().replace(/\s+/g, '_')}`,
              label: (t(subName) || subName).toUpperCase(),
              type: 'submenu',
              submenu: subItems
            })
          }
        })

        // Direct advanced features (without submenu)
        directAdvancedFeatures.forEach((f: any) => {
          const item = featureToMenuItem(f)
          if (item) advancedSubmenu.push(item)
        })
      }
    } else {
      advancedSubmenu.push({
        id: 'game_features_loading',
        label: t('LOADING...'),
        type: 'info'
      })
    }

    items.push({
      id: 'advanced_game_options',
      label: t('ADVANCED GAME OPTIONS'),
      type: 'submenu',
      submenu: advancedSubmenu
    })

    // EDIT THIS GAME'S METADATA
    items.push({
      id: 'edit_metadata',
      label: t("EDIT THIS GAME'S METADATA"),
      type: 'action',
      actionType: 'edit_metadata'
    })

    return items
  }

  useEffect(() => {
    if (isOpen) {
      setDraftGame(game)
      setDraftMetadata(game)
      setScraperQuery(game.name)
      setScraperStage(0)
      setShowMetadataEditor(false)
      setMetadataSelectedIndex(0)
      setShowInputModal(false)
      setNetplayPublic(true)
      setNetplayPassword('')
      setNetplaySpectatorPassword('')
      
      window.api.getSettings().then(s => {
        setSettings(s)
        window.api.getCustomCollections().then(customCols => {
          setCustomCollections(customCols)
          window.api.getCollectionsForGame(game.system || system.name, game.path).then(gameCols => {
            setGameCollections(gameCols)

            // Load dynamic features for the game's current emulator
            loadFeaturesForGameEmulator(game, s)

            const rootItems = getRootItems(game, gameCols, system, customCols, s)
            setActiveMenuStack([{ items: rootItems, title: 'GAME OPTIONS' }])
            setSelectedIndex(getFirstSelectableIndex(rootItems))
          })
        })
      })
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && !isSaveStateManagerOpen) {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [isOpen, isSaveStateManagerOpen])

  useEffect(() => {
    if (isOpen && showMetadataEditor) {
      const selectedEl = document.querySelector('.riescade-metadata-row.selected')
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      }
    }
  }, [metadataSelectedIndex, showMetadataEditor, isOpen])

  // Auto-scroll to selected menu item
  useEffect(() => {
    if (isOpen && !showMetadataEditor && scraperStage === 0) {
      const selectedEl = document.querySelector('.riescade-menu .riescade-menu-item.selected')
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      }
    }
  }, [selectedIndex, activeMenuStack, isOpen, showMetadataEditor, scraperStage])

  // Regenerate menu when dynamic features arrive
  useEffect(() => {
    if (isOpen && gameDynamicFeatures && activeMenuStack.length > 0) {
      const rootItems = getRootItems(draftGame, gameCollections, system, customCollections, settings)
      setActiveMenuStack(prev => {
        const nextStack = [...prev]
        nextStack[0] = { ...nextStack[0], items: rootItems }
        for (let i = 1; i < nextStack.length; i++) {
          const parentId = nextStack[i].parentItemId
          const parentItem = nextStack[i - 1].items.find((it: any) => it.id === parentId)
          if (parentItem && parentItem.submenu) {
            nextStack[i] = { ...nextStack[i], items: parentItem.submenu }
          }
        }
        return nextStack
      })
    }
  }, [gameDynamicFeatures])

  const currentStackItem = activeMenuStack[activeMenuStack.length - 1]
  const currentMenu = currentStackItem ? (currentStackItem.tabs && currentStackItem.activeTab !== undefined ? currentStackItem.items.filter(item => item.tab === currentStackItem.activeTab) : currentStackItem.items) : []
  const menuTitle = currentStackItem?.title || 'GAME OPTIONS'

  useEffect(() => {
    const bottomButtonsCount = activeMenuStack.length <= 1 ? 0 : 1
    const totalSelectables = currentMenu.length + bottomButtonsCount
    if (totalSelectables > 0 && selectedIndex >= totalSelectables) {
      setSelectedIndex(getFirstSelectableIndex(currentMenu))
    }
  }, [currentMenu.length, selectedIndex, activeMenuStack.length])

  const handleToggle = () => {
    const item = currentMenu[selectedIndex]
    if (item.id === 'netplay_public') {
      const nextVal = !netplayPublic
      setNetplayPublic(nextVal)
      setActiveMenuStack(prev => {
        const next = [...prev]
        const current = next[next.length - 1]
        if (current) {
          current.items = current.items.map(it => 
            it.id === 'netplay_public' ? { ...it, value: nextVal } : it
          )
        }
        return next
      })
      return
    }
    if (item.id === 'favorite') {
      const nextFav = !draftGame.favorite
      const updated = { ...draftGame, favorite: nextFav }
      setDraftGame(updated)
      onUpdate(updated)
      setActiveMenuStack(prev => {
        const rootItems = getRootItems(updated, gameCollections, system, customCollections, settings)
        const nextStack = [...prev]
        nextStack[0] = { ...nextStack[0], items: rootItems }
        for (let i = 1; i < nextStack.length; i++) {
          const parentId = nextStack[i].parentItemId
          const parentItem = nextStack[i - 1].items.find(it => it.id === parentId)
          if (parentItem && parentItem.submenu) {
            nextStack[i] = { ...nextStack[i], items: parentItem.submenu }
          }
        }
        return nextStack
      })
    } else if (item.settingName) {
      const key = getGameSettingKey(item.settingName)
      const nextVal = !item.value
      window.api.saveSetting(key, nextVal, 'bool')
      setSettings(prev => ({
        ...prev,
        [key]: { value: nextVal, type: 'bool' }
      }))
      setActiveMenuStack(prev => {
        const next = [...prev]
        const updatedItems = next[next.length - 1].items.map((it, idx) => 
          idx === selectedIndex ? { ...it, value: nextVal } : it
        )
        next[next.length - 1] = { ...next[next.length - 1], items: updatedItems }
        return next
      })
    }
  }

  const handleSelect = (direction: 1 | -1) => {
    const item = currentMenu[selectedIndex]
    if (item.type === 'select' && item.items) {
      const currentIdx = item.items.findIndex((i: any) => i.value === item.value)
      const nextIdx = (currentIdx + direction + item.items.length) % item.items.length
      const nextVal = item.items[nextIdx].value

      if (item.id === 'game_emulator') {
        let emulator = 'auto'
        let core: string | undefined = undefined
        if (nextVal !== 'auto') {
          if (nextVal.includes(':')) {
            const parts = nextVal.split(':')
            emulator = parts[0]
            core = parts[1]
          } else {
            emulator = nextVal
          }
        }
        const updated = { ...draftGame, emulator, core }
        setDraftGame(updated)
        onUpdate(updated)
        loadFeaturesForGameEmulator(updated, settings)
        setActiveMenuStack(prev => {
          const rootItems = getRootItems(updated, gameCollections, system, customCollections, settings)
          const nextStack = [...prev]
          nextStack[0] = { ...nextStack[0], items: rootItems }
          for (let i = 1; i < nextStack.length; i++) {
            const parentId = nextStack[i].parentItemId
            const parentItem = nextStack[i - 1].items.find(it => it.id === parentId)
            if (parentItem && parentItem.submenu) {
              nextStack[i] = { ...nextStack[i], items: parentItem.submenu }
            }
          }
          return nextStack
        })
      } else if (item.settingName) {
        const key = getGameSettingKey(item.settingName)
        window.api.saveSetting(key, nextVal, 'string')
        setSettings(prev => ({
          ...prev,
          [key]: { value: nextVal, type: 'string' }
        }))
        setActiveMenuStack(prev => {
          const next = [...prev]
          const updatedItems = next[next.length - 1].items.map((it, idx) => 
            idx === selectedIndex ? { ...it, value: nextVal } : it
          )
          next[next.length - 1] = { ...next[next.length - 1], items: updatedItems }
          return next
        })
      }
    }
  }

  // Opens a submenu for select items (same behavior as main Menu)
  const handleSelectOpen = (item: any, index: number) => {
    if (!item.items || item.items.length === 0) return
    const activeIdx = item.items.findIndex((i: any) => i.value === item.value)

    const optionsSubmenu: any[] = item.items.map((opt: any) => ({
      id: `opt_${opt.value}`,
      label: opt.label,
      type: 'action',
      onClick: () => {
        const nextVal = opt.value
        if (item.id === 'game_emulator') {
          let emulator = 'auto'
          let core: string | undefined = undefined
          if (nextVal !== 'auto') {
            if (nextVal.includes(':')) {
              const parts = nextVal.split(':')
              emulator = parts[0]
              core = parts[1]
            } else {
              emulator = nextVal
            }
          }
          const updated = { ...draftGame, emulator, core }
          setDraftGame(updated)
          onUpdate(updated)
          loadFeaturesForGameEmulator(updated, settings)
          setActiveMenuStack(prev => {
            const rootItems = getRootItems(updated, gameCollections, system, customCollections, settings)
            const nextStack = [...prev]
            // Pop the options submenu
            nextStack.pop()
            nextStack[0] = { ...nextStack[0], items: rootItems }
            for (let i = 1; i < nextStack.length; i++) {
              const parentId = nextStack[i].parentItemId
              const parentItem = nextStack[i - 1].items.find((it: any) => it.id === parentId)
              if (parentItem && parentItem.submenu) {
                nextStack[i] = { ...nextStack[i], items: parentItem.submenu }
              }
            }
            return nextStack
          })
        } else if (item.settingName) {
          const key = getGameSettingKey(item.settingName)
          window.api.saveSetting(key, nextVal, 'string')
          setSettings(prev => ({
            ...prev,
            [key]: { value: nextVal, type: 'string' }
          }))
          setActiveMenuStack(prev => {
            const next = [...prev]
            // Pop the options submenu
            next.pop()
            // Update the parent item's displayed value
            if (next.length > 0) {
              const parentItems = next[next.length - 1].items.map((it: any, idx: number) =>
                idx === index ? { ...it, value: nextVal } : it
              )
              next[next.length - 1] = { ...next[next.length - 1], items: parentItems }
            }
            return next
          })
        }
        setSelectedIndex(index)
      }
    }))

    setActiveMenuStack(prev => {
      const next = [...prev]
      if (next.length > 0) {
        next[next.length - 1] = { ...next[next.length - 1], savedSelectedIndex: index }
      }
      return [...next, { items: optionsSubmenu, title: item.label, parentItemId: item.id }]
    })
    setSelectedIndex(activeIdx !== -1 ? activeIdx : 0)
  }

  const getBottomButtons = () => {
    if (activeMenuStack.length <= 1) return []
    const buttons: { id: string; label: string; onClick: () => void }[] = []
    buttons.push({
      id: 'back_btn',
      label: t('BACK'),
      onClick: () => {
        if (activeMenuStack.length > 1) {
          setActiveMenuStack(prev => prev.slice(0, -1))
          const parentItem = activeMenuStack[activeMenuStack.length - 2]
          const parentItems = parentItem?.items || []
          const savedIdx = parentItem?.savedSelectedIndex
          setSelectedIndex(savedIdx !== undefined ? savedIdx : getFirstSelectableIndex(parentItems))
        } else {
          onClose()
        }
      }
    })
    return buttons
  }

  const confirmDelete = useCallback(
    async (deletePhysical: boolean) => {
      setShowDeleteConfirmModal(false)
      if (addNotification) addNotification(`REMOVENDO JOGO ${game.name.toUpperCase()}...`, 'info', 'general')

      try {
        await window.api.deleteGame(game.system || system.name, game.path, deletePhysical)

        if (addNotification) {
          addNotification(
            `JOGO ${game.name.toUpperCase()} REMOVIDO COM SUCESSO!`,
            'success',
            'general'
          )
        }

        onClose()

        if (onUpdateGamelists) {
          onUpdateGamelists(system.name)
        }
      } catch (err) {
        console.error(err)
        if (addNotification) addNotification('ERRO AO REMOVER O JOGO', 'warning', 'general')
      }
    },
    [game, system, addNotification, onClose, onUpdateGamelists]
  )

  const handleAction = async (item: any) => {
    if (item.actionType === 'back') {
      if (activeMenuStack.length > 1) {
        setActiveMenuStack(prev => prev.slice(0, -1))
        const parentItem = activeMenuStack[activeMenuStack.length - 2]
        const parentItems = parentItem?.items || []
        const savedIdx = parentItem?.savedSelectedIndex
        setSelectedIndex(savedIdx !== undefined ? savedIdx : getFirstSelectableIndex(parentItems))
      } else {
        onClose()
      }
      return
    }

    if (item.actionType === 'netplay_game') {
      const netplaySubmenu = [
        { id: 'group_netplay_launch', label: t('INICIAR JOGO'), type: 'group' },
        {
          id: 'host_netplay_game',
          label: t('ORGANIZAR JOGO EM REDE'),
          type: 'action',
          actionType: 'host_netplay'
        },
        { id: 'group_netplay_options', label: t('OPÇÕES'), type: 'group' },
        {
          id: 'netplay_public',
          label: t('ANUNCIAR PUBLICAMENTE O JOGO'),
          type: 'toggle',
          value: netplayPublic
        },
        {
          id: 'netplay_password',
          label: t('SENHA DO JOGADOR'),
          type: 'action',
          actionType: 'netplay_password',
          showArrow: true,
          value: netplayPassword
        },
        {
          id: 'netplay_spectator_password',
          label: t('SENHA DE ESPECTADOR'),
          type: 'action',
          actionType: 'netplay_spectator_password',
          showArrow: true,
          value: netplaySpectatorPassword
        }
      ]

      setActiveMenuStack(prev => {
        const next = [...prev]
        if (next.length > 0) {
          next[next.length - 1] = { ...next[next.length - 1], savedSelectedIndex: selectedIndex }
        }
        return [...next, { items: netplaySubmenu, title: t('START ONLINE GAME') }]
      })
      setSelectedIndex(getFirstSelectableIndex(netplaySubmenu))
      return
    }

    if (item.actionType === 'host_netplay') {
      onClose()
      const port = settings['global.netplay.port']?.value || '55435'
      if (onLaunchNetplay) {
        onLaunchNetplay({
          netPlayMode: 'host',
          port: port,
          password: netplayPassword,
          spectatorPassword: netplaySpectatorPassword,
          public: netplayPublic
        })
      }
      return
    }

    if (item.actionType === 'netplay_password') {
      setActiveInputField('netplay_password')
      setInputValue(netplayPassword)
      setShowInputModal(true)
      return
    }

    if (item.actionType === 'netplay_spectator_password') {
      setActiveInputField('netplay_spectator_password')
      setInputValue(netplaySpectatorPassword)
      setShowInputModal(true)
      return
    }

    if (item.actionType === 'launch') {
      onClose()
      if (onLaunch) onLaunch()
      return
    }

    if (item.actionType === 'save_states') {
      onClose()
      if (onOpenSaveStates) onOpenSaveStates()
      return
    }

    if (item.actionType === 'edit_metadata') {
      setDraftMetadata(draftGame)
      setMetadataSelectedIndex(0)
      setShowMetadataEditor(true)
      return
    }

    if (item.actionType === 'scrape') {
      setScraperStage(1)
      setScraperDbs({ ScreenScraper: true, ArcadeDB: true, TheGamesDB: true, HfsDB: true, IGDB: true })
      setScraperDbSelectedIndex(0)
      return
    }

    if (item.actionType === 'delete') {
      setDeleteModalSelectedIndex(1) // default to 'NÃO' for safety
      setShowDeleteConfirmModal(true)
      return
    }

    if (item.actionType === 'view_media') {
      setIsMediaViewerOpen(true)
      return
    }

    if (item.actionType === 'related_games') {
      if (onFilterRelated) {
        if (isFilteredRelated) {
          onFilterRelated(null)
        } else {
          onFilterRelated(game.genre || null)
        }
      }
      onClose()
      return
    }

    if (item.collectionName) {
      const col = item.collectionName
      const action = item.actionType
      
      const success = await window.api.toggleGameInCollection(col, game.system || system.name, game.path, action)
      if (success) {
        const newGameCols = action === 'add' 
          ? [...gameCollections.filter(c => c !== col), col]
          : gameCollections.filter(c => c !== col)
        
        setGameCollections(newGameCols)
        
        if (addNotification) {
          addNotification(
            action === 'add'
              ? `${game.name.toUpperCase()} ADICIONADO À COLEÇÃO ${col.toUpperCase()}`
              : `${game.name.toUpperCase()} REMOVIDO DA COLEÇÃO ${col.toUpperCase()}`,
            action === 'add' ? 'success' : 'info',
            'general'
          )
        }

        const newRootItems = getRootItems(draftGame, newGameCols, system, customCollections, settings)
        
        if (activeMenuStack.length > 1) {
          setActiveMenuStack([{ items: newRootItems, title: 'GAME OPTIONS' }])
          setSelectedIndex(getFirstSelectableIndex(newRootItems))
        } else {
          setActiveMenuStack([{ items: newRootItems, title: 'GAME OPTIONS' }])
          const targetIndex = getFirstSelectableIndex(newRootItems)
          setSelectedIndex(prev => Math.min(prev, newRootItems.length - 1) >= targetIndex ? Math.min(prev, newRootItems.length - 1) : targetIndex)
        }
      }
      return
    }

    // Fallback: call item's onClick if present (used by select option submenus)
    if (item.onClick) {
      item.onClick()
    }
  }

  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })

  const triggerScraperSearch = async (customQuery?: string) => {
    const queryToUse = customQuery || scraperQuery || game.name
    const selectedDbs = Object.entries(scraperDbs)
      .filter(([_, active]) => active)
      .map(([name]) => name)

    if (selectedDbs.length === 0) {
      if (addNotification) addNotification('SELECIONE AO MENOS UMA BASE DE DADOS', 'warning', 'scraper')
      return
    }

    setScraperIsSearching(true)
    setScraperStage(2)
    setScraperMatches([])
    setScraperMatchSelectedIndex(0)
    setActiveSection('matches')
    setFocusedCheckboxIndex(0)
    setFocusedButtonIndex(0)
    setTempMediaUrls({}) // Clear cached temporary media from previous searches

    try {
      const results = await window.api.searchGameMedia(system.name, queryToUse, selectedDbs, game.path)
      setScraperMatches(results || [])
    } catch (err: any) {
      console.error(err)
      const msg = err && typeof err === 'object' && 'message' in err
        ? (err.message as string).replace(/Error invoking remote method.*?: /i, '')
        : 'ERRO AO BUSCAR MÍDIAS'
      if (addNotification) addNotification(msg.toUpperCase(), 'warning', 'scraper')
    } finally {
      setScraperIsSearching(false)
    }
  }

  const triggerScraperDownload = async () => {
    const selectedMatch = scraperMatches[scraperMatchSelectedIndex]
    if (!selectedMatch) return

    if (addNotification) addNotification(`BAIXANDO MÍDIAS PARA ${game.name.toUpperCase()}...`, 'info', 'scraper')
    setScraperStage(0)
    onClose()

    try {
      const updated = await window.api.downloadGameMedia(system.name, game.path, selectedMatch, scrapeOptions)
      if (updated) {
        if (showMetadataEditor) {
          setDraftMetadata(updated)
        }
        const updateResult = onUpdate(updated)
        if (addNotification) addNotification(`MÍDIAS DE ${game.name.toUpperCase()} BAIXADAS COM SUCESSO!`, 'success', 'scraper')
        
        if (onUpdateGamelists) {
          if (updateResult instanceof Promise) {
            updateResult.then(() => {
              onUpdateGamelists(system.name)
            }).catch((err) => {
              console.error('Failed to save metadata before reload:', err)
              onUpdateGamelists(system.name)
            })
          } else {
            onUpdateGamelists(system.name)
          }
        }
      } else {
        if (addNotification) addNotification(`ERRO AO BAIXAR MÍDIAS`, 'warning', 'scraper')
      }
    } catch (err) {
      console.error(err)
      if (addNotification) addNotification(`ERRO AO BAIXAR MÍDIAS`, 'warning', 'scraper')
    }
  }

  const handleScraperKeyDown = (e: KeyboardEvent) => {
    const dbKeys = ['ScreenScraper', 'ArcadeDB', 'TheGamesDB', 'HfsDB', 'IGDB']
    const totalDbs = dbKeys.length
    const buscarIndex = totalDbs
    const cancelarIndex = totalDbs + 1

    if (scraperStage === 1) {
      if (scraperDbSelectedIndex >= totalDbs) {
        // Button zone: horizontal navigation between BUSCAR and CANCELAR
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          setScraperDbSelectedIndex(prev => prev === buscarIndex ? cancelarIndex : buscarIndex)
        } else if (e.key === 'ArrowUp') {
          // Go back up to last DB checkbox
          setScraperDbSelectedIndex(totalDbs - 1)
        } else if (e.key === 'ArrowDown') {
          // Wrap to first DB checkbox
          setScraperDbSelectedIndex(0)
        } else if (e.key === 'Enter' || e.key === ' ') {
          if (scraperDbSelectedIndex === buscarIndex) {
            triggerScraperSearch()
          } else if (scraperDbSelectedIndex === cancelarIndex) {
            setScraperStage(0)
          }
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          setScraperStage(0)
        }
      } else {
        // DB checkbox zone: vertical navigation
        if (e.key === 'ArrowDown') {
          setScraperDbSelectedIndex(prev => prev + 1 < totalDbs ? prev + 1 : buscarIndex)
        } else if (e.key === 'ArrowUp') {
          setScraperDbSelectedIndex(prev => prev - 1 >= 0 ? prev - 1 : cancelarIndex)
        } else if (e.key === 'Enter' || e.key === ' ') {
          const targetKey = dbKeys[scraperDbSelectedIndex]
          setScraperDbs(prev => ({ ...prev, [targetKey]: !prev[targetKey] }))
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          setScraperStage(0)
        }
      }
    } else if (scraperStage === 2) {
      if (scraperIsSearching) return
      if (scraperMatches.length === 0) {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          setScraperStage(1)
        }
        return
      }

      const checkboxKeys = ['title', 'desc', 'fanart', 'logo', 'cover', 'video'] as const

      if (activeSection === 'matches') {
        if (e.key === 'ArrowDown') {
          if (scraperMatchSelectedIndex === scraperMatches.length - 1) {
            setActiveSection('buttons')
            setFocusedButtonIndex(0)
          } else {
            setScraperMatchSelectedIndex(prev => prev + 1)
          }
        } else if (e.key === 'ArrowUp') {
          if (scraperMatchSelectedIndex === 0) {
            setActiveSection('buttons')
            setFocusedButtonIndex(0)
          } else {
            setScraperMatchSelectedIndex(prev => prev - 1)
          }
        } else if (e.key === 'ArrowRight') {
          setActiveSection('checkboxes')
          setFocusedCheckboxIndex(0)
        } else if (e.key === 'Enter' || e.key === ' ') {
          triggerScraperDownload()
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          setScraperStage(1)
        }
      } else if (activeSection === 'checkboxes') {
        if (e.key === 'ArrowDown') {
          if (focusedCheckboxIndex < 5) {
            setFocusedCheckboxIndex(prev => prev + 1)
          } else {
            setActiveSection('buttons')
            setFocusedButtonIndex(0)
          }
        } else if (e.key === 'ArrowUp') {
          if (focusedCheckboxIndex > 0) {
            setFocusedCheckboxIndex(prev => prev - 1)
          } else {
            setActiveSection('buttons')
            setFocusedButtonIndex(0)
          }
        } else if (e.key === 'ArrowLeft') {
          setActiveSection('matches')
        } else if (e.key === 'Enter' || e.key === ' ') {
          const keyToToggle = checkboxKeys[focusedCheckboxIndex]
          setScrapeOptions(prev => ({ ...prev, [keyToToggle]: !prev[keyToToggle] }))
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          setActiveSection('matches')
        }
      } else if (activeSection === 'buttons') {
        if (e.key === 'ArrowLeft') {
          setFocusedButtonIndex(prev => (prev - 1 + 3) % 3)
        } else if (e.key === 'ArrowRight') {
          setFocusedButtonIndex(prev => (prev + 1) % 3)
        } else if (e.key === 'ArrowUp') {
          if (focusedButtonIndex === 0) {
            setActiveSection('matches')
          } else {
            setActiveSection('checkboxes')
            setFocusedCheckboxIndex(5)
          }
        } else if (e.key === 'Enter' || e.key === ' ') {
          if (focusedButtonIndex === 0) {
            triggerScraperDownload()
          } else if (focusedButtonIndex === 1) {
            setActiveInputField('scraper_search_query')
            setInputValue(scraperQuery)
            const useOSK = settings.UseOSK?.value !== 'false' && settings.UseOSK?.value !== false
            if (useOSK) {
              setShowOSK(true)
            } else {
              setShowInputModal(true)
            }
          } else if (focusedButtonIndex === 2) {
            setScraperStage(1)
          }
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          setActiveSection('matches')
        }
      }
    }
  }

  const handleSaveMetadata = async () => {
    setShowMetadataEditor(false)
    if (addNotification) {
      addNotification(`SALVANDO METADADOS PARA ${game.name.toUpperCase()}...`, 'info', 'general')
    }
    try {
      await onUpdate(draftMetadata)
      if (addNotification) {
        addNotification(`METADADOS DE ${draftMetadata.name.toUpperCase()} SALVOS COM SUCESSO!`, 'success', 'general')
      }
      onClose()
      if (onUpdateGamelists) {
        onUpdateGamelists(system.name)
      }
    } catch (err) {
      console.error(err)
      if (addNotification) {
        addNotification('ERRO AO SALVAR METADADOS', 'warning', 'general')
      }
    }
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return
      if (isMediaViewerOpen) return
      if (showOSK) return

      if (showInputModal) {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          if (activeInputField === 'netplay_password') {
            setNetplayPassword(inputValue)
            updateNetplayMenuItemValue('netplay_password', inputValue)
          } else if (activeInputField === 'netplay_spectator_password') {
            setNetplaySpectatorPassword(inputValue)
            updateNetplayMenuItemValue('netplay_spectator_password', inputValue)
          } else {
            const savedVal = activeInputField === 'releasedate' ? parseDateForDb(inputValue) : inputValue
            setDraftMetadata(prev => ({ ...prev, [activeInputField]: savedVal }))
          }
          setShowInputModal(false)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          setShowInputModal(false)
        }
        return
      }

      if (showMetadataEditor) {

        e.preventDefault()
        e.stopPropagation()

        const totalFields = fields.length

        if (e.key === 'ArrowDown') {
          setMetadataSelectedIndex(prev => {
            if (prev < totalFields - 1) {
              return prev + 1
            } else if (prev === totalFields - 1) {
              return totalFields
            } else {
              return 0
            }
          })
        } else if (e.key === 'ArrowUp') {
          setMetadataSelectedIndex(prev => {
            if (prev === 0) {
              return totalFields + 3
            } else if (prev >= totalFields) {
              return totalFields - 1
            } else {
              return prev - 1
            }
          })
        } else if (e.key === 'ArrowRight') {
          if (metadataSelectedIndex >= totalFields) {
            setMetadataSelectedIndex(prev => {
              const currentBtn = prev - totalFields
              const nextBtn = (currentBtn + 1) % 4
              return totalFields + nextBtn
            })
          }
        } else if (e.key === 'ArrowLeft') {
          if (metadataSelectedIndex >= totalFields) {
            setMetadataSelectedIndex(prev => {
              const currentBtn = prev - totalFields
              const nextBtn = (currentBtn - 1 + 4) % 4
              return totalFields + nextBtn
            })
          }
        } else if (e.key === 'Enter' || e.key === ' ') {
          if (metadataSelectedIndex < totalFields) {
            const field = fields[metadataSelectedIndex]
            if (field.type === 'bool') {
              setDraftMetadata(prev => ({ ...prev, [field.key]: !prev[field.key as keyof Game] }))
            } else {
              setActiveInputField(field.key)
              const rawVal = (draftMetadata[field.key as keyof Game] as string) || ''
              const val = field.key === 'releasedate' ? formatDateForDisplay(rawVal) : rawVal
              setInputValue(val)
              const useOSK = settings.UseOSK?.value !== 'false' && settings.UseOSK?.value !== false
              if (useOSK) {
                setShowOSK(true)
              } else {
                setShowInputModal(true)
              }
            }
          } else {
            const btnIdx = metadataSelectedIndex - totalFields
            if (btnIdx === 0) {
              handleSaveMetadata()
            } else if (btnIdx === 1) {
              setScraperStage(1)
              setScraperDbs({ ScreenScraper: true, ArcadeDB: true, TheGamesDB: true, HfsDB: true, IGDB: true })
              setScraperDbSelectedIndex(0)
            } else if (btnIdx === 2) {
              setDeleteModalSelectedIndex(1)
              setShowDeleteConfirmModal(true)
            } else if (btnIdx === 3) {
              setShowMetadataEditor(false)
            }
          }
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          setShowMetadataEditor(false)
        }
        return
      }

      if (showDeleteConfirmModal) {
        e.preventDefault()
        e.stopPropagation()
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          setDeleteModalSelectedIndex(prev => prev === 0 ? 1 : 0)
        } else if (e.key === 'Enter' || e.key === ' ') {
          confirmDelete(deleteModalSelectedIndex === 0)
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          setShowDeleteConfirmModal(false)
        }
        return
      }

      if (scraperStage !== 0) {
        e.preventDefault()
        e.stopPropagation()
        handleScraperKeyDown(e)
        return
      }

      if (activeMenuStack.length === 0) return

      const keyLower = e.key.toLowerCase()
      const navKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'enter', ' ', 'backspace', 'escape']
      if (navKeys.includes(keyLower)) {
        e.stopPropagation()
      }

      const bottomButtons = getBottomButtons()
      const lastSelectableMenuIndex = (() => {
        for (let i = currentMenu.length - 1; i >= 0; i--) {
          if (currentMenu[i]?.type !== 'group') return i
        }
        return -1
      })()

      const hasTabs = currentStackItem && currentStackItem.tabs && currentStackItem.tabs.length > 0 && currentStackItem.activeTab !== undefined

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (selectedIndex >= currentMenu.length) {
          setSelectedIndex(getFirstSelectableIndex(currentMenu))
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
        } else if (selectedIndex === getFirstSelectableIndex(currentMenu) && bottomButtons.length > 0) {
          setSelectedIndex(currentMenu.length + bottomButtons.length - 1)
        } else {
          setSelectedIndex(prev => {
            let next = (prev - 1 + currentMenu.length) % currentMenu.length
            while (currentMenu[next]?.type === 'group' && next !== prev) next = (next - 1 + currentMenu.length) % currentMenu.length
            return next
          })
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (selectedIndex >= currentMenu.length) {
          const btnIdx = selectedIndex - currentMenu.length
          bottomButtons[btnIdx]?.onClick()
        } else {
          const item = currentMenu[selectedIndex]
          if (item) {
            if (item.type === 'submenu') {
              const submenuItems = item.submenu!
              const filteredItems = item.tabs ? submenuItems.filter((si: any) => si.tab === 0) : submenuItems
              setActiveMenuStack(prev => {
                const next = [...prev]
                if (next.length > 0) {
                  next[next.length - 1] = { ...next[next.length - 1], savedSelectedIndex: selectedIndex }
                }
                return [...next, { 
                  items: submenuItems, 
                  title: item.label, 
                  tabs: item.tabs, 
                  activeTab: item.tabs ? 0 : undefined,
                  parentItemId: item.id
                }]
              })
              setSelectedIndex(getFirstSelectableIndex(filteredItems))
            } else if (item.type === 'toggle') {
              handleToggle()
            } else if (item.type === 'select') {
              handleSelectOpen(item, selectedIndex)
            } else if (item.type === 'action') {
              handleAction(item)
            }
          }
        }
      } else if (e.key === 'ArrowRight') {
        if (selectedIndex >= currentMenu.length) {
          e.preventDefault()
          const currentBtnIdx = selectedIndex - currentMenu.length
          const nextBtnIdx = (currentBtnIdx + 1) % bottomButtons.length
          setSelectedIndex(currentMenu.length + nextBtnIdx)
          return
        }
        if (hasTabs) {
          const newTab = (currentStackItem.activeTab! + 1) % currentStackItem.tabs!.length
          setActiveMenuStack(prev => {
            const next = [...prev]
            next[next.length - 1] = { ...next[next.length - 1], activeTab: newTab }
            return next
          })
          const tabItems = currentStackItem.items.filter(item => item.tab === newTab)
          setSelectedIndex(getFirstSelectableIndex(tabItems))
        } else {
          const item = currentMenu[selectedIndex]
          if (item?.type === 'select') handleSelect(1)
        }
      } else if (e.key === 'ArrowLeft') {
        if (selectedIndex >= currentMenu.length) {
          e.preventDefault()
          const currentBtnIdx = selectedIndex - currentMenu.length
          const nextBtnIdx = (currentBtnIdx - 1 + bottomButtons.length) % bottomButtons.length
          setSelectedIndex(currentMenu.length + nextBtnIdx)
          return
        }
        if (hasTabs) {
          const newTab = (currentStackItem.activeTab! - 1 + currentStackItem.tabs!.length) % currentStackItem.tabs!.length
          setActiveMenuStack(prev => {
            const next = [...prev]
            next[next.length - 1] = { ...next[next.length - 1], activeTab: newTab }
            return next
          })
          const tabItems = currentStackItem.items.filter(item => item.tab === newTab)
          setSelectedIndex(getFirstSelectableIndex(tabItems))
        } else {
          const item = currentMenu[selectedIndex]
          if (item?.type === 'select') handleSelect(-1)
        }
      } else if (e.key === 'Backspace' || e.key === 'Escape') {
        e.preventDefault()
        if (activeMenuStack.length > 1) {
          setActiveMenuStack(prev => prev.slice(0, -1))
          const parentItem = activeMenuStack[activeMenuStack.length - 2]
          const parentItems = parentItem?.items || []
          const savedIdx = parentItem?.savedSelectedIndex
          setSelectedIndex(savedIdx !== undefined ? savedIdx : getFirstSelectableIndex(parentItems))
        } else {
          onClose()
        }
      }
    },
    [isOpen, selectedIndex, currentMenu, activeMenuStack, draftGame, gameCollections, customCollections, system, scraperStage, scraperDbSelectedIndex, scraperDbs, scraperMatches, scraperMatchSelectedIndex, settings, showDeleteConfirmModal, deleteModalSelectedIndex, confirmDelete, showMetadataEditor, showInputModal, metadataSelectedIndex, activeInputField, inputValue, draftMetadata, activeSection, focusedCheckboxIndex, focusedButtonIndex, scraperQuery, scrapeOptions]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])

  useEffect(() => {
    if (scraperStage === 2) {
      const selectedEl = document.querySelector('.scraper-match-item.selected')
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [scraperMatchSelectedIndex, scraperStage, activeSection])

  const bottomButtons = getBottomButtons()

  const menuItemsNode = (
    <Box className="riescade-menu-list">
      {currentMenu.map((item, index) => {
        if (item.type === 'group') {
          return (
            <Text 
              key={item.id} 
              size="1" 
              weight="bold" 
              className="riescade-menu-group"
            >
              {item.label}
            </Text>
          )
        }
        const isSelected = index === selectedIndex

        return (
          <Box
            key={item.id}
            onMouseMove={(e) => {
              if (scraperStage === 0) {
                if (e.clientX !== lastMousePos.x || e.clientY !== lastMousePos.y) {
                  setLastMousePos({ x: e.clientX, y: e.clientY })
                  if (selectedIndex !== index) setSelectedIndex(index)
                }
              }
            }}
            onClick={() => {
              if (scraperStage !== 0) return
              if (item.type === 'submenu') {
                const submenuItems = item.submenu!
                const filteredItems = item.tabs ? submenuItems.filter((si: any) => si.tab === 0) : submenuItems
                setActiveMenuStack(prev => {
                  const next = [...prev]
                  if (next.length > 0) {
                    next[next.length - 1] = { ...next[next.length - 1], savedSelectedIndex: selectedIndex }
                  }
                  return [...next, { 
                    items: submenuItems, 
                    title: item.label, 
                    tabs: item.tabs, 
                    activeTab: item.tabs ? 0 : undefined,
                    parentItemId: item.id
                  }]
                })
                setSelectedIndex(getFirstSelectableIndex(filteredItems))
              } else if (item.type === 'toggle') {
                handleToggle()
              } else if (item.type === 'select') {
                handleSelectOpen(item, index)
              } else if (item.type === 'action') {
                handleAction(item)
              }
            }}
            className={`riescade-menu-item${isSelected ? ' selected' : ''}`}
          >
            <Flex className="riescade-menu-item-content">
              <Flex className="riescade-menu-item-row">
                <Text weight="bold" size="2" className="riescade-menu-item-label">
                  {item.label}
                </Text>
              </Flex>
              {item.description && (
                <Text size="1" className="riescade-menu-item-description">
                  {item.description}
                </Text>
              )}
            </Flex>
            <Box className="riescade-menu-item-value">
              {item.type === 'toggle' ? (
                <Switch 
                  checked={item.value} 
                  onClick={(e) => { e.stopPropagation(); handleToggle() }} 
                  style={{ cursor: 'pointer' }} 
                />
              ) : item.type === 'submenu' || item.showArrow ? (
                <span className="riescade-menu-arrow">›</span>
              ) : item.type === 'select' ? (
                <Flex className="riescade-menu-value-control">
                  <Button 
                    variant="ghost" 
                    size="1" 
                    onClick={(e) => { e.stopPropagation(); handleSelect(-1) }}
                  >
                    ◁
                  </Button>
                  <Text size="2">{item.items?.find((i: any) => i.value === item.value)?.label || item.value}</Text>
                  <Button 
                    variant="ghost" 
                    size="1" 
                    onClick={(e) => { e.stopPropagation(); handleSelect(1) }}
                  >
                    ▷
                  </Button>
                </Flex>
              ) : item.type === 'info' ? (
                <Text size="2" weight="bold" style={{ color: isSelected ? '#fff' : '#888' }}>
                  {item.value}
                </Text>
              ) : null}
            </Box>
          </Box>
        )
      })}
    </Box>
  )

  if (!isOpen) return null

  const marqueeUrl = getMarqueeUrl()

  const renderStageStage1 = () => {
    const dbKeys = ['ScreenScraper', 'ArcadeDB', 'TheGamesDB', 'HfsDB', 'IGDB']
    return (
      <Dialog.Root open={isOpen && scraperStage === 1} onOpenChange={(open) => { if (!open) setScraperStage(0); }}>
        <Dialog.Content 
          size="3" 
          className="riescade-menu"
          style={{ maxWidth: '500px' }}
        >
          <Flex className="riescade-menu-header">
            <Heading size="4" className="riescade-menu-title">
              {t('SEARCH FOR MEDIA')}
            </Heading>
          </Flex>
          <Box className="riescade-menu-content">
            <Box className="riescade-menu-list">
              {dbKeys.map((db, idx) => {
                const isSelected = scraperDbSelectedIndex === idx
                const isChecked = scraperDbs[db]
                return (
                  <Box
                    key={db}
                    onMouseMove={() => setScraperDbSelectedIndex(idx)}
                    onClick={() => {
                      setScraperDbSelectedIndex(idx)
                      setScraperDbs(prev => ({ ...prev, [db]: !prev[db] }))
                    }}
                    className={`riescade-menu-item${isSelected ? ' selected' : ''}`}
                  >
                    <Flex className="riescade-menu-item-content">
                      <Flex className="riescade-menu-item-row" gap="3" align="center">
                        <Checkbox checked={isChecked} onClick={(e) => { e.stopPropagation(); setScraperDbs(prev => ({ ...prev, [db]: !prev[db] })); }} />
                        <Text size="2" className="riescade-menu-item-label">{db.toUpperCase()}</Text>
                      </Flex>
                    </Flex>
                  </Box>
                )
              })}
            </Box>
          </Box>
          <Flex className="riescade-menu-footer">
            <Button
              variant={scraperDbSelectedIndex === 5 ? "solid" : "soft"}
              color={scraperDbSelectedIndex === 5 ? undefined : "gray"}
              onMouseMove={() => setScraperDbSelectedIndex(5)}
              onClick={() => triggerScraperSearch()}
            >
              {t('SEARCH')}
            </Button>
            <Button
              variant={scraperDbSelectedIndex === 6 ? "solid" : "soft"}
              color={scraperDbSelectedIndex === 6 ? "red" : "gray"}
              onMouseMove={() => setScraperDbSelectedIndex(6)}
              onClick={() => setScraperStage(0)}
            >
              {t('CANCEL')}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    )
  }

  const renderStageStage2Searching = () => {
    return (
      <Dialog.Root open={isOpen && scraperStage === 2 && scraperIsSearching} onOpenChange={(open) => { if (!open) setScraperStage(1); }}>
        <Dialog.Content className='riescade-menu' size="2" style={{ maxWidth: '400px', width: '90%' }}>
          <Flex direction="column" align="center" justify="center" p="6" gap="3">
            <Spinner size="3" />
            <Text size="2" color="gray">{t('SEARCHING FOR MEDIA IN DATABASES...')}</Text>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    )
  }

  const renderStageStage2NoMatches = () => {
    return (
      <Dialog.Root open={isOpen && scraperStage === 2 && !scraperIsSearching && scraperMatches.length === 0} onOpenChange={(open) => { if (!open) setScraperStage(1); }}>
        <Dialog.Content size="2" style={{ maxWidth: '400px', width: '90%' }}>
          <Flex direction="column" align="center" justify="center" p="6" gap="4">
            <Heading size="3" style={{ color: 'var(--theme-color)' }}>{t('RESULTS')}</Heading>
            <Text size="2" color="gray" style={{ textAlign: 'center' }}>{t('NO MEDIA FOUND FOR THIS GAME.')}</Text>
            <Button onClick={() => setScraperStage(1)} style={{ outline: '2px solid #fff' }}>
              {t('BACK')}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    )
  }

  const renderStageStage2Matches = () => {
    const selectedMatch = scraperMatches[scraperMatchSelectedIndex]
    let previewImage = selectedMatch?.media?.thumbnail || selectedMatch?.thumbnail || selectedMatch?.media?.image || selectedMatch?.image || selectedMatch?.media?.marquee
    let previewVideo = selectedMatch?.media?.video || selectedMatch?.video

    if (selectedMatch) {
      const cachedString = tempMediaUrls[selectedMatch.id]
      if (cachedString) {
        try {
          const cached = JSON.parse(cachedString)
          if (cached.image) previewImage = cached.image
          if (cached.video) previewVideo = cached.video
        } catch (e) {}
      }
    }

    const isLocalUrl = (url?: string) => {
      if (!url) return false
      return url.startsWith('file:///') || url.startsWith('data:') || !url.startsWith('http')
    }

    const showImage = previewImage && isLocalUrl(previewImage)
    const showVideo = !showImage && previewVideo && isLocalUrl(previewVideo)

    const hasMediaToDownload = !!(
      selectedMatch?.media?.image ||
      selectedMatch?.media?.thumbnail ||
      selectedMatch?.image ||
      selectedMatch?.thumbnail ||
      selectedMatch?.media?.video ||
      selectedMatch?.video
    )
    const isCached = selectedMatch ? !!tempMediaUrls[selectedMatch.id] : false
    const isLoadingMedia = tempMediaLoading || (hasMediaToDownload && !isCached)

    const matchesByDb: Record<string, { match: any; globalIndex: number }[]> = {}
    scraperMatches.forEach((match, idx) => {
      const dbName = match.db || 'DESCONHECIDO'
      if (!matchesByDb[dbName]) {
        matchesByDb[dbName] = []
      }
      matchesByDb[dbName].push({ match, globalIndex: idx })
    })

    const formatReleaseDate = (dateStr?: string) => {
      return formatDateForDisplay(dateStr) || 'N/A'
    }

    const renderStars = (rating?: number) => {
      const filledCount = rating !== undefined ? Math.round(rating * 5) : 0
      const stars = []
      for (let i = 0; i < 5; i++) {
        stars.push(
          <Text 
            key={i} 
            style={{ 
              color: i < filledCount ? '#fff' : '#444', 
              fontSize: '1.1rem',
              marginRight: '2px'
            }}
          >
            ★
          </Text>
        )
      }
      return stars
    }

    return (
      <Dialog.Root open={isOpen && scraperStage === 2 && !scraperIsSearching && scraperMatches.length > 0} onOpenChange={(open) => { if (!open) setScraperStage(1); }}>
        <Dialog.Content 
          size="4" 
          className="riescade-menu"
          style={{ 
            maxWidth: '90vw', 
            width: '90vw', 
            height: '90vh', 
            maxHeight: '90vh'
          }}
        >
          <Flex className="riescade-menu-header">
            <Heading size="4" className="riescade-menu-title">
              {getRomFileName(game.path).toUpperCase()}
            </Heading>
            <Text size="1" color="gray" mt="1">{(system.fullname || system.name).toUpperCase()}</Text>
          </Flex>

          <Grid columns="40% 25% 35%" gap="3" style={{ flexGrow: 1, overflow: 'hidden' }}>
            <Box style={{ overflowY: 'auto', borderRight: '1px solid rgba(255, 255, 255, 0.1)', padding: '15px' }} className="custom-scrollbar">
              {Object.entries(matchesByDb).map(([dbName, items]) => (
                <Box key={dbName} mb="4">
                  <Text size="1" weight="bold" color="gray" style={{ textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                    {dbName.toUpperCase()}
                  </Text>
                  <Box className="riescade-menu-list">
                    {items.map(({ match, globalIndex }) => {
                      const isSelected = scraperMatchSelectedIndex === globalIndex
                      return (
                        <Box
                          key={globalIndex}
                          onClick={() => {
                            setScraperMatchSelectedIndex(globalIndex)
                            setActiveSection('matches')
                          }}
                          className={`riescade-menu-item${isSelected ? ' selected' : ''}`}
                        >
                          <Flex className="riescade-menu-item-content">
                            <Flex className="riescade-menu-item-row">
                              <Text weight="bold" size="2" className="riescade-menu-item-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                {match.name || 'Sem nome'}
                              </Text>
                            </Flex>
                          </Flex>
                        </Box>
                      )
                    })}
                  </Box>
                </Box>
              ))}
            </Box>

            <Box style={{ overflowY: 'auto', borderRight: '1px solid rgba(255, 255, 255, 0.1)', padding: '15px' }}>
              <Text size="1" weight="bold" style={{ color: 'var(--theme-color)', letterSpacing: '1.5px', textTransform: 'uppercase', display: 'block', marginBottom: '15px' }}>
                {t('DOWNLOAD CONTENT')}
              </Text>
              <Box className="riescade-menu-list">
                {[
                  { key: 'title', label: t('TITLE') },
                  { key: 'desc', label: t('DESCRIPTION') },
                  { key: 'fanart', label: t('FANART') },
                  { key: 'logo', label: t('LOGO') },
                  { key: 'cover', label: t('COVER') },
                  { key: 'video', label: t('VIDEO') }
                ].map((item, index) => {
                  const isFocused = activeSection === 'checkboxes' && focusedCheckboxIndex === index
                  const isChecked = scrapeOptions[item.key as keyof typeof scrapeOptions]
                  return (
                    <Box
                      key={item.key}
                      onMouseMove={() => {
                        setActiveSection('checkboxes')
                        setFocusedCheckboxIndex(index)
                      }}
                      onClick={() => {
                        setActiveSection('checkboxes')
                        setFocusedCheckboxIndex(index)
                        setScrapeOptions(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof scrapeOptions] }))
                      }}
                      className={`riescade-menu-item${isFocused ? ' selected' : ''}`}
                    >
                      <Flex className="riescade-menu-item-content">
                        <Flex className="riescade-menu-item-row" gap="3" align="center">
                          <Checkbox checked={isChecked} onClick={(e) => { e.stopPropagation(); setScrapeOptions(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof scrapeOptions] })); }} />
                          <Text size="2" className="riescade-menu-item-label">{item.label}</Text>
                        </Flex>
                      </Flex>
                    </Box>
                  )
                })}
              </Box>
            </Box>

            <Box style={{ display: 'flex', flexDirection: 'column', padding: '15px', overflowY: 'auto' }} className="custom-scrollbar">
              <Text size="1" weight="bold" style={{ color: 'var(--theme-color)', letterSpacing: '1.5px', textTransform: 'uppercase', display: 'block', marginBottom: '15px' }}>
                {t('PREVIEW')}
              </Text>
              
              <Box className="riescade-preview-container">
                {isLoadingMedia ? (
                  <Spinner size="2" />
                ) : showImage ? (
                  <img src={previewImage} className="riescade-preview-media" alt="Preview" />
                ) : showVideo ? (
                  <video src={previewVideo} className="riescade-preview-media" autoPlay loop muted />
                ) : (
                  <Text size="1" color="gray">{t('Nenhuma prévia disponível')}</Text>
                )}
              </Box>

              <Heading size="3" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {selectedMatch?.name || 'Sem nome'}
              </Heading>
              
              <Flex gap="3" mt="2" mb="3" style={{ opacity: 0.8, fontSize: '0.8rem' }} align="center" wrap="wrap">
                <Text>{t('DEVELOPER')}: {selectedMatch?.developer || 'N/A'}</Text>
                <Text>•</Text>
                <Text>{t('RELEASE DATE')}: {formatReleaseDate(selectedMatch?.releasedate)}</Text>
                {selectedMatch?.rating !== undefined && (
                  <>
                    <Text>•</Text>
                    <Flex align="center">{renderStars(selectedMatch.rating)}</Flex>
                  </>
                )}
              </Flex>

              <Heading size="1" color="gray" style={{ textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '8px' }}>
                {t('DESCRIPTION')}
              </Heading>
              <Text size="1" color="gray" style={{ display: 'block', maxHeight: '100px', overflowY: 'auto', marginTop: '10px', whiteSpace: 'normal' }} className="custom-scrollbar">
                {selectedMatch?.desc || selectedMatch?.synopsis || t('Nenhuma descrição disponível para este jogo.')}
              </Text>
            </Box>
          </Grid>

          <Flex className="riescade-menu-footer">
            <Button
              variant={activeSection === 'buttons' && focusedButtonIndex === 0 ? "solid" : "soft"}
              color={activeSection === 'buttons' && focusedButtonIndex === 0 ? undefined : "gray"}
              onClick={triggerScraperDownload}
              onMouseEnter={() => {
                setActiveSection('buttons')
                setFocusedButtonIndex(0)
              }}
            >
              {t('DOWNLOAD')}
            </Button>
            <Button
              variant={activeSection === 'buttons' && focusedButtonIndex === 1 ? "solid" : "soft"}
              color={activeSection === 'buttons' && focusedButtonIndex === 1 ? undefined : "gray"}
              onClick={() => {
                setActiveInputField('scraper_search_query')
                setInputValue(scraperQuery)
                const useOSK = settings.UseOSK?.value !== 'false' && settings.UseOSK?.value !== false
                if (useOSK) {
                  setShowOSK(true)
                } else {
                  setShowInputModal(true)
                }
              }}
              onMouseEnter={() => {
                setActiveSection('buttons')
                setFocusedButtonIndex(1)
              }}
            >
              {t('INPUT')}
            </Button>
            <Button
              variant={activeSection === 'buttons' && focusedButtonIndex === 2 ? "solid" : "soft"}
              color={activeSection === 'buttons' && focusedButtonIndex === 2 ? "red" : "gray"}
              onClick={() => setScraperStage(1)}
              onMouseEnter={() => {
                setActiveSection('buttons')
                setFocusedButtonIndex(2)
              }}
            >
              {t('CANCEL')}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    )
  }

  const renderInputModal = () => {
    const field = fields.find(f => f.key === activeInputField)
    let label = field ? field.label : ''
    if (activeInputField === 'netplay_password') label = t('SENHA DO JOGADOR')
    if (activeInputField === 'netplay_spectator_password') label = t('SENHA DE ESPECTADOR')
    const isMultiline = activeInputField === 'desc'
    const isRating = activeInputField === 'rating'

    return (
      <Dialog.Root open={!!showInputModal && !showMetadataEditor} onOpenChange={(open) => { if (!open) setShowInputModal(false); }}>
        <Dialog.Content style={{ maxWidth: '450px', width: '90%' }}>
          <Flex direction="column" gap="4">
            <Heading size="3" style={{ color: 'var(--theme-color)' }}>
              {t(label)}
            </Heading>
            
            {isRating ? (
              <Flex direction="column" align="center" gap="2">
                <Text size="5" style={{ color: 'var(--theme-color)' }}>
                  {getStarsString(inputValue)}
                </Text>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={typeof inputValue === 'number' ? inputValue : parseFloat(inputValue || '0')}
                  onChange={e => setInputValue(parseFloat(e.target.value) as any)}
                  style={{ width: '100%', accentColor: 'var(--theme-color)' }}
                />
                <Text size="2" weight="bold">
                  {Math.round((typeof inputValue === 'number' ? inputValue : parseFloat(inputValue || '0')) * 100)}%
                </Text>
              </Flex>
            ) : isMultiline ? (
              <textarea
                autoFocus
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '120px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '8px',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            ) : (
              <input
                type="text"
                autoFocus
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '8px',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit'
                }}
              />
            )}

            <Flex justify="end" gap="3">
              <Button
                onClick={() => {
                  if (activeInputField === 'netplay_password') {
                    setNetplayPassword(inputValue)
                    updateNetplayMenuItemValue('netplay_password', inputValue)
                  } else if (activeInputField === 'netplay_spectator_password') {
                    setNetplaySpectatorPassword(inputValue)
                    updateNetplayMenuItemValue('netplay_spectator_password', inputValue)
                  } else {
                    const savedVal = activeInputField === 'releasedate' ? parseDateForDb(inputValue) : inputValue
                    setDraftMetadata(prev => ({ ...prev, [activeInputField]: savedVal }))
                  }
                  setShowInputModal(false)
                }}
                style={{ cursor: 'pointer', outline: '2px solid #fff' }}
              >
                {t('SAVE')}
              </Button>
              <Button
                onClick={() => setShowInputModal(false)}
                variant="soft"
                color="gray"
                style={{ cursor: 'pointer' }}
              >
                {t('CANCEL')}
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    )
  }


  const renderMetadataEditor = () => {
    const totalFields = fields.length
    return (
      <Flex direction="column" style={{ height: '100%', maxHeight: 'inherit', overflow: 'hidden' }}>
        <Flex className="riescade-menu-header">
          <Heading size="4" className="riescade-menu-title">
            {t('EDIT METADATA')}
          </Heading>
          <Text size="1" color="gray" mt="1">{getRomDisplayPath(game.path)}</Text>
        </Flex>

        <Box className="riescade-menu-content custom-scrollbar">
          <Box className="riescade-menu-list">
            {fields.map((field, idx) => {
              const isSelected = metadataSelectedIndex === idx
              const val = (draftMetadata[field.key as keyof Game] as string) || ''
              const isBool = field.type === 'bool'
              const boolVal = !!draftMetadata[field.key as keyof Game]

              return (
                <Box
                  key={field.key}
                  className={`riescade-menu-item${isSelected ? ' selected' : ''} riescade-metadata-row`}
                  onMouseMove={() => {
                    if (!showInputModal) setMetadataSelectedIndex(idx)
                  }}
                  onClick={() => {
                    if (showInputModal) return
                    if (isBool) {
                      setDraftMetadata(prev => ({ ...prev, [field.key]: !prev[field.key as keyof Game] }))
                    } else {
                      setActiveInputField(field.key)
                      const rawVal = (draftMetadata[field.key as keyof Game] as string) || ''
                      const val = field.key === 'releasedate' ? formatDateForDisplay(rawVal) : rawVal
                      setInputValue(val)
                      const useOSK = settings.UseOSK?.value !== 'false' && settings.UseOSK?.value !== false
                      if (useOSK) {
                        setShowOSK(true)
                      } else {
                        setShowInputModal(true)
                      }
                    }
                  }}
                >
                  <Flex className="riescade-menu-item-content">
                    <Flex className="riescade-menu-item-row">
                      <Text weight="bold" size="2" className="riescade-menu-item-label">{t(field.label)}</Text>
                    </Flex>
                  </Flex>
                  
                  <Box className="riescade-menu-item-value">
                    {isBool ? (
                      <Switch checked={boolVal} style={{ cursor: 'pointer' }} />
                    ) : (
                      <Flex align="center" gap="1">
                        <Text size="2" color={isSelected ? undefined : "gray"}>
                          {field.key === 'releasedate' ? formatDateForDisplay(val) : (field.type === 'rating' ? getStarsString(val) : val)}
                        </Text>
                        <span className="riescade-menu-arrow">›</span>
                      </Flex>
                    )}
                  </Box>
                </Box>
              )
            })}
          </Box>
        </Box>

        <Flex className="riescade-menu-footer">
          {['SAVE', 'SCRAPE', 'DELETE', 'CANCEL'].map((label, btnIdx) => {
            const idx = totalFields + btnIdx
            const isSelected = metadataSelectedIndex === idx
            return (
              <Button
                key={label}
                variant={isSelected ? "solid" : "soft"}
                color={isSelected ? undefined : "gray"}
                onMouseMove={() => {
                  if (!showInputModal) setMetadataSelectedIndex(idx)
                }}
                onClick={() => {
                  if (btnIdx === 0) handleSaveMetadata()
                  else if (btnIdx === 1) {
                    setScraperStage(1)
                    setScraperDbs({ ScreenScraper: true, ArcadeDB: true, TheGamesDB: true, HfsDB: true, IGDB: true })
                    setScraperDbSelectedIndex(0)
                  } else if (btnIdx === 2) {
                    setDeleteModalSelectedIndex(1)
                    setShowDeleteConfirmModal(true)
                  } else if (btnIdx === 3) {
                    setShowMetadataEditor(false)
                  }
                }}
              >
                {t(label)}
              </Button>
            )
          })}
        </Flex>
      </Flex>
    )
  }


  const isAdvancedMenu = activeMenuStack.some(
    item => item.parentItemId === 'advanced_game_options' || item.title === 'ADVANCED GAME OPTIONS'
  )

  return (
    <>
      <Dialog.Root open={isOpen && scraperStage === 0} onOpenChange={(open) => { if (!open) onClose(); }}>
        <Dialog.Content 
          size={showMetadataEditor ? "4" : "3"}
          className="riescade-menu"
          style={{ maxWidth: showMetadataEditor ? '850px' : '600px' }}
        >
          {showMetadataEditor ? (
            renderMetadataEditor()
          ) : (
            <Flex direction="column" style={{ height: '100%', maxHeight: 'inherit', overflow: 'hidden' }}>
              <Flex className="riescade-menu-header">
                {marqueeUrl && menuTitle !== 'JOGOS EM REDE' && menuTitle !== t('START ONLINE GAME') ? (
                  <Box style={{ height: '90px', maxWidth: '280px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={marqueeUrl} alt="Game Marquee" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                  </Box>
                ) : (
                  <Heading size="4" className="riescade-menu-title">
                    {menuTitle === 'GAME OPTIONS' || menuTitle === 'ADVANCED GAME OPTIONS'
                      ? game.name.toUpperCase()
                      : menuTitle}
                  </Heading>
                )}
                
                <Text size="1" color="gray" mt="1" style={{ letterSpacing: '1px' }}>
                  {menuTitle === 'JOGOS EM REDE' || menuTitle === t('START ONLINE GAME')
                    ? game.name
                    : (system.fullname || system.name).toUpperCase()}
                </Text>

                {currentStackItem?.tabs && currentStackItem.tabs.length > 0 && (
                  <Tabs.Root value={currentStackItem.tabs[currentStackItem.activeTab || 0]} style={{ marginTop: '10px', width: '100%' }}>
                    <Tabs.List style={{ justifyContent: 'center' }}>
                      {currentStackItem.tabs.map((tab, idx) => (
                        <Tabs.Trigger 
                          key={tab} 
                          value={tab}
                          onClick={() => {
                            setActiveMenuStack(prev => {
                              const next = [...prev]
                              next[next.length - 1] = { ...next[next.length - 1], activeTab: idx }
                              return next
                            })
                            const tabItems = currentStackItem.items.filter(item => item.tab === idx)
                            setSelectedIndex(getFirstSelectableIndex(tabItems))
                          }}
                        >
                          {tab}
                        </Tabs.Trigger>
                      ))}
                    </Tabs.List>
                  </Tabs.Root>
                )}
              </Flex>

              <Box className="riescade-menu-content custom-scrollbar">
                {menuItemsNode}
              </Box>

              {bottomButtons.length > 0 && (
                <Flex className="riescade-menu-footer">
                  {bottomButtons.map((btn, btnIdx) => {
                    const isSelected = selectedIndex === currentMenu.length + btnIdx
                    return (
                      <Button
                        key={btn.id}
                        variant={isSelected ? "solid" : "soft"}
                        color={isSelected ? undefined : "gray"}
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
                      </Button>
                    )
                  })}
                </Flex>
              )}
            </Flex>
          )}
        </Dialog.Content>
      </Dialog.Root>

      {renderStageStage1()}
      {renderStageStage2Searching()}
      {renderStageStage2NoMatches()}
      {renderStageStage2Matches()}

      <Dialog.Root open={!!showDeleteConfirmModal} onOpenChange={(open) => { if (!open) setShowDeleteConfirmModal(false); }}>
        <Dialog.Content className='riescade-menu' style={{ maxWidth: '450px', width: '90%' }}>
          <Flex className='riescade-menu-header' direction="column" gap="4">
            <Heading size="3" className='riescade-menu-title'>REMOVER JOGO</Heading>
            <Text size="2" className='center'>
              Você tem certeza que deseja remover o jogo <strong>{game.name.toUpperCase()}</strong>?<br/>
              Apagar os arquivos físicos também?
            </Text>
            <Flex justify="end" gap="3">
              <Button 
                className='riescade-button'
                variant={deleteModalSelectedIndex === 0 ? 'solid' : 'soft'}
                onClick={() => confirmDelete(true)}
              >
                SIM (APAGAR ROM)
              </Button>
              <Button 
                className='riescade-button'
                variant={deleteModalSelectedIndex === 1 ? 'solid' : 'soft'}
                color="gray"
                onClick={() => confirmDelete(false)}
              >
                NÃO (APENAS DA LISTA)
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {isMediaViewerOpen && (
        <GameMediaOverlay
          isOpen={isMediaViewerOpen}
          onClose={() => setIsMediaViewerOpen(false)}
          game={game}
          system={system}
          allSystems={allSystems}
          t={t}
        />
      )}

      {renderInputModal()}

      <VirtualKeyboard
        isOpen={showOSK}
        onClose={() => setShowOSK(false)}
        title={activeInputField === 'scraper_search_query' ? 'BUSCAR JOGOS' : (fields.find(f => f.key === activeInputField)?.label || '')}
        value={inputValue}
        onConfirm={(val) => {
          if (activeInputField === 'scraper_search_query') {
            setScraperQuery(val)
            triggerScraperSearch(val)
          } else if (activeInputField === 'netplay_password') {
            setNetplayPassword(val)
            updateNetplayMenuItemValue('netplay_password', val)
          } else if (activeInputField === 'netplay_spectator_password') {
            setNetplaySpectatorPassword(val)
            updateNetplayMenuItemValue('netplay_spectator_password', val)
          } else {
            const savedVal = activeInputField === 'releasedate' ? parseDateForDb(val) : val
            setDraftMetadata(prev => ({ ...prev, [activeInputField]: savedVal }))
          }
          setShowOSK(false)
        }}
        isPassword={activeInputField === 'netplay_password' || activeInputField === 'netplay_spectator_password'}
      />
    </>
  )
}
