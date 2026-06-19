import React, { useState, useEffect, useRef } from 'react'
import { Dialog, Box, Flex, Heading, Text, Card, Button } from '@radix-ui/themes'
import { Game, System } from '../../../shared/types'

interface SaveState {
  slot: number
  path: string
  date: number
  screenshotUrl?: string
}

interface SaveStateManagerProps {
  isOpen: boolean
  onClose: () => void
  onLaunch: (slot?: number) => void
  game: Game
  system: System
}

export const SaveStateManagerOverlay: React.FC<SaveStateManagerProps> = ({
  isOpen,
  onClose,
  onLaunch,
  game,
  system
}) => {
  const [saveStates, setSaveStates] = useState<SaveState[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Scan saves when opened
  useEffect(() => {
    if (!isOpen) return

    setLoading(true)
    setSelectedIndex(0)
    window.api
      .scanSaveStates(system.name, game.path)
      .then((states) => {
        setSaveStates(states || [])
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to scan save states:', err)
        setSaveStates([])
        setLoading(false)
      })
  }, [isOpen, game, system])

  // Sound feedback on navigation
  const playNavSound = () => {
    window.dispatchEvent(new CustomEvent('riescade-play-nav-sound'))
  }

  interface MenuOption {
    type: 'action' | 'save'
    id: string
    label: string
    slot: number
    date?: number
    screenshotUrl?: string
  }

  // Memoize options to keep references stable
  const options = React.useMemo<MenuOption[]>(() => {
    const list: MenuOption[] = []
    
    // Always include "INICIAR NOVO JOGO"
    list.push({
      type: 'action',
      id: 'new_game',
      label: 'INICIAR NOVO JOGO',
      slot: -2
    })

    if (saveStates.length === 0) {
      // If no save states exist, add "INICIAR NOVO SALVAMENTO AUTOMÁTICO"
      list.push({
        type: 'action',
        id: 'new_autosave',
        label: 'INICIAR NOVO SALVAMENTO AUTOMÁTICO',
        slot: -1
      })
    } else {
      // If save states exist, list them
      saveStates.forEach((save) => {
        list.push({
          type: 'save',
          id: `save_slot_${save.slot}`,
          label: save.slot === -1 ? 'SALVAMENTO AUTOMÁTICO' : `ESPAÇO DE SALVAMENTO ${save.slot}`,
          slot: save.slot,
          date: save.date,
          screenshotUrl: save.screenshotUrl
        })
      })
    }

    return list
  }, [saveStates])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || loading) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const totalOptions = options.length

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => {
          const next = (prev - 1 + totalOptions) % totalOptions
          playNavSound()
          return next
        })
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => {
          const next = (prev + 1) % totalOptions
          playNavSound()
          return next
        })
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        confirmSelection()
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, loading, options, selectedIndex])

  // Center the focused card in the viewport
  useEffect(() => {
    if (!containerRef.current) return
    const children = containerRef.current.children
    const activeChild = children[selectedIndex] as HTMLElement
    if (activeChild) {
      activeChild.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      })
    }
  }, [selectedIndex])

  const confirmSelection = () => {
    const selectedOption = options[selectedIndex]
    if (selectedOption) {
      onLaunch(selectedOption.slot)
    }
  }

  // Format date
  const formatDate = (timestamp: number) => {
    try {
      const date = new Date(timestamp)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${day}/${month}/${year} ${hours}:${minutes}`
    } catch {
      return ''
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Content 
        size="4" 
        className="riescade-menu"
        style={{
          maxWidth: '85vw',
          width: '900px'
        }}
      >
        <Flex className="riescade-menu-header">
          <Heading size="4" className="riescade-menu-title">
            GERENCIADOR DE ESTADOS DE SALVAMENTO
          </Heading>
        </Flex>

        {loading ? (
          <Flex justify="center" p="6" className="riescade-menu-content">
            <Text size="3" color="gray">Carregando salvamentos...</Text>
          </Flex>
        ) : (
          <Box className="riescade-menu-content custom-scrollbar" style={{ overflowX: 'auto', overflowY: 'hidden', padding: '15px 5px' }}>
            <Flex
              ref={containerRef}
              direction="row"
              gap="4"
              align="center"
              style={{
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {options.map((option, index) => {
                const isSelected = selectedIndex === index

                if (option.type === 'action') {
                  return (
                    <Card
                      key={option.id}
                      onClick={() => {
                        setSelectedIndex(index)
                        onLaunch(option.slot)
                      }}
                      style={{
                        minWidth: '240px',
                        height: '180px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        cursor: 'pointer',
                        scrollSnapAlign: 'center',
                        backgroundColor: isSelected ? 'var(--theme-color)' : 'rgba(255,255,255,0.03)',
                        color: isSelected ? '#fff' : 'rgba(255, 255, 255, 0.7)',
                        border: isSelected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Flex direction="column" align="center" justify="center" gap="3">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          width="48"
                          height="48"
                          fill="currentColor"
                        >
                          <path d="M10 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11.1z" />
                        </svg>
                        <Text weight="bold" size="2" style={{ textAlign: 'center', textTransform: 'uppercase' }}>
                          {option.label}
                        </Text>
                      </Flex>
                    </Card>
                  )
                }

                return (
                  <Card
                    key={option.id}
                    onClick={() => {
                      setSelectedIndex(index)
                      onLaunch(option.slot)
                    }}
                    style={{
                      minWidth: '240px',
                      height: '180px',
                      padding: 0,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      scrollSnapAlign: 'center',
                      backgroundColor: isSelected ? 'var(--theme-color)' : 'rgba(255,255,255,0.03)',
                      color: isSelected ? '#fff' : 'rgba(255, 255, 255, 0.7)',
                      border: isSelected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {option.screenshotUrl ? (
                      <Flex direction="column" style={{ height: '100%' }}>
                        <Box
                          style={{
                            height: '120px',
                            backgroundImage: `url("${option.screenshotUrl}")`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                          }}
                        />
                        <Flex direction="column" p="2" gap="1" style={{ flexGrow: 1, background: isSelected ? 'transparent' : 'rgba(0,0,0,0.4)' }}>
                          <Text weight="bold" size="1" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {option.label}
                          </Text>
                          <Text size="1" style={{ opacity: 0.6 }}>
                            {formatDate(option.date || 0)}
                          </Text>
                        </Flex>
                      </Flex>
                    ) : (
                      <Flex direction="column" justify="center" align="center" p="4" style={{ height: '100%', textAlign: 'center' }}>
                        <Text weight="bold" size="2" mb="2">
                          {option.label}
                        </Text>
                        <Text size="1" style={{ opacity: 0.6 }}>
                          {formatDate(option.date || 0)}
                        </Text>
                      </Flex>
                    )}
                  </Card>
                )
              })}
            </Flex>
          </Box>
        )}

        <Flex className="riescade-menu-footer-bar" justify="between" align="center">
          <Flex align="center" gap="1" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <Button size="1" variant="solid" color="gray" className="riescade-menu-footer-btn">B</Button>
            <Text size="1">BACK</Text>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
