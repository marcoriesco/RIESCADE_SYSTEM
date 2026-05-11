import React from 'react'
import { ThemeElement } from '../../../../shared/types/theme'
import { getBaseStyle } from '../utils'
import { ThemeElementItem } from '../ThemeRenderer'

interface Props {
  element: ThemeElement
  data?: any
}

export const ContainerElement: React.FC<Props> = ({ element, data }) => {
  const baseStyle = getBaseStyle(element)
  
  // Containers in our ThemeView are currently flattened, 
  // but if we had a nested structure, we would render children here.
  // For now, it's just a positioned div that might have a background color.
  
  const style: React.CSSProperties = {
    ...baseStyle,
    overflow: 'hidden'
  }

  return (
    <div style={style}>
      {/* If children were supported, they would go here */}
    </div>
  )
}
