import React, { useState, useEffect, useRef } from 'react'

import buttonsSouthIcon from '../resources/buttons_south.svg'
import buttonsEastIcon from '../resources/buttons_east.svg'
import buttonsNorthIcon from '../resources/buttons_north.svg'
import buttonsWestIcon from '../resources/buttons_west.svg'
import buttonStartIcon from '../resources/button_start.svg'
import buttonSelectIcon from '../resources/button_select.svg'
import dpadUpIcon from '../resources/dpad_up.svg'
import dpadDownIcon from '../resources/dpad_down.svg'
import dpadLeftIcon from '../resources/dpad_left.svg'
import dpadRightIcon from '../resources/dpad_right.svg'
import buttonLIcon from '../resources/button_l.svg'
import buttonRIcon from '../resources/button_r.svg'
import buttonLtIcon from '../resources/button_lt.svg'
import buttonRtIcon from '../resources/button_rt.svg'
import analogUpIcon from '../resources/analog_up.svg'
import analogLeftIcon from '../resources/analog_left.svg'
import analogThumbIcon from '../resources/analog_thumb.svg'
import buttonHotkeyIcon from '../resources/button_hotkey.svg'

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
    let src = ''
    switch (type) {
      case 'south': src = buttonsSouthIcon; break
      case 'east': src = buttonsEastIcon; break
      case 'north': src = buttonsNorthIcon; break
      case 'west': src = buttonsWestIcon; break
      case 'start': src = buttonStartIcon; break
      case 'select': src = buttonSelectIcon; break
      case 'dpad-up': src = dpadUpIcon; break
      case 'dpad-down': src = dpadDownIcon; break
      case 'dpad-left': src = dpadLeftIcon; break
      case 'dpad-right': src = dpadRightIcon; break
      case 'shoulder-left': src = buttonLIcon; break
      case 'shoulder-right': src = buttonRIcon; break
      case 'trigger-left': src = buttonLtIcon; break
      case 'trigger-right': src = buttonRtIcon; break
      case 'analog-l-up':
      case 'analog-r-up': src = analogUpIcon; break
      case 'analog-l-left':
      case 'analog-r-left': src = analogLeftIcon; break
      case 'stick-press-l':
      case 'stick-press-r': src = analogThumbIcon; break
      case 'hotkey': src = buttonHotkeyIcon; break
      default: return null
    }

    return (
      <img
        src={src}
        alt={type}
        className="input-config-row-icon"
        style={{
          opacity: active ? 1 : 0.4
        }}
      />
    )
  }

  return (
    <div className="input-config-overlay">
      
      {/* PHASE 1: WARNING DIALOG REPLICA (Screenshot 1) */}
      {phase === 'warning' && (
        <div className="input-config-warning-container">
          <div className="input-config-warning-header">
            {/* Info Circle Icon */}
            <div className="input-config-warning-icon">
              i
            </div>
            
            {/* Warning Text */}
            <div className="input-config-warning-text">
              YOU ARE GOING TO MAP A CONTROLLER. MAP BASED ON THE BUTTON'S POSITION, NOT ITS PHYSICAL LABEL. IF YOU DO NOT HAVE A SPECIAL BUTTON FOR HOTKEY, USE THE SELECT BUTTON. SKIP ALL BUTTONS/STICKS YOU DO NOT HAVE BY HOLDING ANY BUTTON. PRESS THE SOUTH BUTTON TO CONFIRM WHEN DONE.
            </div>
          </div>

          {/* OK and CANCEL Action Buttons */}
          <div className="input-config-warning-buttons">
            <div
              className={`input-config-warning-btn ${warningSelection === 'ok' ? 'active' : ''}`}
              onClick={() => setPhaseWithRef('detect')}
            >
              OK
            </div>
            <div
              className={`input-config-warning-btn ${warningSelection === 'cancel' ? 'active' : ''}`}
              onClick={onClose}
            >
              CANCEL
            </div>
          </div>
        </div>
      )}

      {/* PHASE 2: DETECTION OVERLAY REPLICA (Screenshots 2 & 3) */}
      {phase === 'detect' && (
        <div className="input-config-detect-container">
          {/* Header titles */}
          <h1 className="input-config-detect-title">
            CONFIGURE INPUT
          </h1>
          <h2 className="input-config-detect-subtitle">
            {numGamepads > 0 ? `${numGamepads} GAMEPAD${numGamepads > 1 ? 'S' : ''} DETECTED` : 'NO GAMEPADS DETECTED'}
          </h2>

          {/* Prompts */}
          <div className="input-config-detect-prompts">
            HOLD A BUTTON ON YOUR DEVICE TO CONFIGURE IT.<br />
            PRESS ESC OR A HOTKEY TO CANCEL.
          </div>

          {/* Gamepad Name display upon hold (Screenshot 3) */}
          <div className="input-config-detect-device">
            {device ? device.name.split(' (')[0].toUpperCase() : ''}
          </div>
        </div>
      )}

      {/* PHASE 3 & 4: CONFIGURE/LIST SCREEN (Screenshots 4 & 5) */}
      {(phase === 'map' || phase === 'done') && device && (
        <div className="input-config-panel">
          
          {/* Top Title Headers */}
          <h1 className="input-config-panel-title">
            {phase === 'done' ? 'CONFIGURATION' : 'CONFIGURING'}
          </h1>
          <h2 className="input-config-panel-subtitle">
            GAMEPAD {device.index + 1}
          </h2>
          <h3
            className="input-config-panel-hint"
            style={{
              visibility: phase === 'done' ? 'hidden' : 'visible'
            }}
          >
            HOLD ANY BUTTON TO SKIP
          </h3>

          {/* Hold to skip visual progress bar */}
          {phase === 'map' && skipProgress > 0 && (
            <div className="input-config-skip-track">
              <div
                className="input-config-skip-fill"
                style={{
                  width: `${skipProgress}%`
                }}
              />
            </div>
          )}

          {/* Scrollable button configuration list container */}
          <div 
            ref={listContainerRef}
            className="input-config-scroll-list custom-scrollbar"
          >
            {MAPPING_ORDER.map((item, idx) => {
              const isActive = phase === 'map' && idx === mappingIndex
              const isTaken = idx === alreadyTakenIndex
              const isMapped = mappings[item.id] !== undefined
              
              return (
                <div
                  key={item.id}
                  ref={isActive ? activeRowRef : null}
                  className={`input-config-row ${isActive ? 'active' : ''}`}
                >
                  {/* Left Label & SVG Icon */}
                  <div className="input-config-row-label-section">
                    {renderIcon(item.icon, isActive)}
                    <span className="input-config-row-label">{item.label}</span>
                  </div>

                  {/* Right Status / Mapped key */}
                  <div className="input-config-row-value">
                    {isTaken ? (
                      <span className="status-text taken">ALREADY TAKEN</span>
                    ) : isActive ? (
                      <span className="status-text blink">PRESS ANYTHING</span>
                    ) : isMapped ? (
                      <span>
                        {formatMappingValue(mappings[item.id])}
                      </span>
                    ) : (
                      <span className="status-text undefined">-NOT DEFINED-</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* PHASE 4: Bottom confirmation OK & CANCEL dialog */}
          <div
            className="input-config-done-actions"
            style={{
              opacity: phase === 'done' ? 1 : 0.4,
              pointerEvents: phase === 'done' ? 'auto' : 'none'
            }}
          >
            <div
              className={`input-config-done-btn ${doneSelection === 'ok' && phase === 'done' ? 'active' : ''}`}
              onClick={saveAndExit}
            >
              OK
            </div>
            <div
              className={`input-config-done-btn ${doneSelection === 'cancel' && phase === 'done' ? 'active' : ''}`}
              onClick={onClose}
            >
              CANCEL
            </div>
          </div>

        </div>
      )}

    </div>
  )
}