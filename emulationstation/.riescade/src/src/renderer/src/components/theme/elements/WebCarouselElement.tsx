import React from 'react'
import { resolvePath } from '../utils'

interface Props {
  type: string
  direction?: string
  mediaSource?: string
  itemsCount: number
  data: any
  themePath: string
  isGame: boolean
  logoScale?: number
  logoSelectedScale?: number
  itemClass?: string
  itemsCountSelected?: number
  itemMarquee?: boolean
  itemMarqueeSource?: string
  itemBackground?: boolean
  itemBackgroundSource?: string
  gap?: number
  itemWidth?: number
  itemHeight?: number
}

export const WebCarouselElement: React.FC<Props> = ({
  direction = 'horizontal',
  mediaSource = 'theme',
  itemsCount,
  data,
  themePath,
  isGame,
  logoScale = 0.5,
  logoSelectedScale = 1.0,
  itemClass = 'riescade-carousel-item',
  itemsCountSelected,
  itemMarquee = false,
  itemMarqueeSource = './assets/logos',
  itemBackground = false,
  itemBackgroundSource = './assets/arts',
  gap = 20,
  itemWidth = 385,
  itemHeight = 385
}) => {
  const items = isGame ? (data?.games || []) : (data?.systems || [])
  const currentItemName = isGame ? data?.path : data?.['system.name']

  const selectedIndex = items.findIndex((s: any) =>
    isGame ? s.path === currentItemName : s.name === currentItemName
  )
  const safeSelectedIndex = selectedIndex === -1 ? 0 : selectedIndex

  const distance = 100 / itemsCount
  const halfCount = Math.floor(itemsCount / 2)
  
  // Default selected slot is center
  const activeSlot = itemsCountSelected !== undefined ? itemsCountSelected : halfCount + 1

  const itemsToShow: any[] = []
  if (items.length > 0) {
    items.forEach((item: any, idx: number) => {
      let diff = idx - safeSelectedIndex
      
      // Shortest path for wrap-around
      if (diff > items.length / 2) diff -= items.length
      else if (diff < -items.length / 2) diff += items.length

      // Render if close enough to viewport
      if (Math.abs(diff) <= itemsCount) {
        itemsToShow.push({
          data: item,
          offset: diff,
          isSelected: diff === 0,
          isGame
        })
      }
    })
  }

  const isVertical = direction === 'vertical'

  const getAssetPath = (itemData: any, isGameItem: boolean): string => {
    if (isGameItem) {
      if (mediaSource === 'image') return resolvePath(itemData?.image, itemData)
      if (mediaSource === 'marquee') return resolvePath(itemData?.marquee, itemData)
      return resolvePath(itemData?.image || itemData?.marquee, itemData)
    }

    const sysTheme = itemData.theme || itemData.name
    const sysName = itemData.name === 'all' ? 'auto-allgames' : sysTheme

    // Use custom marquee source if requested
    if (itemMarquee && itemMarqueeSource) {
      return resolvePath(`${themePath}/${itemMarqueeSource.replace('./', '')}/${sysName}.png`)
    }

    if (mediaSource === 'theme') {
      return resolvePath(`${themePath}/assets/logos/${sysName}.png`)
    }
    if (mediaSource.startsWith('./') || mediaSource.startsWith('../')) {
      const cleanPath = mediaSource.replace('./', '')
      return resolvePath(`${themePath}/${cleanPath}/${sysName}.png`)
    }
    return resolvePath(itemData.image || `${themePath}/assets/logos/${sysName}.png`)
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      margin: '0 auto',
      overflow: 'visible',
      perspective: '1500px'
    }}>
      {itemsToShow.map((item) => {
        const itemData = item.data
        const assetPath = getAssetPath(itemData, item.isGame)
        return (
          <CarouselItemNode 
            key={itemData.path || itemData.name}
            item={item}
            isVertical={isVertical}
            logoScale={logoScale}
            logoSelectedScale={logoSelectedScale}
            assetPath={assetPath}
            themePath={themePath}
            itemClass={itemClass}
            activeSlot={activeSlot}
            isCentered={itemsCountSelected === undefined}
            distance={distance}
            itemsCount={itemsCount}
            gap={gap}
            itemWidth={itemWidth}
            itemHeight={itemHeight}
            itemBackground={itemBackground}
            itemBackgroundSource={itemBackgroundSource}
          />
        )
      })}
    </div>
  )
}

