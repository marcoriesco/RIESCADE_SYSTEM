import React, { useState, useEffect } from 'react'
import { ThemeElement } from '../../../../shared/types/theme'
import { getBaseStyle } from '../utils'

interface Props {
  element: ThemeElement
  data?: any
}

export const TextElement: React.FC<Props> = ({ element, data }) => {
  const baseStyle = getBaseStyle(element)
  const { extra } = element

  let content = element.text || extra?.text || ''
  
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    if (element.name === 'clock' || element.type === 'datetime') {
      const timer = setInterval(() => setCurrentTime(new Date()), 1000)
      return () => clearInterval(timer)
    }
  }, [element.name, element.type])

  // Handle md_ metadata mapping
  if (!content && element.name.startsWith('md_')) {
    const metadataMap: Record<string, string[]> = {
      'md_name': ['name'],
      'md_description': ['desc', 'description'],
      'md_developer': ['developer'],
      'md_publisher': ['publisher'],
      'md_genre': ['genre'],
      'md_players': ['players'],
      'md_playcount': ['playcount'],
      'md_lastplayed': ['lastplayed'],
      'md_releasedate': ['releasedate'],
      'md_gametime': ['gametime']
    }
    
    const keys = metadataMap[element.name] || [element.name.replace('md_', '')]
    for (const k of keys) {
      if (data?.[k]) {
        content = data[k]
        break
      }
    }
    if (!content) content = data?.[element.name] || ''
  }

  // Special case for logoText: if empty, use system fullname
  if (!content && element.name === 'logoText') {
    content = data?.['system.fullName'] || data?.fullname || data?.name || ''
  }

  // Special case for systemInfo: game count
  if (!content && element.name === 'systemInfo') {
    content = `${data?.['system.gamecount'] || data?.gamecount || 0} GAMES AVAILABLE`
  }

  // Special case for clock
  if (!content && (element.name === 'clock' || element.type === 'datetime')) {
    const format = extra?.format || '%H:%M'
    const hours = currentTime.getHours().toString().padStart(2, '0')
    const mins = currentTime.getMinutes().toString().padStart(2, '0')
    content = format.replace('%H', hours).replace('%M', mins)
  }
  
  // Handle dynamic text variations if content is an array (from ThemeParser)
  if (Array.isArray(content)) {
    // Find the first matching variation
    const match = content.find(v => {
      if (typeof v !== 'object') return false
      const condition = v.if
      if (condition && condition.includes('system.')) {
        // Simple evaluation: "${system.name} == 'val'"
        const evalMatch = condition.match(/\${system\.name}\s*==\s*'(.*?)'/)
        if (evalMatch) {
          return data?.['system.name'] === evalMatch[1]
        }
      }
      return !condition // Default match
    })
    content = match ? (match.text || match) : (content[0]?.text || content[0])
  }

  // Resolve placeholders: {system:fullName}, {game:name}, etc.
  if (typeof content === 'string') {
    content = content.replace(/{(.*?)}/g, (match, key) => {
      return data?.[key] !== undefined ? data[key] : match
    })
  }
  
  // Handle objects from fast-xml-parser (e.g. <text if="...">Content</text>)
  if (typeof content === 'object' && content !== null) {
    content = content['#text'] || content.text || JSON.stringify(content)
  }

  const style: React.CSSProperties = {
    ...baseStyle,
    display: 'flex',
    alignItems: element.extra?.verticalAlignment === 'center' ? 'center' : 'flex-start',
    justifyContent: element.extra?.alignment === 'center' ? 'center' : (element.extra?.alignment === 'right' ? 'flex-end' : 'flex-start'),
    whiteSpace: element.size && element.size[0] > 0 ? 'normal' : 'nowrap',
    fontSize: element.extra?.fontSize ? `${parseFloat(element.extra.fontSize) * 100}vh` : '2.5vh',
    fontFamily: 'inherit',
    lineHeight: 1.2,
    textAlign: (element.extra?.alignment as any) || 'left',
    textShadow: extra?.glowColor ? `${extra.glowOffset || 0}px ${extra.glowOffset || 0}px ${extra.glowSize || 0}px #${extra.glowColor}` : undefined
  }

  // Final resolution of ${var} and {var} variables
  if (typeof content === 'string') {
    // Match both ${var} and {var}
    content = content.replace(/\$?\{(.*?)\}/g, (m, name) => {
      // In EmulationStation, sometimes variables are lowercase, sometimes camelCase.
      const resolved = data?.[name] !== undefined ? data[name] : data?.[name.toLowerCase()]
      return resolved !== undefined ? resolved : m
    })
  }

  // Handle [bracketed] text formatting (RetroBat/Batocera extraTextColor feature)
  const extraTextColor = element.extra?.extraTextColor
  const renderFormattedText = (text: string) => {
    if (!extraTextColor) return text
    
    // Split the text by [ ] brackets
    const regex = /(.*?)\[(.*?)\](.*)/
    const match = text.match(regex)
    
    if (match) {
      return (
        <>
          {match[1]}
          <span style={{ color: `#${extraTextColor.substring(0, 6)}`, opacity: extraTextColor.length === 8 ? parseInt(extraTextColor.substring(6, 8), 16) / 255 : 1 }}>
            {match[2]}
          </span>
          {match[3] ? renderFormattedText(match[3]) : ''}
        </>
      )
    }
    return text
  }

  return (
    <div style={style}>
      {renderFormattedText(String(content))}
    </div>
  )
}
