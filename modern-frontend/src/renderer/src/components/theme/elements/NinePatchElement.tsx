import React from 'react'
import { ThemeElement } from '../../../../shared/types/theme'
import { getBaseStyle, resolvePath } from '../utils'

interface Props {
  element: ThemeElement
  data?: any
}

export const NinePatchElement: React.FC<Props> = ({ element, data }) => {
  const baseStyle = getBaseStyle(element)
  const { path, extra } = element
  
  const resolvedPath = resolvePath(Array.isArray(path) ? path[0] : path, data)
  
  // ES NinePatch edge sizes are normalized or in pixels? 
  // Usually they are in pixels if not specified otherwise, but ES uses normalized often.
  // In Batocera, <edgeColor>, <centerColor>, <cornerSize>
  const edgeSize = parseFloat(extra?.cornerSize || '16') // Default 16px
  
  const style: React.CSSProperties = {
    ...baseStyle,
    borderStyle: 'solid',
    borderWidth: `${edgeSize}px`,
    borderImageSource: `url("${resolvedPath}")`,
    borderImageSlice: `${edgeSize} fill`,
    borderImageRepeat: 'stretch',
    background: 'none'
  }

  return <div style={style} />
}
