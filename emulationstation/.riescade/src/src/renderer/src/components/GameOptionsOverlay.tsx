import React, { useState, useEffect, useCallback } from 'react'
import { Game, System } from '../../shared/types'

const getRomFileName = (path: string): string => {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || ''
}

interface GameOptionsProps {
  isOpen: boolean
  onClose: () => void
  game: Game
  system: System
  theme?: any
  themeData?: any
  onUpdate: (updatedGame: Game) => void
  addNotification?: (message: string, type: 'info' | 'success' | 'warning') => void
}

export const GameOptionsOverlay: React.FC<GameOptionsProps> = ({ 
  isOpen, onClose, game, system, theme, themeData, onUpdate, addNotification 
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [draftGame, setDraftGame] = useState<Game>(game)
  const [customCollections, setCustomCollections] = useState<string[]>([])
  const [gameCollections, setGameCollections] = useState<string[]>([])
  const [activeMenuStack, setActiveMenuStack] = useState<{ items: any[]; title: string; tabs?: string[]; activeTab?: number; parentItemId?: string }[]>([])
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [rawBiosData, setRawBiosData] = useState<any[]>([])
  const [installedSystems, setInstalledSystems] = useState<any[]>([])

  // Single game scraper states
  const [scraperStage, setScraperStage] = useState<0 | 1 | 2>(0) // 0: closed, 1: database checklist, 2: matches
  const [scraperDbs, setScraperDbs] = useState<Record<string, boolean>>({
    ScreenScraper: true,
    TheGamesDB: true,
    HfsDB: true,
    IGDB: true
  })
  const [scraperDbSelectedIndex, setScraperDbSelectedIndex] = useState(0) // 0-3: DB checkboxes, 4: BUSCAR, 5: CANCELAR
  const [scraperIsSearching, setScraperIsSearching] = useState(false)
  const [scraperMatches, setScraperMatches] = useState<any[]>([])
  const [scraperMatchSelectedIndex, setScraperMatchSelectedIndex] = useState(0)

  // Bios check states
  const [biosCheckOpen, setBiosCheckOpen] = useState(false)
  const [biosActiveTab, setBiosActiveTab] = useState(0) // 0: Sistemas instalados, 1: Todos
  const [biosSelectedIndex, setBiosSelectedIndex] = useState(0)

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

    // 1. Group: COLEÇÕES
    items.push({ id: 'group_collections', label: 'COLEÇÕES', type: 'group' })
    items.push({ 
      id: 'favorite', 
      label: 'FAVORITAR JOGO', 
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
      label: 'ADICIONAR A COLEÇÃO',
      type: 'submenu',
      submenu: addColSubmenu
    })

    // Dynamic "REMOVER DE [COL]" actions for each collection the game is in
    gameCols.forEach(col => {
      items.push({
        id: `remove_col_${col}`,
        label: `REMOVER DE ${col.toUpperCase()}`,
        type: 'action',
        collectionName: col,
        actionType: 'remove'
      })
    })

    // 2. Group: OPÇÕES
    items.push({ id: 'group_options', label: 'OPÇÕES', type: 'group' })
    items.push({
      id: 'scrape_this_game',
      label: 'PROCURAR POR MÍDIAS DESTE JOGO',
      type: 'action',
      actionType: 'scrape'
    })
    items.push({
      id: 'missing_bios_check',
      label: 'VERIFICAR AUSÊNCIA DE BIOS',
      type: 'action',
      actionType: 'missing_bios'
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
        value: getGameSettingValue('emulator', 'auto'),
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
        label: 'JOGOS SUAVES (FILTRO BILINEAR)',
        type: 'toggle',
        settingName: 'smooth',
        value: getGameSettingValue('smooth', 'auto') === 'true' || getGameSettingValue('smooth', 'auto') === true
      }
    ]

    items.push({
      id: 'advanced_game_options',
      label: 'OPÇÕES AVANÇADAS DO JOGO',
      type: 'submenu',
      submenu: advancedSubmenu
    })

    return items
  }

  useEffect(() => {
    if (isOpen) {
      setDraftGame(game)
      setScraperStage(0)
      
      window.api.getBiosInformation().then(setRawBiosData).catch(console.error)
      window.api.getSystems().then(setInstalledSystems).catch(console.error)
      
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

  const getBiosSystemsForTab = (tab: number) => {
    if (tab === 0) {
      const installedNames = new Set(installedSystems.map(s => s.name.toLowerCase()))
      return rawBiosData.filter(sys => installedNames.has(sys.name.toLowerCase()))
    }
    return rawBiosData
  }

  const getRenderItems = (activeBiosSystems: any[]) => {
    const items: any[] = []
    let flatIndex = 0
    
    activeBiosSystems.forEach(sys => {
      const matched = installedSystems.find(s => s.name.toLowerCase() === sys.name.toLowerCase())
      const systemFullName = (matched?.fullName || sys.name || 'UNKNOWN')
      
      if (sys.bios && sys.bios.length > 0) {
        items.push({
          type: 'group',
          id: `render_group_${sys.name}`,
          label: systemFullName.toUpperCase()
        })
        
        sys.bios.forEach(b => {
          items.push({
            type: 'bios',
            id: `render_bios_${sys.name}_${b.path}`,
            path: b.path,
            description: `${b.status} - MD5: ${b.md5}`,
            systemName: sys.name,
            flatIndex: flatIndex++
          })
        })
      }
    })
    
    return items
  }

  const refreshBiosData = async () => {
    if (addNotification) addNotification('ATUALIZANDO INFORMAÇÕES DE BIOS...', 'info')
    try {
      const bios = await window.api.getBiosInformation()
      setRawBiosData(bios || [])
      if (addNotification) addNotification('INFORMAÇÕES DE BIOS ATUALIZADAS!', 'success')
    } catch (err) {
      console.error(err)
      if (addNotification) addNotification('ERRO AO ATUALIZAR INFORMAÇÕES DE BIOS', 'warning')
    }
  }

  useEffect(() => {
    if (biosCheckOpen) {
      const selectedEl = document.querySelector('.bios-item.selected')
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [biosSelectedIndex, biosCheckOpen, biosActiveTab])

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

      if (item.settingName) {
        const key = getGameSettingKey(item.settingName)
        window.api.saveSetting(key, nextVal, 'string')
        setSettings(prev => ({
          ...prev,
          [key]: { value: nextVal, type: 'string' }
        }))
      } else if (item.id === 'emulator') {
        const updated = { ...draftGame, emulator: nextVal, core: undefined }
        setDraftGame(updated)
        onUpdate(updated)
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
    const currentStackItem = activeMenuStack[activeMenuStack.length - 1]
    if (currentStackItem?.parentItemId === 'missing_bios_submenu') {
      return [
        {
          id: 'bios_refresh_btn',
          label: 'ATUALIZAR',
          onClick: async () => {
            const bios = await window.api.getBiosInformation()
            setRawBiosData(bios || [])
            
            setActiveMenuStack(prev => {
              const next = [...prev]
              const idx = next.length - 1
              if (idx >= 0 && next[idx].parentItemId === 'missing_bios_submenu') {
                const generateTabItems = (systemsList: any[], tabIndex: number): any[] => {
                  const tabItems: any[] = []
                  for (const sys of systemsList) {
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

                  const hasAnyBios = systemsList.some(sys => sys.bios && sys.bios.length > 0)
                  if (!hasAnyBios) {
                    tabItems.push({
                      id: `bios_empty_tab${tabIndex}`,
                      label: 'NENHUM ARQUIVO DE BIOS AUSENTE',
                      type: 'info',
                      value: '',
                      tab: tabIndex
                    })
                  }

                  return tabItems
                }

                const installedNames = new Set(installedSystems.map(s => s.name.toLowerCase()))
                const installedBiosSystems = bios.filter((sys: any) => installedNames.has(sys.name.toLowerCase()))

                const tab0Items = generateTabItems(installedBiosSystems, 0)
                const tab1Items = generateTabItems(bios, 1)

                next[idx] = {
                  ...next[idx],
                  items: [...tab0Items, ...tab1Items]
                }
              }
              return next
            })

            const nextStackItem = activeMenuStack[activeMenuStack.length - 1]
            if (nextStackItem) {
              const currentTab = nextStackItem.activeTab ?? 0
              const tabItems = nextStackItem.items.filter(item => item.tab === currentTab)
              setSelectedIndex(getFirstSelectableIndex(tabItems))
            }
          }
        },
        {
          id: 'bios_back_btn',
          label: 'VOLTAR',
          onClick: () => {
            setActiveMenuStack(prev => prev.slice(0, -1))
            setSelectedIndex(0)
          }
        }
      ]
    }
    return []
  }

  const handleAction = async (item: any) => {
    if (item.actionType === 'scrape') {
      setScraperStage(1)
      setScraperDbs({ ScreenScraper: true, TheGamesDB: true, HfsDB: true, IGDB: true })
      setScraperDbSelectedIndex(0)
      return
    }

    if (item.actionType === 'missing_bios') {
      setBiosCheckOpen(true)
      setBiosActiveTab(0)
      setBiosSelectedIndex(0)
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
            action === 'add' ? 'success' : 'info'
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

  const triggerScraperSearch = async () => {
    const selectedDbs = Object.entries(scraperDbs)
      .filter(([_, active]) => active)
      .map(([name]) => name)

    if (selectedDbs.length === 0) {
      if (addNotification) addNotification('SELECIONE AO MENOS UMA BASE DE DADOS', 'warning')
      return
    }

    setScraperIsSearching(true)
    setScraperStage(2)
    setScraperMatches([])
    setScraperMatchSelectedIndex(0)

    try {
      const results = await window.api.searchGameMedia(system.name, game.name, selectedDbs)
      setScraperMatches(results || [])
    } catch (err) {
      console.error(err)
      if (addNotification) addNotification('ERRO AO BUSCAR MÍDIAS', 'warning')
    } finally {
      setScraperIsSearching(false)
    }
  }

  const triggerScraperDownload = async () => {
    const selectedMatch = scraperMatches[scraperMatchSelectedIndex]
    if (!selectedMatch) return

    if (addNotification) addNotification(`BAIXANDO MÍDIAS PARA ${game.name.toUpperCase()}...`, 'info')
    setScraperStage(0)
    onClose()

    try {
      const updated = await window.api.downloadGameMedia(system.name, game.path, selectedMatch)
      if (updated) {
        onUpdate(updated)
        if (addNotification) addNotification(`MÍDIAS DE ${game.name.toUpperCase()} BAIXADAS COM SUCESSO!`, 'success')
      } else {
        if (addNotification) addNotification(`ERRO AO BAIXAR MÍDIAS`, 'warning')
      }
    } catch (err) {
      console.error(err)
      if (addNotification) addNotification(`ERRO AO BAIXAR MÍDIAS`, 'warning')
    }
  }

  const handleScraperKeyDown = (e: KeyboardEvent) => {
    if (scraperStage === 1) {
      if (e.key === 'ArrowDown') {
        setScraperDbSelectedIndex(prev => (prev + 1) % 6)
      } else if (e.key === 'ArrowUp') {
        setScraperDbSelectedIndex(prev => (prev - 1 + 6) % 6)
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (scraperDbSelectedIndex < 4) {
          const keys = Object.keys(scraperDbs)
          const targetKey = keys[scraperDbSelectedIndex]
          setScraperDbs(prev => ({ ...prev, [targetKey]: !prev[targetKey] }))
        } else if (scraperDbSelectedIndex === 4) {
          triggerScraperSearch()
        } else if (scraperDbSelectedIndex === 5) {
          setScraperStage(0)
        }
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        setScraperStage(0)
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
      } else if (e.key === 'Enter') {
        triggerScraperDownload()
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        setScraperStage(1)
      }
    }
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      if (biosCheckOpen) {
        e.preventDefault()
        e.stopPropagation()
        
        const activeBiosSystems = (() => {
          if (biosActiveTab === 0) {
            const installedNames = new Set(installedSystems.map(s => s.name.toLowerCase()))
            return rawBiosData.filter(sys => installedNames.has(sys.name.toLowerCase()))
          }
          return rawBiosData
        })()
        
        const activeBiosFiles = activeBiosSystems.flatMap(sys => 
          (sys.bios || []).map(b => ({ ...b, systemName: sys.name }))
        )
        const totalSelectable = activeBiosFiles.length + 2 // bios files + 2 buttons

        if (e.key === 'ArrowDown') {
          setBiosSelectedIndex(prev => (prev + 1) % totalSelectable)
        } else if (e.key === 'ArrowUp') {
          setBiosSelectedIndex(prev => (prev - 1 + totalSelectable) % totalSelectable)
        } else if (e.key === 'ArrowRight') {
          if (biosSelectedIndex < activeBiosFiles.length) {
            setBiosActiveTab(prev => (prev === 0 ? 1 : 0))
            setBiosSelectedIndex(0)
          } else {
            const currentBtn = biosSelectedIndex - activeBiosFiles.length
            const nextBtn = (currentBtn + 1) % 2
            setBiosSelectedIndex(activeBiosFiles.length + nextBtn)
          }
        } else if (e.key === 'ArrowLeft') {
          if (biosSelectedIndex < activeBiosFiles.length) {
            setBiosActiveTab(prev => (prev === 0 ? 1 : 0))
            setBiosSelectedIndex(0)
          } else {
            const currentBtn = biosSelectedIndex - activeBiosFiles.length
            const nextBtn = (currentBtn - 1 + 2) % 2
            setBiosSelectedIndex(activeBiosFiles.length + nextBtn)
          }
        } else if (e.key === 'Enter' || e.key === ' ') {
          if (biosSelectedIndex === activeBiosFiles.length) {
            refreshBiosData()
          } else if (biosSelectedIndex === activeBiosFiles.length + 1) {
            setBiosCheckOpen(false)
          }
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          setBiosCheckOpen(false)
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
    [isOpen, selectedIndex, currentMenu, activeMenuStack, draftGame, gameCollections, customCollections, system, scraperStage, scraperDbSelectedIndex, scraperDbs, scraperMatches, scraperMatchSelectedIndex, settings, rawBiosData, installedSystems, biosCheckOpen, biosActiveTab, biosSelectedIndex]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

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
            onMouseEnter={() => {
              if (scraperStage === 0) setSelectedIndex(index)
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
    const dbKeys = ['ScreenScraper', 'TheGamesDB', 'HfsDB', 'IGDB']
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
              className={`scraper-modal-btn ${scraperDbSelectedIndex === 4 ? 'selected' : ''}`}
              onClick={triggerScraperSearch}
            >
              BUSCAR
            </button>
            <button 
              className={`scraper-modal-btn secondary ${scraperDbSelectedIndex === 5 ? 'selected' : ''}`}
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

    return (
      <div className="scraper-modal-overlay stage2-overlay">
        <div className="scraper-stage2-container">
          <div className="scraper-stage2-header">
            <h2>RESULTADOS DA BUSCA: {game.name.toUpperCase()}</h2>
          </div>
          
          <div className="scraper-stage2-content">
            {/* Column 1: Matches List */}
            <div className="scraper-column matches-column">
              <div className="column-title">RESULTADOS</div>
              <div className="matches-list">
                {scraperMatches.map((match, idx) => {
                  const isSelected = scraperMatchSelectedIndex === idx
                  const hasImg = !!(match.image || match.thumbnail)
                  const hasVid = !!match.video
                  const hasLog = !!(match.logo || match.marquee)
                  
                  return (
                    <div 
                      key={idx}
                      className={`match-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => setScraperMatchSelectedIndex(idx)}
                    >
                      <span className="match-title">{match.name}</span>
                      <div className="match-badges">
                        {hasImg && <span className="m-badge img">IMG</span>}
                        {hasVid && <span className="m-badge vid">VID</span>}
                        {hasLog && <span className="m-badge log">LOG</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Column 2: Video & Logo Preview */}
            <div className="scraper-column preview-column">
              <div className="column-title">PRÉVIA DE MÍDIAS</div>
              <div className="preview-card-container">
                {selectedMatch?.video ? (
                  <video 
                    key={selectedMatch.video} 
                    src={selectedMatch.video} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    className="preview-video-player"
                  />
                ) : selectedMatch?.image || selectedMatch?.thumbnail ? (
                  <img 
                    src={selectedMatch.image || selectedMatch.thumbnail} 
                    className="preview-image-fallback" 
                    alt="Preview"
                  />
                ) : (
                  <div className="no-preview-placeholder">SEM PRÉVIA DISPONÍVEL</div>
                )}
                
                {/* Overlay Logo/Marquee */}
                {(selectedMatch?.logo || selectedMatch?.marquee) && (
                  <img 
                    src={selectedMatch.logo || selectedMatch.marquee} 
                    className="preview-marquee-overlay" 
                    alt="Logo"
                  />
                )}
              </div>
            </div>

            {/* Column 3: Metadata Box */}
            <div className="scraper-column metadata-column">
              <div className="column-title">METADADOS</div>
              <div className="metadata-box-details">
                <div className="metadata-row">
                  <span className="meta-label">DESENVOLVEDOR:</span>
                  <span className="meta-value">{selectedMatch?.developer || 'N/A'}</span>
                </div>
                <div className="metadata-row">
                  <span className="meta-label">DISTRIBUIDORA:</span>
                  <span className="meta-value">{selectedMatch?.publisher || 'N/A'}</span>
                </div>
                <div className="metadata-row">
                  <span className="meta-label">DATA DE LANÇAMENTO:</span>
                  <span className="meta-value">
                    {selectedMatch?.releasedate ? new Date(selectedMatch.releasedate).toLocaleDateString('pt-BR') : 'N/A'}
                  </span>
                </div>
                <div className="metadata-row">
                  <span className="meta-label">JOGADORES:</span>
                  <span className="meta-value">{selectedMatch?.players || 'N/A'}</span>
                </div>
                <div className="metadata-row">
                  <span className="meta-label">NOTA (RATING):</span>
                  <span className="meta-value">{selectedMatch?.rating ? `${Math.round(parseFloat(selectedMatch.rating) * 100)}%` : 'N/A'}</span>
                </div>
                <div className="metadata-row">
                  <span className="meta-label">GÊNERO:</span>
                  <span className="meta-value">{selectedMatch?.genre || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer: Synopsis & Actions */}
          <div className="scraper-stage2-footer">
            <div className="synopsis-box">
              <span className="synopsis-label">SINOPSE:</span>
              <p className="synopsis-text">{selectedMatch?.desc || selectedMatch?.synopsis || 'Nenhuma descrição disponível para este jogo.'}</p>
            </div>
            <div className="scraper-footer-actions">
              <div className="footer-action-btn">
                <span className="keycap">ENTRADA</span>
                <span className="action-text">SELECIONAR</span>
              </div>
              <div className="footer-action-btn">
                <span className="keycap">BACK / ESC</span>
                <span className="action-text">CANCELAR</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderBiosCheckModal = () => {
    const activeBiosSystems = getBiosSystemsForTab(biosActiveTab)
    const hasBiosFiles = activeBiosSystems.some(sys => sys.bios && sys.bios.length > 0)
    const activeBiosFiles = activeBiosSystems.flatMap(sys => 
      (sys.bios || []).map(b => ({ ...b, systemName: sys.name }))
    )
    const renderItems = getRenderItems(activeBiosSystems)
    
    return (
      <div className="bios-modal-overlay">
        <div className="bios-modal-container">
          <div className="bios-modal-header">
            <h3 className="bios-modal-title">VERIFICAR AUSÊNCIA DE BIOS</h3>
            <div className="bios-modal-tabs">
              {['Sistemas instalados', 'Todos'].map((tab, idx) => (
                <div
                  key={tab}
                  className={`bios-modal-tab ${idx === biosActiveTab ? 'active' : ''}`}
                  onClick={() => {
                    setBiosActiveTab(idx)
                    setBiosSelectedIndex(0)
                  }}
                >
                  {tab}
                </div>
              ))}
            </div>
          </div>
          
          <div className="bios-list-container">
            {!hasBiosFiles ? (
              <div className="bios-empty-message">NENHUM ARQUIVO DE BIOS AUSENTE</div>
            ) : (
              renderItems.map(item => {
                if (item.type === 'group') {
                  return (
                    <div key={item.id} className="bios-group-header">
                      {item.label}
                    </div>
                  )
                }
                
                const isSelected = biosSelectedIndex === item.flatIndex
                
                return (
                  <div
                    key={item.id}
                    className={`bios-item ${isSelected ? 'selected' : ''}`}
                    onMouseEnter={() => setBiosSelectedIndex(item.flatIndex)}
                  >
                    <svg className="bios-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px', flexShrink: 0 }}>
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                    <div className="bios-item-details">
                      <span className="bios-item-path">{item.path}</span>
                      <span className="bios-item-desc">{item.description}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          
          <div className="bios-modal-buttons">
            <button
              className={`bios-modal-btn ${biosSelectedIndex === activeBiosFiles.length ? 'selected' : ''}`}
              onClick={refreshBiosData}
              onMouseEnter={() => setBiosSelectedIndex(activeBiosFiles.length)}
            >
              ATUALIZAR
            </button>
            <button
              className={`bios-modal-btn ${biosSelectedIndex === activeBiosFiles.length + 1 ? 'selected' : ''}`}
              onClick={() => setBiosCheckOpen(false)}
              onMouseEnter={() => setBiosSelectedIndex(activeBiosFiles.length + 1)}
            >
              VOLTAR
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={`riescade-menu-overlay game-options ${visible ? 'visible' : ''}`}>
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
      </div>

      {scraperStage === 1 && renderStageStage1()}
      {scraperStage === 2 && renderStageStage2()}
      {biosCheckOpen && renderBiosCheckModal()}

      <style dangerouslySetInnerHTML={{ __html: `
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

        /* Stage 2 Fullscreen Modal */
        .stage2-overlay {
          padding: 40px;
        }
        .scraper-stage2-container {
          width: 90vw;
          height: 85vh;
          background: rgba(15, 15, 15, 0.92);
          backdrop-filter: blur(20px);
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8);
          animation: scraper-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }
        .scraper-stage2-header {
          padding: 20px 30px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .scraper-stage2-header h2 {
          margin: 0;
          font-size: 1.3rem;
          font-weight: 900;
          letter-spacing: 2px;
          color: var(--theme-color, #f042b0);
        }
        .scraper-stage2-content {
          flex: 1;
          display: flex;
          overflow: hidden;
          padding: 20px;
          gap: 20px;
        }
        .scraper-column {
          display: flex;
          flex-direction: column;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 15px;
          overflow: hidden;
        }
        .column-title {
          font-size: 0.8rem;
          font-weight: 800;
          color: #888;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 15px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding-bottom: 8px;
        }
        .matches-column {
          width: 32%;
        }
        .preview-column {
          width: 40%;
          align-items: stretch;
        }
        .metadata-column {
          width: 28%;
        }
        .matches-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .match-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .match-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .match-item.selected {
          background: var(--theme-color, #f042b0);
          border-color: var(--theme-color, #f042b0);
          box-shadow: 0 4px 12px rgba(240, 66, 176, 0.25);
        }
        .match-title {
          font-weight: 700;
          font-size: 0.9rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 70%;
        }
        .match-badges {
          display: flex;
          gap: 5px;
        }
        .m-badge {
          font-size: 0.65rem;
          font-weight: 900;
          padding: 2px 6px;
          border-radius: 4px;
          color: #fff;
          letter-spacing: 0.5px;
        }
        .m-badge.img { background: #3b82f6; }
        .m-badge.vid { background: #f042b0; }
        .m-badge.log { background: #eab308; }

        .preview-card-container {
          flex: 1;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 8px;
          overflow: hidden;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .preview-video-player {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .preview-image-fallback {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .no-preview-placeholder {
          font-weight: 700;
          color: #555;
          font-size: 0.9rem;
          letter-spacing: 1px;
        }
        .preview-marquee-overlay {
          position: absolute;
          top: 15px;
          right: 15px;
          max-width: 35%;
          max-height: 25%;
          object-fit: contain;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
          pointer-events: none;
        }
        .metadata-box-details {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        .metadata-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .meta-label {
          font-size: 0.7rem;
          font-weight: 800;
          color: #666;
          letter-spacing: 1px;
        }
        .meta-value {
          font-size: 0.9rem;
          font-weight: 700;
          color: #ddd;
        }
        
        .scraper-stage2-footer {
          padding: 20px 30px;
          background: rgba(255, 255, 255, 0.02);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 45px;
        }
        .synopsis-box {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 70px;
          overflow: hidden;
        }
        .synopsis-label {
          font-size: 0.7rem;
          font-weight: 800;
          color: #666;
          letter-spacing: 1px;
        }
        .synopsis-text {
          margin: 0;
          font-size: 0.85rem;
          color: #aaa;
          line-height: 1.4;
          overflow-y: auto;
        }
        .scraper-footer-actions {
          display: flex;
          gap: 25px;
          flex-shrink: 0;
        }
        .footer-action-btn {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .keycap {
          background: #333;
          border: 1px solid #555;
          border-bottom-width: 3px;
          color: #fff;
          font-weight: 800;
          font-size: 0.75rem;
          padding: 4px 10px;
          border-radius: 6px;
          letter-spacing: 0.5px;
        }
        .action-text {
          font-size: 0.8rem;
          font-weight: 700;
          color: #888;
          text-transform: uppercase;
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

        /* BIOS Modal Styles */
        .bios-modal-overlay {
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
        .bios-modal-container {
          background: rgba(20, 20, 20, 0.85);
          backdrop-filter: blur(10px);
          border: 2px solid rgba(240, 66, 176, 0.2);
          border-radius: 16px;
          padding: 35px;
          width: 70vw;
          height: 70vh;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          align-items: stretch;
          animation: scraper-fade-in 0.25s ease-out;
        }
        .bios-modal-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 20px;
        }
        .bios-modal-title {
          margin: 0 0 15px 0;
          font-size: 1.4rem;
          font-weight: 900;
          text-align: center;
          color: #f042b0;
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        .bios-modal-tabs {
          display: flex;
          align-self: flex-start;
          gap: 25px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          width: 100%;
          padding-bottom: 5px;
        }
        .bios-modal-tab {
          font-size: 1.1rem;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          cursor: pointer;
          color: #888;
          border-bottom: 3px solid transparent;
          transition: all 0.2s ease;
          padding: 5px 10px;
          user-select: none;
        }
        .bios-modal-tab.active {
          color: #f042b0;
          border-bottom-color: #f042b0;
        }
        .bios-list-container {
          flex: 1;
          overflow-y: auto;
          margin-bottom: 25px;
          padding-right: 10px;
        }
        .bios-group-header {
          color: #f042b0;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin: 20px 0 10px 0;
          text-align: left;
        }
        .bios-group-header:first-of-type {
          margin-top: 5px;
        }
        .bios-item {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 12px 20px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          cursor: pointer;
          transition: all 0.15s ease;
          margin-bottom: 8px;
        }
        .bios-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .bios-item.selected {
          background: #f042b0;
          border-color: #f042b0;
          box-shadow: 0 4px 12px rgba(240, 66, 176, 0.25);
        }
        .bios-item.selected .bios-item-desc {
          color: rgba(255, 255, 255, 0.8);
        }
        .bios-item-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          color: #fff;
          opacity: 0.8;
        }
        .bios-item-details {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
        }
        .bios-item-path {
          font-weight: 700;
          font-size: 0.95rem;
        }
        .bios-item-desc {
          font-size: 0.75rem;
          color: #aaa;
          margin-top: 2px;
        }
        .bios-empty-message {
          text-align: center;
          color: #aaa;
          margin: 40px 0;
          font-size: 1rem;
        }
        .bios-modal-buttons {
          display: flex;
          justify-content: center;
          gap: 20px;
        }
        .bios-modal-btn {
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
        .bios-modal-btn:hover,
        .bios-modal-btn.selected {
          border-color: #f042b0;
          color: #f042b0;
          transform: scale(1.05);
        }
      ` }} />
    </>
  )
}
