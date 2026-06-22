import React, { useState, useEffect, useCallback } from 'react'
import { Dialog, Heading, TextField, Grid, Button, Flex } from '@radix-ui/themes'

interface VirtualKeyboardProps {
  isOpen: boolean
  onClose: () => void
  title: string
  value: string
  onConfirm: (val: string) => void
  isPassword?: boolean
}

const gridMapping: string[][] = [
  // Row 0
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '_', '+', 'BACKSPACE'],
  // Row 1
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '{', '}', 'OK'],
  // Row 2
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', '"', '|', 'OK'],
  // Row 3
  ['~', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '?', '...', '...'],
  // Row 4
  ['SHIFT', 'SHIFT', 'SPACE', 'SPACE', 'SPACE', 'SPACE', 'SPACE', 'SPACE', 'RESET', 'RESET', 'CANCEL', 'CANCEL', 'CANCEL']
]

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  isOpen,
  onClose,
  title,
  value,
  onConfirm,
  isPassword = false
}) => {
  const [val, setVal] = useState(value)
  const [layout, setLayout] = useState<'lower' | 'upper' | 'symbols'>('lower')
  const [gridPos, setGridPos] = useState({ row: 1, col: 0 }) // Focus starts on 'q'

  useEffect(() => {
    if (isOpen) {
      setVal(value)
      setGridPos({ row: 1, col: 0 })
      setLayout('lower')
    }
  }, [isOpen, value])

  const getKeyDisplay = useCallback((keyId: string, currentLayout: 'lower' | 'upper' | 'symbols'): string => {
    if (keyId === 'BACKSPACE') return '⟵'
    if (keyId === 'OK') return '✔'
    if (keyId === 'SHIFT') return '↑'
    if (keyId === 'SPACE') return ''
    if (keyId === 'RESET') return 'REINICIAR'
    if (keyId === 'CANCEL') return 'CANCELAR'
    if (keyId === '...') return '...'

    if (currentLayout === 'upper') {
      const upperMap: Record<string, string> = {
        '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '0': '0', '_': '-', '+': '=',
        'q': 'Q', 'w': 'W', 'e': 'E', 'r': 'R', 't': 'T', 'y': 'Y', 'u': 'U', 'i': 'I', 'o': 'O', 'p': 'P', '{': '[', '}': ']',
        'a': 'A', 's': 'S', 'd': 'D', 'f': 'F', 'g': 'G', 'h': 'H', 'j': 'J', 'k': 'K', 'l': 'L', ';': ':', '"': "'", '|': '\\',
        '~': '`', 'z': 'Z', 'x': 'X', 'c': 'C', 'v': 'V', 'b': 'B', 'n': 'N', 'm': 'M', ',': '<', '.': '>', '?': '/'
      }
      return upperMap[keyId] || keyId
    } else if (currentLayout === 'symbols') {
      const symbolMap: Record<string, string> = {
        '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')', '_': '\\', '+': '/',
        'q': '[', 'w': ']', 'e': '{', 'r': '}', 't': '#', 'y': '%', 'u': '^', 'i': '*', 'o': '+', 'p': '=',
        'a': '-', 's': '/', 'd': ':', 'f': ';', 'g': '(', 'h': ')', 'j': '$', 'k': '&', 'l': '@', ';': '"', '"': '.', '|': ',',
        '~': '_', 'z': '\\', 'x': '|', 'c': '~', 'v': '<', 'b': '>', 'n': '?', 'm': '!', ',': '\'', '.': '"', '?': '`'
      }
      return symbolMap[keyId] || keyId
    }
    return keyId
  }, [])

  const handleKeyPress = useCallback((keyId: string) => {
    window.dispatchEvent(new CustomEvent('riescade-play-nav-sound'))
    
    if (keyId === 'BACKSPACE') {
      setVal(prev => prev.slice(0, -1))
    } else if (keyId === 'OK') {
      onConfirm(val)
    } else if (keyId === 'SHIFT') {
      setLayout(prev => prev === 'lower' ? 'upper' : 'lower')
    } else if (keyId === 'SPACE') {
      setVal(prev => prev + ' ')
    } else if (keyId === 'RESET') {
      setVal('')
    } else if (keyId === 'CANCEL') {
      onClose()
    } else if (keyId === '...') {
      setLayout(prev => prev === 'symbols' ? 'lower' : 'symbols')
    } else {
      const char = getKeyDisplay(keyId, layout)
      setVal(prev => prev + char)
    }
  }, [val, layout, onConfirm, onClose, getKeyDisplay])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return
    e.preventDefault()
    e.stopPropagation()

    const key = e.key.toLowerCase()

    if (key === 'arrowup') {
      setGridPos(prev => {
        let nextRow = (prev.row - 1 + 5) % 5
        return { ...prev, row: nextRow }
      })
    } else if (key === 'arrowdown') {
      setGridPos(prev => {
        let nextRow = (prev.row + 1) % 5
        return { ...prev, row: nextRow }
      })
    } else if (key === 'arrowleft') {
      setGridPos(prev => {
        let nextCol = (prev.col - 1 + 13) % 13
        return { ...prev, col: nextCol }
      })
    } else if (key === 'arrowright') {
      setGridPos(prev => {
        let nextCol = (prev.col + 1) % 13
        return { ...prev, col: nextCol }
      })
    } else if (key === 'enter' || key === ' ' || key === 'x') {
      const activeKey = gridMapping[gridPos.row][gridPos.col]
      handleKeyPress(activeKey)
    } else if (key === 'escape' || key === 'z') {
      onClose()
    } else if (key === 'backspace') {
      handleKeyPress('BACKSPACE')
    } else {
      // Physical key mapping
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setVal(prev => prev + e.key)
      }
    }
  }, [isOpen, gridPos, layout, val, handleKeyPress, onClose])

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown, true)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen, handleKeyDown])

  const activeKeyId = gridMapping[gridPos.row][gridPos.col]

  return (
    <>
      <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <Dialog.Content 
          className="riescade-menu riescade-menu-osk"
          style={{
            maxWidth: '1000px',
            width: '95%',
          }}
        >
          <Flex className='riescade-menu-header' direction="column" align="stretch" gap="4" p="2">
            <Heading className='riescade-menu-title' align="center" size="4">
              {title}
            </Heading>
          
            <TextField.Root 
              type={isPassword ? 'password' : 'text'}
              value={val}
              readOnly
              size="3"
              style={{
                fontSize: '1.7rem',
                fontWeight: 500,
              }}
            >
              <TextField.Slot side="right">
                <span className="riescade-osk-cursor">|</span>
              </TextField.Slot>
            </TextField.Root>

            <Grid columns="13" gap="2">
              {/* Row 0 */}
              {gridMapping[0].map((k, idx) => {
                const isSelected = activeKeyId === k && gridPos.row === 0 && gridPos.col === idx
                return (
                  <Button
                    key={`row0-${idx}`}
                    size="3"
                    className={`riescade-osk-button ${isSelected ? 'selected' : ''}`}
                    variant={isSelected ? "solid" : "soft"}
                    color={isSelected ? undefined : "gray"}
                    onClick={() => handleKeyPress(k)}
                    style={{
                      height: '48px',
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    {getKeyDisplay(k, layout)}
                  </Button>
                )
              })}

              {/* Row 1 */}
              {gridMapping[1].slice(0, 12).map((k, idx) => {
                const isSelected = activeKeyId === k && gridPos.row === 1 && gridPos.col === idx
                return (
                  <Button
                    key={`row1-${idx}`}
                    size="3"
                    className={`riescade-osk-button ${isSelected ? 'selected' : ''}`}
                    variant={isSelected ? "solid" : "soft"}
                    color={isSelected ? undefined : "gray"}
                    onClick={() => handleKeyPress(k)}
                    style={{
                      height: '48px',
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    {getKeyDisplay(k, layout)}
                  </Button>
                )
              })}
              {/* Spanned OK key */}
              <Button
                className={`riescade-osk-button ${activeKeyId === 'OK' ? 'selected' : ''}`}
                size="3"
                variant={activeKeyId === 'OK' ? "solid" : "soft"}
                color={activeKeyId === 'OK' ? undefined : "gray"}
                onClick={() => handleKeyPress('OK')}
                style={{
                  gridColumn: '13',
                  gridRow: 'span 2',
                  height: '104px',
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {getKeyDisplay('OK', layout)}
              </Button>

              {/* Row 2 */}
              {gridMapping[2].slice(0, 12).map((k, idx) => {
                const isSelected = activeKeyId === k && gridPos.row === 2 && gridPos.col === idx
                return (
                  <Button
                    key={`row2-${idx}`}
                    size="3"
                    className={`riescade-osk-button ${isSelected ? 'selected' : ''}`}
                    variant={isSelected ? "solid" : "soft"}
                    color={isSelected ? undefined : "gray"}
                    onClick={() => handleKeyPress(k)}
                    style={{
                      height: '48px',
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    {getKeyDisplay(k, layout)}
                  </Button>
                )
              })}

              {/* Row 3 */}
              {gridMapping[3].slice(0, 11).map((k, idx) => {
                const isSelected = activeKeyId === k && gridPos.row === 3 && gridPos.col === idx
                return (
                  <Button
                    key={`row3-${idx}`}
                    size="3"
                    className={`riescade-osk-button ${isSelected ? 'selected' : ''}`}
                    variant={isSelected ? "solid" : "soft"}
                    color={isSelected ? undefined : "gray"}
                    onClick={() => handleKeyPress(k)}
                    style={{
                      height: '48px',
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    {getKeyDisplay(k, layout)}
                  </Button>
                )
              })}
              {/* Spanned ... key */}
              <Button
                className={`riescade-osk-button ${activeKeyId === '...' ? 'selected' : ''}`}
                size="3"
                variant={activeKeyId === '...' ? "solid" : "soft"}
                color={activeKeyId === '...' ? undefined : "gray"}
                onClick={() => handleKeyPress('...')}
                style={{
                  gridColumn: 'span 2',
                  height: '48px',
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {getKeyDisplay('...', layout)}
              </Button>

              {/* Row 4 */}
              <Button
                className={`riescade-osk-button ${activeKeyId === 'SHIFT' ? 'selected' : ''}`}
                size="3"
                variant={activeKeyId === 'SHIFT' ? "solid" : "soft"}
                color={activeKeyId === 'SHIFT' ? undefined : "gray"}
                onClick={() => handleKeyPress('SHIFT')}
                style={{
                  gridColumn: 'span 2',
                  height: '48px',
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {getKeyDisplay('SHIFT', layout)}
              </Button>
              <Button
                className={`riescade-osk-button ${activeKeyId === 'SPACE' ? 'selected' : ''}`}
                size="3"
                variant={activeKeyId === 'SPACE' ? "solid" : "soft"}
                color={activeKeyId === 'SPACE' ? undefined : "gray"}
                onClick={() => handleKeyPress('SPACE')}
                style={{
                  gridColumn: 'span 6',
                  height: '48px',
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {getKeyDisplay('SPACE', layout)}
              </Button>
              <Button
                className={`riescade-osk-button ${activeKeyId === 'RESET' ? 'selected' : ''}`}
                size="3"
                variant={activeKeyId === 'RESET' ? "solid" : "soft"}
                color={activeKeyId === 'RESET' ? undefined : "gray"}
                onClick={() => handleKeyPress('RESET')}
                style={{
                  gridColumn: 'span 2',
                  height: '48px',
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {getKeyDisplay('RESET', layout)}
              </Button>
              <Button
                className={`riescade-osk-button ${activeKeyId === 'CANCEL' ? 'selected' : ''}`}
                size="3"
                variant={activeKeyId === 'CANCEL' ? "solid" : "soft"}
                color={activeKeyId === 'CANCEL' ? undefined : "gray"}
                onClick={() => handleKeyPress('CANCEL')}
                style={{
                  gridColumn: 'span 3',
                  height: '48px',
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {getKeyDisplay('CANCEL', layout)}
              </Button>
            </Grid>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <style>{`
        .riescade-osk-cursor {
          color: var(--theme-color, #ff0055);
          font-size: 1.7rem;
          font-weight: bold;
          animation: osk-blink 0.8s infinite;
          margin-left: 2px;
        }
        @keyframes osk-blink {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        .riescade-osk-button {
          transition: transform 0.1s ease, box-shadow 0.1s ease;
        }
        .riescade-osk-button:hover,
        .riescade-osk-button.selected {
          transform: scale(1.04) !important;
          box-shadow: 0 0 12px var(--theme-color, #ff0055) !important;
          background-color: var(--theme-color, #ff0055) !important;
          color: #fff !important;
        }
      `}</style>
    </>
  )
}
