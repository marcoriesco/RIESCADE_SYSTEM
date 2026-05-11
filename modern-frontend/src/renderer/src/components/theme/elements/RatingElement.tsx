import React from 'react'
import { ThemeElement } from '../../../../shared/types/theme'
import { getBaseStyle } from '../utils'

interface Props {
  element: ThemeElement
  data?: any
}

export const RatingElement: React.FC<Props> = ({ element, data }) => {
  const baseStyle = getBaseStyle(element)
  const rating = data?.rating || 0
  
  const style: React.CSSProperties = {
    ...baseStyle,
    display: 'flex',
    fontSize: baseStyle.height || '2vh',
    gap: '2px'
  }

  // ES rating is 0 to 1
  const stars = Math.round(rating * 5)

  return (
    <div style={style}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ color: i < stars ? baseStyle.color : 'rgba(255,255,255,0.2)' }}>
          {i < stars ? '★' : '☆'}
        </span>
      ))}
    </div>
  )
}
