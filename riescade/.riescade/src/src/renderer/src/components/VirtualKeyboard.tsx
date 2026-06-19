import React, { useState, useEffect, useCallback } from 'react'
import { Dialog } from '@radix-ui/themes'

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
          className="riescade-menu riescade-osk-container"
          style={{
            maxWidth: '1000px',
            width: '95%',
          }}
        >
          <h3 className="riescade-osk-title">{title}</h3>
        
        <div className="riescade-osk-input-wrapper">
          <input 
            type={isPassword ? 'password' : 'text'}
            className="riescade-osk-input"
            value={val}
            readOnly
          />
          <span className="riescade-osk-cursor">|</span>
        </div>

        <div className="riescade-osk-grid">
          {/* Row 0 */}
          {gridMapping[0].map((k, idx) => (
            <div
              key={`row0-${idx}`}
              className={`riescade-osk-key ${activeKeyId === k && gridPos.row === 0 && gridPos.col === idx ? 'selected' : ''}`}
              onClick={() => handleKeyPress(k)}
            >
              {getKeyDisplay(k, layout)}
            </div>
          ))}

          {/* Row 1 */}
          {gridMapping[1].slice(0, 12).map((k, idx) => (
            <div
              key={`row1-${idx}`}
              className={`riescade-osk-key ${activeKeyId === k && gridPos.row === 1 && gridPos.col === idx ? 'selected' : ''}`}
              onClick={() => handleKeyPress(k)}
            >
              {getKeyDisplay(k, layout)}
            </div>
          ))}
          {/* Spanned OK key */}
          <div
            className={`riescade-osk-key ok-key ${activeKeyId === 'OK' ? 'selected' : ''}`}
            onClick={() => handleKeyPress('OK')}
          >
            {getKeyDisplay('OK', layout)}
          </div>

          {/* Row 2 */}
          {gridMapping[2].slice(0, 12).map((k, idx) => (
            <div
              key={`row2-${idx}`}
              className={`riescade-osk-key ${activeKeyId === k && gridPos.row === 2 && gridPos.col === idx ? 'selected' : ''}`}
              onClick={() => handleKeyPress(k)}
            >
              {getKeyDisplay(k, layout)}
            </div>
          ))}

          {/* Row 3 */}
          {gridMapping[3].slice(0, 11).map((k, idx) => (
            <div
              key={`row3-${idx}`}
              className={`riescade-osk-key ${activeKeyId === k && gridPos.row === 3 && gridPos.col === idx ? 'selected' : ''}`}
              onClick={() => handleKeyPress(k)}
            >
              {getKeyDisplay(k, layout)}
            </div>
          ))}
          {/* Spanned ... key */}
          <div
            className={`riescade-osk-key span-2 ${activeKeyId === '...' ? 'selected' : ''}`}
            onClick={() => handleKeyPress('...')}
          >
            {getKeyDisplay('...', layout)}
          </div>

          {/* Row 4 */}
          <div
            className={`riescade-osk-key span-2 ${activeKeyId === 'SHIFT' ? 'selected' : ''}`}
            onClick={() => handleKeyPress('SHIFT')}
          >
            {getKeyDisplay('SHIFT', layout)}
          </div>
          <div
            className={`riescade-osk-key span-6 ${activeKeyId === 'SPACE' ? 'selected' : ''}`}
            onClick={() => handleKeyPress('SPACE')}
          >
            {getKeyDisplay('SPACE', layout)}
          </div>
          <div
            className={`riescade-osk-key span-2 ${activeKeyId === 'RESET' ? 'selected' : ''}`}
            onClick={() => handleKeyPress('RESET')}
          >
            {getKeyDisplay('RESET', layout)}
          </div>
          <div
            className={`riescade-osk-key span-3 ${activeKeyId === 'CANCEL' ? 'selected' : ''}`}
            onClick={() => handleKeyPress('CANCEL')}
          >
            {getKeyDisplay('CANCEL', layout)}
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Root>

    <style>{`
      .riescade-osk-container {
          background: #11141a;
          border: 2px solid #333;
          border-radius: 8px;
          width: 960px;
          padding: 25px 35px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.95);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .riescade-osk-title {
          color: var(--theme-color, #ff0055);
          font-size: 1.5rem;
          font-weight: bold;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin: 0;
        }
        .riescade-osk-input-wrapper {
          background: #fff;
          border-radius: 4px;
          padding: 10px 18px;
          display: flex;
          align-items: center;
          border: 2px solid #555;
          position: relative;
        }
        .riescade-osk-input {
          width: 100%;
          border: none;
          background: transparent;
          color: #000;
          font-size: 1.7rem;
          font-family: inherit;
          outline: none;
          padding: 0;
          margin: 0;
          font-weight: 500;
        }
        .riescade-osk-cursor {
          color: #ff0055;
          font-size: 1.7rem;
          font-weight: bold;
          animation: osk-blink 0.8s infinite;
          margin-left: 2px;
        }
        @keyframes osk-blink {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        .riescade-osk-grid {
          display: grid;
          grid-template-columns: repeat(13, 1fr);
          gap: 7px;
        }
        .riescade-osk-key {
          background: #191c24;
          border: 1px solid #2e3440;
          border-radius: 4px;
          color: #d8dee9;
          font-size: 1.25rem;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-weight: bold;
          user-select: none;
          transition: all 0.1s ease;
        }
        .riescade-osk-key:hover, .riescade-osk-key.selected {
          background: #fff;
          color: #000;
          border-color: #fff;
          transform: scale(1.04);
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.45);
        }
        .riescade-osk-key.ok-key {
          grid-column: 13;
          grid-row: span 2;
          height: 103px;
          background: #2b303c;
        }
        .riescade-osk-key.span-2 {
          grid-column: span 2;
        }
        .riescade-osk-key.span-6 {
          grid-column: span 6;
        }
        .riescade-osk-key.span-3 {
          grid-column: span 3;
        }
        @keyframes osk-fade-in {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  )
}
