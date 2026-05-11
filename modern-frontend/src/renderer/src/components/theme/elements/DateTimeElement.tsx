import React from 'react'
import { ThemeElement } from '../../../../shared/types/theme'
import { getBaseStyle } from '../utils'

interface Props {
  element: ThemeElement
  data?: any
}

export const DateTimeElement: React.FC<Props> = ({ element, data }) => {
  const baseStyle = getBaseStyle(element)
  const { extra } = element
  
  // Find the date value in data (e.g. releasedate, lastplayed)
  const dateValue = data?.[element.name.replace('md_', '')] || data?.releasedate
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    try {
      // ES dates are often YYYYMMDDTHHMMSS
      const year = dateStr.substring(0, 4)
      const month = dateStr.substring(4, 6)
      const day = dateStr.substring(6, 8)
      
      if (extra?.format === '%Y') return year
      return `${day}/${month}/${year}`
    } catch (e) {
      return dateStr
    }
  }

  return (
    <div style={{ ...baseStyle, fontSize: element.fontSize ? `${element.fontSize * 100}vh` : '2vh' }}>
      {formatDate(dateValue)}
    </div>
  )
}
