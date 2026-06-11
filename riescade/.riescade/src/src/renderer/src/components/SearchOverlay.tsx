import React, { useState, useEffect, useRef, useCallback } from 'react'

interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
  searchQuery: string
  onSearch: (query: string) => void
  onClear: () => void
  isGamelist: boolean
  hasResults: boolean
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
  isOpen,
  onClose,
  searchQuery,
  onSearch,
  onClear,
  isGamelist,
  hasResults
}) => {
  const [activeRow, setActiveRow] = useState<number>(0) // 0: Input, 1: Buttons
  const [selectedButtonIndex, setSelectedButtonIndex] = useState<number>(0) // 0: OK, 1: CANCELAR, 2: LIMPAR
  const [tempQuery, setTempQuery] = useState<string>('')
  const [initialQuery, setInitialQuery] = useState<string>('')
  const [visible, setVisible] = useState<boolean>(false)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTempQuery(searchQuery)
      setInitialQuery(searchQuery)
      setActiveRow(0)
      setSelectedButtonIndex(0)
      requestAnimationFrame(() => {
        setVisible(true)
        // Focus input field on open
        setTimeout(() => inputRef.current?.focus(), 50)
      })
    } else {
      setVisible(false)
    }
  }, [isOpen, searchQuery])

  const handleCancel = useCallback(() => {
    // Revert query to whatever it was before opening the modal
    onSearch(initialQuery)
    onClose()
  }, [initialQuery, onSearch, onClose])

  const handleConfirmButton = useCallback(() => {
    if (selectedButtonIndex === 0) {
      // OK - close and keep active query
      onClose()
    } else if (selectedButtonIndex === 1) {
      // CANCELAR - revert and close
      handleCancel()
    } else if (selectedButtonIndex === 2) {
      // LIMPAR - clear query
      setTempQuery('')
      onClear()
      setActiveRow(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [selectedButtonIndex, handleCancel, onClear, onClose])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setTempQuery(val)
    onSearch(val) // Live filtering
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      if (activeRow === 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setActiveRow(1)
          setSelectedButtonIndex(0)
          inputRef.current?.blur()
        } else if (e.key === 'Enter') {
          e.preventDefault()
          onClose() // OK
        } else if (e.key === 'Escape') {
          e.preventDefault()
          handleCancel() // Revert & close
        }
      } else if (activeRow === 1) {
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setActiveRow(0)
          setTimeout(() => inputRef.current?.focus(), 50)
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setSelectedButtonIndex((prev) => (prev - 1 + 3) % 3)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          setSelectedButtonIndex((prev) => (prev + 1) % 3)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          handleConfirmButton()
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault()
          handleCancel() // Revert & close
        }
      }
    },
    [isOpen, activeRow, selectedButtonIndex, handleCancel, handleConfirmButton, onClose]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!isOpen) return null

  return (
    <div className={`riescade-overlay riescade-menu-overlay search-overlay ${visible ? 'visible' : ''}`}>
      <div className="search-container">
        <div className="search-header">
          <h2 className="search-title">
            {isGamelist ? 'BUSCAR JOGOS' : 'BUSCAR SISTEMAS'}
          </h2>
        </div>

        <div className="search-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className={`search-input ${activeRow === 0 ? 'selected' : ''}`}
            placeholder="DIGITE SUA PESQUISA..."
            value={tempQuery}
            onChange={handleInputChange}
          />
        </div>

        {!hasResults && (
          <div className="search-no-results">
            {isGamelist ? 'NENHUM JOGO ENCONTRADO' : 'NENHUM SISTEMA ENCONTRADO'}
          </div>
        )}

        <div className="search-buttons">
          <button
            className={`riescade-button ${activeRow === 1 && selectedButtonIndex === 0 ? 'selected' : ''}`}
            onClick={() => {
              onClose()
            }}
          >
            OK
          </button>
          <button
            className={`riescade-button ${activeRow === 1 && selectedButtonIndex === 1 ? 'selected' : ''}`}
            onClick={handleCancel}
          >
            CANCELAR
          </button>
          <button
            className={`riescade-button ${activeRow === 1 && selectedButtonIndex === 2 ? 'selected' : ''}`}
            onClick={() => {
              setTempQuery('')
              onClear()
              setActiveRow(0)
              setTimeout(() => inputRef.current?.focus(), 50)
            }}
          >
            LIMPAR
          </button>
        </div>
      </div>
    </div>
  )
}
