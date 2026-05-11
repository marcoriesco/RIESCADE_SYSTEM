export interface ThemeView {
  name: string
  elements: ThemeElement[]
}

export interface ThemeElement {
  type: string
  name: string
  pos?: [number, number]
  size?: [number, number]
  maxSize?: [number, number]
  origin?: [number, number]
  path?: string | string[]
  color?: string
  fontPath?: string
  fontSize?: number
  alignment?: 'left' | 'center' | 'right'
  extra?: Record<string, any>
}

export interface ThemeConfig {
  name: string
  path: string
  defaultView?: string
  views: Record<string, ThemeView | string>
  isWebTheme?: boolean
}
