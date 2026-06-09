import React, { useEffect, useRef, useMemo, useCallback } from 'react'

interface Props {
  data: any
}

// Memoized game list item to prevent re-renders when parent state changes
const GameListItem = React.memo<{
  game: any
  index: number
  isSelected: boolean
  distance: number
}>(({ game, index, isSelected, distance }) => {
  return (
    <div
      className={`gamelist-item riescade-list-item ${isSelected ? 'selected' : ''}`}
      data-index={index}
      style={{
        padding: '6px 20px',
        display: 'flex',
        alignItems: 'center',
        opacity: isSelected ? 1 : Math.max(0.3, 1 - distance * 0.15),
        transform: isSelected ? 'scale(1.05) translateX(10px)' : 'scale(1)',
        transformOrigin: 'left center',
        transition: 'all 0.15s ease-out',
        flexShrink: 0,
        minHeight: '5vh',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}
    >
      {game.name}
    </div>
  )
}, (prev, next) => {
  // Only re-render if selection state or game identity changed
  return prev.game.path === next.game.path
    && prev.isSelected === next.isSelected
    && prev.distance === next.distance
})

// Number of items to render above and below the visible window
const VIRTUAL_OVERSCAN = 10
// Approximate item height in pixels (5vh at 1080p ~= 54px)
const ESTIMATED_ITEM_HEIGHT = 54

export const WebGamelistElement: React.FC<Props> = ({ data }) => {
  const games = data?.games || []
  const selectedIndex = games.findIndex((g: any) => g.path === data?.path)
  const safeIndex = selectedIndex === -1 ? 0 : selectedIndex
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = React.useState(0)
  const [containerHeight, setContainerHeight] = React.useState(600)

  // Track scroll position and container size for virtualization
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleScroll = () => setScrollTop(el.scrollTop)
    const handleResize = () => setContainerHeight(el.clientHeight)

    el.addEventListener('scroll', handleScroll, { passive: true })
    handleResize()

    const observer = new ResizeObserver(handleResize)
    observer.observe(el)

    return () => {
      el.removeEventListener('scroll', handleScroll)
      observer.disconnect()
    }
  }, [])

  // Auto-scroll to keep selected item visible
  useEffect(() => {
    if (!containerRef.current) return
    const items = containerRef.current.querySelectorAll('.gamelist-item')
    if (items.length > 0) {
      // Find the item matching the selected index
      const target = containerRef.current.querySelector(`.gamelist-item[data-index="${safeIndex}"]`)
      if (target) {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
  }, [safeIndex])

  // Compute which items to render (virtualization window)
  const { visibleGames, startIndex } = useMemo(() => {
    if (games.length === 0) return { visibleGames: [], startIndex: 0 }

    const totalItems = games.length
    const visibleCount = Math.ceil(containerHeight / ESTIMATED_ITEM_HEIGHT) + VIRTUAL_OVERSCAN * 2

    // Center the window around the selected item, but also factor in scroll position
    let start = Math.max(0, Math.floor(scrollTop / ESTIMATED_ITEM_HEIGHT) - VIRTUAL_OVERSCAN)
    // Also ensure selected item is always in view
    const selectedStart = Math.max(0, safeIndex - Math.floor(visibleCount / 2))
    // Use whichever start is more appropriate
    if (Math.abs(start - safeIndex) > visibleCount) {
      start = selectedStart
    }

    const end = Math.min(totalItems, start + visibleCount)

    return {
      visibleGames: games.slice(start, end),
      startIndex: start
    }
  }, [games, safeIndex, scrollTop, containerHeight])

  if (!games.length) {
    return (
      <div style={{
        color: 'rgba(255,255,255,0.5)',
        padding: '20px',
        width: '100%',
        textAlign: 'center',
        marginTop: '20vh'
      }}>
        Nenhuma rom encontrada
      </div>
    )
  }

  const totalHeight = games.length * ESTIMATED_ITEM_HEIGHT

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Spacer for items above the visible window */}
      {startIndex > 0 && (
        <div style={{ height: startIndex * ESTIMATED_ITEM_HEIGHT, flexShrink: 0 }} />
      )}
      {visibleGames.map((game: any, i: number) => {
        const actualIndex = startIndex + i
        const isSelected = actualIndex === safeIndex
        const dist = Math.abs(actualIndex - safeIndex)

        return (
          <GameListItem
            key={game.path || actualIndex}
            game={game}
            index={actualIndex}
            isSelected={isSelected}
            distance={dist}
          />
        )
      })}
      {/* Spacer for items below the visible window */}
      {startIndex + visibleGames.length < games.length && (
        <div style={{
          height: (games.length - startIndex - visibleGames.length) * ESTIMATED_ITEM_HEIGHT,
          flexShrink: 0
        }} />
      )}
    </div>
  )
}
