import { create } from 'zustand'
import { System, Game } from '../../../shared/types'

interface LibraryState {
  systems: System[]
  games: Game[]
  selectedSystem: System | null
  systemIndex: number
  selectedGameIndex: number
  loading: boolean
  theme: any | null
  themes: string[]
  fetchSystems: () => Promise<void>
  fetchGames: (system: System) => Promise<void>
  fetchTheme: (themeName: string) => Promise<void>
  fetchThemes: () => Promise<void>
  setSelectedSystem: (system: System | null) => void
  setSystemIndex: (index: number | ((prev: number) => number)) => void
  setSelectedGameIndex: (index: number) => void
}

export const useLibraryStore = create<LibraryState>((set) => ({
  systems: [],
  games: [],
  selectedSystem: null,
  systemIndex: 0,
  selectedGameIndex: 0,
  theme: null,
  themes: [],
  loading: false,
  fetchSystems: async () => {
    set({ loading: true })
    try {
      // @ts-ignore (exposed via preload)
      const systems = await window.api.getSystems()
      set({ systems, loading: false })
    } catch (error) {
      console.error('Failed to fetch systems:', error)
      set({ loading: false })
    }
  },
  fetchGames: async (system: System) => {
    set({ loading: true, games: [], selectedGameIndex: 0 })
    try {
      // @ts-ignore (exposed via preload)
      const games = await window.api.getGames(system.name)
      set({ games, loading: false })
    } catch (error) {
      console.error('Failed to fetch games:', error)
      set({ loading: false })
    }
  },
  fetchTheme: async (themeName: string) => {
    try {
      // @ts-ignore
      const theme = await window.api.loadTheme(themeName)
      set({ theme })
    } catch (error) {
      console.error('Failed to load theme:', error)
    }
  },
  fetchThemes: async () => {
    try {
      // @ts-ignore
      const themes = await window.api.getThemes()
      set({ themes })
    } catch (error) {
      console.error('Failed to fetch themes:', error)
    }
  },
  setSelectedSystem: (system) => set({ selectedSystem: system, selectedGameIndex: 0 }),
  setSystemIndex: (index) => set((state) => ({ 
    systemIndex: typeof index === 'function' ? index(state.systemIndex) : index 
  })),
  setSelectedGameIndex: (index) => set({ selectedGameIndex: index })
}))
