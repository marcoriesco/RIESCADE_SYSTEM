import React, { useState, useEffect, useRef } from 'react'

const MAPPING_ORDER = [
  { id: 'up', label: 'D-PAD UP' },
  { id: 'down', label: 'D-PAD DOWN' },
  { id: 'left', label: 'D-PAD LEFT' },
  { id: 'right', label: 'D-PAD RIGHT' },
  { id: 'start', label: 'START' },
  { id: 'select', label: 'SELECT' },
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'x', label: 'X' },
  { id: 'y', label: 'Y' },
  { id: 'pageup', label: 'LEFT SHOULDER' },
  { id: 'pagedown', label: 'RIGHT SHOULDER' },
  { id: 'l2', label: 'LEFT TRIGGER' },
  { id: 'r2', label: 'RIGHT TRIGGER' },
  { id: 'l3', label: 'LEFT THUMB' },
  { id: 'r3', label: 'RIGHT THUMB' },
  { id: 'joystick1up', label: 'LEFT ANALOG UP' },
  { id: 'joystick1left', label: 'LEFT ANALOG LEFT' },
  { id: 'joystick2up', label: 'RIGHT ANALOG UP' },
  { id: 'joystick2left', label: 'RIGHT ANALOG LEFT' },
  { id: 'hotkey', label: 'HOTKEY' }
]

interface Props {
  onClose: () => void
}

export const InputConfigOverlay: React.FC<Props> = ({ onClose }) => {
  const [phase, setPhase] = useState<'detect' | 'map' | 'done'>('detect')
  const [device, setDevice] = useState<{ id: string, index: number, name: string } | null>(null)
  const [mappingIndex, setMappingIndex] = useState(0)
  const [mappings, setMappings] = useState<Record<string, { type: string, id: number, value: number }>>({})
  
  const detectRef = useRef<number>(0)
  const previousState = useRef<Gamepad | null>(null)
  const holdingState = useRef<{ button: number, time: number } | null>(null)

  useEffect(() => {
    let animationFrame: number

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads()
      let activePad: Gamepad | null = null

      if (phase === 'detect') {
        for (const pad of gamepads) {
          if (!pad) continue
          const pressedIndex = pad.buttons.findIndex(b => b.pressed)
          if (pressedIndex !== -1) {
             if (!holdingState.current) {
                holdingState.current = { button: pressedIndex, time: Date.now() }
             } else if (holdingState.current.button === pressedIndex) {
                if (Date.now() - holdingState.current.time > 1500) {
                   setDevice({ id: pad.id, index: pad.index, name: pad.id })
                   setPhase('map')
                   holdingState.current = null
                   previousState.current = null
                   break
                }
             }
          } else {
             holdingState.current = null
          }
        }
      } else if (phase === 'map' && device) {
        const pad = gamepads[device.index]
        if (pad) {
          if (previousState.current) {
             // check buttons
             for (let i = 0; i < pad.buttons.length; i++) {
                if (pad.buttons[i].pressed && !previousState.current.buttons[i].pressed) {
                   handleInput('button', i, 1)
                   break
                }
             }
             // check axes
             for (let i = 0; i < pad.axes.length; i++) {
                const val = pad.axes[i]
                const prevVal = previousState.current.axes[i]
                if (Math.abs(val) > 0.5 && Math.abs(prevVal) <= 0.5) {
                   handleInput('axis', i, val > 0 ? 1 : -1)
                   break
                }
             }
          }
          previousState.current = { ...pad, buttons: pad.buttons.map(b => ({ ...b })), axes: [...pad.axes] } as any
        }
      }

      animationFrame = requestAnimationFrame(pollGamepad)
    }

    animationFrame = requestAnimationFrame(pollGamepad)
    return () => cancelAnimationFrame(animationFrame)
  }, [phase, device, mappingIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        if (phase === 'detect') onClose()
        else {
          // skip button
          handleInput('key', 0, 0) // dummy skip
        }
      } else if (e.type === 'keydown' && phase === 'map') {
        // We could also map keyboard here, but focusing on gamepad for now
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, onClose, mappingIndex])

  const handleInput = (type: string, id: number, value: number) => {
    // If skipping (Escape key handled as special case)
    if (type !== 'key') {
      const targetId = MAPPING_ORDER[mappingIndex].id
      setMappings(prev => ({
        ...prev,
        [targetId]: { type, id, value }
      }))
    }

    if (mappingIndex < MAPPING_ORDER.length - 1) {
      setMappingIndex(i => i + 1)
    } else {
      setPhase('done')
      saveConfiguration()
    }
  }

  const saveConfiguration = async () => {
    // We would send this via IPC to index.ts to write to es_input.cfg
    // For now we just close
    console.log('Saved Mappings:', mappings)
    setTimeout(() => onClose(), 1000)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontFamily: 'sans-serif'
    }}>
      {phase === 'detect' && (
        <div style={{ textAlign: 'center' }}>
          <h2>CONFIGURING</h2>
          <p>HOLD ANY BUTTON ON YOUR DEVICE TO CONFIGURE IT.</p>
          <p style={{ color: '#888', marginTop: 20 }}>PRESS ESC TO CANCEL</p>
        </div>
      )}

      {phase === 'map' && device && (
        <div style={{ textAlign: 'center', width: '50%' }}>
          <h2>CONFIGURING: {device.name.substring(0, 30)}</h2>
          <div style={{
            background: '#222', padding: 20, margin: '20px 0',
            border: '2px solid #555', borderRadius: 8
          }}>
            <h3 style={{ margin: 0, color: '#f042b0' }}>
              PRESS {MAPPING_ORDER[mappingIndex].label}
            </h3>
          </div>
          <p style={{ color: '#888' }}>PRESS ESC TO SKIP THIS BUTTON</p>
        </div>
      )}

      {phase === 'done' && (
        <h2>CONFIGURATION SAVED!</h2>
      )}
    </div>
  )
}