import React, { useState, useEffect, useCallback } from 'react'
import { Game, System } from '../../../shared/types'

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
}

export const GameOptionsOverlay: React.FC<GameOptionsProps> = ({ 
  isOpen, onClose, game, system, theme, themeData, onUpdate, addNotification, onUpdateGamelists, onLaunch, onOpenSaveStates
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [draftGame, setDraftGame] = useState<Game>(game)
  const [customCollections, setCustomCollections] = useState<string[]>([])
  const [gameCollections, setGameCollections] = useState<string[]>([])
  const [activeMenuStack, setActiveMenuStack] = useState<{ items: any[]; title: string; tabs?: string[]; activeTab?: number; parentItemId?: string }[]>([])
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
            updates.image = `file:///${localPath.replace(/\\/g, '/')}`
          }
        } else if (videoUrl && videoUrl.startsWith('http')) {
          // Only download video if no image-type source is available
          const localPath = await window.api.downloadTempMedia(videoUrl)
          if (localPath) {
            updates.video = `file:///${localPath.replace(/\\/g, '/')}`
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
    if (game.marquee.startsWith('http') || game.marquee.startsWith('file://') || game.marquee.startsWith('data:')) {
      return game.marquee
    }
    const normalized = game.marquee.replace(/\\/g, '/')
    if (normalized.match(/^[a-zA-Z]:/) || normalized.startsWith('/')) {
      return `file:///${normalized.replace(/^\/+/, '')}`
    }
    const systemPath = (system.path || '').replace(/\\/g, '/')
    return `file:///${systemPath}/${normalized.replace(/^\.\//, '')}`
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
        value: currentGame.emulator || 'auto',
        items: [
          { label: 'AUTO', value: 'auto' },
          ...(sys.emulators?.map(e => ({ label: e.name.toUpperCase(), value: e.name })) || [])
        ]
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

      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [isOpen, game])

  const currentStackItem = activeMenuStack[activeMenuStack.length - 1]
  const currentMenu = currentStackItem ? (currentStackItem.tabs && currentStackItem.activeTab !== undefined ? currentStackItem.items.filter(item => item.tab === currentStackItem.activeTab) : currentStackItem.items) : []
  const menuTitle = currentStackItem?.title || 'GAME OPTIONS'

  const handleToggle = () => {
    const item = currentMenu[selectedIndex]
    if (item.id === 'favorite') {
      const updated = { ...draftGame, favorite: !draftGame.favorite }
      setDraftGame(updated)
      onUpdate(updated)
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
        const updated = { ...draftGame, emulator: nextVal, core: undefined }
        setDraftGame(updated)
        onUpdate(updated)
      } else if (item.settingName) {
        const key = getGameSettingKey(item.settingName)
        window.api.saveSetting(key, nextVal, 'string')
        setSettings(prev => ({
          ...prev,
          [key]: { value: nextVal, type: 'string' }
        }))
      }

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
            setDraftMetadata(prev => ({ ...prev, [activeInputField]: inputValue }))
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
              setInputValue((draftMetadata[field.key as keyof Game] as string) || '')
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
              setActiveMenuStack(prev => [...prev, { 
                items: submenuItems, 
                title: item.label, 
                tabs: item.tabs, 
                activeTab: item.tabs ? 0 : undefined,
                parentItemId: item.id
              }])
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
          setSelectedIndex(0)
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
                setActiveMenuStack(prev => [...prev, { 
                  items: submenuItems, 
                  title: item.label, 
                  tabs: item.tabs, 
                  activeTab: item.tabs ? 0 : undefined,
                  parentItemId: item.id
                }])
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
                <div className={`menu-toggle ${item.value ? 'on' : 'off'}`}>
                  <div className="toggle-thumb" />
                </div>
              ) : item.type === 'submenu' ? (
                <span className="menu-submenu-arrow">▶</span>
              ) : item.type === 'select' ? (
                <div className="menu-select">
                  <span className="arrow">«</span>
                  <span className="value">{item.items?.find(i => i.value === item.value)?.label || item.value}</span>
                  <span className="arrow">»</span>
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
      <div className="scraper-modal-overlay">
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
                  <div className={`scraper-checkbox ${isChecked ? 'checked' : ''}`}>
                    {isChecked && <span className="checkmark">✔</span>}
                  </div>
                  <span className="scraper-db-name">{db.toUpperCase()}</span>
                </div>
              )
            })}
          </div>
          <div className="scraper-modal-buttons">
            <button 
              className={`scraper-modal-btn ${scraperDbSelectedIndex === dbKeys.length ? 'selected' : ''}`}
              onClick={triggerScraperSearch}
            >
              BUSCAR
            </button>
            <button 
              className={`scraper-modal-btn secondary ${scraperDbSelectedIndex === dbKeys.length + 1 ? 'selected' : ''}`}
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
        <div className="scraper-modal-overlay">
          <div className="scraper-modal-container searching-modal">
            <div className="scraper-spinner"></div>
            <p className="searching-text">BUSCANDO MÍDIAS NAS BASES DE DADOS...</p>
          </div>
        </div>
      )
    }

    if (scraperMatches.length === 0) {
      return (
        <div className="scraper-modal-overlay">
          <div className="scraper-modal-container no-results-modal">
            <h3 className="scraper-modal-title">RESULTADOS</h3>
            <p className="no-results-text">NENHUMA MÍDIA ENCONTRADA PARA ESTE JOGO.</p>
            <div className="scraper-modal-buttons" style={{ justifyContent: 'center' }}>
              <button className="scraper-modal-btn selected" onClick={() => setScraperStage(1)}>
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
      if (!dateStr) return 'N/A'
      try {
        if (dateStr.length >= 8 && !dateStr.includes('-')) {
          const y = dateStr.substring(0, 4)
          const m = dateStr.substring(4, 6)
          const d = dateStr.substring(6, 8)
          return `${d}/${m}/${y}`
        }
        const date = new Date(dateStr)
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('pt-BR')
        }
      } catch (e) {}
      return dateStr
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
      <div className="scraper-modal-overlay stage2-overlay">
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
            <div className="scraper-details-description">
              {selectedMatch?.desc || selectedMatch?.synopsis || 'Nenhuma descrição disponível para este jogo.'}
            </div>
          </div>
        </div>

        {/* Footer actions center bottom */}
        <div className="scraper-footer-buttons">
          <button className="scraper-footer-btn" onClick={triggerScraperDownload}>ENTRADA</button>
          <button className="scraper-footer-btn" onClick={() => setScraperStage(0)}>CANCELAR</button>
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
      <div className="riescade-metadata-input-overlay" style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.8)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={() => setShowInputModal(false)}
      >
        <div className="riescade-metadata-input-container" style={{
          background: '#141414',
          border: '2px solid var(--theme-color, #ff007f)',
          borderRadius: '10px',
          width: '500px',
          padding: '25px',
          boxSizing: 'border-box',
          boxShadow: '0 15px 40px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          gap: '15px'
        }}
        onClick={e => e.stopPropagation()}
        >
          <div style={{
            fontSize: '1.2rem',
            fontWeight: 'bold',
            color: 'var(--theme-color, #ff007f)',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            {label}
          </div>
          
          {isRating ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
              <div style={{ fontSize: '1.8rem', letterSpacing: '2px', color: '#fff' }}>
                {getStarsString(inputValue)}
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={typeof inputValue === 'number' ? inputValue : parseFloat(inputValue || '0')}
                onChange={e => setInputValue(parseFloat(e.target.value) as any)}
                style={{
                  width: '100%',
                  accentColor: 'var(--theme-color, #ff007f)',
                  cursor: 'pointer'
                }}
              />
              <div style={{ color: '#888', fontSize: '0.9rem' }}>
                {Math.round((typeof inputValue === 'number' ? inputValue : parseFloat(inputValue || '0')) * 100)}%
              </div>
            </div>
          ) : isMultiline ? (
            <textarea
              autoFocus
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              style={{
                background: '#222',
                border: '1px solid #444',
                borderRadius: '5px',
                color: '#fff',
                padding: '10px',
                fontSize: '1rem',
                minHeight: '120px',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none'
              }}
            />
          ) : (
            <input
              type="text"
              autoFocus
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              style={{
                background: '#222',
                border: '1px solid #444',
                borderRadius: '5px',
                color: '#fff',
                padding: '10px',
                fontSize: '1rem',
                width: '100%',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '10px'
          }}>
            <button
              onClick={() => {
                setDraftMetadata(prev => ({ ...prev, [activeInputField]: inputValue }))
                setShowInputModal(false)
              }}
              style={{
                background: 'var(--theme-color, #ff007f)',
                color: '#fff',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              SAVE
            </button>
            <button
              onClick={() => setShowInputModal(false)}
              style={{
                background: '#333',
                color: '#ccc',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
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
      <div className="riescade-metadata-editor-overlay" style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(15px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box'
      }}>
        <div className="riescade-metadata-editor-container" style={{
          width: '700px',
          height: '85vh',
          background: 'rgba(12, 12, 12, 0.95)',
          border: '1.5px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '"Roboto Condensed", "Inter", sans-serif',
          padding: '25px 35px',
          boxSizing: 'border-box',
          color: '#fff',
          position: 'relative'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '20px', flexShrink: 0 }}>
            <h2 style={{
              margin: 0,
              color: 'var(--theme-color, #ff007f)',
              fontSize: '1.8rem',
              fontWeight: 800,
              letterSpacing: '1.5px',
              textTransform: 'uppercase'
            }}>EDIT METADATA</h2>
            <div style={{
              color: 'var(--theme-color, #ff007f)',
              fontSize: '0.9rem',
              marginTop: '5px',
              fontWeight: 'bold',
              opacity: 0.85
            }}>{romDisplayPath}</div>
          </div>

          {/* Scrollable Fields List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            marginBottom: '20px',
            paddingRight: '5px'
          }}>
            {fields.map((field, idx) => {
              const isSelected = metadataSelectedIndex === idx
              const val = (draftMetadata[field.key as keyof Game] as string) || ''
              const isBool = field.type === 'bool'
              const boolVal = !!draftMetadata[field.key as keyof Game]

              return (
                <div
                  key={field.key}
                  className={`riescade-metadata-row ${isSelected ? 'selected' : ''}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 15px',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--theme-color, #ff007f)' : 'transparent',
                    color: isSelected ? '#fff' : '#b0b0b0',
                    transition: 'background 0.1s ease',
                    minHeight: '40px',
                    boxSizing: 'border-box'
                  }}
                  onMouseEnter={() => {
                    if (!showInputModal) setMetadataSelectedIndex(idx)
                  }}
                  onClick={() => {
                    if (showInputModal) return
                    if (isBool) {
                      setDraftMetadata(prev => ({ ...prev, [field.key]: !prev[field.key as keyof Game] }))
                    } else {
                      setActiveInputField(field.key)
                      setInputValue((draftMetadata[field.key as keyof Game] as string) || '')
                      setShowInputModal(true)
                    }
                  }}
                >
                  <span style={{
                    fontWeight: 'bold',
                    fontSize: '1.05rem',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    color: isSelected ? '#fff' : '#e0e0e0'
                  }}>{field.label}</span>
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    maxWidth: '65%'
                  }}>
                    {isBool ? (
                      <div style={{
                        width: '40px',
                        height: '22px',
                        background: boolVal ? (isSelected ? '#fff' : 'var(--theme-color, #ff007f)') : '#333',
                        border: isSelected ? '1.5px solid #fff' : '1.5px solid #555',
                        borderRadius: '11px',
                        position: 'relative',
                        transition: 'background 0.2s ease',
                        cursor: 'pointer'
                      }}>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          background: isSelected ? 'var(--theme-color, #ff007f)' : '#fff',
                          borderRadius: '50%',
                          position: 'absolute',
                          top: '1.5px',
                          left: boolVal ? '20px' : '2px',
                          transition: 'left 0.2s ease'
                        }} />
                      </div>
                    ) : (
                      <>
                        <span style={{
                          fontSize: '1rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: isSelected ? '#fff' : '#888',
                          textAlign: 'right'
                        }}>
                          {field.type === 'rating' ? getStarsString(val) : val}
                        </span>
                        <span style={{
                          fontSize: '1.1rem',
                          color: isSelected ? '#fff' : '#666',
                          marginLeft: '5px'
                        }}>&gt;</span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bottom Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '15px',
            padding: '10px 0',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            flexShrink: 0
          }}>
            {['SAVE', 'SCRAPE', 'DELETE', 'CANCEL'].map((label, btnIdx) => {
              const idx = totalFields + btnIdx
              const isSelected = metadataSelectedIndex === idx
              return (
                <button
                  key={label}
                  className={`riescade-metadata-btn ${isSelected ? 'selected' : ''}`}
                  style={{
                    background: isSelected ? 'var(--theme-color, #ff007f)' : 'transparent',
                    color: isSelected ? '#fff' : '#ccc',
                    border: isSelected ? '1px solid var(--theme-color, #ff007f)' : '1px solid rgba(255, 255, 255, 0.3)',
                    padding: '8px 25px',
                    fontSize: '0.95rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textTransform: 'uppercase',
                    outline: 'none',
                    minWidth: '100px'
                  }}
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
      <div className={`riescade-menu-overlay game-options ${visible ? 'visible' : ''}`}>
        {!showMetadataEditor && (
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
                      className={`riescade-menu-bottom-button ${isSelected ? 'selected' : ''}`}
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
        {showMetadataEditor && renderMetadataEditor()}
      </div>

      {scraperStage === 1 && renderStageStage1()}
      {scraperStage === 2 && renderStageStage2()}
      {showDeleteConfirmModal && (
        <div className="scraper-completion-overlay" onClick={() => setShowDeleteConfirmModal(false)}>
          <div className="scraper-completion-modal" onClick={e => e.stopPropagation()}>
            <h3 className="scraper-completion-title">REMOVER JOGO</h3>
            <p className="scraper-completion-text">
              Você tem certeza que deseja remover o jogo <strong>{game.name.toUpperCase()}</strong>?<br/>
              Apagar os arquivos físicos também?
            </p>
            <div className="scraper-completion-buttons">
              <button 
                className={`scraper-completion-btn primary ${deleteModalSelectedIndex === 0 ? 'selected' : ''}`}
                onClick={() => confirmDelete(true)}
              >
                SIM (APAGAR ROM)
              </button>
              <button 
                className={`scraper-completion-btn secondary ${deleteModalSelectedIndex === 1 ? 'selected' : ''}`}
                onClick={() => confirmDelete(false)}
              >
                NÃO (APENAS DA LISTA)
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .scraper-completion-overlay {
          z-index: 10000000 !important;
        }
        .riescade-menu-overlay.game-options { 
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
        .riescade-menu-overlay.game-options.visible { 
          opacity: 1; 
          pointer-events: auto; 
        }
        .riescade-menu-overlay.game-options .riescade-menu-container { 
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
        .riescade-menu-overlay.game-options.visible .riescade-menu-container { 
          transform: translateX(0); 
        }
        .riescade-menu-overlay.game-options .riescade-menu-header { 
          background: #eee; 
          padding: 15px 25px; 
          text-align: center; 
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid rgba(0,0,0,0.1);
        }
        .riescade-menu-overlay.game-options .riescade-menu-title { 
          margin: 0; 
          color: var(--theme-color, #3b82f6); 
          font-size: 1.2rem; 
          font-weight: 900; 
          letter-spacing: 3px; 
          text-transform: uppercase; 
        }
        .riescade-menu-overlay.game-options .riescade-menu-subtitle { 
          font-size: 0.8rem; 
          color: #ffffff; 
          margin-top: 5px; 
          text-transform: uppercase;
          font-weight: 700;
        }
        .riescade-menu-overlay.game-options .riescade-menu-marquee-container {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 10px;
          width: 100%;
        }
        .riescade-menu-overlay.game-options .riescade-menu-marquee {
          max-width: 90%;
          max-height: 80px;
          object-fit: contain;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.15));
        }
        .riescade-menu-overlay.game-options .riescade-menu-list-container { 
          background: #fff; 
          flex: 1;
          overflow-x: hidden;
          overflow-y: auto;
          max-height: 100% !important;
        }
        .riescade-menu-overlay.game-options .riescade-menu-item { 
          padding: 12px 30px; 
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
          border-bottom: 1px solid rgba(0,0,0,0.1); 
          transition: background 0.15s ease, color 0.15s ease; 
          color: #444; 
          cursor: pointer;
        }
        .riescade-menu-overlay.game-options .riescade-menu-item.selected { 
          background: var(--theme-color, #3b82f6); 
          color: #fff; 
        }
        .riescade-menu-overlay.game-options .riescade-menu-label { 
          font-weight: 500; 
          font-size: 0.95rem; 
          text-transform: uppercase; 
        }
        .riescade-menu-overlay.game-options .riescade-menu-item.selected .riescade-menu-label { 
          font-weight: 800; 
        }
        .riescade-menu-overlay.game-options .riescade-menu-group { 
          padding: 20px 30px 10px; 
          color: #888; 
          font-size: 0.8rem; 
          font-weight: 800; 
          letter-spacing: 2px; 
          text-transform: uppercase; 
          border-bottom: 1px solid rgba(0,0,0,0.05); 
        }
        .riescade-menu-overlay.game-options .riescade-menu-value {
          display: flex;
          align-items: center;
        }
        .riescade-menu-overlay.game-options .menu-toggle { 
          width: 40px; 
          height: 20px; 
          background: #ccc; 
          border-radius: 10px; 
          position: relative; 
          transition: background 0.15s ease; 
        }
        .riescade-menu-overlay.game-options .menu-toggle.on { 
          background: #4ade80; 
        }
        .riescade-menu-overlay.game-options .menu-toggle.on .toggle-thumb { 
          transform: translateX(20px); 
        }
        .riescade-menu-overlay.game-options .toggle-thumb { 
          width: 16px; 
          height: 16px; 
          background: #fff; 
          border-radius: 50%; 
          position: absolute; 
          top: 2px; 
          left: 2px; 
          transition: transform 0.15s ease; 
        }
        .riescade-menu-overlay.game-options .menu-select { 
          display: flex; 
          align-items: center; 
          gap: 10px; 
          font-weight: 800; 
          font-size: 0.9rem; 
        }
        .riescade-menu-overlay.game-options .menu-select .arrow { 
          opacity: 0.3; 
        }
        .riescade-menu-overlay.game-options .riescade-menu-item.selected .menu-select .arrow { 
          opacity: 1; 
        }
        .riescade-menu-overlay.game-options .menu-submenu-arrow { 
          opacity: 0.5; 
          font-size: 0.95rem; 
        }
        .riescade-menu-overlay.game-options .riescade-menu-item.selected .menu-submenu-arrow { 
          opacity: 1; 
        }
        .riescade-menu-overlay.game-options .riescade-menu-footer { 
          background: #ddd; 
          padding: 10px 25px; 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
        }
        .riescade-menu-overlay.game-options .riescade-menu-footer-actions { 
          display: flex; 
          gap: 30px; 
          font-size: 0.8rem; 
          color: #444; 
          font-weight: 700; 
        }
        .riescade-menu-overlay.game-options .riescade-menu-footer-action { 
          display: flex; 
          align-items: center; 
          gap: 8px; 
        }
        .riescade-menu-overlay.game-options .riescade-menu-footer-button { 
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
        .riescade-menu-overlay.game-options .riescade-menu-footer-text {
          text-transform: uppercase;
        }

        /* Single Scraper Modal Styles */
        .scraper-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(15px);
          z-index: 10000000 !important;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', sans-serif;
          color: #fff;
        }
        .scraper-modal-container {
          background: rgba(20, 20, 20, 0.85);
          backdrop-filter: blur(10px);
          border: 2px solid rgba(240, 66, 176, 0.2);
          border-radius: 16px;
          padding: 35px;
          width: 450px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          align-items: stretch;
          animation: scraper-fade-in 0.25s ease-out;
        }
        @keyframes scraper-fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .scraper-modal-title {
          margin: 0 0 25px 0;
          font-size: 1.4rem;
          font-weight: 900;
          text-align: center;
          color: var(--theme-color, #f042b0);
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        .scraper-db-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 30px;
        }
        .scraper-db-item {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 12px 20px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .scraper-db-item.selected {
          background: rgba(240, 66, 176, 0.1);
          border-color: var(--theme-color, #f042b0);
        }
        .scraper-checkbox {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          background: rgba(0, 0, 0, 0.2);
        }
        .scraper-checkbox.checked {
          background: var(--theme-color, #f042b0);
          border-color: var(--theme-color, #f042b0);
        }
        .scraper-checkbox .checkmark {
          color: #fff;
          font-size: 12px;
          font-weight: bold;
        }
        .scraper-db-name {
          font-weight: 700;
          font-size: 0.95rem;
          letter-spacing: 1px;
        }
        .scraper-modal-buttons {
          display: flex;
          gap: 15px;
          justify-content: flex-end;
        }
        .scraper-modal-btn {
          padding: 12px 25px;
          border-radius: 8px;
          border: none;
          font-weight: 800;
          font-size: 0.9rem;
          letter-spacing: 1px;
          cursor: pointer;
          transition: all 0.15s ease;
          background: var(--theme-color, #f042b0);
          color: #fff;
          box-shadow: 0 4px 12px rgba(240, 66, 176, 0.3);
        }
        .scraper-modal-btn.secondary {
          background: rgba(255, 255, 255, 0.08);
          color: #ccc;
          box-shadow: none;
        }
        .scraper-modal-btn.selected {
          outline: 3px solid #fff;
          outline-offset: 2px;
        }
        .scraper-modal-btn.secondary.selected {
          color: #fff;
          background: rgba(255, 255, 255, 0.15);
        }

        /* Stage 2 Fullscreen Redesigned Modal */
        .stage2-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(20px);
          z-index: 10000000 !important;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: space-between;
          padding: 40px 60px;
          font-family: 'Inter', sans-serif;
          color: #fff;
          box-sizing: border-box;
          animation: scraper-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .scraper-header {
          text-align: center;
          margin-bottom: 30px;
          flex-shrink: 0;
        }
        .scraper-header .rom-filename {
          font-size: 1.6rem;
          font-weight: 900;
          color: #fff;
          letter-spacing: 1px;
          margin-bottom: 5px;
        }
        .scraper-header .system-fullname {
          font-size: 1rem;
          font-weight: 800;
          color: #ff007f;
          letter-spacing: 2px;
        }
        .scraper-stage2-main-content {
          width: 100%;
          flex: 1;
          display: flex;
          gap: 50px;
          overflow: hidden;
          margin-bottom: 30px;
        }
        .scraper-matches-section {
          width: 40%;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          padding-right: 15px;
          border-right: 1px solid rgba(255, 255, 255, 0.1);
        }
        .scraper-db-group {
          margin-bottom: 25px;
        }
        .scraper-db-group-title {
          font-size: 0.85rem;
          font-weight: 900;
          color: #ff007f;
          letter-spacing: 2px;
          margin-bottom: 12px;
          text-transform: uppercase;
        }
        .scraper-match-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 15px;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.12s ease;
          background: rgba(255, 255, 255, 0.01);
        }
        .scraper-match-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .scraper-match-item.selected {
          background: #a3004f;
        }
        .scraper-match-item .match-name {
          font-weight: 700;
          font-size: 1.2em;
          color: #eee;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 70%;
        }
        .scraper-match-item.selected .match-name {
          color: #fff;
          font-weight: 800;
        }
        .scraper-match-item .match-icons {
          display: flex;
          gap: 8px;
          align-items: center;
          color: rgba(255, 255, 255, 0.8);
        }
        .scraper-match-item.selected .match-icons {
          color: #fff;
        }
        .icon-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 2px 4px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          transition: all 0.2s ease;
        }
        .icon-badge.img {
          background: rgba(6, 182, 212, 0.15); /* cyan */
          color: #22d3ee;
        }
        .icon-badge.vid {
          background: rgba(236, 72, 153, 0.15); /* pink */
          color: #f472b6;
        }
        .icon-badge.txt {
          background: rgba(16, 185, 129, 0.15); /* emerald */
          color: #34d399;
          font-size: 0.7rem !important;
        }
        .scraper-details-section {
          width: 60%;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          padding-right: 10px;
        }
        .scraper-details-top {
          display: flex;
          gap: 40px;
          align-items: flex-start;
          flex-shrink: 0;
        }
        .scraper-details-image-container {
          width: 45%;
          display: flex;
          justify-content: center;
          align-items: center;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 12px;
          padding: 15px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
          min-height: 200px;
        }
        .scraper-details-image-container img,
        .scraper-details-image-container video {
          max-width: 100%;
          max-height: 250px;
          object-fit: contain;
          border-radius: 4px;
        }
        .scraper-details-metadata {
          width: 55%;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .metadata-grid-row {
          display: flex;
          font-size: 0.95rem;
          line-height: 1.4;
        }
        .metadata-grid-label {
          width: 160px;
          font-weight: 800;
          color: #ff007f;
          letter-spacing: 1px;
        }
        .metadata-grid-value {
          font-weight: 500;
          color: #ddd;
        }
        .scraper-details-description {
          margin-top: 30px;
          font-size: 0.9rem;
          color: #aaa;
          line-height: 1.6;
          max-height: 180px;
          overflow-y: auto;
          padding-right: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 20px;
        }
        .scraper-footer-buttons {
          display: flex;
          gap: 20px;
          justify-content: center;
          width: 100%;
          flex-shrink: 0;
        }
        .scraper-footer-btn {
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.4);
          border-radius: 4px;
          padding: 10px 30px;
          color: #fff;
          font-size: 1.0rem;
          font-weight: 700;
          cursor: pointer;
          text-transform: uppercase;
          transition: all 0.15s ease;
          min-width: 140px;
          letter-spacing: 1px;
        }
        .scraper-footer-btn:hover {
          background: #ff007f;
          border-color: #ff007f;
          box-shadow: 0 0 15px rgba(255, 0, 127, 0.4);
        }
        .searching-modal {
          align-items: center;
          justify-content: center;
          gap: 20px;
          width: 380px;
        }
        .searching-text {
          font-size: 0.95rem;
          font-weight: 700;
          text-align: center;
          color: #ccc;
          margin: 0;
        }
        .no-results-text {
          text-align: center;
          color: #aaa;
          margin: 15px 0 30px;
        }
        .scraper-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255,255,255,0.1);
          border-top-color: var(--theme-color, #f042b0);
          border-radius: 50%;
          animation: scraper-spin 1s linear infinite;
        }
        @keyframes scraper-spin {
          to { transform: rotate(360deg); }
        }

        /* Tabs & Bottom Buttons Styles */
        .riescade-menu-overlay.game-options .riescade-menu-tabs { width:100%; display: flex; justify-content: flex-start; gap: 0; padding: 12px 25px 0; border-top: 1px solid rgba(0,0,0,0.05); }
        .riescade-menu-overlay.game-options .riescade-menu-tab { width:auto; padding: 5px 20px; font-size: 1rem; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; color: #999; border-bottom: 3px solid transparent; transition: color 0.2s ease, border-color 0.2s ease; user-select: none; }
        .riescade-menu-overlay.game-options .riescade-menu-tab:hover { color: var(--theme-color, #3b82f6); }
        .riescade-menu-overlay.game-options .riescade-menu-tab.active { color: var(--theme-color, #3b82f6); border-bottom-color: var(--theme-color, #3b82f6); }
        
        .riescade-menu-overlay.game-options .riescade-menu-bottom-bar {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 20px;
          padding: 20px;
          background: #dfdfdf;
          border-top: 1px solid rgba(0,0,0,0.1);
        }
        
        .riescade-menu-overlay.game-options .riescade-menu-bottom-button {
          background: transparent;
          color: #999;
          border: 2px solid #999;
          border-radius: 4px;
          padding: 8px 24px;
          font-size: 0.9rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          text-transform: uppercase;
          outline: none;
        }
        
        .riescade-menu-overlay.game-options .riescade-menu-bottom-button:hover,
        .riescade-menu-overlay.game-options .riescade-menu-bottom-button.selected {
          border-color: var(--theme-color, #3b82f6);
          color: var(--theme-color, #3b82f6);
          transform: scale(1.05);
        }

        .riescade-menu-overlay.game-options .riescade-menu-text-container { display: flex; flex-direction: column; align-items: flex-start; text-align: left; gap: 2px; }
        .riescade-menu-overlay.game-options .riescade-menu-description { font-size: 0.75rem; color: #777; font-weight: 400; text-transform: none; line-height: 1.3; margin-top: 2px; }
        .riescade-menu-overlay.game-options .riescade-menu-item.selected .riescade-menu-description { color: rgba(255, 255, 255, 0.8); }


      ` }} />
    </>
  )
}
