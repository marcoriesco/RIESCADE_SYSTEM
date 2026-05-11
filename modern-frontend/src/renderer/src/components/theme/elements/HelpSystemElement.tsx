import React from 'react'
import { ThemeElement } from '../../../../shared/types/theme'
import { getBaseStyle } from '../utils'

interface Props {
  element: ThemeElement
  data?: any
}

export const HelpSystemElement: React.FC<Props> = ({ element }) => {
  const baseStyle = getBaseStyle(element)

  return (
    <div style={{
      ...baseStyle,
      display: 'flex',
      gap: '20px',
      alignItems: 'center',
      color: '#fff',
      fontSize: '14px',
      opacity: 0.7
    }}>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        <div style={{ background: '#fff', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>A</div>
        <span>SELECT</span>
      </div>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        <div style={{ background: '#fff', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>B</div>
        <span>BACK</span>
      </div>
    </div>
  )
}
