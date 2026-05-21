import React, { useState, useEffect, useRef } from 'react'

const MAPPING_ORDER = [
  { id: 'a', label: 'SOUTH', icon: 'south' },
  { id: 'b', label: 'EAST', icon: 'east' },
  { id: 'x', label: 'NORTH', icon: 'north' },
  { id: 'y', label: 'WEST', icon: 'west' },
  { id: 'start', label: 'START', icon: 'start' },
  { id: 'select', label: 'SELECT', icon: 'select' },
  { id: 'up', label: 'D-PAD UP', icon: 'dpad-up' },
  { id: 'down', label: 'D-PAD DOWN', icon: 'dpad-down' },
  { id: 'left', label: 'D-PAD LEFT', icon: 'dpad-left' },
  { id: 'right', label: 'D-PAD RIGHT', icon: 'dpad-right' },
  { id: 'pageup', label: 'LEFT SHOULDER', icon: 'shoulder-left' },
  { id: 'pagedown', label: 'RIGHT SHOULDER', icon: 'shoulder-right' },
  { id: 'joystick1up', label: 'LEFT ANALOG UP', icon: 'analog-l-up' },
  { id: 'joystick1left', label: 'LEFT ANALOG LEFT', icon: 'analog-l-left' },
  { id: 'joystick2up', label: 'RIGHT ANALOG UP', icon: 'analog-r-up' },
  { id: 'joystick2left', label: 'RIGHT ANALOG LEFT', icon: 'analog-r-left' },
  { id: 'l2', label: 'LEFT TRIGGER', icon: 'trigger-left' },
  { id: 'r2', label: 'RIGHT TRIGGER', icon: 'trigger-right' },
  { id: 'l3', label: 'LEFT STICK PRESS', icon: 'stick-press-l' },
  { id: 'r3', label: 'RIGHT STICK PRESS', icon: 'stick-press-r' },
  { id: 'hotkey', label: 'HOTKEY', icon: 'hotkey' }
]

// Convert browser gamepad standard inputs to standard SDL2/XInput indexes
const convertBrowserToSdl = (type: string, id: number, value: number) => {
  if (type === 'button') {
    switch (id) {
      case 0: return { type: 'button', id: 0, value: 1 } // South (A/B)
      case 1: return { type: 'button', id: 1, value: 1 } // East (B/A)
      case 2: return { type: 'button', id: 2, value: 1 } // West (X/Y)
      case 3: return { type: 'button', id: 3, value: 1 } // North (Y/X)
      case 4: return { type: 'button', id: 4, value: 1 } // LB
      case 5: return { type: 'button', id: 5, value: 1 } // RB
      case 6: return { type: 'axis', id: 4, value: 1 }   // LT (mapped as SDL Axis 4)
      case 7: return { type: 'axis', id: 5, value: 1 }   // RT (mapped as SDL Axis 5)
      case 8: return { type: 'button', id: 6, value: 1 } // Back/Select
      case 9: return { type: 'button', id: 7, value: 1 } // Start
      case 10: return { type: 'button', id: 8, value: 1 } // Left Stick Click
      case 11: return { type: 'button', id: 9, value: 1 } // Right Stick Click
      case 12: return { type: 'hat', id: 0, value: 1 }    // D-Pad Up
      case 13: return { type: 'hat', id: 0, value: 4 }    // D-Pad Down
      case 14: return { type: 'hat', id: 0, value: 8 }    // D-Pad Left
      case 15: return { type: 'hat', id: 0, value: 2 }    // D-Pad Right
      default: return { type: 'button', id, value: 1 }
    }
  } else if (type === 'axis') {
    // LeftStick X (0), LeftStick Y (1), RightStick X (2), RightStick Y (3) map directly
    return { type: 'axis', id, value }
  }
  return { type, id, value }
}

const getGamepadGuid = (pad: Gamepad): string => {
  const id = pad.id
  const vMatch = id.match(/vendor: ([0-9a-f]{4})/i)
  const pMatch = id.match(/product: ([0-9a-f]{4})/i)
  if (vMatch && pMatch) {
    const v = vMatch[1]
    const p = pMatch[1]
    const vSwap = v.substring(2, 4) + v.substring(0, 2)
    const pSwap = p.substring(2, 4) + p.substring(0, 2)
    return `03000000${vSwap}0000${pSwap}000000000000`.toLowerCase()
  }
  if (id.toLowerCase().includes('xinput') || id.toLowerCase().includes('xbox 360')) {
    return '030000005e0400008e02000000007200'
  }
  return id
}

