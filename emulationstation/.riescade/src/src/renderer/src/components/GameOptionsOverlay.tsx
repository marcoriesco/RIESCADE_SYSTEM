import React, { useState, useEffect, useCallback } from 'react'
import { Game, System } from '../../../shared/types'

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
  const matchYmd = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T\d+)?$/)
  if (matchYmd) {
    return `${matchYmd[3]}/${matchYmd[2]}/${matchYmd[1]}`
  }
  const matchHyphen = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (matchHyphen) {
    return `${matchHyphen[3]}/${matchHyphen[2]}/${matchHyphen[1]}`
  }
  return clean
}

const parseDateForDb = (dateStr?: string): string => {
  if (!dateStr) return ''
  const clean = dateStr.trim()
  const matchDmy = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (matchDmy) {
    const d = matchDmy[1].padStart(2, '0')
    const m = matchDmy[2].padStart(2, '0')
    const y = matchDmy[3]
    return `${y}${m}${d}T000000`
  }
  const matchYmd = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (matchYmd) {
    const y = matchYmd[1]
    const m = matchYmd[2]
    const d = matchYmd[3]
    return `${y}${m}${d}T000000`
  }
  const matchYear = clean.match(/^(\d{4})$/)
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
}

export const GameOptionsOverlay: React.FC<GameOptionsProps> = ({ 
  isOpen, onClose, game, system, theme, themeData, onUpdate, addNotification, onUpdateGamelists, onLaunch, onOpenSaveStates, isSaveStateManagerOpen
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [draftGame, setDraftGame] = useState<Game>(game)
  const [customCollections, setCustomCollections] = useState<string[]>([])
  const [gameCollections, setGameCollections] = useState<string[]>([])
  const [activeMenuStack, setActiveMenuStack] = useState<{ items: any[]; title: string; tabs?: string[]; activeTab?: number; parentItemId?: string; savedSelectedIndex?: number }[]>([])
  const [settings, setSettings] = useState<Record<string, any>>({})

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
  const [activeInputField, setActiveInputField] = useState<string>('')
  const [inputValue, setInputValue] = useState('')

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

    const currentLang = currentSettings['Language']?.value || 'en_US'
    const isPt = currentLang.startsWith('pt')
    const t = (en: string, pt: string) => isPt ? pt : en

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
    items.push({ id: 'group_games', label: t('GAME', 'JOGO'), type: 'group' })
    items.push({
      id: 'launch_game',
      label: t('LAUNCH', 'JOGAR'),
      type: 'action',
      actionType: 'launch'
    })
    if (isLibretro) {
      items.push({
        id: 'save_states',
        label: t('SAVE STATES', 'ESTADOS DE SALVAMENTO'),
        type: 'action',
        actionType: 'save_states'
      })
    }
    items.push({
      id: 'delete_game',
      label: t('DELETE GAME', 'REMOVER JOGO'),
      type: 'action',
      actionType: 'delete'
    })

    // 2. Group: COLEÇÕES
    items.push({ id: 'group_collections', label: t('COLLECTIONS', 'COLEÇÕES'), type: 'group' })
    items.push({ 
      id: 'favorite', 
      label: currentGame.favorite ? t('REMOVE FROM FAVORITES', 'REMOVER DOS FAVORITOS') : t('ADD TO FAVORITES', 'FAVORITAR JOGO'), 
      type: 'toggle', 
      value: currentGame.favorite 
    })

    // Submenu: ADICIONAR A COLEÇÃO
    const addColSubmenu: any[] = allCols.map(col => ({
      id: `add_col_${col}`,
      label: col.toUpperCase(),
      type: 'action',
      collectionName: col,
      actionType: 'add'
    }))

    items.push({
      id: 'add_to_collection',
      label: t('ADD TO CUSTOM COLLECTION...', 'ADICIONAR A COLEÇÃO'),
      type: 'submenu',
      submenu: addColSubmenu
    })

    // Dynamic "REMOVER DE [COL]" actions for each collection the game is in
    gameCols.forEach(col => {
      items.push({
        id: `remove_col_${col}`,
        label: t(`REMOVE FROM ${col.toUpperCase()}`, `REMOVER DE ${col.toUpperCase()}`),
        type: 'action',
        collectionName: col,
        actionType: 'remove'
      })
    })

    // 3. Group: OPTIONS
    items.push({ id: 'group_options', label: t('OPTIONS', 'OPÇÕES'), type: 'group' })
    items.push({
      id: 'scrape_this_game',
      label: t('SCRAPE', 'PROCURAR POR MÍDIAS DESTE JOGO'),
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
      },
      {
        id: 'game_ratio',
        label: 'GAME ASPECT RATIO',
        type: 'select',
        settingName: 'ratio',
        value: getGameSettingValue('ratio', 'auto'),
        items: [
          { label: 'AUTO', value: 'auto' },
          { label: '4/3', value: '4/3' },
          { label: '16/9', value: '16/9' },
          { label: '16/10', value: '16/10' },
          { label: 'FULL', value: 'full' }
        ]
      },
      {
        id: 'game_shaderset',
        label: 'SHADER SET',
        type: 'select',
        settingName: 'shaderset',
        value: getGameSettingValue('shaderset', 'auto'),
        items: [
          { label: 'AUTO', value: 'auto' },
          { label: 'NONE', value: 'none' },
          { label: 'RIESCADE', value: '[riescade]' },
          { label: 'CRT-NEW-PIXIE', value: 'crt-new-pixie' },
          { label: 'CRT-ROYALE', value: 'crt-royale' },
          { label: 'CURVATURE', value: 'curvature' },
          { label: 'ENHANCED', value: 'enhanced' },
          { label: 'FLATTEN-GLOW', value: 'flatten-glow' },
          { label: 'HANDHELD', value: 'handheld' },
          { label: 'NTSC', value: 'ntsc' },
          { label: 'RETRO', value: 'retro' },
          { label: 'SCALEFX', value: 'scalefx' },
          { label: 'SCANLINES', value: 'scanlines' },
          { label: 'ZFAST', value: 'zfast' }
        ]
      },
      {
        id: 'game_bezel',
        label: 'DECORATIONS',
        type: 'select',
        settingName: 'bezel',
        value: getGameSettingValue('bezel', 'auto'),
        items: [
          { label: 'AUTO', value: 'auto' },
          { label: 'NONE', value: 'none' }
        ]
      },
      {
        id: 'game_smooth',
        label: t('SMOOTH GAMES (BILINEAR FILTERING)', 'JOGOS SUAVES (FILTRO BILINEAR)'),
        type: 'toggle',
        settingName: 'smooth',
        value: getGameSettingValue('smooth', 'auto') === 'true' || getGameSettingValue('smooth', 'auto') === true
      }
    ]

    items.push({
      id: 'advanced_game_options',
      label: t('ADVANCED GAME OPTIONS', 'OPÇÕES AVANÇADAS DO JOGO'),
      type: 'submenu',
      submenu: advancedSubmenu
    })

    // EDIT THIS GAME'S METADATA
    items.push({
      id: 'edit_metadata',
      label: t("EDIT THIS GAME'S METADATA", "EDITAR METADADOS DESTE JOGO"),
      type: 'action',
      actionType: 'edit_metadata'
    })

    return items
  }

  useEffect(() => {
    if (isOpen) {
      setDraftGame(game)
      setDraftMetadata(game)
      setScraperStage(0)
      setShowMetadataEditor(false)
      setMetadataSelectedIndex(0)
      setShowInputModal(false)
      
      window.api.getSettings().then(s => {
        setSettings(s)
        window.api.getCustomCollections().then(customCols => {
          setCustomCollections(customCols)
          window.api.getCollectionsForGame(game.system || system.name, game.path).then(gameCols => {
            setGameCollections(gameCols)
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

  const currentStackItem = activeMenuStack[activeMenuStack.length - 1]
  const currentMenu = currentStackItem ? (currentStackItem.tabs && currentStackItem.activeTab !== undefined ? currentStackItem.items.filter(item => item.tab === currentStackItem.activeTab) : currentStackItem.items) : []
  const menuTitle = currentStackItem?.title || 'GAME OPTIONS'

  const handleToggle = () => {
    const item = currentMenu[selectedIndex]
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
      const currentIdx = item.items.findIndex(i => i.value === item.value)
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

  const getBottomButtons = () => {
    return []
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
    }
  }

  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })

  const triggerScraperSearch = async () => {
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
    setTempMediaUrls({}) // Clear cached temporary media from previous searches

    try {
      const results = await window.api.searchGameMedia(system.name, game.name, selectedDbs, game.path)
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
      const updated = await window.api.downloadGameMedia(system.name, game.path, selectedMatch)
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
      if (e.key === 'ArrowDown') {
        setScraperMatchSelectedIndex(prev => (prev + 1) % scraperMatches.length)
      } else if (e.key === 'ArrowUp') {
        setScraperMatchSelectedIndex(prev => (prev - 1 + scraperMatches.length) % scraperMatches.length)
      } else if (e.key === 'Enter' || e.key === ' ') {
        triggerScraperDownload()
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        setScraperStage(1)
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

      if (showMetadataEditor) {
        if (showInputModal) {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation()
            const savedVal = activeInputField === 'releasedate' ? parseDateForDb(inputValue) : inputValue
            setDraftMetadata(prev => ({ ...prev, [activeInputField]: savedVal }))
            setShowInputModal(false)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            setShowInputModal(false)
          }
          return
        }

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
              setInputValue(field.key === 'releasedate' ? formatDateForDisplay(rawVal) : rawVal)
              setShowInputModal(true)
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
              const filteredItems = item.tabs ? submenuItems.filter(si => si.tab === 0) : submenuItems
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
      } else if (e.key === 'Backspace' || e.key === 'Escape' || e.key === 'Control') {
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
    [isOpen, selectedIndex, currentMenu, activeMenuStack, draftGame, gameCollections, customCollections, system, scraperStage, scraperDbSelectedIndex, scraperDbs, scraperMatches, scraperMatchSelectedIndex, settings, showDeleteConfirmModal, deleteModalSelectedIndex, confirmDelete, showMetadataEditor, showInputModal, metadataSelectedIndex, activeInputField, inputValue, draftMetadata]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const bottomButtons = getBottomButtons()

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
        return (
          <div
            key={item.id}
            className={`riescade-menu-item ${index === selectedIndex ? 'selected' : ''}`}
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
                const filteredItems = item.tabs ? submenuItems.filter(si => si.tab === 0) : submenuItems
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
              } else if (item.type === 'action') {
                handleAction(item)
              }
            }}
          >
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
            <div className="riescade-menu-value">
              {item.type === 'toggle' ? (
                <div className={`riescade-switch ${item.value ? 'on' : ''}`}>
                  <div className="thumb toggle-thumb" />
                </div>
              ) : item.type === 'submenu' ? (
                <span className="menu-submenu-arrow">›</span>
              ) : item.type === 'select' ? (
                <div className="menu-select">
                  <span className="arrow">◁</span>
                  <span className="value">{item.items?.find(i => i.value === item.value)?.label || item.value}</span>
                  <span className="arrow">▷</span>
                </div>
              ) : item.type === 'info' ? (
                <div className="menu-info" style={{ fontSize: '0.85rem', fontWeight: 600, color: index === selectedIndex ? '#fff' : '#888' }}>
                  {item.value}
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )

  if (!isOpen) return null

  const marqueeUrl = getMarqueeUrl()

  const renderStageStage1 = () => {
    const dbKeys = ['ScreenScraper', 'ArcadeDB', 'TheGamesDB', 'HfsDB', 'IGDB']
    return (
      <div className="riescade-overlay scraper-modal-overlay game-options-scraper visible">
        <div className="scraper-modal-container db-select-modal">
          <h3 className="scraper-modal-title">BUSCAR MÍDIAS</h3>
          <div className="scraper-db-list">
            {dbKeys.map((db, idx) => {
              const isSelected = scraperDbSelectedIndex === idx
              const isChecked = scraperDbs[db]
              return (
                <div 
                  key={db}
                  className={`scraper-db-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setScraperDbSelectedIndex(idx)
                    setScraperDbs(prev => ({ ...prev, [db]: !prev[db] }))
                  }}
                >
                  <div className={`riescade-checkbox ${isChecked ? 'checked' : ''}`}>
                    {isChecked && <span className="checkmark">✔</span>}
                  </div>
                  <span className="scraper-db-name">{db.toUpperCase()}</span>
                </div>
              )
            })}
          </div>
          <div className="scraper-modal-buttons">
            <button 
              className={`riescade-button ${scraperDbSelectedIndex === dbKeys.length ? 'selected' : ''}`}
              onClick={triggerScraperSearch}
            >
              BUSCAR
            </button>
            <button 
              className={`riescade-button secondary ${scraperDbSelectedIndex === dbKeys.length + 1 ? 'selected' : ''}`}
              onClick={() => setScraperStage(0)}
            >
              CANCELAR
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderStageStage2 = () => {
    if (scraperIsSearching) {
      return (
        <div className="riescade-overlay scraper-modal-overlay game-options-scraper visible">
          <div className="scraper-modal-container searching-modal">
            <div className="scraper-spinner"></div>
            <p className="searching-text">BUSCANDO MÍDIAS NAS BASES DE DADOS...</p>
          </div>
        </div>
      )
    }

    if (scraperMatches.length === 0) {
      return (
        <div className="riescade-overlay scraper-modal-overlay game-options-scraper visible">
          <div className="scraper-modal-container no-results-modal">
            <h3 className="scraper-modal-title">RESULTADOS</h3>
            <p className="no-results-text">NENHUMA MÍDIA ENCONTRADA PARA ESTE JOGO.</p>
            <div className="scraper-modal-buttons" style={{ justifyContent: 'center' }}>
              <button className="riescade-button selected" onClick={() => setScraperStage(1)}>
                VOLTAR
              </button>
            </div>
          </div>
        </div>
      )
    }

    const selectedMatch = scraperMatches[scraperMatchSelectedIndex]
    // Priority: BOX/thumbnail → IMAGE → LOGO/marquee → VIDEO
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

    // Image takes priority over video in preview display
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

    // Group matches by database source
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
          <span 
            key={i} 
            style={{ 
              color: i < filledCount ? '#fff' : '#444', 
              fontSize: '1.1rem',
              marginRight: '2px'
            }}
          >
            ★
          </span>
        )
      }
      return stars
    }

    return (
      <div className="riescade-overlay scraper-modal-overlay stage2-overlay game-options-scraper visible">
        <div className="scraper-header">
          <div className="rom-filename">{getRomFileName(game.path).toUpperCase()}</div>
          <div className="system-fullname">{(system.fullname || system.name).toUpperCase()}</div>
        </div>

        <div className="scraper-stage2-main-content">
          {/* Left Column: Matches List grouped by DB */}
          <div className="scraper-matches-section">
            {Object.entries(matchesByDb).map(([dbName, items]) => (
              <div key={dbName} className="scraper-db-group">
                <div className="scraper-db-group-title">{dbName.toUpperCase()}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {items.map(({ match, globalIndex }) => {
                    const isSelected = scraperMatchSelectedIndex === globalIndex
                    const hasBox = !!(match.media?.thumbnail || match.thumbnail)
                    const hasImage = !!(match.media?.image || match.image)
                    const hasLogo = !!(match.media?.marquee)
                    const hasVid = !!(match.video || match.media?.video)
                    const hasTxt = !!(match.desc || match.synopsis)

                    return (
                      <div
                        key={globalIndex}
                        className={`scraper-match-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => setScraperMatchSelectedIndex(globalIndex)}
                      >
                        <span className="match-name">{match.name || 'Sem nome'}</span>
                        <div className="match-icons">
                          {hasBox && (
                            <span className="icon-badge img" title="Box / Cover">
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H6V4h12v16zM9 13.5h6v1H9z"/>
                              </svg>
                            </span>
                          )}
                          {hasImage && (
                            <span className="icon-badge img" title="Imagem">
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-1.96-2.36L6.5 17h11l-3.54-4.71z"/>
                              </svg>
                            </span>
                          )}
                          {hasLogo && (
                            <span className="icon-badge img" title="Logo">
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z"/>
                              </svg>
                            </span>
                          )}
                          {hasVid && (
                            <span className="icon-badge vid" title="Vídeo">
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                              </svg>
                            </span>
                          )}
                          {hasTxt && (
                            <span className="icon-badge txt" title="Texto">
                              TXT
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Media Preview & Metadata Grid */}
          <div className="scraper-details-section">
            <div className="scraper-details-top">
              {/* Media Preview Box */}
              <div className="scraper-details-image-container" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '250px' }}>
                {isLoadingMedia && (
                  <div className="scraper-spinner" style={{ position: 'absolute', zIndex: 2 }}></div>
                )}
                {showImage ? (
                  <img
                    key={previewImage}
                    src={previewImage}
                    alt="Preview"
                    style={{ maxWidth: '100%', maxHeight: '250px', objectFit: 'contain', opacity: isLoadingMedia ? 0.3 : 1 }}
                  />
                ) : showVideo ? (
                  <video
                    key={previewVideo}
                    src={previewVideo}
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ maxWidth: '100%', maxHeight: '250px', objectFit: 'contain', opacity: isLoadingMedia ? 0.3 : 1 }}
                  />
                ) : isLoadingMedia ? null : (
                  <div style={{ color: '#555', fontWeight: 'bold', fontSize: '0.9rem' }}>SEM PRÉVIA DISPONÍVEL</div>
                )}
              </div>

              {/* Metadata Attributes */}
              <div className="scraper-details-metadata">
                <div className="metadata-grid-row">
                  <span className="metadata-grid-label">PUBLICADORA:</span>
                  <span className="metadata-grid-value">{selectedMatch?.publisher || 'N/A'}</span>
                </div>
                <div className="metadata-grid-row">
                  <span className="metadata-grid-label">DESENVOLVEDORA:</span>
                  <span className="metadata-grid-value">{selectedMatch?.developer || 'N/A'}</span>
                </div>
                <div className="metadata-grid-row">
                  <span className="metadata-grid-label">GÊNERO:</span>
                  <span className="metadata-grid-value">{selectedMatch?.genre || 'N/A'}</span>
                </div>
                <div className="metadata-grid-row">
                  <span className="metadata-grid-label">JOGADORES:</span>
                  <span className="metadata-grid-value">{selectedMatch?.players || 'N/A'}</span>
                </div>
                <div className="metadata-grid-row">
                  <span className="metadata-grid-label">LANÇAMENTO:</span>
                  <span className="metadata-grid-value">{formatReleaseDate(selectedMatch?.releasedate)}</span>
                </div>
                <div className="metadata-grid-row" style={{ alignItems: 'center' }}>
                  <span className="metadata-grid-label">CLASSIFICAÇÃO:</span>
                  <span className="metadata-grid-value" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {renderStars(selectedMatch?.rating)}
                  </span>
                </div>
              </div>
            </div>

            {/* Synopsis Description Text */}
            <div className="scraper-details-description custom-scrollbar">
              {selectedMatch?.desc || selectedMatch?.synopsis || 'Nenhuma descrição disponível para este jogo.'}
            </div>
          </div>
        </div>

        {/* Footer actions center bottom */}
        <div className="scraper-footer-buttons">
          <button className="riescade-button" onClick={triggerScraperDownload}>ENTRADA</button>
          <button className="riescade-button" onClick={() => setScraperStage(0)}>CANCELAR</button>
        </div>
      </div>
    )
  }

  const renderInputModal = () => {
    if (!showInputModal) return null
    const field = fields.find(f => f.key === activeInputField)
    const label = field ? field.label : ''
    const isMultiline = activeInputField === 'desc'
    const isRating = activeInputField === 'rating'

    return (
      <div className="riescade-metadata-input-overlay" onClick={() => setShowInputModal(false)}>
        <div className="riescade-metadata-input-container" onClick={e => e.stopPropagation()}>
          <div className="riescade-metadata-input-title">
            {label}
          </div>
          
          {isRating ? (
            <div className="riescade-metadata-input-rating-container">
              <div className="riescade-metadata-input-stars">
                {getStarsString(inputValue)}
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={typeof inputValue === 'number' ? inputValue : parseFloat(inputValue || '0')}
                onChange={e => setInputValue(parseFloat(e.target.value) as any)}
                className="riescade-metadata-input-range"
              />
              <div className="riescade-metadata-input-percent">
                {Math.round((typeof inputValue === 'number' ? inputValue : parseFloat(inputValue || '0')) * 100)}%
              </div>
            </div>
          ) : isMultiline ? (
            <textarea
              autoFocus
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="riescade-metadata-input"
            />
          ) : (
            <input
              type="text"
              autoFocus
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="riescade-metadata-input"
            />
          )}

          <div className="riescade-metadata-modal-buttons">
            <button
              onClick={() => {
                const savedVal = activeInputField === 'releasedate' ? parseDateForDb(inputValue) : inputValue
                setDraftMetadata(prev => ({ ...prev, [activeInputField]: savedVal }))
                setShowInputModal(false)
              }}
              className="riescade-button"
            >
              SAVE
            </button>
            <button
              onClick={() => setShowInputModal(false)}
              className="riescade-button"
            >
              CANCEL
            </button>
          </div>
        </div>
      </div>
    )
  }


  const renderMetadataEditor = () => {
    const totalFields = fields.length
    const romDisplayPath = getRomDisplayPath(game.path)

    return (
      <div className="riescade-metadata-editor-overlay">
        <div className="riescade-metadata-editor-container riescade-menu-container">
          {/* Header */}
          <div className="riescade-metadata-editor-header">
            <h2 className="riescade-metadata-editor-title">EDIT METADATA</h2>
            <div className="riescade-metadata-editor-path">{romDisplayPath}</div>
          </div>

          {/* Scrollable Fields List */}
          <div className="riescade-metadata-fields-list custom-scrollbar">
            {fields.map((field, idx) => {
              const isSelected = metadataSelectedIndex === idx
              const val = (draftMetadata[field.key as keyof Game] as string) || ''
              const isBool = field.type === 'bool'
              const boolVal = !!draftMetadata[field.key as keyof Game]

              return (
                <div
                  key={field.key}
                  className={`riescade-metadata-row ${isSelected ? 'selected' : ''}`}
                  onMouseEnter={() => {
                    if (!showInputModal) setMetadataSelectedIndex(idx)
                  }}
                  onClick={() => {
                    if (showInputModal) return
                    if (isBool) {
                      setDraftMetadata(prev => ({ ...prev, [field.key]: !prev[field.key as keyof Game] }))
                    } else {
                      setActiveInputField(field.key)
                      const rawVal = (draftMetadata[field.key as keyof Game] as string) || ''
                      setInputValue(field.key === 'releasedate' ? formatDateForDisplay(rawVal) : rawVal)
                      setShowInputModal(true)
                    }
                  }}
                >
                  <span className="riescade-metadata-field-label">{field.label}</span>
                  
                  <div className="riescade-metadata-value-wrapper">
                    {isBool ? (
                      <div className={`riescade-switch ${boolVal ? 'on' : ''} ${isSelected ? 'selected-row' : ''}`}>
                        <div className={`thumb ${boolVal ? 'on' : ''} ${isSelected ? 'selected-row' : ''}`} />
                      </div>
                    ) : (
                      <>
                        <span className="riescade-metadata-value-text">
                          {field.key === 'releasedate' ? formatDateForDisplay(val) : (field.type === 'rating' ? getStarsString(val) : val)}
                        </span>
                        <span className="riescade-metadata-arrow">›</span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bottom Buttons */}
          <div className="riescade-metadata-actions">
            {['SAVE', 'SCRAPE', 'DELETE', 'CANCEL'].map((label, btnIdx) => {
              const idx = totalFields + btnIdx
              const isSelected = metadataSelectedIndex === idx
              return (
                <button
                  key={label}
                  className={`riescade-button ${isSelected ? 'selected' : ''}`}
                  onMouseEnter={() => {
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
                  {label}
                </button>
              )
            })}
          </div>

          {showInputModal && renderInputModal()}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={`riescade-overlay riescade-menu-overlay ${showMetadataEditor ? 'game-options-metatada game-options-metadata' : 'game-options-root'} ${visible && scraperStage === 0 ? 'visible' : ''}`}>
        {!showMetadataEditor && scraperStage === 0 && (
          <div className="riescade-menu-container">
            <div className="riescade-menu-header">
              {marqueeUrl ? (
                <div className="riescade-menu-marquee-container">
                  <img src={marqueeUrl} alt="Game Marquee" className="riescade-menu-marquee" />
                </div>
              ) : (
                <>
                  <h2 className="riescade-menu-title">{menuTitle}</h2>
                  <div className="riescade-menu-subtitle">{game.name}</div>
                </>
              )}
              {marqueeUrl && menuTitle !== 'GAME OPTIONS' && (
                <h2 className="riescade-menu-title" style={{ marginTop: '10px' }}>{menuTitle}</h2>
              )}

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
                        const tabItems = currentStackItem.items.filter(item => item.tab === idx)
                        setSelectedIndex(getFirstSelectableIndex(tabItems))
                      }}
                    >
                      {tab}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="riescade-menu-list-container">{menuItemsNode}</div>
            
            {bottomButtons.length > 0 && (
              <div className="riescade-menu-bottom-bar">
                {bottomButtons.map((btn, btnIdx) => {
                  const isSelected = selectedIndex === currentMenu.length + btnIdx
                  return (
                    <button
                      key={btn.id}
                      className={`riescade-button ${isSelected ? 'selected' : ''}`}
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

            <div className="riescade-menu-footer">
              {bottomButtons.length === 0 && (
                <div className="riescade-menu-footer-actions">
                  <div className="riescade-menu-footer-action">
                    <span className="riescade-menu-footer-button">B</span>
                    <span className="riescade-menu-footer-text">BACK</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {showMetadataEditor && scraperStage === 0 && renderMetadataEditor()}
      </div>

      {scraperStage === 1 && renderStageStage1()}
      {scraperStage === 2 && renderStageStage2()}
      {showDeleteConfirmModal && (
        <div className="riescade-overlay scraper-completion-overlay visible" onClick={() => setShowDeleteConfirmModal(false)}>
          <div className="scraper-completion-modal" onClick={e => e.stopPropagation()}>
            <h3 className="scraper-completion-title">REMOVER JOGO</h3>
            <p className="scraper-completion-text">
              Você tem certeza que deseja remover o jogo <strong>{game.name.toUpperCase()}</strong>?<br/>
              Apagar os arquivos físicos também?
            </p>
            <div className="scraper-completion-buttons">
              <button 
                className={`riescade-button primary ${deleteModalSelectedIndex === 0 ? 'selected' : ''}`}
                onClick={() => confirmDelete(true)}
              >
                SIM (APAGAR ROM)
              </button>
              <button 
                className={`riescade-button secondary ${deleteModalSelectedIndex === 1 ? 'selected' : ''}`}
                onClick={() => confirmDelete(false)}
              >
                NÃO (APENAS DA LISTA)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
