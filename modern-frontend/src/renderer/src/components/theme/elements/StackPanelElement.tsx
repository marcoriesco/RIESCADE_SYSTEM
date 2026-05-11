import React from 'react'
import { ThemeElement } from '../../../../shared/types/theme'
import { getBaseStyle } from '../utils'

interface Props {
  element: ThemeElement
  data?: any
}

export const StackPanelElement: React.FC<Props> = ({ element, data }) => {
  const baseStyle = getBaseStyle(element)
  const orientation = element.extra?.orientation || 'vertical'
  
  const style: React.CSSProperties = {
    ...baseStyle,
    display: 'flex',
    flexDirection: orientation === 'horizontal' ? 'row' : 'column',
    gap: element.extra?.margin ? `${parseFloat(element.extra.margin) * 100}vh` : '0'
  }

  return (
    <div style={style}>
      {/* StackPanel usually contains other elements in ES. 
          Our current parser flattens everything, so this is just a container for now.
          In the future, we should update the parser to preserve hierarchy. */}
    </div>
  )
}
