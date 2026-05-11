import { create } from 'zustand'

interface SettingValue {
  value: any
  type: 'string' | 'bool' | 'int' | 'float'
}

interface SettingsState {
  settings: Record<string, SettingValue>
  fetchSettings: () => Promise<void>
  saveSetting: (name: string, value: any, type: 'string' | 'bool' | 'int' | 'float') => Promise<void>
  getSetting: (name: string, defaultValue?: any) => any
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {},
  fetchSettings: async () => {
    const settings = await window.api.getSettings()
    set({ settings })
  },
  saveSetting: async (name, value, type) => {
    await window.api.saveSetting(name, value, type)
    set((state) => ({
      settings: {
        ...state.settings,
        [name]: { value, type }
      }
    }))
  },
  getSetting: (name, defaultValue = null) => {
    return get().settings[name]?.value ?? defaultValue
  }
}))
