import { useEffect, useState, useMemo, useCallback } from 'react';
import { WebThemeRenderer } from './components/theme/WebThemeRenderer';
import { Menu } from './components/Menu';
import { GameOptionsOverlay } from './components/GameOptionsOverlay';
import { LaunchScreen } from './components/LaunchScreen';

// Simple types inline - no need for separate store
interface System {
	name: string;
	fullname: string;
	path: string;
	extension: string;
	command: string;
	platform: string;
	theme: string;
	hardware?: string;
	emulators: any[];
	gamecount?: number;
}

interface Game {
	id: string;
	name: string;
	desc?: string;
	image?: string;
	video?: string;
	marquee?: string;
	thumbnail?: string;
	rating?: number;
	releasedate?: string;
	developer?: string;
	publisher?: string;
	genre?: string;
	players?: string;
	favorite?: boolean;
	hidden?: boolean;
	playcount?: number;
	lastplayed?: string;
	path: string;
	system: string;
	fanart?: string;
	wheel?: string;
	titleshot?: string;
	boxart?: string;
	boxback?: string;
	cartridge?: string;
	manual?: string;
	magazine?: string;
	map?: string;
	bezel?: string;
	mix?: string;
}

function App() {
	// ─── State ───
	const [systems, setSystems] = useState<System[]>([]);
	const [games, setGames] = useState<Game[]>([]);
	const [theme, setTheme] = useState<any>(null);
	const [systemIndex, setSystemIndex] = useState(0);
	const [selectedSystem, setSelectedSystem] = useState<System | null>(null);
	const [selectedGameIndex, setSelectedGameIndex] = useState(0);
	const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isLaunching, setIsLaunching] = useState(false);
	const [isGameOptionsOpen, setIsGameOptionsOpen] = useState(false);
	const [isInitializing, setIsInitializing] = useState(true);
	const [enterPressTimer, setEnterPressTimer] = useState<NodeJS.Timeout | null>(
		null,
	);
	const [notifications, setNotifications] = useState<
		{ id: string; message: string; type: 'info' | 'success' | 'warning' }[]
	>([]);
	const [themeRevision, setThemeRevision] = useState(0);
	const [settings, setSettings] = useState<any>({});

	// ─── Initial Load ───
	useEffect(() => {
		// Load systems and settings
		Promise.all([
			window.api.getSystems(),
			window.api.getSettings()
		]).then(([s, initialSettings]: [System[], any]) => {
			setSystems(s);
			setSettings(initialSettings);
			
			// Restore LastSystem
			const lastSystem = initialSettings.LastSystem?.value;
			if (lastSystem) {
				const idx = s.findIndex(sys => sys.name === lastSystem);
				if (idx !== -1) setSystemIndex(idx);
			}
		});

		// Load theme
		const loadTheme = (themeName: string) => {
			if (themeName) {
				window.api.loadTheme(themeName).then((t: any) => setTheme(t));
			}
		};

		window.api.getActiveTheme().then((themeName: string) => {
			loadTheme(themeName);
		});

		// Listen for theme file changes (Live Reload)
		const removeThemeListener = window.api.on(
			'theme-files-changed',
			(_: any, themeName: string) => {
				console.log('Theme changed on disk, reloading...', themeName);
				setThemeRevision((prev) => prev + 1);
				loadTheme(themeName);
			},
		);

		// Save LastSystem when systemIndex changes (via debounced/effect)
		// We'll use another useEffect for saving to avoid complexity here.

		// Gamepad polling
		let rafId: number;
		let lastInputTime = 0;

		const updateControllers = (event?: GamepadEvent) => {
			const gamepads = navigator.getGamepads();
			const active = Array.from(gamepads)
				.filter((gp) => gp !== null)
				.map((gp) => {
					const id = gp!.id;
					const vMatch = id.match(/vendor: ([0-9a-f]{4})/i);
					const pMatch = id.match(/product: ([0-9a-f]{4})/i);

					let guid = id;
					if (vMatch && pMatch) {
						const v = vMatch[1];
						const p = pMatch[1];
						// Swap bytes for SDL2 format: 045e -> 5e04
						const vSwap = v.substring(2, 4) + v.substring(0, 2);
						const pSwap = p.substring(2, 4) + p.substring(0, 2);
						guid = `03000000${vSwap}0000${pSwap}000000000000`;
					} else if (
						id.toLowerCase().includes('xinput') ||
						id.toLowerCase().includes('xbox 360')
					) {
						// Standard SDL2 GUID for XInput Xbox 360 Controller
						guid = '030000005e0400008e02000000007200';
					}

					return {
						name: id,
						guid: guid,
						buttons: gp!.buttons.length,
						axes: gp!.axes.length,
						hats: 1,
					};
				});

			if (event) {
				const isConnected = event.type === 'gamepadconnected';
				const gpName = event.gamepad.id.split('(')[0].trim();
				addNotification(
					`${gpName}\n${isConnected ? 'Conectado' : 'Desconectado'}`,
					isConnected ? 'success' : 'warning'
				);
			}

			if (active.length > 0)
				window.api.executeCommand('set-active-controllers', active);
		};

		let controllersInitialized = false;
		let activityTimeout: NodeJS.Timeout;
		const pollGamepad = (time: number) => {
			const gamepads = navigator.getGamepads();
			
			// Detect ANY activity across all gamepads for visual feedback
			let hasActivity = false;
			for (const gp of gamepads) {
				if (!gp) continue;
				// Check buttons
				for (let i = 0; i < gp.buttons.length; i++) {
					if (gp.buttons[i].pressed) {
						hasActivity = true;
						break;
					}
				}
				if (hasActivity) break;
				// Check axes (with deadzone)
				for (let i = 0; i < gp.axes.length; i++) {
					if (Math.abs(gp.axes[i]) > 0.1) {
						hasActivity = true;
						break;
					}
				}
				if (hasActivity) break;
			}

			if (hasActivity) {
				const elements = document.querySelectorAll('riescade-controller-activity, [riescade-controller-activity]');
				if (elements.length > 0) {
					elements.forEach(el => el.classList.add('active'));
					
					clearTimeout(activityTimeout);
					activityTimeout = setTimeout(() => {
						document.querySelectorAll('riescade-controller-activity, [riescade-controller-activity]').forEach(el => {
							el.classList.remove('active');
						});
					}, 500); // 500ms is enough for a quick blink
				}
			}

			const gp = gamepads[0];
			if (gp) {
				if (!controllersInitialized) {
					updateControllers();
					controllersInitialized = true;
				}
				if (time - lastInputTime > 200) {
					let key = '';
					if (gp.buttons[12]?.pressed || gp.axes[1] < -0.5) key = 'ArrowUp';
					else if (gp.buttons[13]?.pressed || gp.axes[1] > 0.5)
						key = 'ArrowDown';
					else if (gp.buttons[14]?.pressed || gp.axes[0] < -0.5)
						key = 'ArrowLeft';
					else if (gp.buttons[15]?.pressed || gp.axes[0] > 0.5)
						key = 'ArrowRight';
					else if (gp.buttons[4]?.pressed) key = 'PageDown';
					else if (gp.buttons[5]?.pressed) key = 'PageUp';
					else if (gp.buttons[0]?.pressed) key = 'Enter';
					else if (gp.buttons[1]?.pressed) key = 'Backspace';
					else if (gp.buttons[8]?.pressed) key = 'Control';
					else if (gp.buttons[9]?.pressed) key = ' ';
					if (key) {
						window.dispatchEvent(new KeyboardEvent('keydown', { key }));
						setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key })), 50);
						lastInputTime = time;
					}
				}
			}
			rafId = requestAnimationFrame(pollGamepad);
		};

		rafId = requestAnimationFrame(pollGamepad);
		window.addEventListener('gamepadconnected', updateControllers);
		window.addEventListener('gamepaddisconnected', updateControllers);

		return () => {
			cancelAnimationFrame(rafId);
			window.removeEventListener('gamepadconnected', updateControllers);
			window.removeEventListener('gamepaddisconnected', updateControllers);
			if (removeThemeListener) removeThemeListener();
		};
	}, []);

	const addNotification = useCallback(
		(message: string, type: 'info' | 'success' | 'warning' = 'info') => {
			const id = Math.random().toString(36).substring(2, 9);
			setNotifications((prev) => [...prev, { id, message, type }]);
			setTimeout(() => {
				setNotifications((prev) => prev.filter((n) => n.id !== id));
			}, 3000);
		},
		[],
	);

	// Load games when system selected
	useEffect(() => {
		if (selectedSystem) {
			setGames([]);
			setSelectedGameIndex(0);
			setSelectedCollection(null);
			window.api.getGames(selectedSystem.name).then((g: Game[]) => setGames(g));
		}
	}, [selectedSystem]);

	// Load games when collection selected
	useEffect(() => {
		if (selectedSystem && selectedSystem.name === 'collections' && selectedCollection) {
			setGames([]);
			setSelectedGameIndex(0);
			window.api.getCollectionGames(selectedCollection).then((g: Game[]) => setGames(g));
		}
	}, [selectedCollection, selectedSystem]);

	// End splash screen
	useEffect(() => {
		if (systems.length > 0 && theme) {
			const timer = setTimeout(() => setIsInitializing(false), 3000);
			return () => clearTimeout(timer);
		}
	}, [systems.length, theme]);

	const filteredSystems = useMemo(() => {
		const visibleSetting = settings.VisibleSystems?.value || '';
		const hiddenSetting = settings.HiddenSystems?.value || '';
		const autoSetting = settings.CollectionSystemsAuto?.value || '';
		
		const visibleList = String(visibleSetting).split(',').filter(v => v.trim() !== '');
		const hiddenList = String(hiddenSetting).split(';').filter(v => v.trim() !== '');
		const autoList = String(autoSetting).split(',').filter(v => v.trim() !== '');

		let baseSystems = visibleList.length > 0 
			? systems.filter(s => 
				visibleList.includes(s.name) || 
				s.name === 'all' || 
				s.name === 'favorites' ||
				s.name === 'collections' ||
				autoList.includes(s.name)
			)
			: systems;

		// Subtract hidden systems
		if (hiddenList.length > 0) {
			baseSystems = baseSystems.filter(s => !hiddenList.includes(s.name));
		}

		// Only show 'collections' if we have at least one enabled custom collection!
		const customSetting = settings.CollectionSystemsCustom?.value || '';
		const enabledCols = String(customSetting).split(',').map(s => s.trim()).filter(s => s.length > 0);
		if (enabledCols.length === 0) {
			baseSystems = baseSystems.filter(s => s.name !== 'collections');
		}

		return baseSystems;
	}, [systems, settings]);

	const getFriendlySystemName = (sys: any) => {
		if (!sys) return '';
		const name = sys.name;
		const mapping: Record<string, string> = {
			'collections': 'COLEÇÕES',
			'all': 'TODOS OS JOGOS',
			'favorites': 'FAVORITOS',
			'recent': 'ÚLTIMOS JOGADOS',
			'neverplayed': 'NUNCA JOGADOS',
			'retroachievements': 'RETROACHIEVEMENTS',
			'2players': '2 JOGADORES',
			'4players': '4 JOGADORES',
			'arcade': 'ARCADE (GERAL)',
			'vertical': 'VERTICAL ARCADE',
			'lightgun': 'LIGHTGUN',
			'wheel': 'WHEEL',
			'trackball': 'TRACKBALL',
			'spinner': 'SPINNER',
			'_action': 'ACTION',
			'_adult': 'ADULT',
			'_adventure': 'ADVENTURE',
			'_asiaticboard': 'ASIATIC BOARD',
			'_beatemup': 'BEAT\'EM UP',
			'_casino': 'CASINO',
			'_casual': 'CASUAL',
			'_demo': 'DEMO',
			'_educational': 'EDUCATIONAL',
			'_fight': 'FIGHT',
			'_huntingandfishing': 'HUNTING & FISHING',
			'_musicanddance': 'MUSIC & DANCE',
			'_pinball': 'PINBALL',
			'_platform': 'PLATFORM',
			'_playingcards': 'PLAYING CARDS',
			'_puzzle': 'PUZZLE',
			'_quiz': 'QUIZ',
			'_racedriving': 'RACING',
			'_reflection': 'REFLECTION',
			'_roleplayings': 'RPG',
			'_shootemup': 'SHOOT\'EM UP',
			'_shooter': 'SHOOTER',
			'_sports': 'SPORTS',
			'_sportswithanimals': 'SPORTS WITH ANIMALS',
			'_strategy': 'STRATEGY',
			'_simulation': 'SIMULATION',
			'_various': 'VARIOUS',
			'zatomiswave': 'ATOMISWAVE',
			'znaomi': 'NAOMI',
			'zmodel2': 'MODEL 2',
			'zmodel3': 'MODEL 3',
			'zdaphne': 'DAPHNE',
			'zatari': 'ATARI ARCADE',
			'zatlus': 'ATLUS',
			'zbanpresto': 'BANPRESTO',
			'zcapcom': 'CAPCOM',
			'zdataeast': 'DATA EAST',
			'zeighting': 'EIGHTING',
			'zexidy': 'EXIDY',
			'zgaelco': 'GAELCO',
			'zgottlieb': 'GOTTLIEB',
			'zigs': 'IGS',
			'zjaleco': 'JALECO',
			'zkaneko': 'KANEKO',
			'zkonami': 'KONAMI',
			'zmidway': 'MIDWAY',
			'zmitchell': 'MITCHELL',
			'znamco': 'NAMCO',
			'zneogeo': 'NEOGEO',
			'znichibutsu': 'NICHIBUTSU',
			'znmk': 'NMK',
			'zpsikyo': 'PSIKYO',
			'zsammy': 'SAMMY',
			'zsega': 'SEGA',
			'zsegastv': 'SEGA ST-V',
			'zseibukaihatsu': 'SEIBU KAIHATSU',
			'zsemicom': 'SEMICOM',
			'zseta': 'SETA',
			'zsnk': 'SNK',
			'ztaito': 'TAITO',
			'ztechnos': 'TECHNOS',
			'ztecmo': 'TECMO',
			'ztoaplan': 'TOAPLAN',
			'zuniversal': 'UNIVERSAL',
			'zvisco': 'VISCO',
			'zcps1': 'CPS1',
			'zcps2': 'CPS2',
			'zcps3': 'CPS3',
			'zcave': 'CAVE',
			'zirem': 'IREM'
		};
		return mapping[name] || sys.fullname || sys.name.toUpperCase();
	};

	const currentSystem = filteredSystems[systemIndex];
	const currentGame = games[selectedGameIndex];

	// ─── Theme Data ───
	useEffect(() => {
		if (selectedSystem) {
			window.api.saveSetting('LastSystem', selectedSystem.name, 'string');
		}
	}, [selectedSystem]);

	const themeData = useMemo(() => {
		const sys = selectedSystem || currentSystem;
		const sysFullName = getFriendlySystemName(sys);

		// Flatten global settings
		const flattenedSettings = Object.entries(settings).reduce((acc, [k, v]: [string, any]) => {
			acc[k] = v?.value !== undefined ? v.value : v;
			return acc;
		}, {} as any);

		const baseData: any = {
			...flattenedSettings,
			systems: filteredSystems,
			games,
			'global:themeRevision': themeRevision,
			'system.fullName': sysFullName,
			'system.name': sys?.name || 'all',
			'system.theme': sys?.theme || sys?.name || 'auto-allgames',
			'system.gamecount': sys?.gamecount || 0,
			'system.hardwareType': sys?.hardware || 'console',
			'system:fullName': sysFullName,
			'system:name': sys?.name || 'all',
			'system:gamecount': sys?.gamecount || 0,
			'system:theme': sys?.theme || sys?.name || 'auto-allgames',
			'system:hardwareType': sys?.hardware || 'console',
			'global:time': new Date().toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
			}),
			'global:screenWidth': window.innerWidth,
			'global:screenHeight': window.innerHeight,
			'menu:open': isMenuOpen,
			'game:launching': isLaunching,
			...(theme?.settings || {}),
			...Object.entries(theme?.settings || {}).reduce((acc, [k, v]) => ({ ...acc, [`options:${k}`]: v }), {})
		};

		// Mapping for common settings (like RetroAchievements)
		const cheevosUser = baseData['global.cheevos.username'] || baseData['RetroAchievements.Username'];
		if (cheevosUser) {
			baseData['global.cheevos.username'] = cheevosUser;
			baseData.global = { ...baseData.global, cheevos: { username: cheevosUser } };
		}

		if (selectedSystem && currentGame) {
			const resolveMedia = (p?: string) => {
				if (!p) return '';
				if (p.startsWith('http')) return p;
				return p.replace(/\\/g, '/');
			};

			return {
				...baseData,
				...currentGame,
				'game:name': currentGame.name,
				'game:desc': currentGame.desc,
				'game:image': resolveMedia(currentGame.image),
				'game:thumbnail': resolveMedia(currentGame.thumbnail),
				'game:video': resolveMedia(currentGame.video),
				'game:marquee': resolveMedia(currentGame.marquee || currentGame.wheel),
				'game:fanart': resolveMedia(currentGame.fanart || currentGame.image),
				'game:titleshot': resolveMedia(
					currentGame.titleshot || currentGame.image,
				),
				'game:wheel': resolveMedia(
					currentGame.wheel || currentGame.marquee || currentGame.image,
				),
				'game:mix': currentGame.mix || currentGame.image,
				'game:rating': currentGame.rating,
				'game:releasedate': currentGame.releasedate,
				'game:developer': currentGame.developer,
				'game:publisher': currentGame.publisher,
				'game:genre': currentGame.genre,
				'game:players': currentGame.players,
				'game:playcount': currentGame.playcount,
				'game:lastplayed': currentGame.lastplayed,
			};
		}
		return baseData;
	}, [
		systems,
		games,
		selectedSystem,
		currentSystem,
		currentGame,
		isMenuOpen,
		isGameOptionsOpen,
		theme,
	]);

	const handleUpdateGame = (updatedGame: Game) => {
		if (!selectedSystem) return;
		const wasFavorite = currentGame?.favorite;
		window.api.updateGame(selectedSystem.name, updatedGame).then(() => {
			// Refresh local games list
			setGames((prev) =>
				prev.map((g) => (g.path === updatedGame.path ? updatedGame : g)),
			);

			// Notify on favorite change
			if (updatedGame.favorite !== wasFavorite) {
				addNotification(
					updatedGame.favorite
						? `${updatedGame.name} ADDED TO FAVORITES`
						: `${updatedGame.name} REMOVED FROM FAVORITES`,
					updatedGame.favorite ? 'success' : 'info',
				);
			}
		});
	};

	// ─── Keyboard Navigation ───
	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === ' ' && !isGameOptionsOpen) {
				setIsMenuOpen((prev) => !prev);
				return;
			}

			if (isMenuOpen || isInitializing || isGameOptionsOpen || isLaunching) return;

			if (!selectedSystem) {
				// System view navigation
				if (filteredSystems.length === 0) return;
				
				const systemHtml = theme?.views?.system || '';
				const isVertical = systemHtml.includes('type="vertical"');

				if (isVertical) {
					if (e.key === 'ArrowDown') setSystemIndex((prev) => (prev + 1) % filteredSystems.length);
					if (e.key === 'ArrowUp') setSystemIndex((prev) => (prev - 1 + filteredSystems.length) % filteredSystems.length);
				} else {
					if (e.key === 'ArrowRight') setSystemIndex((prev) => (prev + 1) % filteredSystems.length);
					if (e.key === 'ArrowLeft') setSystemIndex((prev) => (prev - 1 + filteredSystems.length) % filteredSystems.length);
				}

				// Quick jump by hardware group
				if (e.key === 'PageUp') {
					const currentHw = filteredSystems[systemIndex]?.hardware || '';
					let next = (systemIndex + 1) % filteredSystems.length;
					while (next !== systemIndex) {
						if ((filteredSystems[next]?.hardware || '') !== currentHw) {
							setSystemIndex(next);
							break;
						}
						next = (next + 1) % filteredSystems.length;
					}
				}
				if (e.key === 'PageDown') {
					const currentHw = filteredSystems[systemIndex]?.hardware || '';
					let prev = (systemIndex - 1 + filteredSystems.length) % filteredSystems.length;
					while (prev !== systemIndex) {
						if ((filteredSystems[prev]?.hardware || '') !== currentHw) {
							const targetHw = filteredSystems[prev]?.hardware || '';
							let first = prev;
							while (
								first > 0 &&
								(filteredSystems[first - 1]?.hardware || '') === targetHw
							)
								first--;
							setSystemIndex(first);
							break;
						}
						prev = (prev - 1 + filteredSystems.length) % filteredSystems.length;
					}
				}

				if (e.key === 'Enter') setSelectedSystem(filteredSystems[systemIndex]);
			} else {
				// Gamelist navigation
				if (e.key === 'Backspace' || e.key === 'Escape') {
					if (isGameOptionsOpen) {
						setIsGameOptionsOpen(false);
					} else if (selectedCollection) {
						setSelectedCollection(null);
						window.api.getGames(selectedSystem.name).then((g: Game[]) => {
							setGames(g);
							setSelectedGameIndex(0);
						});
					} else {
						setSelectedSystem(null);
					}
					return;
				}
				if (games.length === 0) return;

				const gamelistHtml = theme?.views?.gamelist || '';
				const isHorizontal = gamelistHtml.includes('type="horizontal"');

				if (isHorizontal) {
					if (e.key === 'ArrowRight') setSelectedGameIndex((prev) => (prev + 1) % games.length);
					if (e.key === 'ArrowLeft') setSelectedGameIndex((prev) => (prev - 1 + games.length) % games.length);
				} else {
					if (e.key === 'ArrowDown') setSelectedGameIndex((prev) => (prev + 1) % games.length);
					if (e.key === 'ArrowUp') setSelectedGameIndex((prev) => (prev - 1 + games.length) % games.length);
				}

				// Quick jump by letter
				if (e.key === 'PageUp') {
					const currentLetter = (
						games[selectedGameIndex]?.name?.[0] || ''
					).toUpperCase();
					let next = (selectedGameIndex + 1) % games.length;
					while (next !== selectedGameIndex) {
						if (
							(games[next]?.name?.[0] || '').toUpperCase() !== currentLetter
						) {
							setSelectedGameIndex(next);
							break;
						}
						next = (next + 1) % games.length;
					}
				}
				if (e.key === 'PageDown') {
					const currentLetter = (
						games[selectedGameIndex]?.name?.[0] || ''
					).toUpperCase();
					let prev = (selectedGameIndex - 1 + games.length) % games.length;
					while (prev !== selectedGameIndex) {
						const prevLetter = (games[prev]?.name?.[0] || '').toUpperCase();
						if (prevLetter !== currentLetter) {
							let first = prev;
							while (
								first > 0 &&
								(games[first - 1]?.name?.[0] || '').toUpperCase() === prevLetter
							)
								first--;
							setSelectedGameIndex(first);
							break;
						}
						prev = (prev - 1 + games.length) % games.length;
					}
				}

				if (e.key === 'Control' && currentGame) {
					setIsGameOptionsOpen((prev) => !prev);
					return;
				}
				if (isGameOptionsOpen) return;

				if (e.key === 'Enter' && currentGame && !isLaunching) {
					if (currentGame.isCollectionFolder) {
						setSelectedCollection(currentGame.path);
					} else {
						setIsLaunching(true);
						window.api
							.launchGame(currentGame, selectedSystem)
							.then(() => {
								setTimeout(() => setIsLaunching(false), 5000);
							})
							.catch((err) => {
								console.error('Launch game failed or exited with code:', err);
								setTimeout(() => setIsLaunching(false), 5000);
							});
					}
				}
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			// No logic needed here for now
		};

		window.addEventListener('keydown', handleKey);
		window.addEventListener('keyup', handleKeyUp);
		return () => {
			window.removeEventListener('keydown', handleKey);
			window.removeEventListener('keyup', handleKeyUp);
		};
	}, [
		systemIndex,
		systems,
		selectedSystem,
		selectedGameIndex,
		games.length,
		isMenuOpen,
		isGameOptionsOpen,
		currentGame,
		isInitializing,
		isLaunching,
		enterPressTimer,
		settings,
	]);

	// ─── Rendering ───
	if (!theme) return null;

	if (isInitializing && theme.views?.start) {
		const normalizedPath = theme.path.replace(/\\/g, '/');
		const processedHtml = theme.views.start
			.replace(/src="\.\//g, `src="file:///${normalizedPath}/`)
			.replace(/href="\.\//g, `href="file:///${normalizedPath}/`);

		return (
			<div 
				style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden' }} 
				dangerouslySetInnerHTML={{ __html: processedHtml }} 
			/>
		);
	}


	return (
		<div
			className="app-root"
			style={{
				width: '100vw',
				height: '100vh',
				overflow: 'hidden',
				background: '#000',
			}}
		>
			<WebThemeRenderer
				htmlContent={selectedSystem ? theme.views.gamelist : theme.views.system}
				data={themeData}
				themePath={theme.path}
			/>
			<Menu
				isOpen={isMenuOpen}
				onClose={() => setIsMenuOpen(false)}
				theme={theme}
				themeData={themeData}
				allSystems={systems}
			/>
			{selectedSystem && currentGame && (
				<GameOptionsOverlay
					isOpen={isGameOptionsOpen}
					onClose={() => setIsGameOptionsOpen(false)}
					game={currentGame}
					system={selectedSystem}
					theme={theme}
					themeData={themeData}
					onUpdate={handleUpdateGame}
				/>
			)}

			{isLaunching && currentGame && selectedSystem && (
				<LaunchScreen
					game={currentGame}
					system={selectedSystem}
					theme={theme}
					themeData={themeData}
				/>
			)}

			{/* Notifications Layer */}
			<div className="riescade-notifications-container">
				{notifications.map((n) => (
					<div key={n.id} className={`riescade-notification ${n.type}`}>
						<div className="riescade-notification-status" />
						<span className="riescade-notification-message">{n.message}</span>
					</div>
				))}
			</div>
		</div>
	);
}

export default App;
