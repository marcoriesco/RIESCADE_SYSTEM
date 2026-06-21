import React, { useState, useEffect, useCallback } from 'react'
import { Dialog, Box, Flex, Heading, Text, Tabs } from '@radix-ui/themes'
import { Game, System } from '../../../shared/types'

const escapeFileUrl = (url: string): string => {
  if (url.startsWith('file://')) {
    const [pathPart, ...queryParts] = url.split('?')
    return [pathPart.replace(/#/g, '%23'), ...queryParts].join('?')
  }
  return url
}

const resolveMediaUrl = (path: string | undefined, system: System, game: Game, allSystems: System[]) => {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('file://')) return escapeFileUrl(path)
  const normalized = path.replace(/\\/g, '/')
  let url = normalized
  if (normalized.match(/^[a-zA-Z]:/) || normalized.startsWith('/')) {
    url = normalized.match(/^[a-zA-Z]:/) ? `file:///${normalized}` : `file://${normalized}`
  } else {
    // Resolve relative paths relative to activeGame's system path
    const sysLower = (game.system || system.name || '').toLowerCase()
    const gameSystem = allSystems.find(s => s.name.toLowerCase() === sysLower) || system
    if (gameSystem && gameSystem.path && !gameSystem.path.startsWith('virtual://')) {
      const sysPath = gameSystem.path.replace(/\\/g, '/')
      const cleanP = normalized.replace(/^\.\//, '')
      const absolute = sysPath.endsWith('/') ? `${sysPath}${cleanP}` : `${sysPath}/${cleanP}`
      url = absolute.match(/^[a-zA-Z]:/) ? `file:///${absolute}` : `file://${absolute}`
    }
  }
  return escapeFileUrl(url)
}

interface GameMediaOverlayProps {
  isOpen: boolean
  onClose: () => void
  game: Game
  system: System
  allSystems: System[]
  t: (key: string) => string
}

interface MediaTab {
  id: string
  label: string
  type: 'image' | 'video' | 'pdf'
  url: string
}

export const GameMediaOverlay: React.FC<GameMediaOverlayProps> = ({
  isOpen,
  onClose,
  game,
  system,
  allSystems,
  t
}) => {
  const [activeTab, setActiveTab] = useState(0)

  // Build dynamic tabs based on active files
  const tabs: MediaTab[] = []

  // COVER: thumbnail, boxart, or image
  const coverPath = game.thumbnail || game.boxart || game.image
  if (coverPath) {
    tabs.push({ id: 'cover', label: t('COVER').toUpperCase(), type: 'image', url: resolveMediaUrl(coverPath, system, game, allSystems) })
  }

  // FANART
  if (game.fanart) {
    tabs.push({ id: 'fanart', label: t('FANART').toUpperCase(), type: 'image', url: resolveMediaUrl(game.fanart, system, game, allSystems) })
  }

  // MARQUEE: marquee or wheel
  const marqueePath = game.marquee || game.wheel
  if (marqueePath) {
    tabs.push({ id: 'marquee', label: t('LOGO').toUpperCase(), type: 'image', url: resolveMediaUrl(marqueePath, system, game, allSystems) })
  }

  // VIDEO
  if (game.video) {
    tabs.push({ id: 'video', label: t('VIDEO').toUpperCase(), type: 'video', url: resolveMediaUrl(game.video, system, game, allSystems) })
  }

  // MANUAL
  if (game.manual) {
    tabs.push({ id: 'manual', label: t('MANUAL').toUpperCase(), type: 'pdf', url: resolveMediaUrl(game.manual, system, game, allSystems) })
  }

  // TITLE
  if (game.titleshot) {
    tabs.push({ id: 'title', label: t('TITLE SHOT').toUpperCase(), type: 'image', url: resolveMediaUrl(game.titleshot, system, game, allSystems) })
  }

  // BOX BACKSIDE
  if (game.boxback) {
    tabs.push({ id: 'boxback', label: (t('BOX BACKSIDE') || 'BOX BACKSIDE').toUpperCase(), type: 'image', url: resolveMediaUrl(game.boxback, system, game, allSystems) })
  }

  // CARTRIDGE
  if (game.cartridge) {
    tabs.push({ id: 'cartridge', label: (t('CARTRIDGE') || 'CARTRIDGE').toUpperCase(), type: 'image', url: resolveMediaUrl(game.cartridge, system, game, allSystems) })
  }

  useEffect(() => {
    if (isOpen) {
      setActiveTab(0)
    }
  }, [isOpen])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || tabs.length === 0) return

      const key = (e.key || '').toLowerCase()

      // Close inputs: escape, backspace, z, w
      if (key === 'escape' || key === 'backspace' || key === 'z' || key === 'w') {
        e.preventDefault()
        onClose()
        return
      }

      // Next tab: ArrowRight, PageDown, e, E
      if (key === 'arrowright' || key === 'pagedown' || key === 'e') {
        e.preventDefault()
        setActiveTab((prev) => (prev + 1) % tabs.length)
        return
      }

      // Previous tab: ArrowLeft, PageUp, q, Q
      if (key === 'arrowleft' || key === 'pageup' || key === 'q') {
        e.preventDefault()
        setActiveTab((prev) => (prev - 1 + tabs.length) % tabs.length)
        return
      }
    },
    [isOpen, tabs, onClose]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!isOpen) return null

  const activeTabItem = tabs[activeTab]

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Content
        size="4"
        className="riescade-menu riescade-menu-game-media"
        style={{
          maxWidth: '90vw',
          width: '90vw',
          height: '90vh',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0
        }}
      >
        <Flex className="riescade-menu-header" direction="column" align="center">
          <Heading size="4" className="riescade-menu-title">
            {game.name.toUpperCase()}
          </Heading>
          <Text size="1" color="gray" mt="1" style={{ letterSpacing: '1px' }}>
            {t('VIEW GAME MEDIA')}
          </Text>

          {tabs.length > 0 && (
            <Tabs.Root value={tabs[activeTab].id} style={{ marginTop: '10px', width: '100%' }}>
              <Tabs.List style={{ justifyContent: 'center' }}>
                {tabs.map((tab, idx) => (
                  <Tabs.Trigger
                    key={tab.id}
                    value={tab.id}
                    onClick={() => setActiveTab(idx)}
                  >
                    {tab.label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Tabs.Root>
          )}
        </Flex>

        <Flex className="game-media-content-container" style={{ flexGrow: 1, padding: '30px', overflow: 'hidden' }} justify="center" align="center">
          {tabs.length === 0 ? (
            <Flex direction="column" align="center" justify="center" gap="3" style={{ border: '2px dashed rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '40px', maxWidth: '80%' }}>
              <Text size="2" color="gray" weight="bold">
                {t('NO MEDIA AVAILABLE')}
              </Text>
            </Flex>
          ) : (
            activeTabItem && (
              <Flex className="game-media-wrapper" justify="center" align="center" style={{ width: '100%', height: '100%' }}>
                {activeTabItem.type === 'image' && (
                  <img src={activeTabItem.url} className="game-media-item image" alt={activeTabItem.label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 10px 35px rgba(0, 0, 0, 0.5)' }} />
                )}
                {activeTabItem.type === 'video' && (
                  <video src={activeTabItem.url} className="game-media-item video" autoPlay loop muted controls style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 10px 35px rgba(0, 0, 0, 0.5)' }} />
                )}
                {activeTabItem.type === 'pdf' && (
                  <iframe src={activeTabItem.url} className="game-media-item pdf" title={activeTabItem.label} style={{ width: '100%', height: '100%', background: 'white', border: 'none', borderRadius: '4px', boxShadow: '0 10px 35px rgba(0, 0, 0, 0.5)' }} />
                )}
              </Flex>
            )
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