const CarouselItemNode = ({ 
  item, isVertical, logoScale, logoSelectedScale, assetPath, themePath, itemClass, 
  activeSlot, gap, itemWidth, itemHeight, itemBackground, itemBackgroundSource,
  isCentered, distance, itemsCount
}: any) => {
  const [imageFailed, setImageFailed] = React.useState(false)
  const { data: itemData, offset, isSelected } = item
  
  const absOffset = Math.abs(offset)
  
  // Percentage-based size
  const sizePct = 100 / itemsCount
  
  // Calculate position
  let posValue = ''
  let transform = ''
  let isVisible = false

  if (isCentered) {
    // Percentage-based logic for centered carousels (Default Theme)
    const pos = 50 + offset * distance
    posValue = `${pos}%`
    transform = `translate(-50%, -50%) scale(${isSelected ? logoSelectedScale : logoScale})`
    isVisible = absOffset <= Math.floor(itemsCount / 2) + 1
  } else {
    // Percentage-based Slot logic (Switch Theme)
    const slotIndex = (activeSlot - 1) + offset
    // posValue = `calc(${slotIndex * sizePct}% + ${gap / 2}px)`
    posValue = `${slotIndex * sizePct}%`
    transform = `translate(0, -50%) scale(${isSelected ? logoSelectedScale : logoScale})`
    isVisible = slotIndex >= -1 && slotIndex <= itemsCount
  }

  const opacity = isSelected ? 1.0 : 0.8
  const saturation = isSelected ? 1 : 0.8
  const zIndex = isSelected ? 100 : 50 - absOffset

  const sysTheme = itemData.theme || itemData.name
  const sysName = itemData.name === 'all' ? 'auto-allgames' : sysTheme
  
  const artPath = itemBackground && itemBackgroundSource
    ? resolvePath(`${themePath}/${itemBackgroundSource.replace('./', '')}/${sysName}.jpg`)
    : (itemBackground && !item.isGame 
        ? resolvePath(`${themePath}/assets/arts/${sysName}.jpg`)
        : (itemBackground ? resolvePath(itemData.image || itemData.marquee, itemData) : ''))

  return (
    <div
      className={`${itemClass} ${isSelected ? 'selected' : ''}`}
      data-riescade-name={itemData.name}
      style={{
        position: 'absolute',
        left: isVertical ? '50%' : posValue,
        top: isVertical ? posValue : '50%',
        transform: transform,
        width: isVertical ? '90%' : `calc(${sizePct}% - ${gap}px)`,
        height: isVertical ? `calc(${sizePct}% - ${gap}px)` : '80%',
        margin: isVertical ? `0 0 0 ${gap / 2}px` : `0 0 0 ${gap / 2}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: isCentered ? 'center' : 'flex-end',
        paddingBottom: isCentered ? '0' : (isSelected ? '40px' : '20px'),
        opacity: isVisible ? opacity : 0,
        filter: `saturate(${saturation})`,
        zIndex,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'transform, opacity',
        '--item-art': `url("${artPath}")`,
        overflow: 'visible'
      } as any}
    >
      {!imageFailed ? (
        <img
          src={assetPath}
          style={{
            maxWidth: isCentered ? '100%' : '70%',
            maxHeight: isCentered ? '60%' : '25%',
            objectFit: 'contain',
            position: 'relative',
            zIndex: 2,
            filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.5))'
          }}
          alt={itemData.name}
          onError={(e) => {
            setImageFailed(true)
          }}
        />
      ) : (
        <span className="riescade-carousel-text">
          {itemData.fullname || itemData.name}
        </span>
      )}
    </div>
  )
}
