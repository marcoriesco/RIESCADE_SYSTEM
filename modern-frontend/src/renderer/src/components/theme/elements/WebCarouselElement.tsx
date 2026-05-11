import React, { forwardRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { resolvePath } from '../utils'

interface Props {
  type: string
  direction?: string
  mediaSource?: string
  itemsCount: number
  data: any
  themePath: string
  isGame: boolean
}

export const WebCarouselElement: React.FC<Props> = ({ direction = 'horizontal', mediaSource = 'theme', itemsCount, data, themePath, isGame }) => {
  const items = isGame ? (data?.games || []) : (data?.systems || [])
  const currentItemName = isGame ? (data?.name) : (data?.['system.name'])
  
  const selectedIndex = items.findIndex((s: any) => (isGame ? s.path === data?.path : s.name === currentItemName))
  const safeSelectedIndex = selectedIndex === -1 ? 0 : selectedIndex

  // Distance between items in percentage (relative to the container)
  const distance = 100 / itemsCount
  const halfCount = Math.floor(itemsCount / 2)

  const itemsToShow: any[] = []
  if (items.length > 0) {
    for (let i = -halfCount; i <= halfCount; i++) {
      const idx = (safeSelectedIndex + i + items.length) % items.length
      if (items[idx]) {
        itemsToShow.push({
          data: items[idx],
          offset: i,
          isSelected: i === 0,
          isGame
        })
      }
    }
  }

  const isVertical = direction === 'vertical'

  return (
    <div style={{ position: 'relative', width: '90%', height: '100%', margin: '0 auto', overflow: 'visible', perspective: '1500px' }}>
      <AnimatePresence mode="popLayout" initial={false}>
        {itemsToShow.map((item) => (
          <CarouselItem 
            key={item.data.path || item.data.name}
            item={item}
            distance={distance}
            isVertical={isVertical}
            themePath={themePath}
            mediaSource={mediaSource}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

const CarouselItem = forwardRef<HTMLDivElement, { 
  item: any, 
  distance: number,
  isVertical: boolean,
  themePath: string,
  mediaSource: string
}>(({ item, distance, isVertical, themePath, mediaSource }, ref) => {
  const { data, offset, isSelected, isGame } = item
  
  // Premium Coverflow Logic
  const absOffset = Math.abs(offset)
  
  // Calculate Base Position
  const pos = 50 + (offset * distance)
  
  // Linear transforms for uniform spacing
  const zIndex = isSelected ? 50 : 20 - absOffset
  const rotateY = 0
  const rotateX = 0
  const zTranslate = 0
  
  const scale = isSelected ? 1.0 : 0.5
  const opacity = isSelected ? 1.0 : 0.5
  const saturation = isSelected ? 1 : 0
  
  // Fade out items completely if they are too far
  const isVisible = absOffset <= Math.floor(100 / distance / 1.5)
  
  let assetPath = ''
  if (isGame) {
    if (mediaSource === 'image') assetPath = resolvePath(data?.image, data)
    else if (mediaSource === 'marquee') assetPath = resolvePath(data?.marquee, data)
    else assetPath = resolvePath(data?.image || data?.marquee, data)
  } else {
    const sysTheme = data.theme || data.name
    const sysName = data.name === 'all' ? 'auto-allgames' : sysTheme
    
    if (mediaSource === 'theme') {
      assetPath = resolvePath(`${themePath}/assets/logos/${sysName}.png`)
    } else if (mediaSource.startsWith('./') || mediaSource.startsWith('../')) {
      // Resolve relative path from theme root
      const cleanPath = mediaSource.replace('./', '')
      assetPath = resolvePath(`${themePath}/${cleanPath}/${sysName}.png`)
    } else {
      assetPath = resolvePath(data.image || `${themePath}/assets/logos/${sysName}.png`)
    }
  }

  return (
    <motion.div 
      ref={ref}
      className={`carousel-item ${isSelected ? 'selected' : ''}`}
      initial={{ 
        left: isVertical ? '50%' : `${pos}%`, 
        top: isVertical ? `${pos}%` : '50%', 
        x: '-50%', y: '-50%',
        rotateY: isVertical ? 0 : rotateY,
        rotateX: isVertical ? rotateX : 0,
        z: zTranslate,
        opacity: 0,
        scale: 0.5
      }}
      animate={{ 
        left: isVertical ? '50%' : `${pos}%`, 
        top: isVertical ? `${pos}%` : '50%', 
        x: '-50%', y: '-50%',
        rotateY: isVertical ? 0 : rotateY,
        rotateX: isVertical ? rotateX : 0,
        z: zTranslate,
        opacity: isVisible ? opacity : 0,
        scale: scale,
        zIndex: zIndex
      }}
      transition={{ 
        type: 'spring', 
        stiffness: 300, 
        damping: 30,
        mass: 1
      }}
      style={{ 
        position: 'absolute',
        width: isVertical ? '90%' : '20%', 
        height: isVertical ? '20%' : '80%',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        transformStyle: 'preserve-3d',
        filter: `saturate(${saturation})`
      }}
    >
      <img 
        src={assetPath} 
        style={{ 
          maxWidth: '100%', 
          maxHeight: '60%', 
          objectFit: 'contain',
          transform: 'translateZ(20px)', // Small parallax pop
        }} 
        alt={data.name}
        onError={(e) => {
           if (!isGame) {
             const sysName = data.name === 'all' ? 'auto-allgames' : data.name
             e.currentTarget.src = resolvePath(`${themePath}/assets/logos/collections/${sysName}.png`)
           }
        }}
      />
    </motion.div>
  )
})
