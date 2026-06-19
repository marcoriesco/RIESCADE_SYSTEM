import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, Flex, Heading, Text, TextField, Button, Box } from '@radix-ui/themes'
import { VirtualKeyboard } from './VirtualKeyboard'

interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
  searchQuery: string
  onSearch: (query: string) => void
  onClear: () => void
  isGamelist: boolean
  hasResults: boolean
  settings?: any
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
  isOpen,
  onClose,
  searchQuery,
  onSearch,
  onClear,
  isGamelist,
  hasResults,
  settings
}) => {
  const useOSK = settings?.UseOSK?.value !== 'false' && settings?.UseOSK?.value !== false

  if (useOSK && isOpen) {
    return (
      <VirtualKeyboard
        isOpen={isOpen}
        onClose={onClose}
        title={isGamelist ? 'BUSCAR JOGOS' : 'BUSCAR SISTEMAS'}
        value={searchQuery}
        onConfirm={(val) => {
          onSearch(val)
          onClose()
        }}
      />
    )
  }

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
          e.stopPropagation()
          setActiveRow(1)
          setSelectedButtonIndex(0)
          inputRef.current?.blur()
        } else if (e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          onClose() // OK
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          handleCancel() // Revert & close
        }
      } else if (activeRow === 1) {
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          e.stopPropagation()
          setActiveRow(0)
          setTimeout(() => inputRef.current?.focus(), 50)
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          e.stopPropagation()
          setSelectedButtonIndex((prev) => (prev - 1 + 3) % 3)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          e.stopPropagation()
          setSelectedButtonIndex((prev) => (prev + 1) % 3)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          handleConfirmButton()
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault()
          e.stopPropagation()
          handleCancel() // Revert & close
        }
      }
    },
    [isOpen, activeRow, selectedButtonIndex, handleCancel, handleConfirmButton, onClose]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) handleCancel(); }}>
      <Dialog.Content 
        size="3" 
        className="riescade-menu"
        style={{
          maxWidth: '480px'
        }}
      >
        <Flex className="riescade-menu-header">
          <Heading size="4" className="riescade-menu-title">
            {isGamelist ? 'BUSCAR JOGOS' : 'BUSCAR SISTEMAS'}
          </Heading>
        </Flex>

        <Box className="riescade-menu-content">
          <Box mb="4">
            <TextField.Root
              ref={inputRef}
              type="text"
              placeholder="DIGITE SUA PESQUISA..."
              value={tempQuery}
              onChange={handleInputChange}
              size="3"
              style={{
                outline: activeRow === 0 ? '2px solid var(--theme-color)' : 'none',
                border: activeRow === 0 ? '1px solid transparent' : '1px solid rgba(255,255,255,0.2)'
              }}
            />
          </Box>

          {!hasResults && (
            <Box mb="4" style={{ textAlign: 'center' }}>
              <Text size="2" color="red" weight="bold">
                {isGamelist ? 'NENHUM JOGO ENCONTRADO' : 'NENHUM SISTEMA ENCONTRADO'}
              </Text>
            </Box>
          )}
        </Box>

        <Flex className="riescade-menu-footer">
          <Button
            variant={activeRow === 1 && selectedButtonIndex === 0 ? "solid" : "soft"}
            color={activeRow === 1 && selectedButtonIndex === 0 ? undefined : "gray"}
            onClick={onClose}
          >
            OK
          </Button>
          <Button
            variant={activeRow === 1 && selectedButtonIndex === 1 ? "solid" : "soft"}
            color={activeRow === 1 && selectedButtonIndex === 1 ? undefined : "gray"}
            onClick={handleCancel}
          >
            CANCELAR
          </Button>
          <Button
            variant={activeRow === 1 && selectedButtonIndex === 2 ? "solid" : "soft"}
            color={activeRow === 1 && selectedButtonIndex === 2 ? undefined : "gray"}
            onClick={() => {
              setTempQuery('')
              onClear()
              setActiveRow(0)
              setTimeout(() => inputRef.current?.focus(), 50)
            }}
          >
            LIMPAR
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
