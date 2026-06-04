import React, { useEffect, useState, useRef } from 'react'

interface NetplayRoom {
  isLan: boolean
  username: string
  game_name: string
  game_crc: string
  core_name: string
  frontend: string
  retroarch_version: string
  ip: string
  port: number
  mitm_ip?: string
  mitm_port?: number
  mitm_session?: string
  host_method: number
  has_password: boolean
  country: string
  localGame?: {
    id: string
    name: string
    path: string
    system: string
    absolutePath: string
    matchStatus: 'SAME_ROM' | 'DIFFERENT_ROM' | 'UNAVAILABLE'
    localCrc: string
  }
}

interface NetplayLobbyOverlayProps {
  isOpen: boolean
  onClose: () => void
  onLaunchRoom: (room: NetplayRoom, mode: 'client' | 'spectator') => void
  t: (key: string) => string
}

export const NetplayLobbyOverlay: React.FC<NetplayLobbyOverlayProps> = ({
  isOpen,
  onClose,
  onLaunchRoom,
  t
}) => {
  const [rooms, setRooms] = useState<NetplayRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [focusedPart, setFocusedPart] = useState<'list' | 'buttons'>('list')
  const [buttonIndex, setButtonIndex] = useState(0) // 0: Refresh, 1: Close
  const listContainerRef = useRef<HTMLDivElement | null>(null)

  const fetchRooms = async () => {
    setLoading(true)
    try {
      const lobby = await window.api.getNetplayLobby()
      setRooms(lobby || [])
      setSelectedIndex(0)
      setFocusedPart('list')
    } catch (err) {
      console.error('Failed to get Netplay lobby list:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchRooms()
    }
  }, [isOpen])

  // Group rooms for display
  const lanRooms = rooms.filter(r => r.isLan)
  const availableRooms = rooms.filter(r => !r.isLan && r.localGame && r.localGame.matchStatus === 'SAME_ROM')
  const differentRomRooms = rooms.filter(r => !r.isLan && r.localGame && r.localGame.matchStatus === 'DIFFERENT_ROM')
  const unavailableRooms = rooms.filter(r => !r.isLan && (!r.localGame || r.localGame.matchStatus === 'UNAVAILABLE'))

  const groupedRooms = [
    ...lanRooms,
    ...availableRooms,
    ...differentRomRooms
  ]

  // Handle keyboard/controller events
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = (e.key || '').toLowerCase()

      if (key === 'escape' || key === 'backspace' || key === 'z') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }

      if (key === 's') {
        e.preventDefault()
        e.stopPropagation()
        fetchRooms()
        return
      }

      if (focusedPart === 'list') {
        if (key === 'arrowdown') {
          e.preventDefault()
          e.stopPropagation()
          if (groupedRooms.length > 0) {
            if (selectedIndex < groupedRooms.length - 1) {
              setSelectedIndex(prev => prev + 1)
            } else {
              setFocusedPart('buttons')
              setButtonIndex(0)
            }
          }
        } else if (key === 'arrowup') {
          e.preventDefault()
          e.stopPropagation()
          if (selectedIndex > 0) {
            setSelectedIndex(prev => prev - 1)
          }
        } else if (key === 'enter' || key === 'x') {
          e.preventDefault()
          e.stopPropagation()
          const currentRoom = groupedRooms[selectedIndex]
          if (currentRoom && currentRoom.localGame) {
            onLaunchRoom(currentRoom, 'client')
          }
        } else if (key === 'q') {
          // North button for spectating
          e.preventDefault()
          e.stopPropagation()
          const currentRoom = groupedRooms[selectedIndex]
          if (currentRoom && currentRoom.localGame) {
            onLaunchRoom(currentRoom, 'spectator')
          }
        }
      } else {
        // Button focus
        if (key === 'arrowleft') {
          e.preventDefault()
          e.stopPropagation()
          setButtonIndex(0)
        } else if (key === 'arrowright') {
          e.preventDefault()
          e.stopPropagation()
          setButtonIndex(1)
        } else if (key === 'arrowup') {
          e.preventDefault()
          e.stopPropagation()
          setFocusedPart('list')
          setSelectedIndex(groupedRooms.length > 0 ? groupedRooms.length - 1 : 0)
        } else if (key === 'enter' || key === 'x') {
          e.preventDefault()
          e.stopPropagation()
          if (buttonIndex === 0) {
            fetchRooms()
          } else {
            onClose()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen, selectedIndex, focusedPart, buttonIndex, groupedRooms])

  // Center selected item in scroll container
  useEffect(() => {
    if (listContainerRef.current) {
      const activeItem = listContainerRef.current.querySelector('.netplay-lobby-row.active') as HTMLElement
      if (activeItem) {
        const container = listContainerRef.current
        const itemTop = activeItem.offsetTop
        const itemHeight = activeItem.offsetHeight
        const containerHeight = container.clientHeight
        const scrollTop = container.scrollTop

        if (itemTop < scrollTop) {
          container.scrollTop = itemTop
        } else if (itemTop + itemHeight > scrollTop + containerHeight) {
          container.scrollTop = itemTop + itemHeight - containerHeight
        }
      }
    }
  }, [selectedIndex, focusedPart])

  if (!isOpen) return null

  // Helpers to get header offsets for sections
  const getSectionHeaderIndex = (type: 'lan' | 'available' | 'different' | 'unavailable') => {
    if (type === 'lan') return 0
    if (type === 'available') return lanRooms.length
    if (type === 'different') return lanRooms.length + availableRooms.length
    return lanRooms.length + availableRooms.length + differentRomRooms.length
  }

  return (
    <div className="netplay-lobby-overlay">
      <div className="netplay-lobby-panel">
        <div className="netplay-lobby-header">
          <h2 className="netplay-lobby-title">{t('NETPLAY LOBBY')}</h2>
          <div className="netplay-lobby-subtitle">
            {loading ? t('SEARCHING NETPLAY GAMES...') : t('Select a game lobby to join')}
          </div>
        </div>

        {loading ? (
          <div className="netplay-lobby-loading">
            <div className="netplay-spinner" />
            <div style={{ fontSize: '14px', color: '#9ca3af', letterSpacing: '0.5px' }}>
              {t('SEARCHING NETPLAY GAMES...')}
            </div>
          </div>
        ) : groupedRooms.length === 0 ? (
          <div className="netplay-lobby-empty">
            {t('NO ACTIVE NETPLAY SESSIONS FOUND')}
          </div>
        ) : (
          <div className="netplay-lobby-list" ref={listContainerRef}>
            {lanRooms.length > 0 ? (
              <div className="netplay-lobby-section-header">{t('LAN GAMES')}</div>
            ) : availableRooms.length > 0 ? (
              <div className="netplay-lobby-section-header">{t('ONLINE GAMES')}</div>
            ) : differentRomRooms.length > 0 ? (
              <div className="netplay-lobby-section-header">{t('DIFFERENT ROM')}</div>
            ) : null}
            {groupedRooms.map((room, idx) => {
              const isSectionStart =
                (idx === getSectionHeaderIndex('lan') && lanRooms.length > 0) ||
                (idx === getSectionHeaderIndex('available') && availableRooms.length > 0) ||
                (idx === getSectionHeaderIndex('different') && differentRomRooms.length > 0) ||
                (idx === getSectionHeaderIndex('unavailable') && unavailableRooms.length > 0)

              let sectionTitle = ''
              if (isSectionStart) {
                if (idx === getSectionHeaderIndex('lan')) sectionTitle = t('LAN GAMES')
                else if (idx === getSectionHeaderIndex('available')) sectionTitle = t('ONLINE GAMES')
                else if (idx === getSectionHeaderIndex('different')) sectionTitle = t('DIFFERENT ROM')
                else if (idx === getSectionHeaderIndex('unavailable')) sectionTitle = t('UNAVAILABLE')
              }

              const isRowActive = focusedPart === 'list' && selectedIndex === idx
              const matchStatus = room.localGame?.matchStatus || 'UNAVAILABLE'
              const isRoomSelectable = !!room.localGame

              return (
                <React.Fragment key={`${room.ip}-${room.port}-${room.username}-${idx}`}>
                  {isSectionStart && idx > 0 && (
                    <div className="netplay-lobby-section-header">{sectionTitle}</div>
                  )}
                  <div
                    className={`netplay-lobby-row ${isRowActive ? 'active' : ''} ${
                      !isRoomSelectable ? 'unavailable' : ''
                    }`}
                    onClick={() => {
                      if (isRoomSelectable) {
                        setSelectedIndex(idx)
                        setFocusedPart('list')
                        onLaunchRoom(room, 'client')
                      }
                    }}
                  >
                    <div className="netplay-row-left">
                      <div className="netplay-system-icon">
                        {room.localGame?.system?.substring(0, 3).toUpperCase() || 'NET'}
                      </div>
                      <div className="netplay-game-details">
                        <div className="netplay-game-name">
                          {room.game_name}
                          {room.has_password && <span style={{ marginLeft: '8px', fontSize: '12px' }}>🔒</span>}
                        </div>
                        <div className="netplay-host-info">
                          {room.isLan && <span className="netplay-badge-lan">LAN</span>}
                          <span>👤 {room.username}</span>
                          {room.country && room.country !== 'lan' && (
                            <span>🌐 {room.country.toUpperCase()}</span>
                          )}
                          <span>💻 {room.frontend}</span>
                        </div>
                      </div>
                    </div>

                    <div className="netplay-row-right">
                      <div className="netplay-core-info">
                        <div className="core-name">{room.core_name}</div>
                        <div className="ra-version">
                          RA {room.retroarch_version}
                        </div>
                      </div>

                      {matchStatus === 'SAME_ROM' && (
                        <div className="netplay-status-badge same">{t('SAME ROM')}</div>
                      )}
                      {matchStatus === 'DIFFERENT_ROM' && (
                        <div className="netplay-status-badge diff">{t('DIFFERENT ROM')}</div>
                      )}
                      {matchStatus === 'UNAVAILABLE' && (
                        <div className="netplay-status-badge missing">{t('UNAVAILABLE')}</div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              )
            })}
          </div>
        )}

        <div className="netplay-lobby-footer">
          <div className="netplay-lobby-help">
            <div className="netplay-help-item">
              <span className="netplay-help-btn">X / Enter</span> {t('JOIN GAME')}
            </div>
            <div className="netplay-help-item">
              <span className="netplay-help-btn">Q</span> {t('WATCH GAME')}
            </div>
            <div className="netplay-help-item">
              <span className="netplay-help-btn">S</span> {t('REFRESH')}
            </div>
            <div className="netplay-help-item">
              <span className="netplay-help-btn">O / ESC</span> {t('CLOSE')}
            </div>
          </div>

          <div className="netplay-lobby-buttons">
            <button
              className={`riescade-button ${
                focusedPart === 'buttons' && buttonIndex === 0 ? 'active' : ''
              }`}
              onClick={fetchRooms}
            >
              {t('REFRESH')}
            </button>
            <button
              className={`riescade-button ${
                focusedPart === 'buttons' && buttonIndex === 1 ? 'active' : ''
              }`}
              onClick={onClose}
            >
              {t('CLOSE')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
