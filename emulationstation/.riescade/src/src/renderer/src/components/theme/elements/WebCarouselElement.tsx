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
}

export const WebCarouselElement: React.FC<Props> = ({
  direction = 'horizontal',
  mediaSource = 'theme',
  itemsCount,
  data,
  themePath,
  isGame,
  logoScale = 0.5,
  logoSelectedScale = 1.0
}) => {
  const items = isGame ? (data?.games || []) : (data?.systems || [])
  const currentItemName = isGame ? data?.path : data?.['system.name']

  const selectedIndex = items.findIndex((s: any) =>
    isGame ? s.path === currentItemName : s.name === currentItemName
  )
  const safeSelectedIndex = selectedIndex === -1 ? 0 : selectedIndex

  const distance = 100 / itemsCount
  const halfCount = Math.floor(itemsCount / 2)

  const itemsToShow: any[] = []
  if (items.length > 0) {
    items.forEach((item: any, idx: number) => {
      let diff = idx - safeSelectedIndex
      
      // Shortest path for wrap-around
      if (diff > items.length / 2) diff -= items.length
      else if (diff < -items.length / 2) diff += items.length

      // Render if close enough to viewport, or if we have few items
      if (Math.abs(diff) <= halfCount + 2 || items.length <= itemsCount + 2) {
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
      width: '90%',
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
            distance={distance}
            isVertical={isVertical}
            logoScale={logoScale}
            logoSelectedScale={logoSelectedScale}
            assetPath={assetPath}
            themePath={themePath}
          />
        )
      })}
    </div>
  )
}

const CarouselItemNode = ({ item, distance, isVertical, logoScale, logoSelectedScale, assetPath, themePath }: any) => {
  const [imageFailed, setImageFailed] = React.useState(false)
  const { data: itemData, offset, isSelected } = item
  
  const absOffset = Math.abs(offset)
  const pos = 50 + offset * distance
  const scale = isSelected ? logoSelectedScale : logoScale
  const opacity = isSelected ? 1.0 : 0.5
  const saturation = isSelected ? 1 : 0
  const isVisible = absOffset <= Math.floor(100 / distance / 1.5)
  const zIndex = isSelected ? 50 : 20 - absOffset

  return (
    <div
      className={`carousel-item ${isSelected ? 'selected' : ''}`}
      style={{
        position: 'absolute',
        left: isVertical ? '50%' : `${pos}%`,
        top: isVertical ? `${pos}%` : '50%',
        transform: `translate(-50%, -50%) scale(${scale})`,
        width: isVertical ? '90%' : '20%',
        height: isVertical ? '20%' : '80%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isVisible ? opacity : 0,
        filter: `saturate(${saturation})`,
        zIndex,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'transform, opacity'
      }}
    >
      {!imageFailed ? (
        <img
          src={assetPath}
          style={{
            maxWidth: '100%',
            maxHeight: '60%',
            objectFit: 'contain',
          }}
          alt={itemData.name}
          onError={(e) => {
            if (!item.isGame) {
              const sysName = itemData.name === 'all' ? 'auto-allgames' : itemData.name
              const fbPath = resolvePath(`${themePath}/assets/logos/collections/${sysName}.png`)
              if (e.currentTarget.src !== fbPath) {
                e.currentTarget.src = fbPath
              } else {
                setImageFailed(true)
              }
            } else {
              setImageFailed(true)
            }
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
