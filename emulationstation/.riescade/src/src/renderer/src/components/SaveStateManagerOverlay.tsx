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
    <div className="savestate-overlay">

      {/* Header Title */}
      <h1 className="savestate-header-title">
        GERENCIADOR DE ESTADOS DE SALVAMENTO
      </h1>

      {loading ? (
        <div className="savestate-loading">Carregando salvamentos...</div>
      ) : (
        /* Horizontal Cards Container */
        <div
          ref={containerRef}
          className="savestate-scroll"
        >
          {options.map((option, index) => {
            const isSelected = selectedIndex === index

            if (option.type === 'action') {
              return (
                <div
                  key={option.id}
                  className={`savestate-card action-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedIndex(index)
                    onLaunch(option.slot)
                  }}
                >
                  {/* Centered Curved Arrow Icon */}
                  <div className="savestate-card-icon-container">
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
                  <div className="savestate-card-label">
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
                      className="savestate-card-screenshot"
                      style={{
                        backgroundImage: `url("${option.screenshotUrl}")`
                      }}
                    />
                    {/* Details Footer */}
                    <div className="savestate-card-details">
                      <div className="savestate-card-details-title">
                        {option.label}
                      </div>
                      <div className="savestate-card-details-date">
                        {formatDate(option.date || 0)}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Elegant full-card gradient containing the save metadata directly (No placeholder icon/separate footer) */
                  <div className="savestate-card-gradient">
                    <div className="savestate-card-gradient-title">
                      {option.label}
                    </div>
                    <div className="savestate-card-details-date">
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
