import React, { useEffect, useState, useRef } from 'react'
import { Dialog, Box, Flex, Heading, Text, Button, Badge } from '@radix-ui/themes'

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
    ...differentRomRooms,
    ...unavailableRooms
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
          const isRoomSelectable = currentRoom && !!currentRoom.localGame && currentRoom.localGame.matchStatus !== 'UNAVAILABLE'
          if (isRoomSelectable) {
            onLaunchRoom(currentRoom!, 'client')
          }
        } else if (key === 'q') {
          // North button for spectating
          e.preventDefault()
          e.stopPropagation()
          const currentRoom = groupedRooms[selectedIndex]
          const isRoomSelectable = currentRoom && !!currentRoom.localGame && currentRoom.localGame.matchStatus !== 'UNAVAILABLE'
          if (isRoomSelectable) {
            onLaunchRoom(currentRoom!, 'spectator')
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
      const activeItem = listContainerRef.current.querySelector('.riescade-menu-item.selected') as HTMLElement
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      }
    }
  }, [selectedIndex, focusedPart])

  if (!isOpen) return null

  // Helpers to get header offsets for sections
  const getSectionHeaderIndex = (type: 'lan' | 'available' | 'different' | 'unavailable') => {
    if (type === 'lan') return lanRooms.length > 0 ? 0 : -1
    if (type === 'available') return availableRooms.length > 0 ? lanRooms.length : -1
    if (type === 'different') return differentRomRooms.length > 0 ? lanRooms.length + availableRooms.length : -1
    if (type === 'unavailable') return unavailableRooms.length > 0 ? lanRooms.length + availableRooms.length + differentRomRooms.length : -1
    return -1
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Content 
        size="4" 
        className="riescade-menu riescade-menu-netplay"
        style={{
          maxWidth: '800px',
          height: '80vh',
          maxHeight: '700px'
        }}
      >
        <Flex className="riescade-menu-header">
          <Heading size="4" className="riescade-menu-title">
            {t('NETPLAY LOBBY')}
          </Heading>
          <Text size="2" color="gray" mt="1">
            {loading ? t('SEARCHING NETPLAY GAMES...') : t('Select a game lobby to join')}
          </Text>
        </Flex>

        {loading ? (
          <Flex direction="column" align="center" justify="center" p="6" gap="3" style={{ flexGrow: 1 }}>
            <Box className="netplay-spinner" style={{ borderColor: 'var(--theme-color)', borderTopColor: 'transparent' }} />
            <Text size="2" color="gray">{t('SEARCHING NETPLAY GAMES...')}</Text>
          </Flex>
        ) : groupedRooms.length === 0 ? (
          <Flex align="center" justify="center" p="6" style={{ flexGrow: 1 }}>
            <Text size="2" color="gray" weight="bold">{t('NO ACTIVE NETPLAY SESSIONS FOUND')}</Text>
          </Flex>
        ) : (
          <Box className="riescade-menu-content custom-scrollbar" ref={listContainerRef}>
            <Flex direction="column" gap="2">
              {groupedRooms.map((room, idx) => {
                const isSectionStart =
                  idx === getSectionHeaderIndex('lan') ||
                  idx === getSectionHeaderIndex('available') ||
                  idx === getSectionHeaderIndex('different') ||
                  idx === getSectionHeaderIndex('unavailable')

                let sectionTitle = ''
                if (isSectionStart) {
                  if (idx === getSectionHeaderIndex('lan')) sectionTitle = t('LAN GAMES')
                  else if (idx === getSectionHeaderIndex('available')) sectionTitle = t('ONLINE GAMES')
                  else if (idx === getSectionHeaderIndex('different')) sectionTitle = t('DIFFERENT ROM')
                  else if (idx === getSectionHeaderIndex('unavailable')) sectionTitle = t('UNAVAILABLE')
                }

                const isRowActive = focusedPart === 'list' && selectedIndex === idx
                const matchStatus = room.localGame?.matchStatus || 'UNAVAILABLE'
                const isRoomSelectable = !!room.localGame && room.localGame.matchStatus !== 'UNAVAILABLE'
                return (
                  <React.Fragment key={`${room.ip}-${room.port}-${room.username}-${idx}`}>
                    {isSectionStart && (
                      <Text 
                        size="1" 
                        weight="bold" 
                        className="riescade-menu-group"
                      >
                        {sectionTitle}
                      </Text>
                    )}
                    <Box
                      onClick={() => {
                        if (isRoomSelectable) {
                          setSelectedIndex(idx)
                          setFocusedPart('list')
                          onLaunchRoom(room, 'client')
                        }
                      }}
                      className={`riescade-menu-item${isRowActive ? ' selected' : ''}`}
                      style={{
                        cursor: isRoomSelectable ? 'pointer' : 'not-allowed',
                        opacity: isRoomSelectable ? 1 : 0.4,
                      }}
                    >
                      <Flex align="center" gap="3" style={{ flexGrow: 1, overflow: 'hidden' }}>
                        <Box style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {room.localGame?.system?.substring(0, 3).toUpperCase() || 'NET'}
                        </Box>
                        <Flex direction="column" align="start" gap="1" style={{ overflow: 'hidden' }}>
                          <Text weight="bold" size="2" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }}>
                            {room.game_name}
                            {room.has_password && <span style={{ marginLeft: '8px' }}>🔒</span>}
                          </Text>
                          <Flex align="center" gap="2" style={{ fontSize: '0.75rem', opacity: isRowActive ? 0.9 : 0.6 }}>
                            {room.isLan && <Badge color="green">LAN</Badge>}
                            <Text>👤 {room.username}</Text>
                            {room.country && room.country !== 'lan' && <Text>🌐 {room.country.toUpperCase()}</Text>}
                            <Text>💻 {room.frontend}</Text>
                          </Flex>
                        </Flex>
                      </Flex>

                      <Flex align="center" gap="3" style={{ flexShrink: 0 }}>
                        <Flex direction="column" align="end" gap="1">
                          <Text size="1" weight="bold">{room.core_name}</Text>
                          <Text size="1" style={{ opacity: 0.6 }}>RA {room.retroarch_version}</Text>
                        </Flex>

                        <Badge 
                          color={matchStatus === 'SAME_ROM' ? 'green' : matchStatus === 'DIFFERENT_ROM' ? 'yellow' : 'red'}
                          variant="solid"
                        >
                          {matchStatus === 'SAME_ROM' && t('SAME ROM')}
                          {matchStatus === 'DIFFERENT_ROM' && t('DIFFERENT ROM')}
                          {matchStatus === 'UNAVAILABLE' && t('UNAVAILABLE')}
                        </Badge>
                      </Flex>
                    </Box>
                  </React.Fragment>
                )
              })}
            </Flex>
          </Box>
        )}

        <Flex className="riescade-menu-footer" justify="between" align="center">
          <Flex gap="3">
            <Button
              variant={focusedPart === 'buttons' && buttonIndex === 0 ? 'solid' : 'soft'}
              color={focusedPart === 'buttons' && buttonIndex === 0 ? undefined : 'gray'}
              onClick={fetchRooms}
            >
              {t('REFRESH')}
            </Button>
            <Button
              variant={focusedPart === 'buttons' && buttonIndex === 1 ? 'solid' : 'soft'}
              color={focusedPart === 'buttons' && buttonIndex === 1 ? undefined : 'gray'}
              onClick={onClose}
            >
              {t('CLOSE')}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
