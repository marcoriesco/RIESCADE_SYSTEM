import React, { useState, useEffect, useRef } from 'react'
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
        setSelectedIndex((prev) => {
          const next = (prev - 1 + totalOptions) % totalOptions
          playNavSound()
          return next
        })
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setSelectedIndex((prev) => {
          const next = (prev + 1) % totalOptions
          playNavSound()
          return next
        })
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        confirmSelection()
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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

  if (!isOpen) return null

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
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'savestate-fadein 0.25s ease-out',
        userSelect: 'none'
      }}
    >
      {/* Dynamic Keyframes Animation Injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes savestate-fadein {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes savestate-pulse {
          0% { box-shadow: 0 0 10px rgba(186, 12, 70, 0.4); }
          50% { box-shadow: 0 0 25px rgba(186, 12, 70, 0.9); }
          100% { box-shadow: 0 0 10px rgba(186, 12, 70, 0.4); }
        }
        .savestate-card {
          position: relative;
          width: 250px;
          height: 350px;
          border-radius: 16px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          flex-shrink: 0;
        }
        .savestate-card.selected {
          border-color: #ba0c46;
          animation: savestate-pulse 1.8s infinite;
        }
        .savestate-card:hover {
          border-color: rgba(255, 255, 255, 0.2);
        }
        .savestate-card.selected:hover {
          border-color: #ba0c46;
        }
        .savestate-scroll::-webkit-scrollbar {
          height: 8px;
        }
        .savestate-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 4px;
        }
        .savestate-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 4px;
        }
        .savestate-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
      `}} />

      {/* Header Title */}
      <h1
        style={{
          color: '#ba0c46',
          fontSize: '2rem',
          fontWeight: 900,
          letterSpacing: '3px',
          textAlign: 'center',
          marginBottom: '50px',
          textTransform: 'uppercase',
          textShadow: '0 2px 10px rgba(186, 12, 70, 0.3)',
          fontFamily: "'Inter', sans-serif"
        }}
      >
        GERENCIADOR DE ESTADOS DE SALVAMENTO
      </h1>

      {loading ? (
        <div style={{ color: '#fff', fontSize: '1.2rem', opacity: 0.7 }}>Carregando salvamentos...</div>
      ) : (
        /* Horizontal Cards Container */
        <div
          ref={containerRef}
          className="savestate-scroll"
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '30px',
            maxWidth: '90%',
            overflowX: 'auto',
            padding: '30px 40px',
            scrollBehavior: 'smooth',
            alignItems: 'center'
          }}
        >
          {options.map((option, index) => {
            const isSelected = selectedIndex === index

            if (option.type === 'action') {
              return (
                <div
                  key={option.id}
                  className={`savestate-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedIndex(index)
                    onLaunch(option.slot)
                  }}
                  style={{
                    background: isSelected ? '#ba0c46' : 'rgba(255, 255, 255, 0.05)'
                  }}
                >
                  {/* Centered Curved Arrow Icon */}
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSelected ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                      transition: 'color 0.2s ease'
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      width="72"
                      height="72"
                      fill="currentColor"
                    >
                      <path d="M10 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11.1z" />
                    </svg>
                  </div>

                  {/* Clean card label */}
                  <div
                    style={{
                      padding: '24px 20px',
                      textAlign: 'center',
                      color: isSelected ? '#fff' : 'rgba(255, 255, 255, 0.7)',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      lineHeight: '1.3',
                      minHeight: '80px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.2s ease',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word'
                    }}
                  >
                    {option.label}
                  </div>
                </div>
              )
            }

            // Otherwise, it is a save state card (type === 'save')
            return (
              <div
                key={option.id}
                className={`savestate-card ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedIndex(index)
                  onLaunch(option.slot)
                }}
              >
                {/* Screenshot or Fallback Gradient */}
                {option.screenshotUrl ? (
                  <>
                    <div
                      style={{
                        height: '65%',
                        width: '100%',
                        backgroundImage: `url("${option.screenshotUrl}")`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                      }}
                    />
                    {/* Details Footer */}
                    <div
                      style={{
                        height: '35%',
                        padding: '15px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        background: 'rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      <div
                        style={{
                          color: isSelected ? '#ba0c46' : '#fff',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          letterSpacing: '1px',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          transition: 'color 0.2s ease'
                        }}
                      >
                        {option.label}
                      </div>
                      <div
                        style={{
                          color: 'rgba(255, 255, 255, 0.5)',
                          fontSize: '0.75rem',
                          fontFamily: "'Courier New', Courier, monospace"
                        }}
                      >
                        {formatDate(option.date || 0)}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Elegant full-card gradient containing the save metadata directly (No placeholder icon/separate footer) */
                  <div
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #1c020c, #480520, #6e0830)',
                      padding: '24px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      height: '100%'
                    }}
                  >
                    <div
                      style={{
                        color: isSelected ? '#ff4d80' : '#fff',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                        lineHeight: '1.4',
                        transition: 'color 0.2s ease',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        textShadow: isSelected ? '0 0 10px rgba(255, 77, 128, 0.5)' : 'none'
                      }}
                    >
                      {option.label}
                    </div>
                    <div
                      style={{
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontSize: '0.75rem',
                        fontFamily: "'Courier New', Courier, monospace"
                      }}
                    >
                      {formatDate(option.date || 0)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
