import { useEffect, useState, useMemo } from 'react'
import { useLibraryStore } from './store/useLibraryStore'
import { ThemeRenderer } from './components/theme/ThemeRenderer'
import { WebThemeRenderer } from './components/theme/WebThemeRenderer'
import { Menu } from './components/Menu'
import { LaunchScreen } from './components/LaunchScreen'

function App() {
  const { 
    systems, fetchSystems, 
    selectedSystem, setSelectedSystem, 
    systemIndex, setSystemIndex,
    selectedGameIndex, setSelectedGameIndex,
    theme, fetchTheme, 
    games, fetchGames 
  } = useLibraryStore()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLaunching, setIsLaunching] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)

  // Initial Load
  useEffect(() => {
    fetchSystems()
    window.api.getActiveTheme().then(themeName => {
      if (themeName) {
        fetchTheme(themeName)
        window.api.onThemeUpdated(() => fetchTheme(themeName))
      }
    })

    // Gamepad logic
    const updateGamepads = () => {
      const gamepads = navigator.getGamepads()
      const activeGamepads = Array.from(gamepads)
        .filter(gp => gp !== null)
        .map(gp => ({
          name: gp!.id,
          guid: gp!.id.match(/vendor: ([0-9a-f]{4}) product: ([0-9a-f]{4})/i) ? 
                `03000000${gp!.id.match(/vendor: ([0-9a-f]{4})/i)![1]}0000${gp!.id.match(/product: ([0-9a-f]{4})/i)![1]}000000000000` : 
                gp!.id,
          buttons: gp!.buttons.length,
          axes: gp!.axes.length,
          hats: 0 
        }))
      if (activeGamepads.length > 0) window.api.executeCommand('set-active-controllers', activeGamepads)
    }

    let lastInputTime = 0
    let rafId: number
    const pollGamepad = (time: number) => {
        const gp = navigator.getGamepads()[0]
        if (gp && time - lastInputTime > 200) {
            let key = ''
            if (gp.buttons[12]?.pressed || gp.axes[1] < -0.5) key = 'ArrowUp'
            else if (gp.buttons[13]?.pressed || gp.axes[1] > 0.5) key = 'ArrowDown'
            else if (gp.buttons[14]?.pressed || gp.axes[0] < -0.5) key = 'ArrowLeft'
            else if (gp.buttons[15]?.pressed || gp.axes[0] > 0.5) key = 'ArrowRight'
            else if (gp.buttons[4]?.pressed) key = 'PageDown'
            else if (gp.buttons[5]?.pressed) key = 'PageUp'
            else if (gp.buttons[0]?.pressed) key = 'Enter'
            else if (gp.buttons[1]?.pressed) key = 'Backspace'
            else if (gp.buttons[9]?.pressed) key = ' '
            if (key) {
                window.dispatchEvent(new KeyboardEvent('keydown', { key }))
                lastInputTime = time
            }
        }
        rafId = requestAnimationFrame(pollGamepad)
    }
    rafId = requestAnimationFrame(pollGamepad)
    window.addEventListener("gamepadconnected", updateGamepads)
    window.addEventListener("gamepaddisconnected", updateGamepads)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("gamepadconnected", updateGamepads)
      window.removeEventListener("gamepaddisconnected", updateGamepads)
    }
  }, [])

  useEffect(() => {
    if (selectedSystem) fetchGames(selectedSystem)
  }, [selectedSystem])

  // Initialization/Splash end condition
  useEffect(() => {
    if (systems.length > 0 && theme) {
      const timer = setTimeout(() => setIsInitializing(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [systems.length, theme])

  const currentSystem = systems[systemIndex]
  const currentGame = games[selectedGameIndex]

  // Prepare Theme Data
  const themeData = useMemo(() => {
    const sys = selectedSystem || currentSystem
    const baseData = {
      systems,
      games,
      'system.fullName': sys?.fullname || 'All Games',
      'system.name': sys?.name || 'all',
      'system.theme': sys?.theme || (sys?.name === 'all' ? 'auto-allgames' : (sys?.name || 'auto-allgames')),
      'system.gamecount': sys?.gamecount || 0,
      'system.manufacturer': (sys as any)?.manufacturer || '',
      'system.hardwareType': sys?.hardware || '',
      'system.releaseYear': (sys as any)?.releaseYear || '',
      'system.group': (sys as any)?.group || '',
      'system.sortedBy': 'filename',
      'system:fullName': sys?.fullname || 'All Games',
      'system:name': sys?.name || 'all',
      'system:gamecount': sys?.gamecount || 0,
      'system:theme': sys?.theme || (sys?.name === 'all' ? 'auto-allgames' : (sys?.name || 'auto-allgames')),
      'system:manufacturer': (sys as any)?.manufacturer || '',
      'system:hardwareType': sys?.hardware || (sys?.platform?.includes('arcade') ? 'arcade' : 'console'),
      'system:releaseYear': (sys as any)?.releaseYear || '',
      'global:help': true,
      'global:clock': true,
      'global:screenWidth': window.innerWidth,
      'global:screenHeight': window.innerHeight,
      'global:screenRatio': (window.innerWidth / window.innerHeight).toFixed(2),
      'global:vertical': window.innerHeight > window.innerWidth,
      'menu:open': isMenuOpen
    }

    if (selectedSystem && currentGame) {
      const resolveGameMedia = (mediaPath?: string) => {
        if (!mediaPath) return ''
        if (mediaPath.startsWith('http')) return mediaPath
        return mediaPath.replace(/\\/g, '/')
      }

      return { 
        ...baseData,
        ...currentGame,
        'game:name': currentGame.name,
        'game:desc': currentGame.desc,
        'game:image': resolveGameMedia(currentGame.image),
        'game:thumbnail': resolveGameMedia(currentGame.thumbnail),
        'game:video': resolveGameMedia(currentGame.video),
        'game:marquee': resolveGameMedia(currentGame.marquee || currentGame.wheel),
        'game:fanart': resolveGameMedia(currentGame.fanart || currentGame.image),
        'game:titleshot': resolveGameMedia(currentGame.titleshot || currentGame.image),
        'game:manual': currentGame.manual,
        'game:magazine': currentGame.magazine,
        'game:map': currentGame.map,
        'game:bezel': currentGame.bezel,
        'game:cartridge': currentGame.cartridge,
        'game:boxart': currentGame.boxart || currentGame.image,
        'game:boxback': currentGame.boxback,
        'game:wheel': resolveGameMedia(currentGame.wheel || currentGame.marquee || currentGame.image),
        'game:mix': currentGame.mix || currentGame.image,
        'game:rating': currentGame.rating,
        'game:releasedate': currentGame.releasedate,
        'game:developer': currentGame.developer,
        'game:publisher': currentGame.publisher,
        'game:genre': currentGame.genre,
        'game:players': currentGame.players,
        'game:playcount': currentGame.playcount,
        'game:lastplayed': currentGame.lastplayed,
      }
    }
    return baseData
  }, [systems, games, selectedSystem, currentSystem, currentGame, isMenuOpen])

  // Key Navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && !isMenuOpen) { setIsMenuOpen(true); return; }
      if (isMenuOpen || isInitializing) return
      if (!selectedSystem) {
        if (systems.length === 0) return
        if (e.key === 'ArrowRight') setSystemIndex(prev => (prev + 1) % systems.length)
        if (e.key === 'ArrowLeft') setSystemIndex(prev => (prev - 1 + systems.length) % systems.length)
        
        // Quick Jump by Hardware (PageUp/PageDown or Q/E)
        if (e.key === 'PageUp' || e.key === 'e') {
          const currentHardware = (systems[systemIndex] as any)?.hardware || ''
          let nextIdx = (systemIndex + 1) % systems.length
          while (nextIdx !== systemIndex) {
            if (((systems[nextIdx] as any)?.hardware || '') !== currentHardware) {
              setSystemIndex(nextIdx)
              break
            }
            nextIdx = (nextIdx + 1) % systems.length
          }
        }
        if (e.key === 'PageDown' || e.key === 'q') {
          const currentHardware = (systems[systemIndex] as any)?.hardware || ''
          let nextIdx = (systemIndex - 1 + systems.length) % systems.length
          while (nextIdx !== systemIndex) {
            if (((systems[nextIdx] as any)?.hardware || '') !== currentHardware) {
              // Found a different hardware type, now find the first system of THAT type
              const targetHardware = (systems[nextIdx] as any)?.hardware || ''
              let firstInGroup = nextIdx
              while (firstInGroup > 0 && ((systems[firstInGroup - 1] as any)?.hardware || '') === targetHardware) {
                firstInGroup--
              }
              setSystemIndex(firstInGroup)
              break
            }
            nextIdx = (nextIdx - 1 + systems.length) % systems.length
          }
        }

        if (e.key === 'Enter') setSelectedSystem(systems[systemIndex])
      } else {
        if (e.key === 'Backspace' || e.key === 'Escape') { setSelectedSystem(null); return; }
        if (games.length === 0) return
        if (e.key === 'ArrowDown') setSelectedGameIndex((selectedGameIndex + 1) % games.length)
        if (e.key === 'ArrowUp') setSelectedGameIndex((selectedGameIndex - 1 + games.length) % games.length)
        
        // Quick Jump by Letter (PageUp/PageDown or Q/E)
        if (e.key === 'PageUp' || e.key === 'e') {
          const currentLetter = (games[selectedGameIndex]?.name?.[0] || '').toUpperCase()
          let nextIdx = (selectedGameIndex + 1) % games.length
          while (nextIdx !== selectedGameIndex) {
            const nextLetter = (games[nextIdx]?.name?.[0] || '').toUpperCase()
            if (nextLetter !== currentLetter) {
              setSelectedGameIndex(nextIdx)
              break
            }
            nextIdx = (nextIdx + 1) % games.length
          }
        }
        if (e.key === 'PageDown' || e.key === 'q') {
          const currentLetter = (games[selectedGameIndex]?.name?.[0] || '').toUpperCase()
          let prevIdx = (selectedGameIndex - 1 + games.length) % games.length
          while (prevIdx !== selectedGameIndex) {
            const prevLetter = (games[prevIdx]?.name?.[0] || '').toUpperCase()
            if (prevLetter !== currentLetter) {
              // Found a different letter, now find the FIRST game of that letter
              const targetLetter = prevLetter
              let firstOfLetter = prevIdx
              while (firstOfLetter > 0) {
                const checkLetter = (games[firstOfLetter - 1]?.name?.[0] || '').toUpperCase()
                if (checkLetter !== targetLetter) break
                firstOfLetter--
              }
              setSelectedGameIndex(firstOfLetter)
              break
            }
            prevIdx = (prevIdx - 1 + games.length) % games.length
          }
        }

        if (e.key === 'Enter' && currentGame) {
          setIsLaunching(true)
          window.api.launchGame(currentGame, selectedSystem).then(() => {
             setTimeout(() => setIsLaunching(false), 5000)
          })
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [systemIndex, systems, selectedSystem, selectedGameIndex, games.length, isMenuOpen, currentGame, isInitializing])

  // Rendering
  if (isInitializing && theme?.views?.start) {
    return <WebThemeRenderer htmlContent={theme.views.start} data={themeData} themePath={theme.path} />
  }

  if (isLaunching && currentGame && selectedSystem) {
    return <LaunchScreen game={currentGame} system={selectedSystem} theme={theme} themeData={themeData} />
  }

  return (
    <div className="app-root" style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>
      {theme?.isWebTheme ? (
        <WebThemeRenderer 
          htmlContent={selectedSystem ? theme.views.gamelist : theme.views.system}
          data={themeData}
          themePath={theme.path}
        />
      ) : (
        <ThemeRenderer 
          view={selectedSystem ? theme?.views?.gamelist : (theme?.views?.system || (theme?.defaultView ? theme.views[theme.defaultView] : undefined))} 
          data={themeData} 
        />
      )}
      <Menu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </div>
  )
}

export default App
