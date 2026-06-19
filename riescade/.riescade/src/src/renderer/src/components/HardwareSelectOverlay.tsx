import React, { useState, useEffect, useCallback } from 'react'
import { Dialog, Box, Flex, Heading, Text, Button } from '@radix-ui/themes'
import { System } from '../../../shared/types'

interface HardwareSelectProps {
  isOpen: boolean
  onClose: () => void
  systems: System[]
  onSelectSystem: (systemName: string) => void
}

export const HardwareSelectOverlay: React.FC<HardwareSelectProps> = ({
  isOpen, onClose, systems, onSelectSystem
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [visible, setVisible] = useState(false)

  const CATEGORIES_ORDER = [
    'arcade',
    'computer',
    'console',
    'extension',
    'pinball',
    'port',
    'portable',
    'system',
    'auto collection',
    'custom-collections'
  ]

  const CATEGORIES_DISPLAY: Record<string, string> = {
    'arcade': 'ARCADE',
    'computer': 'COMPUTER',
    'console': 'CONSOLE',
    'extension': 'EXTENSION',
    'pinball': 'PINBALL',
    'port': 'PORT',
    'portable': 'PORTABLE',
    'system': 'SYSTEM',
    'auto collection': 'AUTO COLLECTION',
    'custom-collections': 'CUSTOM COLLECTION'
  }

  // Group systems by hardware category
  const groups: Record<string, System[]> = {}
  systems.forEach(sys => {
    let hw = String(sys.hardware || 'console').toLowerCase()
    if (sys.name === 'collections') {
      hw = 'custom-collections'
    }
    if (!groups[hw]) groups[hw] = []
    groups[hw].push(sys)
  })

  // Build selectable categories list
  const menuItems: any[] = []
  CATEGORIES_ORDER.forEach(cat => {
    const sysList = groups[cat] || []
    if (sysList.length > 0) {
      // Sort alphabetically by fullname
      const sorted = [...sysList].sort((a, b) => 
        (a.fullname || a.name).localeCompare(b.fullname || b.name)
      )
      
      const subLabelText = sorted.map(sys => {
        if (sys.name === 'arcade' && sys.hardware === 'auto collection') {
          return 'ARCADE (GERAL)'
        }
        if (sys.name === 'auto-arcade') {
          return 'ARCADE (GERAL)'
        }
        return sys.fullname || sys.name.toUpperCase()
      }).join(', ')

      menuItems.push({
        id: `group_${cat}`,
        label: CATEGORIES_DISPLAY[cat] || cat.toUpperCase(),
        subLabel: subLabelText,
        systemName: sorted[0].name // Selecting this category points to its first system
      })
    }
  })

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0)
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [isOpen])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || menuItems.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex(prev => (prev + 1) % menuItems.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex(prev => (prev - 1 + menuItems.length) % menuItems.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        const item = menuItems[selectedIndex]
        if (item) {
          onSelectSystem(item.systemName)
          onClose()
        }
      } else if (e.key === 'Backspace' || e.key === 'Escape' || e.key === 'Control') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    },
    [isOpen, selectedIndex, menuItems, onSelectSystem, onClose]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Content 
        size="3" 
        className="riescade-menu riescade-menu-hardware"
        style={{ maxWidth: '500px' }}
      >
        <Flex className="riescade-menu-header">
          <Heading size="4" className="riescade-menu-title">
            IR PARA O HARDWARE
          </Heading>
        </Flex>

        <Box className="riescade-menu-content custom-scrollbar">
          <Box className="riescade-menu-list">
            {menuItems.map((item, index) => {
              const isSelected = index === selectedIndex
              return (
                <Box
                  key={item.id}
                  onClick={() => {
                    onSelectSystem(item.systemName)
                    onClose()
                  }}
                  className={`riescade-menu-item${isSelected ? ' selected' : ''}`}
                >
                  <Flex className="riescade-menu-item-content">
                    <Flex className="riescade-menu-item-row">
                      <Text weight="bold" size="2" className="riescade-menu-item-label">
                        {item.label}
                      </Text>
                    </Flex>
                    {item.subLabel && (
                      <Text size="1" className="riescade-menu-item-description">
                        {item.subLabel}
                      </Text>
                    )}
                  </Flex>
                </Box>
              )
            })}
          </Box>
        </Box>
      </Dialog.Content>
    </Dialog.Root>
  )
}
