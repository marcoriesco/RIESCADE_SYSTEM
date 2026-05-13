import React, { useEffect, useRef } from 'react'

interface Props {
  data: any
}

export const WebGamelistElement: React.FC<Props> = ({ data }) => {
  const games = data?.games || []
  const selectedIndex = games.findIndex((g: any) => g.path === data?.path)
  const safeIndex = selectedIndex === -1 ? 0 : selectedIndex
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to keep selected item visible
  useEffect(() => {
    if (!containerRef.current) return
    const items = containerRef.current.querySelectorAll('.gamelist-item')
    if (items[safeIndex]) {
      items[safeIndex].scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [safeIndex])

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

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {games.map((game: any, index: number) => {
        const isSelected = index === safeIndex
        const dist = Math.abs(index - safeIndex)

        return (
          <div
            key={game.path || index}
            className={`gamelist-item riescade-list-item ${isSelected ? 'selected' : ''}`}
            style={{
              padding: '6px 20px',
              display: 'flex',
              alignItems: 'center',
              opacity: isSelected ? 1 : Math.max(0.3, 1 - dist * 0.15),
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
      })}
    </div>
  )
}
