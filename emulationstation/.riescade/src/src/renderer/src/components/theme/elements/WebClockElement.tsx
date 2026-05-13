import React, { useState, useEffect } from 'react'

interface Props {
  format?: string // HH:mm:ss, HH:mm, hh:mm:ss a, etc.
  displayDate?: boolean
  dateFormat?: string
}

export const WebClockElement: React.FC<Props> = ({ 
  format = 'HH:mm', 
  displayDate = false, 
  dateFormat = 'DD/MM/YYYY' 
}) => {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date, fmt: string) => {
    let h = date.getHours()
    const m = date.getMinutes().toString().padStart(2, '0')
    const s = date.getSeconds().toString().padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    
    let displayH = h
    if (fmt.includes('hh')) {
      displayH = h % 12 || 12
    }
    const hStr = displayH.toString().padStart(2, '0')

    let result = fmt
      .replace('HH', h.toString().padStart(2, '0'))
      .replace('hh', hStr)
      .replace('mm', m)
      .replace('ss', s)
      .replace('a', ampm)
      .replace('A', ampm)
    
    return result
  }

  const formatDate = (date: Date, fmt: string) => {
    const d = date.getDate().toString().padStart(2, '0')
    const m = (date.getMonth() + 1).toString().padStart(2, '0')
    const y = date.getFullYear().toString()

    return fmt
      .replace('DD', d)
      .replace('MM', m)
      .replace('YYYY', y)
      .replace('YY', y.substring(2))
  }

  return (
    <div className="riescade-clock-container">
      <span className="riescade-clock-time">{formatTime(now, format)}</span>
      {displayDate && (
        <span className="riescade-clock-date" style={{ marginLeft: '10px' }}>
          {formatDate(now, dateFormat)}
        </span>
      )}
    </div>
  )
}
