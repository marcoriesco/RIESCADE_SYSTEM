import React, { useState, forwardRef } from 'react'
import { ThemeElement } from '../../../../shared/types/theme'
import { getBaseStyle, resolvePath } from '../utils'
import { useLibraryStore } from '../../../store/useLibraryStore'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  element: ThemeElement
  data?: any 
}

export const CarouselElement: React.FC<Props> = ({ element, data }) => {
  const baseStyle = getBaseStyle(element)
  const { extra } = element

  // ES Carousel Parameters from XML
  const logoSize = extra?.logoSize ? String(extra.logoSize).split(/\s+/).map(parseFloat) : [0.24, 0.1]
  const logoScale = parseFloat(extra?.logoScale || '1.2')
  const maxLogoCount = parseInt(extra?.maxLogoCount || extra?.maxItemCount || '3')
  const carouselType = extra?.type || 'horizontal'
  
  const isGameCarousel = element.type === 'gamecarousel'
  const items = isGameCarousel ? (data?.games || []) : (data?.systems || [])
  const currentItemName = isGameCarousel ? (data?.name) : (data?.['system.name'])
  
  const selectedIndex = items.findIndex((s: any) => (isGameCarousel ? s.path === data?.path : s.name === currentItemName))
  const safeSelectedIndex = selectedIndex === -1 ? 0 : selectedIndex

  const { theme } = useLibraryStore.getState()
  const themePath = theme?.path || ''

  // Distance between items in percentage (relative to the container)
  const distance = 100 / maxLogoCount
  const halfCount = Math.floor(maxLogoCount / 2) + 1 

  const itemsToShow = []
  if (items.length > 0) {
    for (let i = -halfCount; i <= halfCount; i++) {
      const idx = (safeSelectedIndex + i + items.length) % items.length
      if (items[idx]) {
        itemsToShow.push({
          data: items[idx],
          offset: i,
          isSelected: i === 0,
          isGame: isGameCarousel
        })
      }
    }
  }

  const containerStyle: React.CSSProperties = {
    ...baseStyle,
    overflow: 'visible',
    background: baseStyle.backgroundColor,
    pointerEvents: 'auto'
  }

  return (
    <div style={containerStyle}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <AnimatePresence mode="popLayout" initial={false}>
          {itemsToShow.map((item) => (
            <CarouselItem 
              key={item.data.path || item.data.name}
              item={item}
              distance={distance}
              carouselType={carouselType}
              logoSize={logoSize}
              logoScale={logoScale}
              themePath={themePath}
              theme={theme}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

const CarouselItem = forwardRef<HTMLDivElement, { 
  item: any, 
  distance: number,
  carouselType: string,
  logoSize: number[], 
  logoScale: number, 
  themePath: string, 
  theme: any 
}>(({ item, distance, carouselType, logoSize, logoScale, themePath, theme }, ref) => {
  const [error, setError] = useState(false)
  const { data, offset, isSelected, isGame } = item
  
  // Logic: Position = Center (50%) + (offset * distance)
  const isVertical = carouselType.includes('vertical')
  const isWheel = carouselType.includes('wheel')
  const pos = 50 + (offset * distance)
  
  let assetPath = ''
  if (isGame) {
    const imageSource = theme?.views?.system?.elements?.find((e: any) => e.type === 'gamecarousel')?.extra?.imageSource || 'image'
    assetPath = resolvePath(data?.[imageSource] || data?.image || data?.marquee, data)
  } else {
    const sysName = data.name === 'all' ? 'auto-allgames' : data.name
    assetPath = resolvePath(`${themePath}/resources/logos/${sysName}.png`)
  }

  // logoSize in ES is relative to the SCREEN, not the container.
  // Using vw/vh matches NORMALIZED_PAIR behavior perfectly.
  const width = `${logoSize[0] * 100}vw`
  const height = logoSize[1] > 0 ? `${logoSize[1] * 100}vh` : 'auto'

  const renderContent = () => {
    if (error || !assetPath) {
      return (
        <div style={{ 
          width: '100%',
          textAlign: 'center',
          color: '#fff',
          fontSize: '2vh',
          fontWeight: 'bold',
          textTransform: 'uppercase'
        }}>
          {data.fullname || data.name}
        </div>
      )
    }

    return (
      <img 
        src={assetPath} 
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
        alt={data.name}
        onError={(e) => {
          if (!isGame) {
             const sysName = data.name === 'all' ? 'auto-allgames' : data.name
             const collectionPath = resolvePath(`${themePath}/resources/logos/collections/${sysName}.png`)
             if (e.currentTarget.src !== collectionPath) {
                e.currentTarget.src = collectionPath
             } else {
                setError(true)
             }
          } else {
             setError(true)
          }
        }}
      />
    )
  }

  const logoRotation = parseFloat(theme?.views?.system?.elements?.find((e: any) => e.type === 'gamecarousel' || e.type === 'carousel')?.extra?.logoRotation || '7.5')
  const rotationOriginExtra = theme?.views?.system?.elements?.find((e: any) => e.type === 'gamecarousel' || e.type === 'carousel')?.extra?.logoRotationOrigin
  const transformOrigin = rotationOriginExtra ? `${parseFloat(rotationOriginExtra.split(' ')[0]) * 100}% ${parseFloat(rotationOriginExtra.split(' ')[1]) * 100}%` : 'center center'

  return (
    <motion.div 
      ref={ref}
      layout
      initial={{ 
        left: isVertical ? '50%' : `${pos}%`, 
        top: isVertical ? `${pos}%` : '50%', 
        x: '-50%',
        y: '-50%',
        opacity: 0, 
        scale: 0.5, 
        rotate: 0 
      }}
      animate={{ 
        left: isVertical ? '50%' : `${pos}%`, 
        top: isVertical ? `${pos}%` : '50%', 
        x: '-50%',
        y: '-50%',
        opacity: Math.abs(offset) > Math.floor(100 / distance / 2) ? 0 : 1,
        scale: isSelected ? logoScale : 1, // ES default unselected scale is 1
        rotate: isWheel ? (isSelected ? 0 : (offset * logoRotation)) : 0,
        zIndex: isSelected ? 10 : 5 - Math.abs(offset)
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ 
        position: 'absolute',
        width,
        height,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        transformOrigin
      }}
    >
      {renderContent()}
    </motion.div>
  )
})

CarouselItem.displayName = 'CarouselItem'