const formatMappingValue = (mapping: { type: string, id: number, value: number }) => {
  if (mapping.type === 'button') {
    return `BUTTON ${mapping.id}`
  } else if (mapping.type === 'hat') {
    const dir = mapping.value === 1 ? 'UP' : mapping.value === 4 ? 'DOWN' : mapping.value === 8 ? 'LEFT' : 'RIGHT'
    return `HAT ${mapping.id} ${dir}`
  } else if (mapping.type === 'axis') {
    return `AXIS ${mapping.id}${mapping.value > 0 ? '+' : '-'}`
  }
  return '-NOT DEFINED-'
}

interface Props {
  onClose: () => void
}

export const InputConfigOverlay: React.FC<Props> = ({ onClose }) => {
  const [phase, setPhase] = useState<'warning' | 'detect' | 'map' | 'done'>('warning')
  const [device, setDevice] = useState<{ id: string, index: number, name: string } | null>(null)
  const [numGamepads, setNumGamepads] = useState(0)
  
  // Dialog OK/CANCEL selection in warning and map-done states
  const [warningSelection, setWarningSelection] = useState<'ok' | 'cancel'>('ok')
  const [doneSelection, setDoneSelection] = useState<'ok' | 'cancel'>('ok')
  
  // Remapping state
  const [mappingIndex, setMappingIndex] = useState(0)
  const [mappings, setMappings] = useState<Record<string, { type: string, id: number, value: number }>>({})
  const [alreadyTakenIndex, setAlreadyTakenIndex] = useState<number | null>(null)
  const [skipProgress, setSkipProgress] = useState(0) // Visual progress feedback for hold-to-skip

  // Ref-based state mirrors to bypass React stale closures in animation loops
  const phaseRef = useRef<'warning' | 'detect' | 'map' | 'done'>('warning')
  const deviceRef = useRef<{ id: string, index: number, name: string } | null>(null)
  const mappingsRef = useRef<Record<string, { type: string, id: number, value: number }>>({})
  const mappingIndexRef = useRef(0)
  const warningSelectionRef = useRef<'ok' | 'cancel'>('ok')
  const doneSelectionRef = useRef<'ok' | 'cancel'>('ok')
  const alreadyTakenIndexRef = useRef<number | null>(null)

  // Hold states
  const detectionHold = useRef<{ index: number, startTime: number } | null>(null)
  const activePressState = useRef<{ type: string, id: number, value: number, startTime: number } | null>(null)
  const previousState = useRef<Gamepad | null>(null)
  const lastInputTime = useRef<number>(0)
  
  // Element Refs for Auto-scrolling
  const listContainerRef = useRef<HTMLDivElement | null>(null)
  const activeRowRef = useRef<HTMLDivElement | null>(null)

  // Set attribute to block background hotkeys
  useEffect(() => {
    const currentVal = parseInt(document.body.getAttribute('data-input-config-active') || '0', 10)
    document.body.setAttribute('data-input-config-active', String(currentVal + 1))
    return () => {
      setTimeout(() => {
        const newVal = Math.max(0, parseInt(document.body.getAttribute('data-input-config-active') || '1', 10) - 1)
        if (newVal === 0) {
          document.body.removeAttribute('data-input-config-active')
        } else {
          document.body.setAttribute('data-input-config-active', String(newVal))
        }
      }, 400)
    }
  }, [])

  // Sync state helpers
  const setPhaseWithRef = (newPhase: 'warning' | 'detect' | 'map' | 'done') => {
    phaseRef.current = newPhase
    setPhase(newPhase)
  }

  const setDeviceWithRef = (newDevice: { id: string, index: number, name: string } | null) => {
    deviceRef.current = newDevice
    setDevice(newDevice)
  }

  const setMappingsWithRef = (newMappings: Record<string, { type: string, id: number, value: number }>) => {
    mappingsRef.current = newMappings
    setMappings(newMappings)
  }

  const setMappingIndexWithRef = (val: number) => {
    mappingIndexRef.current = val
    setMappingIndex(val)
  }

  // Auto-scroll active row into view
  useEffect(() => {
    if (activeRowRef.current) {
      activeRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [mappingIndex, phase])

  // Poll connected gamepad count
  useEffect(() => {
    const updateCount = () => {
      const pads = navigator.getGamepads().filter(Boolean)
      setNumGamepads(pads.length)
    }
    updateCount()
    const timer = setInterval(updateCount, 1000)
    return () => clearInterval(timer)
  }, [])

  // Game Loop Polling
  useEffect(() => {
    let animationFrame: number

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads()
      const currentPhase = phaseRef.current
      const currentDevice = deviceRef.current

      // Find the active gamepad to track previousState
      let primaryPad: Gamepad | null = null
      if (currentDevice) {
        primaryPad = gamepads[currentDevice.index]
      } else {
        primaryPad = gamepads.find(Boolean) || null
      }

      // Phase 1: Warning Loop (supports navigating OK/CANCEL with D-pad)
      if (currentPhase === 'warning') {
        if (primaryPad) {
          const pad = primaryPad
          const prevPad = previousState.current

          // D-Pad Left/Right or Left Stick Left/Right
          const goLeft = (pad.axes[0] < -0.5 && (!prevPad || prevPad.axes[0] >= -0.5)) ||
                         (pad.buttons[14]?.pressed && (!prevPad || !prevPad.buttons[14]?.pressed))
          const goRight = (pad.axes[0] > 0.5 && (!prevPad || prevPad.axes[0] <= 0.5)) ||
                          (pad.buttons[15]?.pressed && (!prevPad || !prevPad.buttons[15]?.pressed))
          
          if (goLeft) {
            warningSelectionRef.current = 'ok'
            setWarningSelection('ok')
          }
          if (goRight) {
            warningSelectionRef.current = 'cancel'
            setWarningSelection('cancel')
          }

          // South Button Confirm
          if (prevPad && pad.buttons[0]?.pressed && !prevPad.buttons[0]?.pressed) {
            if (warningSelectionRef.current === 'ok') {
              setPhaseWithRef('detect')
            } else {
              onClose()
            }
            lastInputTime.current = Date.now()
          }

          // East Button Cancel (B Button)
          else if (prevPad && pad.buttons[1]?.pressed && !prevPad.buttons[1]?.pressed) {
            onClose()
            lastInputTime.current = Date.now()
          }
        }
      } 
      
      // Phase 2: Detection Loop
      else if (currentPhase === 'detect') {
        let anyPressed = false
        if (primaryPad) {
          const pad = primaryPad
          const prevPad = previousState.current

          // East Button Cancel (B Button)
          if (prevPad && pad.buttons[1]?.pressed && !prevPad.buttons[1]?.pressed) {
            onClose()
            lastInputTime.current = Date.now()
          } else {
            // Find pressed buttons (exclude East button/button 1 if it is a cancel)
            const pressedButton = pad.buttons.findIndex((b, idx) => b.pressed && idx !== 1)
            if (pressedButton !== -1) {
              anyPressed = true
              if (!detectionHold.current || detectionHold.current.index !== pad.index) {
                detectionHold.current = { index: pad.index, startTime: Date.now() }
                setDeviceWithRef({ id: pad.id, index: pad.index, name: pad.id })
              } else {
                const holdDuration = Date.now() - detectionHold.current.startTime
                if (holdDuration > 600) {
                  setPhaseWithRef('map')
                  setMappingIndexWithRef(0)
                  setMappingsWithRef({})
                  detectionHold.current = null
                  activePressState.current = null
                  previousState.current = null
                  lastInputTime.current = Date.now()
                }
              }
            }
          }
        }
        if (!anyPressed) {
          detectionHold.current = null
          setDeviceWithRef(null)
        }
      } 
      
      // Phase 3: Remapping Loop
      else if (currentPhase === 'map' && currentDevice) {
        const pad = primaryPad
        const prevPad = previousState.current

        if (pad) {
          // Enforce input cooldown to avoid bounce/accidental fast forward
          const isCooldown = Date.now() - lastInputTime.current < 350
          if (isCooldown) {
            if (primaryPad) {
              previousState.current = { ...primaryPad, buttons: primaryPad.buttons.map(b => ({ ...b })), axes: [...primaryPad.axes] } as any
            }
            animationFrame = requestAnimationFrame(pollGamepad)
            return
          }

          // Look for active inputs (Buttons and Axes)
          let activeInput: { type: string, id: number, value: number } | null = null

          // 1. Detect Gamepad Buttons (0 to 15)
          for (let i = 0; i < pad.buttons.length; i++) {
            if (pad.buttons[i].pressed) {
              activeInput = { type: 'button', id: i, value: 1 }
              break
            }
          }

          // 2. Detect Gamepad Axes (0 to 3)
          if (!activeInput) {
            for (let i = 0; i < 4; i++) {
              if (Math.abs(pad.axes[i]) > 0.6) {
                activeInput = { type: 'axis', id: i, value: pad.axes[i] > 0 ? 1 : -1 }
                break
              }
            }
          }

          // Tap vs Hold-to-Skip Logic
          if (activeInput) {
            if (!activePressState.current || 
                activePressState.current.type !== activeInput.type || 
                activePressState.current.id !== activeInput.id ||
                (activeInput.type === 'axis' && activePressState.current.value !== activeInput.value)) {
              
              activePressState.current = { ...activeInput, startTime: Date.now() }
              setSkipProgress(0)
            } else {
              const holdDuration = Date.now() - activePressState.current.startTime
              // Visual feedback: progress goes from 0% to 100% over 1 second hold
              setSkipProgress(Math.min(100, (holdDuration / 1000) * 100))

              if (holdDuration > 1000) {
                // HOLD-TO-SKIP TRIGGERED
                activePressState.current = null
                setSkipProgress(0)
                handleSkip()
              }
            }
          } else {
            // Released! Evaluate if it was a quick tap/press
            if (activePressState.current) {
              const duration = Date.now() - activePressState.current.startTime
              if (duration < 500) {
                handleInput(activePressState.current.type, activePressState.current.id, activePressState.current.value)
              }
              activePressState.current = null
              setSkipProgress(0)
            }
          }
        }
      }

      // Phase 4: Save Selection Navigation Loop
      else if (currentPhase === 'done' && currentDevice) {
        const pad = primaryPad
        const prevPad = previousState.current

        if (pad) {
          // Left / Right or D-Pad Left / Right to switch OK/CANCEL
          const goLeft = (pad.axes[0] < -0.5 && (!prevPad || prevPad.axes[0] >= -0.5)) ||
                         (pad.buttons[14]?.pressed && (!prevPad || !prevPad.buttons[14]?.pressed))
          const goRight = (pad.axes[0] > 0.5 && (!prevPad || prevPad.axes[0] <= 0.5)) ||
                          (pad.buttons[15]?.pressed && (!prevPad || !prevPad.buttons[15]?.pressed))

          if (goLeft) {
            doneSelectionRef.current = 'ok'
            setDoneSelection('ok')
          }
          if (goRight) {
            doneSelectionRef.current = 'cancel'
            setDoneSelection('cancel')
          }

          // South button confirmation on finished state
          if (prevPad && pad.buttons[0]?.pressed && !prevPad.buttons[0]?.pressed) {
            if (doneSelectionRef.current === 'ok') {
              saveAndExit()
            } else {
              onClose()
            }
            lastInputTime.current = Date.now()
          }

          // East button cancel (B Button)
          else if (prevPad && pad.buttons[1]?.pressed && !prevPad.buttons[1]?.pressed) {
            onClose()
            lastInputTime.current = Date.now()
          }
        }
      }

      // Consistently update previous state at the end of the frame
      if (primaryPad) {
        previousState.current = {
          ...primaryPad,
          buttons: primaryPad.buttons.map(b => ({ ...b })),
          axes: [...primaryPad.axes]
        } as any
      } else {
        previousState.current = null
      }

      animationFrame = requestAnimationFrame(pollGamepad)
    }

    animationFrame = requestAnimationFrame(pollGamepad)
    return () => cancelAnimationFrame(animationFrame)
  }, [onClose])

  // Handle Keyboard Triggers (ESC / Arrows / Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const currentPhase = phaseRef.current

      if (e.key === 'Escape') {
        if (currentPhase === 'warning' || currentPhase === 'detect') {
          onClose()
        } else if (currentPhase === 'map') {
          handleSkip()
        } else if (currentPhase === 'done') {
          onClose()
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentPhase === 'warning') {
          warningSelectionRef.current = 'ok'
          setWarningSelection('ok')
        } else if (currentPhase === 'done') {
          doneSelectionRef.current = 'ok'
          setDoneSelection('ok')
        }
      } else if (e.key === 'ArrowRight') {
        if (currentPhase === 'warning') {
          warningSelectionRef.current = 'cancel'
          setWarningSelection('cancel')
        } else if (currentPhase === 'done') {
          doneSelectionRef.current = 'cancel'
          setDoneSelection('cancel')
        }
      } else if (e.key === 'Enter') {
        if (currentPhase === 'warning') {
          if (warningSelectionRef.current === 'ok') setPhaseWithRef('detect')
          else onClose()
        } else if (currentPhase === 'done') {
          if (doneSelectionRef.current === 'ok') saveAndExit()
          else onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Handle a successfully validated input mapping
  const handleInput = (type: string, id: number, value: number) => {
    if (alreadyTakenIndexRef.current !== null) return

    const activeKey = MAPPING_ORDER[mappingIndexRef.current]
    const sdlRepresentation = convertBrowserToSdl(type, id, value)

    // DUPLICATE CHECK: Allowed ONLY for hotkey mapping!
    if (activeKey.id !== 'hotkey') {
      const isDuplicate = Object.entries(mappingsRef.current).some(([keyId, existingMapping]) => {
        // Exclude hotkey from standard checks
        if (keyId === 'hotkey') return false
        
        const existingSdl = convertBrowserToSdl(existingMapping.type, existingMapping.id, existingMapping.value)
        return existingSdl.type === sdlRepresentation.type && 
               existingSdl.id === sdlRepresentation.id && 
               existingSdl.value === sdlRepresentation.value
      })

      if (isDuplicate) {
        // Flash ALREADY TAKEN on row
        alreadyTakenIndexRef.current = mappingIndexRef.current
        setAlreadyTakenIndex(mappingIndexRef.current)
        lastInputTime.current = Date.now()
        setTimeout(() => {
          alreadyTakenIndexRef.current = null
          setAlreadyTakenIndex(null)
        }, 1000)
        return
      }
    }

    // Map input and advance
    const updated = {
      ...mappingsRef.current,
      [activeKey.id]: { type, id, value }
    }
    setMappingsWithRef(updated)

    if (mappingIndexRef.current < MAPPING_ORDER.length - 1) {
      setMappingIndexWithRef(mappingIndexRef.current + 1)
      lastInputTime.current = Date.now()
    } else {
      // Completed last mapping - shift focus to OK / CANCEL
      setPhaseWithRef('done')
      lastInputTime.current = Date.now()
    }
  }

  // Handle hold-to-skip or ESC skip
  const handleSkip = () => {
    if (alreadyTakenIndexRef.current !== null) return
    const activeKey = MAPPING_ORDER[mappingIndexRef.current]

    // Skip means we delete or don't set mapping for this key
    const updated = { ...mappingsRef.current }
    delete updated[activeKey.id]
    setMappingsWithRef(updated)

    if (mappingIndexRef.current < MAPPING_ORDER.length - 1) {
      setMappingIndexWithRef(mappingIndexRef.current + 1)
      lastInputTime.current = Date.now()
    } else {
      setPhaseWithRef('done')
      lastInputTime.current = Date.now()
    }
  }

  // Translate browser inputs to SDL2 and invoke IPC
  const saveAndExit = async () => {
    const currentDevice = deviceRef.current
    if (!currentDevice) return
    const gamepads = navigator.getGamepads()
    const pad = gamepads[currentDevice.index]
    const guid = pad ? getGamepadGuid(pad) : currentDevice.id
    const cleanName = currentDevice.name.split(' (')[0] || currentDevice.name

    // Translate each captured mapped key standard Web Gamepad inputs into hardware SDL2 mappings
    const sdlMappings: Record<string, { type: string, id: number, value: number }> = {}
    Object.entries(mappingsRef.current).forEach(([key, browserMap]) => {
      sdlMappings[key] = convertBrowserToSdl(browserMap.type, browserMap.id, browserMap.value)
    })

    try {
      await window.api.saveInputConfig({
        deviceName: cleanName,
        deviceGUID: guid,
        mappings: sdlMappings
      })
      console.log('Successfully saved SDL translated mappings to backend config.')
    } catch (err) {
      console.error('Failed to save mappings:', err)
    }
    onClose()
  }

  // Inline SVG icons mapper
  const renderIcon = (type: string, active: boolean) => {
    const color = active ? '#fff' : '#888'
    const highlightColor = active ? '#fff' : '#bf0052'
    switch (type) {
      case 'south':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="6" r="2.5" stroke={color} strokeWidth="1.5" />
            <circle cx="6" cy="12" r="2.5" stroke={color} strokeWidth="1.5" />
            <circle cx="18" cy="12" r="2.5" stroke={color} strokeWidth="1.5" />
            <circle cx="12" cy="18" r="2.5" fill={highlightColor} stroke={highlightColor} strokeWidth="1.5" />
          </svg>
        )
      case 'east':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="6" r="2.5" stroke={color} strokeWidth="1.5" />
            <circle cx="6" cy="12" r="2.5" stroke={color} strokeWidth="1.5" />
            <circle cx="12" cy="18" r="2.5" stroke={color} strokeWidth="1.5" />
            <circle cx="18" cy="12" r="2.5" fill={highlightColor} stroke={highlightColor} strokeWidth="1.5" />
          </svg>
        )
      case 'north':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="6" r="2.5" fill={highlightColor} stroke={highlightColor} strokeWidth="1.5" />
            <circle cx="6" cy="12" r="2.5" stroke={color} strokeWidth="1.5" />
            <circle cx="18" cy="12" r="2.5" stroke={color} strokeWidth="1.5" />
            <circle cx="12" cy="18" r="2.5" stroke={color} strokeWidth="1.5" />
          </svg>
        )
      case 'west':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="6" r="2.5" stroke={color} strokeWidth="1.5" />
            <circle cx="6" cy="12" r="2.5" fill={highlightColor} stroke={highlightColor} strokeWidth="1.5" />
            <circle cx="18" cy="12" r="2.5" stroke={color} strokeWidth="1.5" />
            <circle cx="12" cy="18" r="2.5" stroke={color} strokeWidth="1.5" />
          </svg>
        )
      case 'start':
      case 'select':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="9" width="18" height="6" rx="3" stroke={color} strokeWidth="1.5" />
            <rect x="7" y="11" width="10" height="2" rx="1" fill={highlightColor} />
          </svg>
        )
      case 'dpad-up':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 4 L12 20 M4 12 L20 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M12 3 L9 7 H15 Z" fill={highlightColor} stroke={highlightColor} />
          </svg>
        )
      case 'dpad-down':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 4 L12 20 M4 12 L20 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M12 21 L9 17 H15 Z" fill={highlightColor} stroke={highlightColor} />
          </svg>
        )
      case 'dpad-left':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 4 L12 20 M4 12 L20 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 12 L7 9 V15 Z" fill={highlightColor} stroke={highlightColor} />
          </svg>
        )
      case 'dpad-right':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 4 L12 20 M4 12 L20 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M21 12 L17 9 V15 Z" fill={highlightColor} stroke={highlightColor} />
          </svg>
        )
      case 'shoulder-left':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 14 C3 8, 8 7, 12 7 L12 11 C8 11, 5 12, 5 14 Z" fill={highlightColor} stroke={color} strokeWidth="1" />
          </svg>
        )
      case 'shoulder-right':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M21 14 C21 8, 16 7, 12 7 L12 11 C16 11, 19 12, 19 14 Z" fill={highlightColor} stroke={color} strokeWidth="1" />
          </svg>
        )
      case 'trigger-left':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M4 6 H10 V16 C10 19, 4 19, 4 16 Z" fill={highlightColor} stroke={color} strokeWidth="1.5" />
            <text x="5.5" y="12" fill="#fff" fontSize="6.5" fontWeight="bold">LT</text>
          </svg>
        )
      case 'trigger-right':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M20 6 H14 V16 C14 19, 20 19, 20 16 Z" fill={highlightColor} stroke={color} strokeWidth="1.5" />
            <text x="14.5" y="12" fill="#fff" fontSize="6.5" fontWeight="bold">RT</text>
          </svg>
        )
      case 'analog-l-up':
      case 'analog-l-left':
      case 'analog-r-up':
      case 'analog-r-left':
        const isRight = type.includes('analog-r')
        const isUp = type.includes('up')
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.5" />
            <circle cx={12 + (isUp ? 0 : -3.5)} cy={12 + (isUp ? -3.5 : 0)} r="3" fill={highlightColor} />
            <text x="10.5" y="14" fill="#fff" fontSize="6" fontWeight="bold">{isRight ? 'R' : 'L'}</text>
          </svg>
        )
      case 'stick-press-l':
      case 'stick-press-r':
        const isPressR = type.includes('-r')
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.5" />
            <circle cx="12" cy="12" r="4.5" fill={highlightColor} />
            <text x="9" y="14.5" fill="#fff" fontSize="6" fontWeight="bold">{isPressR ? 'R3' : 'L3'}</text>
          </svg>
        )
      case 'hotkey':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="6" width="16" height="12" rx="2" stroke={color} strokeWidth="1.5" fill={highlightColor} />
            <text x="6.5" y="14.5" fill="#fff" fontSize="7.5" fontWeight="bold">HK</text>
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontFamily: '"Outfit", "Inter", "Segoe UI", sans-serif',
      userSelect: 'none'
    }}>
      
      {/* PHASE 1: WARNING DIALOG REPLICA (Screenshot 1) */}
      {phase === 'warning' && (
        <div style={{
          width: '720px',
          backgroundColor: 'rgba(15, 15, 15, 0.98)',
          border: '1.5px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.8)',
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '30px' }}>
            {/* Info Circle Icon */}
            <div style={{
              width: '56px', height: '56px',
              borderRadius: '50%',
              border: '2px solid rgba(255, 255, 255, 0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '32px', fontWeight: 'bold', fontFamily: 'serif',
              color: 'rgba(255, 255, 255, 0.9)',
              flexShrink: 0,
              marginTop: '5px'
            }}>
              i
            </div>
            
            {/* Warning Text */}
            <div style={{
              fontSize: '18px',
              lineHeight: '1.7',
              color: 'rgba(255, 255, 255, 0.85)',
              fontWeight: 500,
              letterSpacing: '0.5px'
            }}>
              YOU ARE GOING TO MAP A CONTROLLER. MAP BASED ON THE BUTTON'S POSITION, NOT ITS PHYSICAL LABEL. IF YOU DO NOT HAVE A SPECIAL BUTTON FOR HOTKEY, USE THE SELECT BUTTON. SKIP ALL BUTTONS/STICKS YOU DO NOT HAVE BY HOLDING ANY BUTTON. PRESS THE SOUTH BUTTON TO CONFIRM WHEN DONE.
            </div>
          </div>

          {/* OK and CANCEL Action Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '20px',
            marginTop: '45px'
          }}>
            <div style={{
              padding: '8px 24px',
              backgroundColor: warningSelection === 'ok' ? '#bf0052' : 'transparent',
              border: warningSelection === 'ok' ? '2.5px solid #bf0052' : '2.5px solid rgba(255,255,255,0.4)',
              cursor: 'pointer',
              fontWeight: 'bold',
              letterSpacing: '1px',
              fontSize: '15px',
              textAlign: 'center',
              minWidth: '90px'
            }} onClick={() => setPhaseWithRef('detect')}>
              OK
            </div>
            <div style={{
              padding: '8px 24px',
              backgroundColor: warningSelection === 'cancel' ? '#bf0052' : 'transparent',
              border: warningSelection === 'cancel' ? '2.5px solid #bf0052' : '2.5px solid rgba(255,255,255,0.4)',
              cursor: 'pointer',
              fontWeight: 'bold',
              letterSpacing: '1px',
              fontSize: '15px',
              textAlign: 'center',
              minWidth: '90px'
            }} onClick={onClose}>
              CANCEL
            </div>
          </div>
        </div>
      )}

      {/* PHASE 2: DETECTION OVERLAY REPLICA (Screenshots 2 & 3) */}
      {phase === 'detect' && (
        <div style={{
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%'
        }}>
          {/* Header titles */}
          <h1 style={{
            fontSize: '32px',
            color: '#bf0052',
            letterSpacing: '2px',
            margin: '0 0 10px 0',
            fontWeight: 700
          }}>
            CONFIGURE INPUT
          </h1>
          <h2 style={{
            fontSize: '18px',
            color: '#bf0052',
            letterSpacing: '1px',
            margin: '0 0 50px 0',
            fontWeight: 600
          }}>
            {numGamepads > 0 ? `${numGamepads} GAMEPAD${numGamepads > 1 ? 'S' : ''} DETECTED` : 'NO GAMEPADS DETECTED'}
          </h2>

          {/* Prompts */}
          <div style={{
            fontSize: '18px',
            letterSpacing: '0.5px',
            lineHeight: '2',
            color: 'rgba(255, 255, 255, 0.85)',
            fontWeight: 500
          }}>
            HOLD A BUTTON ON YOUR DEVICE TO CONFIGURE IT.<br />
            PRESS ESC OR A HOTKEY TO CANCEL.
          </div>

          {/* Gamepad Name display upon hold (Screenshot 3) */}
          <div style={{
            marginTop: '100px',
            height: '40px',
            fontSize: '22px',
            color: 'rgba(255, 255, 255, 0.45)',
            fontWeight: 600,
            letterSpacing: '1.5px',
            textTransform: 'uppercase'
          }}>
            {device ? device.name.split(' (')[0].toUpperCase() : ''}
          </div>
        </div>
      )}

      {/* PHASE 3 & 4: CONFIGURE/LIST SCREEN (Screenshots 4 & 5) */}
      {(phase === 'map' || phase === 'done') && device && (
        <div style={{
          width: '800px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px 0'
        }}>
          
          {/* Top Title Headers */}
          <h1 style={{
            fontSize: '24px',
            color: '#bf0052',
            letterSpacing: '2px',
            margin: '0 0 5px 0',
            fontWeight: 700,
            textTransform: 'uppercase'
          }}>
            {phase === 'done' ? 'CONFIGURATION' : 'CONFIGURING'}
          </h1>
          <h2 style={{
            fontSize: '18px',
            color: '#bf0052',
            letterSpacing: '1px',
            margin: '0 0 5px 0',
            fontWeight: 600,
            textTransform: 'uppercase'
          }}>
            GAMEPAD {device.index + 1}
          </h2>
          <h3 style={{
            fontSize: '14px',
            color: '#ff3366',
            letterSpacing: '1px',
            margin: '0 0 25px 0',
            fontWeight: 600,
            visibility: phase === 'done' ? 'hidden' : 'visible'
          }}>
            HOLD ANY BUTTON TO SKIP
          </h3>

          {/* Hold to skip visual progress bar */}
          {phase === 'map' && skipProgress > 0 && (
            <div style={{
              width: '100%',
              height: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              marginBottom: '15px',
              position: 'relative',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${skipProgress}%`,
                height: '100%',
                backgroundColor: '#ff3366',
                transition: 'width 0.05s linear'
              }} />
            </div>
          )}

          {/* Scrollable button configuration list container */}
          <div 
            ref={listContainerRef}
            style={{
              width: '100%',
              height: '440px',
              overflowY: 'auto',
              border: '1.5px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(10, 10, 10, 0.95)',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'
            }}
            className="custom-scrollbar"
          >
            {MAPPING_ORDER.map((item, idx) => {
              const isActive = phase === 'map' && idx === mappingIndex
              const isTaken = idx === alreadyTakenIndex
              const isMapped = mappings[item.id] !== undefined
              
              return (
                <div
                  key={item.id}
                  ref={isActive ? activeRowRef : null}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: '40px',
                    padding: '0 25px',
                    backgroundColor: isActive ? '#bf0052' : (idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent'),
                    color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.85)',
                    fontSize: '15px',
                    fontWeight: isActive ? 'bold' : 500,
                    letterSpacing: '0.5px',
                    flexShrink: 0
                  }}
                >
                  {/* Left Label & SVG Icon */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {renderIcon(item.icon, isActive)}
                    <span style={{ fontSize: '15px' }}>{item.label}</span>
                  </div>

                  {/* Right Status / Mapped key */}
                  <div style={{
                    fontSize: '15px',
                    fontWeight: 'bold',
                    letterSpacing: '0.5px'
                  }}>
                    {isTaken ? (
                      <span style={{ color: isActive ? '#fff' : '#ff3333', animation: 'blink 0.5s infinite' }}>ALREADY TAKEN</span>
                    ) : isActive ? (
                      <span style={{ color: '#fff', animation: 'blink 0.8s infinite' }}>PRESS ANYTHING</span>
                    ) : isMapped ? (
                      <span style={{ color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.9)' }}>
                        {formatMappingValue(mappings[item.id])}
                      </span>
                    ) : (
                      <span style={{ color: 'rgba(255, 255, 255, 0.35)' }}>-NOT DEFINED-</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* PHASE 4: Bottom confirmation OK & CANCEL dialog */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '20px',
            marginTop: '30px',
            width: '100%',
            opacity: phase === 'done' ? 1 : 0.4,
            pointerEvents: phase === 'done' ? 'auto' : 'none'
          }}>
            <div style={{
              padding: '8px 24px',
              backgroundColor: doneSelection === 'ok' && phase === 'done' ? '#bf0052' : 'transparent',
              border: doneSelection === 'ok' && phase === 'done' ? '2.5px solid #bf0052' : '2.5px solid rgba(255,255,255,0.4)',
              cursor: 'pointer',
              fontWeight: 'bold',
              letterSpacing: '1px',
              fontSize: '15px',
              textAlign: 'center',
              minWidth: '90px'
            }} onClick={saveAndExit}>
              OK
            </div>
            <div style={{
              padding: '8px 24px',
              backgroundColor: doneSelection === 'cancel' && phase === 'done' ? '#bf0052' : 'transparent',
              border: doneSelection === 'cancel' && phase === 'done' ? '2.5px solid #bf0052' : '2.5px solid rgba(255,255,255,0.4)',
              cursor: 'pointer',
              fontWeight: 'bold',
              letterSpacing: '1px',
              fontSize: '15px',
              textAlign: 'center',
              minWidth: '90px'
            }} onClick={onClose}>
              CANCEL
            </div>
          </div>

        </div>
      )}

      {/* Embedded keyframes stylesheet */}
      <style>{`
        @keyframes blink {
          0% { opacity: 0.3; }
          50% { opacity: 1; }
          100% { opacity: 0.3; }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.3);
        }
      `}</style>

    </div>
  )
}