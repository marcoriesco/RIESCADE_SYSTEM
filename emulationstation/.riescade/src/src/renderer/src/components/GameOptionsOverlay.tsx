import React, { useState, useEffect, useCallback } from 'react'
import { Game, System } from '../../shared/types'

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
  const [activeMenuStack, setActiveMenuStack] = useState<{ items: any[]; title: string }[]>([])

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

  const getRootItems = (currentGame: Game, gameCols: string[], sys: System, allCols: string[]) => {
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

    // 2. Group: OPÇÕES AVANÇADAS
    items.push({ id: 'group_advanced', label: 'OPÇÕES AVANÇADAS', type: 'group' })
    items.push({ 
      id: 'emulator', 
      label: 'EMULATOR', 
      type: 'select', 
      value: currentGame.emulator || sys.emulators?.[0]?.name || 'DEFAULT',
      items: sys.emulators?.map(e => ({ label: e.name.toUpperCase(), value: e.name })) || []
    })

    return items
  }

  useEffect(() => {
    if (isOpen) {
      setDraftGame(game)
      
      // Load available collections and current collections for this game
      window.api.getCustomCollections().then(setCustomCollections)
      window.api.getCollectionsForGame(game.system || system.name, game.path).then(gameCols => {
        setGameCollections(gameCols)
        const rootItems = getRootItems(game, gameCols, system, customCollections)
        setActiveMenuStack([{ items: rootItems, title: 'GAME OPTIONS' }])
        setSelectedIndex(getFirstSelectableIndex(rootItems))
      })

      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [isOpen, game])

  const currentMenu = activeMenuStack[activeMenuStack.length - 1]?.items || []
  const menuTitle = activeMenuStack[activeMenuStack.length - 1]?.title || 'GAME OPTIONS'

  const handleToggle = () => {
    const item = currentMenu[selectedIndex]
    if (item.id === 'favorite') {
      const updated = { ...draftGame, favorite: !draftGame.favorite }
      setDraftGame(updated)
      onUpdate(updated)
    }
  }

  const handleSelect = (direction: 1 | -1) => {
    const item = currentMenu[selectedIndex]
    if (item.id === 'emulator' && item.items) {
      const currentIdx = item.items.findIndex(i => i.value === item.value)
      const nextIdx = (currentIdx + direction + item.items.length) % item.items.length
      const updated = { ...draftGame, emulator: item.items[nextIdx].value, core: undefined }
      setDraftGame(updated)
      onUpdate(updated)
      
      // Update the active menu stack item so it renders correctly
      setActiveMenuStack(prev => {
        const next = [...prev]
        const updatedItems = next[next.length - 1].items.map(it => 
          it.id === 'emulator' ? { ...it, value: updated.emulator } : it
        )
        next[next.length - 1] = { ...next[next.length - 1], items: updatedItems }
        return next
      })
    }
  }

  const handleAction = async (item: any) => {
    if (item.collectionName) {
      const col = item.collectionName
      const action = item.actionType // 'add' or 'remove'
      
      const success = await window.api.toggleGameInCollection(col, game.system || system.name, game.path, action)
      if (success) {
        // Refresh collections lists
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

        // Re-generate root menu items and update the stack
        const newRootItems = getRootItems(draftGame, newGameCols, system, customCollections)
        
        if (activeMenuStack.length > 1) {
          // If we were inside the "ADICIONAR A COLEÇÃO" submenu, go back to root!
          setActiveMenuStack([{ items: newRootItems, title: 'GAME OPTIONS' }])
          setSelectedIndex(getFirstSelectableIndex(newRootItems))
        } else {
          // If we clicked on "REMOVER DE [COL]" directly from root
          setActiveMenuStack([{ items: newRootItems, title: 'GAME OPTIONS' }])
          // Bound selectIndex to not overflow if item removed
          const targetIndex = getFirstSelectableIndex(newRootItems)
          setSelectedIndex(prev => Math.min(prev, newRootItems.length - 1) >= targetIndex ? Math.min(prev, newRootItems.length - 1) : targetIndex)
        }
      }
    }
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || activeMenuStack.length === 0) return

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
        if (item) {
          if (item.type === 'submenu') {
            setActiveMenuStack(prev => [...prev, { items: item.submenu, title: item.label }])
            setSelectedIndex(getFirstSelectableIndex(item.submenu))
          } else if (item.type === 'toggle') {
            handleToggle()
            // Update value in stack
            setActiveMenuStack(prev => {
              const next = [...prev]
              const updatedItems = next[next.length - 1].items.map((it, idx) => 
                idx === selectedIndex ? { ...it, value: !it.value } : it
              )
              next[next.length - 1] = { ...next[next.length - 1], items: updatedItems }
              return next
            })
          } else if (item.type === 'action') {
            handleAction(item)
          }
        }
      } else if (e.key === 'ArrowRight') {
        const item = currentMenu[selectedIndex]
        if (item?.type === 'select') handleSelect(1)
      } else if (e.key === 'ArrowLeft') {
        const item = currentMenu[selectedIndex]
        if (item?.type === 'select') handleSelect(-1)
      } else if (e.key === 'Backspace' || e.key === 'Escape' || e.key === 'Control') {
        if (activeMenuStack.length > 1) {
          setActiveMenuStack(prev => prev.slice(0, -1))
          setSelectedIndex(0)
        } else {
          onClose()
        }
      }
    },
    [isOpen, selectedIndex, currentMenu, activeMenuStack, draftGame, gameCollections, customCollections, system]
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
          >
            <span className="riescade-menu-label">
              {item.label}
            </span>
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
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )

  if (!isOpen) return null

  const marqueeUrl = getMarqueeUrl()

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
          </div>
          <div className="riescade-menu-list-container">{menuItemsNode}</div>
          <div className="riescade-menu-footer">
            <div className="riescade-menu-footer-actions">
              <div className="riescade-menu-footer-action">
                <span className="riescade-menu-footer-button">B</span>
                <span className="riescade-menu-footer-text">BACK</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
        }
        .riescade-menu-overlay.game-options.visible { 
          opacity: 1; 
          pointer-events: auto; 
        }
        .riescade-menu-overlay.game-options .riescade-menu-container { 
          width: 420px; 
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
          color: #333; 
          font-size: 1.2rem; 
          font-weight: 900; 
          letter-spacing: 3px; 
          text-transform: uppercase; 
        }
        .riescade-menu-overlay.game-options .riescade-menu-subtitle { 
          font-size: 0.8rem; 
          color: #666; 
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
          overflow-y: auto; 
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
          background: #fdfdfd;
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
      ` }} />
    </>
  )
}
