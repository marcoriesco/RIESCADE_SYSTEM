import React, { useEffect, useRef, useState } from 'react'
import { FixedSizeList as List } from 'react-window'

interface Props {
  data: any
}

export const WebGamelistElement: React.FC<Props> = ({ data }) => {
  const games = data?.games || []
  const selectedIndex = games.findIndex((g: any) => g.path === data?.path)
  const safeIndex = selectedIndex === -1 ? 0 : selectedIndex
  
  const listRef = useRef<List>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(0)

  useEffect(() => {
    if (!wrapperRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    observer.observe(wrapperRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (listRef.current) {
      // Use center alignment to keep the selected game in the middle
      listRef.current.scrollToItem(safeIndex, 'center')
    }
  }, [safeIndex])

  const itemHeight = Math.max(30, containerHeight * 0.05) // 5vh approx

  const Row = ({ index, style }: any) => {
    const game = games[index]
    const isSelected = index === safeIndex
    return (
      <div 
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '20px',
          opacity: isSelected ? 1 : Math.max(0.3, 1 - (Math.abs(index - safeIndex) * 0.15)),
          transform: isSelected ? 'scale(1.05) translateX(10px)' : 'scale(1)',
          transformOrigin: 'left center',
          transition: 'all 0.15s ease-out'
        }}
        className={`riescade-list-item ${isSelected ? 'selected' : ''}`}
      >
        {game.name}
      </div>
    )
  }

  return (
    <div 
      ref={wrapperRef}
      id="gamelist-container-wrapper"
      style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden'
      }}
    >
      {!games.length ? (
        <div style={{ color: 'rgba(255,255,255,0.5)', padding: '20px', width: '100%', textAlign: 'center', marginTop: '20vh' }}>
          Nenhuma rom encontrada
        </div>
      ) : (
        containerHeight > 0 && (
          <List
            ref={listRef}
            height={containerHeight}
            itemCount={games.length}
            itemSize={itemHeight}
            width="100%"
            style={{ overflowX: 'hidden', overflowY: 'hidden' }} // Hide scrollbar
          >
            {Row}
          </List>
        )
      )}
    </div>
  )
}
