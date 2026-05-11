import React from 'react'
import { ThemeElement } from '../../../../shared/types/theme'
import { getBaseStyle, resolvePath } from '../utils'

interface Props {
  element: ThemeElement
  data?: any
}

export const ImageGridElement: React.FC<Props> = ({ element, data }) => {
  const baseStyle = getBaseStyle(element)
  const { extra } = element
  
  const games = data?.games || []
  const selectedIndex = data?.selectedIndex || 0
  
  // ES ImageGrid parameters
  const margin = parseFloat(extra?.margin || '0.01')
  
  const style: React.CSSProperties = {
    ...baseStyle,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: `${margin * 100}vh`,
    overflowY: 'auto',
    padding: '10px'
  }

  return (
    <div style={style}>
      {games.map((game: any, i: number) => {
        const isSelected = i === selectedIndex
        const imagePath = resolvePath(game.thumbnail || game.image, data)
        
        return (
          <div 
            key={game.id || game.path}
            style={{
              position: 'relative',
              aspectRatio: '1/1',
              border: isSelected ? '4px solid yellow' : '2px solid transparent',
              overflow: 'hidden',
              background: '#222'
            }}
          >
            {imagePath && (
              <img 
                src={imagePath} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                alt={game.name}
              />
            )}
            <div style={{
              position: 'absolute', bottom: 0, width: '100%', 
              background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '0.8rem', padding: '2px'
            }}>
              {game.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}
