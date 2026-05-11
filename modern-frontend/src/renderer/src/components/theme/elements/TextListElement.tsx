import React from 'react'
import { ThemeElement } from '../../../../shared/types/theme'
import { getBaseStyle } from '../utils'

interface Props {
  element: ThemeElement
  data?: any
}

export const TextListElement: React.FC<Props> = ({ element, data }) => {
  const baseStyle = getBaseStyle(element)
  const { extra } = element
  
  const games = data?.games || []
  const selectedIndex = data?.selectedIndex || 0
  
  const selectorColor = extra?.selectorColor ? `#${String(extra.selectorColor).substring(0, 6)}` : 'yellow'
  const selectedColor = extra?.selectedColor ? `#${String(extra.selectedColor).substring(0, 6)}` : 'black'
  const primaryColor = extra?.primaryColor ? `#${String(extra.primaryColor).substring(0, 6)}` : 'white'
  const secondaryColor = extra?.secondaryColor ? `#${String(extra.secondaryColor).substring(0, 6)}` : 'gray'

  const style: React.CSSProperties = {
    ...baseStyle,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontSize: extra?.fontSize ? `${parseFloat(extra.fontSize) * 100}vh` : '2.5vh',
    textAlign: (extra?.alignment as any) || 'left'
  }

  return (
    <div style={style}>
      {games.map((game: any, i: number) => {
        const isSelected = i === selectedIndex
        return (
          <div 
            key={game.id || game.path}
            style={{
              padding: '2px 10px',
              backgroundColor: isSelected ? selectorColor : 'transparent',
              color: isSelected ? selectedColor : (game.folder ? secondaryColor : primaryColor),
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden'
            }}
          >
            {game.name}
          </div>
        )
      })}
    </div>
  )
}
