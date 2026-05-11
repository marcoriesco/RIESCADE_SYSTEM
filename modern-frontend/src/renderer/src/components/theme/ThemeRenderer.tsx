import React, { useState } from 'react'
import { ThemeView, ThemeElement } from '../../../../shared/types/theme'
import { ImageElement } from './elements/ImageElement'
import { TextElement } from './elements/TextElement'
import { VideoElement } from './elements/VideoElement'
import { DateTimeElement } from './elements/DateTimeElement'
import { CarouselElement } from './elements/CarouselElement'
import { HelpSystemElement } from './elements/HelpSystemElement'

import { RatingElement } from './elements/RatingElement'
import { NinePatchElement } from './elements/NinePatchElement'
import { ContainerElement } from './elements/ContainerElement'
import { StackPanelElement } from './elements/StackPanelElement'
import { TextListElement } from './elements/TextListElement'
import { ImageGridElement } from './elements/ImageGridElement'

interface Props {
  view?: ThemeView
  data?: any
}

const elementComponents: Record<string, React.FC<any>> = {
  image: ImageElement,
  text: TextElement,
  video: VideoElement,
  datetime: DateTimeElement,
  carousel: CarouselElement,
  gamecarousel: CarouselElement,
  helpsystem: HelpSystemElement,
  rating: RatingElement,
  ninepatch: NinePatchElement,
  container: ContainerElement,
  stackpanel: StackPanelElement,
  textlist: TextListElement,
  imagegrid: ImageGridElement
}

export const ThemeRenderer: React.FC<Props> = ({ view, data }) => {
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set())

  if (!view) return null

  // Sort elements by zIndex if available
  const sortedElements = [...view.elements].sort((a, b) => {
    const za = parseInt(a.extra?.zIndex || '0')
    const zb = parseInt(b.extra?.zIndex || '0')
    return za - zb
  })

  const handleImageError = (name: string) => {
    if (name === 'logo' || name === 'logoEffect' || name === 'logoEffectShadow') {
      setFailedLogos(prev => {
        const next = new Set(prev)
        next.add(name)
        return next
      })
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {sortedElements.map((element, index) => {
        // If it's a logo that failed, don't render it
        if (failedLogos.has(element.name)) return null

        // If it's logoText, only render it if the logo failed or doesn't exist
        if (element.name === 'logoText') {
          const logoElement = view.elements.find(e => e.name === 'logo')
          const logoFailed = failedLogos.has('logo')
          // If logo exists but hasn't failed yet, wait.
          if (logoElement && !logoFailed) return null
        }

        return (
          <ThemeElementItem 
            key={`${element.type}-${element.name}-${index}`} 
            element={element} 
            data={data}
            onImageError={() => handleImageError(element.name)}
          />
        )
      })}
    </div>
  )
}

interface ItemProps {
  element: ThemeElement
  data?: any
  onImageError?: () => void
}

const ThemeElementItem: React.FC<ItemProps> = ({ element, data, onImageError }) => {
  const Component = elementComponents[element.type]
  if (!Component) return null

  return <Component element={element} data={data} onImageError={onImageError} />
}
