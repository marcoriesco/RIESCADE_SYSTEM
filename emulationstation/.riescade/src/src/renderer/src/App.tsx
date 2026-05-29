import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { WebThemeRenderer } from './components/theme/WebThemeRenderer';
import { Menu } from './components/Menu';
import { GameOptionsOverlay } from './components/GameOptionsOverlay';
import { LaunchScreen } from './components/LaunchScreen';
import { HardwareSelectOverlay } from './components/HardwareSelectOverlay';
import { SaveStateManagerOverlay } from './components/SaveStateManagerOverlay';

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
	group?: string;
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
	const [isHardwareSelectOpen, setIsHardwareSelectOpen] = useState(false);
	const [isInitializing, setIsInitializing] = useState(true);
	const [enterPressTimer, setEnterPressTimer] = useState<NodeJS.Timeout | null>(
		null,
	);
	const [notifications, setNotifications] = useState<
		{ id: string; message: string; type: 'info' | 'success' | 'warning'; category?: 'controller' | 'scraper' | 'general' }[]
	>([]);
	const [themeRevision, setThemeRevision] = useState(0);
	const [mediaRevision, setMediaRevision] = useState(0);
	const [settings, setSettings] = useState<any>({});
	const [isSaveStateManagerOpen, setIsSaveStateManagerOpen] = useState(false);
	const [saveManagerGame, setSaveManagerGame] = useState<Game | null>(null);
	const [saveManagerSystem, setSaveManagerSystem] = useState<System | null>(null);
	const [hasRestoredLastSystem, setHasRestoredLastSystem] = useState(false);
	const [systemsLoadingProgress, setSystemsLoadingProgress] = useState(0);
	const [isLoadingGames, setIsLoadingGames] = useState(false);

	// ─── Audio System State & Refs ───
	const [musicFiles, setMusicFiles] = useState<string[]>([]);
	const [musicPath, setMusicPath] = useState<string>('');
	const [currentTrackName, setCurrentTrackName] = useState<string>('');
	const [showMusicTitle, setShowMusicTitle] = useState(false);

	// Scraper progress state
	const [bulkScrapeStatus, setBulkScrapeStatus] = useState<{
		active: boolean;
		current: number;
		total: number;
		systemCode: string;
		systemName: string;
		gameName: string;
	} | null>(null);
	const [showGamelistUpdateModal, setShowGamelistUpdateModal] = useState(false);
	const [reloadModalSelectedIndex, setReloadModalSelectedIndex] = useState(0);
	const [isUpdatingGamelist, setIsUpdatingGamelist] = useState(false);

	const bgMusicRef = useRef<HTMLAudioElement | null>(null);
	const navSoundRef = useRef<HTMLAudioElement | null>(null);
	const musicTitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const currentPlaylistRef = useRef<string[]>([]);
	const currentTrackIndexRef = useRef<number>(-1);
	const activeSystemRef = useRef<string>('');

	const currentGame = games[selectedGameIndex];

	const shuffleArray = <T,>(array: T[]): T[] => {
		const arr = [...array];
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	};

	const playTrack = useCallback((fileOrUrl: string, isAbsolute = false) => {
		if (!bgMusicRef.current) return;
		
		let srcUrl = fileOrUrl;
		if (!isAbsolute && musicPath) {
			const cleanPath = musicPath.replace(/\\/g, '/');
			srcUrl = `file:///${cleanPath}/${fileOrUrl}`;
		}
		
		bgMusicRef.current.src = srcUrl;
		bgMusicRef.current.load();
		bgMusicRef.current.play().catch(e => {
			console.warn('Playback blocked or failed:', e);
		});

		// Animate title display if setting enabled
		const displayTitles = settings['audio.display_titles']?.value !== 'false' && settings['audio.display_titles']?.value !== false;
		if (displayTitles) {
			const cleanName = fileOrUrl.split('/').pop() || fileOrUrl;
			const nameWithoutExt = cleanName.substring(0, cleanName.lastIndexOf('.')) || cleanName;
			setCurrentTrackName(nameWithoutExt.toUpperCase());
			setShowMusicTitle(true);
			
			if (musicTitleTimeoutRef.current) {
				clearTimeout(musicTitleTimeoutRef.current);
			}
			
			const displayTime = (settings['audio.display_titles_time']?.value !== undefined 
				? parseInt(settings['audio.display_titles_time'].value, 10) 
				: 6) * 1000;
				
			musicTitleTimeoutRef.current = setTimeout(() => {
				setShowMusicTitle(false);
			}, displayTime);
		} else {
			setShowMusicTitle(false);
			setCurrentTrackName('');
		}
	}, [musicPath, settings['audio.display_titles'], settings['audio.display_titles_time']]);

	const playNextTrack = useCallback(() => {
		const playlist = currentPlaylistRef.current;
		if (!playlist || playlist.length === 0) return;
		
		let nextIndex = currentTrackIndexRef.current + 1;
		if (nextIndex >= playlist.length) {
			const shuffled = shuffleArray(playlist);
			currentPlaylistRef.current = shuffled;
			nextIndex = 0;
		}
		
		currentTrackIndexRef.current = nextIndex;
		const file = playlist[nextIndex];
		const isAbsolute = file.startsWith('file:///');
		if (file) {
			playTrack(file, isAbsolute);
		}
	}, [playTrack]);

	// Initialize Audio Elements
	useEffect(() => {
		bgMusicRef.current = new Audio();
		navSoundRef.current = new Audio();
		
		bgMusicRef.current.loop = false;
		bgMusicRef.current.autoplay = false;
		
		bgMusicRef.current.onended = () => {
			playNextTrack();
		};
		
		return () => {
			if (bgMusicRef.current) {
				bgMusicRef.current.pause();
				bgMusicRef.current.src = '';
				bgMusicRef.current = null;
			}
			if (navSoundRef.current) {
				navSoundRef.current.pause();
				navSoundRef.current.src = '';
				navSoundRef.current = null;
			}
			if (musicTitleTimeoutRef.current) {
				clearTimeout(musicTitleTimeoutRef.current);
			}
		};
	}, [playNextTrack]);

	// Navigation sound playback
	useEffect(() => {
		const playClick = () => {
			if (!navSoundRef.current || !theme) return;
			const isSoundsEnabled = settings.EnableSounds?.value === 'true' || settings.EnableSounds?.value === true;
			if (!isSoundsEnabled) return;

			const themePathClean = theme.path ? theme.path.replace(/\\/g, '/') : '';
			const clickSoundUrl = `file:///${themePathClean}/assets/sounds/click.ogg`;
			
			navSoundRef.current.src = clickSoundUrl;
			navSoundRef.current.currentTime = 0;
			navSoundRef.current.play().catch(() => {});
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Enter', ' ', 'Backspace', 'Escape', 'Control'];
			if (navKeys.includes(e.key)) {
				playClick();
			}
		};

		const handleCustomNavSound = () => {
			playClick();
		};

		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('riescade-play-nav-sound', handleCustomNavSound);
		
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('riescade-play-nav-sound', handleCustomNavSound);
		};
	}, [theme, settings.EnableSounds]);

	// Background Music Player Loop Controller
	useEffect(() => {
		if (!bgMusicRef.current || isInitializing) return;

		const isBgMusicEnabled = settings['audio.bgmusic']?.value !== 'false' && settings['audio.bgmusic']?.value !== false;
		
		if (!isBgMusicEnabled) {
			bgMusicRef.current.pause();
			return;
		}

		const baseVol = (settings.MusicVolume?.value !== undefined ? parseInt(settings.MusicVolume.value, 10) : 80) / 100;
		const shouldDuck = selectedSystem && 
			currentGame && 
			currentGame.video && 
			(settings.VideoLowersMusic?.value === 'true' || settings.VideoLowersMusic?.value === true) && 
			(settings.VideoAudio?.value === 'true' || settings.VideoAudio?.value === true);
		
		bgMusicRef.current.volume = shouldDuck ? baseVol * 0.15 : baseVol;

		const sysName = selectedSystem?.name || 'system_view';
		const useThemeMusic = settings['audio.thememusics']?.value === 'true' || settings['audio.thememusics']?.value === true;
		const usePerSystem = settings['audio.persystem']?.value === 'true' || settings['audio.persystem']?.value === true;
		const useFavorite = settings['audio.useFavoriteMusic']?.value === 'true' || settings['audio.useFavoriteMusic']?.value === true;

		const loadAndPlayPlaylist = async () => {
			// 1. Try theme system-specific music
			if (useThemeMusic && selectedSystem && theme?.path) {
				const themePathClean = theme.path.replace(/\\/g, '/');
				const themeOgg = `file:///${themePathClean}/assets/sounds/${selectedSystem.name}.ogg`;
				const themeMp3 = `file:///${themePathClean}/assets/sounds/${selectedSystem.name}.mp3`;
				
				const testThemeMusic = async (url: string) => {
					try {
						const res = await fetch(url, { method: 'HEAD' });
						return res.ok;
					} catch {
						return false;
					}
				};
				
				let themeMusicSrc = '';
				if (await testThemeMusic(themeOgg)) {
					themeMusicSrc = themeOgg;
				} else if (await testThemeMusic(themeMp3)) {
					themeMusicSrc = themeMp3;
				}
				
				if (themeMusicSrc) {
					activeSystemRef.current = `theme_${sysName}`;
					currentPlaylistRef.current = [themeMusicSrc];
					currentTrackIndexRef.current = 0;
					playTrack(themeMusicSrc, true);
					return;
				}
			}

			// 2. Try per-system music folders
			if (usePerSystem && selectedSystem) {
				const systemMusic = await window.api.getMusicFiles(selectedSystem.name);
				if (systemMusic && systemMusic.length > 0) {
					activeSystemRef.current = `persystem_${sysName}`;
					const shuffled = shuffleArray(systemMusic);
					currentPlaylistRef.current = shuffled;
					currentTrackIndexRef.current = 0;
					playTrack(shuffled[0]);
					return;
				}
			}

			// 3. Fall back to standard playlist (general or favorites)
			const favString = settings['audio.favoriteSongs']?.value || '';
			const favList = favString.split(';').map(s => s.trim()).filter(Boolean);
			
			let baseTracks = musicFiles;
			if (useFavorite) {
				baseTracks = musicFiles.filter(file => favList.includes(file));
			}

			if (baseTracks.length === 0 && useFavorite) {
				baseTracks = musicFiles;
			}

			if (baseTracks.length > 0) {
				const activeKey = useFavorite ? 'favorites' : 'all';
				if (activeSystemRef.current === activeKey && bgMusicRef.current && !bgMusicRef.current.paused) {
					return;
				}
				
				activeSystemRef.current = activeKey;
				const shuffled = shuffleArray(baseTracks);
				currentPlaylistRef.current = shuffled;
				currentTrackIndexRef.current = 0;
				playTrack(shuffled[0]);
			} else {
				bgMusicRef.current.pause();
				bgMusicRef.current.src = '';
				setCurrentTrackName('');
			}
		};

		loadAndPlayPlaylist();
	}, [
		selectedSystem, 
		musicFiles, 
		musicPath, 
		settings['audio.bgmusic'], 
		settings['audio.thememusics'], 
		settings['audio.persystem'], 
		settings['audio.useFavoriteMusic'], 
		settings['audio.favoriteSongs'],
		theme,
		isInitializing,
		playTrack
	]);

	// Video ducking volume controller
	useEffect(() => {
		if (!bgMusicRef.current) return;
		
		const baseVol = (settings.MusicVolume?.value !== undefined ? parseInt(settings.MusicVolume.value, 10) : 80) / 100;
		const shouldDuck = selectedSystem && 
			currentGame && 
			currentGame.video && 
			(settings.VideoLowersMusic?.value === 'true' || settings.VideoLowersMusic?.value === true) && 
			(settings.VideoAudio?.value === 'true' || settings.VideoAudio?.value === true);
			
		const targetVol = shouldDuck ? baseVol * 0.15 : baseVol;
		bgMusicRef.current.volume = targetVol;
	}, [selectedSystem, currentGame, settings.MusicVolume, settings.VideoLowersMusic, settings.VideoAudio]);


	// Listen for systems loading progress from the main process
	useEffect(() => {
		const removeProgress = window.api.on(
			'systems-loading-progress',
			(_: any, progress: number) => {
				setSystemsLoadingProgress(progress);
			},
		);
		return () => removeProgress();
	}, []);

	// Listen for scraper progress and finish events
	useEffect(() => {
		const removeScrapeProgress = window.api.on('scrape-progress', (_: any, data: any) => {
			setBulkScrapeStatus({
				active: true,
				current: data.current,
				total: data.total,
				systemCode: data.systemCode || '',
				systemName: data.systemName || '',
				gameName: data.gameName || ''
			});
		});

		const removeScrapeFinished = window.api.on('scrape-finished', (_: any, data: any) => {
			setBulkScrapeStatus(null);
			setShowGamelistUpdateModal(true);
			setReloadModalSelectedIndex(0); // Default to YES
		});

		return () => {
			removeScrapeProgress();
			removeScrapeFinished();
		};
	}, []);

	// ─── Initial Load ───
	useEffect(() => {
		// Load theme first so splash screen is rendered immediately
		const loadTheme = (themeName: string, isInitial = false) => {
			if (themeName) {
				window.api.loadTheme(themeName).then((t: any) => {
					setTheme(t);
					
					if (isInitial) {
						// Wait a tiny bit (100ms) to ensure React has fully rendered and painted the splash screen to the DOM
						setTimeout(() => {
							window.api.preloadLibrary().then(() => {
								Promise.all([
									window.api.getSystems(),
									window.api.getSettings(),
									window.api.getMusicFiles(),
									window.api.getMusicPath()
								]).then(([s, initialSettings, files, mPath]: [System[], any, string[], string]) => {
									setSystems(s);
									setSettings(initialSettings);
									setMusicFiles(files);
									setMusicPath(mPath);
								});
							});
						}, 100);
					}
				});
			}
		};

		window.api.getActiveTheme().then((themeName: string) => {
			loadTheme(themeName, true);
		});

		// Listen for theme file changes (Live Reload)
		const removeThemeListener = window.api.on(
			'theme-files-changed',
			(_: any, themeName: string) => {
				console.log('Theme changed on disk, reloading...', themeName);
				setThemeRevision((prev) => prev + 1);
				loadTheme(themeName, false);
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
					isConnected ? 'success' : 'warning',
					'controller'
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
				// Skip gamepad-to-keyboard dispatch when InputConfigOverlay is active
				// (it sets data-input-config-active on document.body to claim exclusive gamepad control)
				if (time - lastInputTime > 200 && !document.body.hasAttribute('data-input-config-active')) {
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
					else if (gp.buttons[0]?.pressed) key = ' ';
					else if (gp.buttons[1]?.pressed) key = 'Backspace';
					else if (gp.buttons[8]?.pressed) key = 'Control';
					else if (gp.buttons[9]?.pressed) key = 'Enter';
					else if (gp.buttons[11]?.pressed) key = 'Control'; // Select button on many controllers is 11 or 8
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
		(message: string, type: 'info' | 'success' | 'warning' = 'info', category: 'controller' | 'scraper' | 'general' = 'general') => {
			const id = Math.random().toString(36).substring(2, 9);
			setNotifications((prev) => [...prev, { id, message, type, category }]);
			setTimeout(() => {
				setNotifications((prev) => prev.filter((n) => n.id !== id));
			}, 3000);
		},
		[],
	);

	const performInPlaceGamelistReload = useCallback((forcePhysical = true, systemName?: string) => {
		setIsUpdatingGamelist(true);
		setIsMenuOpen(false);
		setIsGameOptionsOpen(false);
		setShowGamelistUpdateModal(false);

		window.api.preloadLibrary(forcePhysical, systemName).then(() => {
			Promise.all([
				window.api.getSystems(),
				window.api.getSettings(),
				window.api.getMusicFiles(),
				window.api.getMusicPath()
			]).then(([s, updatedSettings, files, mPath]: [System[], any, string[], string]) => {
				setSystems(s);
				setSettings(updatedSettings);
				setMusicFiles(files);
				setMusicPath(mPath);

				if (selectedSystem) {
					window.api.getGames(selectedSystem.name).then((masterGames: Game[]) => {
						const groupedSetting = updatedSettings.SystemsGrouped?.value || '';
						const groupedList = String(groupedSetting).split(',').filter(v => v.trim() !== '');

						const childSystems = s.filter(cs => 
							cs.group && 
							cs.group.toLowerCase() === selectedSystem.name.toLowerCase() && 
							groupedList.includes(cs.name)
						);

						if (childSystems.length > 0) {
							Promise.all(childSystems.map(cs => window.api.getGames(cs.name))).then((allChildGames) => {
								const merged = [...masterGames];
								allChildGames.forEach(childGames => {
									merged.push(...childGames);
								});
								merged.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
								setGames(merged);
								setIsUpdatingGamelist(false);
								addNotification('GAMELIST ATUALIZADA', 'success', 'scraper');
							});
						} else {
							setGames(masterGames);
							setIsUpdatingGamelist(false);
							addNotification('GAMELIST ATUALIZADA', 'success', 'scraper');
						}
					});
				} else {
					setIsUpdatingGamelist(false);
					addNotification('GAMELIST ATUALIZADA', 'success', 'scraper');
				}
			}).catch(err => {
				console.error('Failed to load libraries during in-place reload:', err);
				setIsUpdatingGamelist(false);
				addNotification('ERRO AO ATUALIZAR GAMELIST', 'warning', 'general');
			});
		}).catch(err => {
			console.error('Failed to preload during in-place reload:', err);
			setIsUpdatingGamelist(false);
			addNotification('ERRO AO ATUALIZAR GAMELIST', 'warning', 'general');
		});
	}, [selectedSystem, addNotification]);

	// Listen for systems updated event (e.g. from windows_installers)
	useEffect(() => {
		const removeListener = window.api.on(
			'systems-updated',
			() => {
				console.log('Library updated on backend, performing silent reload...');
				performInPlaceGamelistReload(false);
			},
		);
		return () => removeListener();
	}, [performInPlaceGamelistReload]);

	const handleFastReload = useCallback(() => {
		performInPlaceGamelistReload(false);
	}, [performInPlaceGamelistReload]);

	const handleUpdateGamelists = useCallback((forcePhysicalOrSystem?: boolean | string, systemName?: string) => {
		let force = true;
		let sys: string | undefined = undefined;

		if (typeof forcePhysicalOrSystem === 'string') {
			sys = forcePhysicalOrSystem;
			force = true;
		} else {
			if (forcePhysicalOrSystem !== undefined) {
				force = forcePhysicalOrSystem;
			}
			sys = systemName;
		}

		performInPlaceGamelistReload(force, sys);
	}, [performInPlaceGamelistReload]);

	// Load games when system selected
	useEffect(() => {
		if (selectedSystem) {
			setIsLoadingGames(true);
			setGames([]);
			setSelectedGameIndex(0);
			setSelectedCollection(null);
			window.api.getGames(selectedSystem.name).then((masterGames: Game[]) => {
				const groupedSetting = settings.SystemsGrouped?.value || '';
				const groupedList = String(groupedSetting).split(',').filter(v => v.trim() !== '');

				// Find child systems that belong to this group AND are enabled for grouping
				const childSystems = systems.filter(s => 
					s.group && 
					s.group.toLowerCase() === selectedSystem.name.toLowerCase() && 
					groupedList.includes(s.name)
				);

				if (childSystems.length > 0) {
					Promise.all(childSystems.map(s => window.api.getGames(s.name))).then((allChildGames) => {
						const merged = [...masterGames];
						allChildGames.forEach(childGames => {
							merged.push(...childGames);
						});
						merged.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
						setGames(merged);
						setIsLoadingGames(false);
					}).catch(err => {
						console.error(err);
						setIsLoadingGames(false);
					});
				} else {
					setGames(masterGames);
					setIsLoadingGames(false);
				}
			}).catch(err => {
				console.error(err);
				setIsLoadingGames(false);
			});
		} else {
			setIsLoadingGames(false);
		}
	}, [selectedSystem, systems, settings.SystemsGrouped]);

	// Load games when collection selected
	useEffect(() => {
		if (selectedSystem && selectedSystem.name === 'collections' && selectedCollection) {
			setIsLoadingGames(true);
			setGames([]);
			setSelectedGameIndex(0);
			window.api.getCollectionGames(selectedCollection).then((g: Game[]) => {
				setGames(g);
				setIsLoadingGames(false);
			}).catch(err => {
				console.error(err);
				setIsLoadingGames(false);
			});
		}
	}, [selectedCollection, selectedSystem]);

	// End splash screen
	useEffect(() => {
		if (systems.length > 0 && theme) {
			const timer = setTimeout(() => setIsInitializing(false), 500);
			return () => clearTimeout(timer);
		}
	}, [systems.length, theme]);

	const filteredSystems = useMemo(() => {
		const visibleSetting = settings.VisibleSystems?.value || '';
		const hiddenSetting = settings.HiddenSystems?.value || '';
		const autoSetting = settings.CollectionSystemsAuto?.value || '';
		const groupedSetting = settings.SystemsGrouped?.value || '';
		
		const visibleList = String(visibleSetting).split(',').filter(v => v.trim() !== '');
		const hiddenList = String(hiddenSetting).split(';').filter(v => v.trim() !== '');
		const autoList = String(autoSetting).split(',').filter(v => v.trim() !== '');
		const groupedList = String(groupedSetting).split(',').filter(v => v.trim() !== '');

		let baseSystems = visibleList.length > 0 
			? systems.filter(s => 
				visibleList.includes(s.name) || 
				s.name === 'collections' ||
				s.path.startsWith('virtual://') ||
				systems.some(child => 
					child.group && 
					child.group.toLowerCase() === s.name.toLowerCase() && 
					groupedList.includes(child.name) && 
					visibleList.includes(child.name)
				)
			)
			: systems;

		// Subtract hidden systems
		if (hiddenList.length > 0) {
			baseSystems = baseSystems.filter(s => !hiddenList.includes(s.name));
		}

		// Subtract grouped systems
		if (groupedList.length > 0) {
			baseSystems = baseSystems.filter(s => 
				!groupedList.includes(s.name) || 
				(s.group && s.group.toLowerCase() === s.name.toLowerCase())
			);
		}

		// Only show 'collections' if we have at least one enabled custom collection!
		const customSetting = settings.CollectionSystemsCustom?.value || '';
		const enabledCols = String(customSetting).split(',').map(s => s.trim()).filter(s => s.length > 0);
		if (enabledCols.length === 0) {
			baseSystems = baseSystems.filter(s => s.name !== 'collections');
		}

		return baseSystems;
	}, [systems, settings]);

	// Restore StartupSystem / LastSystem and handle StartOnGamelist on startup
	useEffect(() => {
		if (filteredSystems.length > 0 && !hasRestoredLastSystem) {
			// 1. Determine which system to startup on
			const startupSetting = settings.StartupSystem?.value || 'last';
			let targetSystemName = '';

			if (startupSetting === 'last') {
				targetSystemName = settings.LastSystem?.value || '';
			} else {
				targetSystemName = startupSetting;
			}

			let resolvedIndex = 0;
			if (targetSystemName) {
				const idx = filteredSystems.findIndex(sys => sys.name === targetSystemName);
				if (idx !== -1) {
					resolvedIndex = idx;
					setSystemIndex(idx);
				}
			}

			// 2. Handle StartOnGamelist
			const startOnGamelist = settings.StartOnGamelist?.value === true || settings.StartOnGamelist?.value === 'true';
			if (startOnGamelist && filteredSystems[resolvedIndex]) {
				setSelectedSystem(filteredSystems[resolvedIndex]);
			}

			setHasRestoredLastSystem(true);
		}
	}, [filteredSystems, settings, hasRestoredLastSystem]);

	const getFriendlySystemName = (sys: any) => {
		if (!sys) return '';
		const name = sys.name;

		if (name === 'arcade' || name === 'auto-arcade') {
			return 'ARCADE';
		}

		const mapping: Record<string, string> = {
			'collections': 'Coleçõs',
			'all': 'Todos os jogos',
			'favorites': 'Favoritos',
			'recent': 'Últimos jogados',
			'neverplayed': 'Nunca jogados',
			'retroachievements': 'RetroAchivements',
			'2players': '2 Jogadores',
			'4players': '4 Jogadores',
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
			'znichibutsu': 'NICHIBUTSU',
			'znmk': 'NMK',
			'zpsikyo': 'PSIKYO',
			'zsammy': 'SAMMY',
			'zsega': 'SEGA',
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
			'zcave': 'CAVE',
			'zirem': 'IREM'
		};
		return mapping[name] || sys.fullname || sys.name.toUpperCase();
	};

	const currentSystem = filteredSystems[systemIndex];

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

		const isCollectionsVal = !!(selectedSystem && selectedSystem.name === 'collections' && !selectedCollection);

		// Pre-populate collection folder media in the games array for carousel elements!
		const resolvedGames = (isCollectionsVal && theme?.path)
			? games.map(g => {
				if (g.isCollectionFolder) {
					const normalizedThemePath = theme.path.replace(/\\/g, '/');
					return {
						...g,
						marquee: `file:///${normalizedThemePath}/assets/logos/collections/${g.name}.png`,
						wheel: `file:///${normalizedThemePath}/assets/logos/collections/${g.name}.png`,
						image: `file:///${normalizedThemePath}/assets/arts/collections/${g.name}.jpg`,
						fanart: `file:///${normalizedThemePath}/assets/arts/collections/${g.name}.jpg`,
						thumbnail: `file:///${normalizedThemePath}/assets/arts/collections/${g.name}.jpg`,
					};
				}
				return g;
			})
			: games;

		const baseData: any = {
			...flattenedSettings,
			systems: filteredSystems,
			games: resolvedGames,
			isCollections: isCollectionsVal,
			iscollections: isCollectionsVal,
			'gamelist:loading': isLoadingGames,
			'gamelist.loading': isLoadingGames,
			'system.isCollections': isCollectionsVal,
			'system:isCollections': isCollectionsVal,
			'global:themeRevision': themeRevision,
			'global:mediaRevision': mediaRevision,
			'system.fullName': sysFullName,
			'system.name': sys?.name || 'all',
			'system.theme': sys?.theme || sys?.name || 'auto-allgames',
			'system.gamecount': (selectedSystem && !isLoadingGames) ? games.length : (sys?.gamecount || 0),
			'system.hardwareType': sys?.hardware || 'console',
			'system:fullName': sysFullName,
			'system:name': sys?.name || 'all',
			'system:gamecount': (selectedSystem && !isLoadingGames) ? games.length : (sys?.gamecount || 0),
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

		// Inject theme translations
		const lang = settings['Language']?.value || 'en_US';
		const themeLocales = theme?.locales || {};
		const defaultLocaleKey = theme?.defaultLocale || 'en_US';
		const currentLocale = themeLocales[lang] || {};
		const fallbackLocale = themeLocales[defaultLocaleKey] || themeLocales['en_US'] || {};
		for (const key of Object.keys({ ...fallbackLocale, ...currentLocale })) {
			baseData[`t:${key}`] = currentLocale[key] || fallbackLocale[key] || key;
		}

		// Mapping for common settings (like RetroAchievements)
		const cheevosUser = baseData['global.cheevos.username'] || baseData['RetroAchievements.Username'];
		if (cheevosUser) {
			baseData['global.cheevos.username'] = cheevosUser;
			baseData.global = { ...baseData.global, cheevos: { username: cheevosUser } };
		}

		if (selectedSystem && currentGame) {
			const resolveMedia = (p?: string) => {
				if (!p) return '';
				if (p.startsWith('http') || p.startsWith('file://')) return p;
				const normalized = p.replace(/\\/g, '/');
				if (normalized.match(/^[a-zA-Z]:/) || normalized.startsWith('/')) {
					return normalized.match(/^[a-zA-Z]:/) ? `file:///${normalized}` : `file://${normalized}`;
				}
				return normalized;
			};

			let gameImage = resolveMedia(currentGame.image);
			let gameThumbnail = resolveMedia(currentGame.thumbnail);
			let gameVideo = resolveMedia(currentGame.video);
			let gameMarquee = resolveMedia(currentGame.marquee || currentGame.wheel);
			let gameFanart = resolveMedia(currentGame.fanart || currentGame.image);
			let gameWheel = resolveMedia(currentGame.wheel || currentGame.marquee || currentGame.image);

			// Dynamic theme resolution for collection folders (Layer 2)
			if (isCollectionsVal && currentGame.isCollectionFolder && theme?.path) {
				const normalizedThemePath = theme.path.replace(/\\/g, '/');
				
				// Standard theme paths for this collection folder using absolute file:/// URLs
				const logoPath = `file:///${normalizedThemePath}/assets/logos/collections/${currentGame.name}.png`;
				const artPath = `file:///${normalizedThemePath}/assets/arts/collections/${currentGame.name}.jpg`;

				gameMarquee = logoPath;
				gameWheel = logoPath;
				gameImage = artPath;
				gameFanart = artPath;
				gameThumbnail = artPath;
			}

			const isCollectionSystem = selectedSystem && (
				selectedSystem.name === 'collections' ||
				selectedSystem.path.startsWith('virtual://') ||
				['all', 'favorites', 'recent', 'neverplayed', 'retroachievements', '2players', '4players', 'vertical', 'lightgun', 'wheel', 'trackball', 'spinner'].includes(selectedSystem.name.toLowerCase())
			);

			const gameSystem = systems.find(s => s.name.toLowerCase() === currentGame.system.toLowerCase());
			const sysDisplayName = gameSystem ? gameSystem.name : currentGame.system;

			const displayNameWithSystem = isCollectionSystem
				? `${currentGame.name} <span class="gamelist-meta-system">[${sysDisplayName}]</span>`
				: currentGame.name;

			return {
				...baseData,
				...currentGame,
				'game:name': displayNameWithSystem,
				'game:desc': currentGame.desc,
				'game:image': gameImage,
				'game:thumbnail': gameThumbnail,
				'game:video': gameVideo,
				'game:marquee': gameMarquee,
				'game:fanart': gameFanart,
				'game:titleshot': resolveMedia(currentGame.titleshot || currentGame.image) || gameImage,
				'game:wheel': gameWheel,
				'game:mix': currentGame.mix || currentGame.image || gameImage,
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
		isLaunching,
		theme,
		selectedCollection,
		themeRevision,
		mediaRevision,
	]);

	const handleUpdateGame = (updatedGame: Game) => {
		if (!selectedSystem) return Promise.resolve();
		const wasFavorite = currentGame?.favorite;
		return window.api.updateGame(selectedSystem.name, updatedGame).then(() => {
			// Increment media revision to bust browser cache
			setMediaRevision((prev) => prev + 1);

			// Refresh/Reload the gamelist from the API silently
			const getGamesPromise = (selectedSystem.name === 'collections' && selectedCollection)
				? window.api.getCollectionGames(selectedCollection)
				: window.api.getGames(selectedSystem.name);

			const gamesUpdatePromise = getGamesPromise.then((masterGames: Game[]) => {
				const groupedSetting = settings.SystemsGrouped?.value || '';
				const groupedList = String(groupedSetting).split(',').filter(v => v.trim() !== '');

				// Find child systems that belong to this group AND are enabled for grouping
				const childSystems = systems.filter((s) => 
					s.group && 
					s.group.toLowerCase() === selectedSystem.name.toLowerCase() && 
					groupedList.includes(s.name)
				);

				const updateGamesState = (newGames: Game[]) => {
					setGames(newGames);
					// Adjust selected index to keep the updated game selected
					const newIdx = newGames.findIndex((g) => g.path === updatedGame.path);
					if (newIdx !== -1) {
						setSelectedGameIndex(newIdx);
					} else {
						setSelectedGameIndex((prevIdx) => {
							if (newGames.length === 0) return 0;
							if (prevIdx >= newGames.length) return newGames.length - 1;
							return prevIdx;
						});
					}
				};

				if (childSystems.length > 0) {
					return Promise.all(childSystems.map((s) => window.api.getGames(s.name))).then((allChildGames) => {
						const merged = [...masterGames];
						allChildGames.forEach((childGames) => {
							merged.push(...childGames);
						});
						merged.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
						updateGamesState(merged);
					});
				} else {
					updateGamesState(masterGames);
				}
			});

			// Notify on favorite change
			if (updatedGame.favorite !== wasFavorite) {
				addNotification(
					updatedGame.favorite
						? `${updatedGame.name} ADDED TO FAVORITES`
						: `${updatedGame.name} REMOVED FROM FAVORITES`,
					updatedGame.favorite ? 'success' : 'info',
					'general',
				);
			}

			return gamesUpdatePromise;
		});
	};

	// ─── Keyboard Navigation ───
	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if (showGamelistUpdateModal) {
				if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
					setReloadModalSelectedIndex((prev) => (prev === 0 ? 1 : 0));
				} else if (e.key === 'Enter' || e.key === ' ') {
					if (reloadModalSelectedIndex === 0) {
						handleFastReload();
					} else {
						setShowGamelistUpdateModal(false);
					}
				} else if (e.key === 'Escape' || e.key === 'Backspace') {
					setShowGamelistUpdateModal(false);
				}
				return;
			}

			if (e.key === 'Control') {
				setIsMenuOpen(false);
				setIsGameOptionsOpen(false);
				setIsHardwareSelectOpen(false);
				setIsLaunching(false);
				// Let it bubble or handle below
			}

			if (e.key === 'Enter' && !isGameOptionsOpen) {
				setIsMenuOpen((prev) => !prev);
				return;
			}

			if (isMenuOpen || isInitializing || isGameOptionsOpen || isLaunching || isHardwareSelectOpen) return;

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

				if (e.key === ' ') setSelectedSystem(filteredSystems[systemIndex]);

				if (e.key === 'Control') {
					setIsHardwareSelectOpen(true);
					return;
				}
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
				if (isGameOptionsOpen || isSaveStateManagerOpen) return;

				if (e.key === ' ' && currentGame && !isLaunching) {
					if (currentGame.isCollectionFolder) {
						setSelectedCollection(currentGame.path);
					} else {
						const saveStatesSetting = String(settings['global.savestates']?.value ?? '0');

						const executeDirectLaunch = () => {
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
						};

						if (saveStatesSetting === '0') {
							executeDirectLaunch();
						} else {
							window.api
								.scanSaveStates(selectedSystem!.name, currentGame.path)
								.then((states) => {
									if (saveStatesSetting === '2' && (!states || states.length === 0)) {
										executeDirectLaunch();
									} else {
										setSaveManagerGame(currentGame);
										setSaveManagerSystem(selectedSystem);
										setIsSaveStateManagerOpen(true);
									}
								})
								.catch((err) => {
									console.error('Failed to scan save states before launch:', err);
									executeDirectLaunch();
								});
						}
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
		isHardwareSelectOpen,
		currentGame,
		isInitializing,
		isLaunching,
		enterPressTimer,
		settings,
		showGamelistUpdateModal,
		reloadModalSelectedIndex,
		handleFastReload,
		isSaveStateManagerOpen,
	]);

	// ─── Start screen: render once, update progress via DOM refs to avoid flickering ───
	const startScreenRef = useRef<HTMLDivElement>(null);
	const startHtmlOnce = useMemo(() => {
		if (!theme?.views?.start) return null;
		const normalizedPath = theme.path.replace(/\\/g, '/');
		// Resolve translations for {t:KEY} tags
		const lang = settings['Language']?.value || 'en_US';
		const themeLocales = theme?.locales || {};
		const defaultLocaleKey = theme?.defaultLocale || 'en_US';
		const currentLocale = themeLocales[lang] || {};
		const fallbackLocale = themeLocales[defaultLocaleKey] || themeLocales['en_US'] || {};
		const merged = { ...fallbackLocale, ...currentLocale };
		return theme.views.start
			.replace(/src="\.\/"/g, `src="file:///${normalizedPath}/"`)
			.replace(/src="\.\//g, `src="file:///${normalizedPath}/`)
			.replace(/href="\.\//g, `href="file:///${normalizedPath}/`)
			.replace(/{systems-loading}/g, '0')
			.replace(/\{t:(\w+)\}/g, (_match: string, key: string) => merged[key] || fallbackLocale[key] || key);
	}, [theme?.views?.start, theme?.path, theme?.locales, theme?.defaultLocale, settings['Language']?.value]);

	useEffect(() => {
		const el = startScreenRef.current;
		if (!el) return;
		// Update progress bar width
		const bar = el.querySelector('.progress-bar') as HTMLElement;
		if (bar) bar.style.width = `${systemsLoadingProgress}%`;
		// Update percentage text
		const pct = el.querySelector('.percentage');
		if (pct) pct.textContent = `${systemsLoadingProgress}%`;
		// Show/hide loading overlay and progress container based on progress
		const overlay = el.querySelector('.loading-overlay') as HTMLElement;
		const progressContainer = el.querySelector('.progress-container') as HTMLElement;
		if (overlay) overlay.style.opacity = systemsLoadingProgress > 0 ? '1' : '0';
		if (progressContainer) progressContainer.style.opacity = systemsLoadingProgress > 0 ? '1' : '0';
	}, [systemsLoadingProgress]);

	// ─── Rendering ───
	if (!theme) return null;

	if (isInitializing && startHtmlOnce) {
		return (
			<div 
				ref={startScreenRef}
				style={{
					width: '100vw',
					height: '100vh',
					background: '#000',
					overflow: 'hidden',
					['--theme-color' as any]: themeData['options:colors'] || themeData['colors'] || '#3b82f6',
				}} 
				dangerouslySetInnerHTML={{ __html: startHtmlOnce }} 
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
				['--theme-color' as any]: themeData['options:colors'] || themeData['colors'] || '#3b82f6',
			}}
		>
			<WebThemeRenderer
				htmlContent={selectedSystem ? theme.views.gamelist : theme.views.system}
				data={themeData}
				themePath={theme.path}
			/>
			<Menu
				isOpen={isMenuOpen}
				selectedSystem={selectedSystem}
				onUpdateGamelists={handleUpdateGamelists}
				onClose={() => {
					setIsMenuOpen(false);
					// Refresh settings when menu closes to reflect changes like DrawFramerate
					window.api.getSettings().then((latestSettings: any) => {
						setSettings(latestSettings);
					});
					window.api.getMusicFiles().then((files: string[]) => {
						setMusicFiles(files);
					});
					if (theme && theme.name) {
						window.api.loadTheme(theme.name).then(setTheme);
					}
				}}
				theme={theme}
				themeData={themeData}
				allSystems={systems}
			/>
			<HardwareSelectOverlay
				isOpen={isHardwareSelectOpen}
				onClose={() => setIsHardwareSelectOpen(false)}
				systems={filteredSystems}
				onSelectSystem={(systemName) => {
					const idx = filteredSystems.findIndex(s => s.name === systemName);
					if (idx !== -1) {
						setSystemIndex(idx);
					}
				}}
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
					addNotification={addNotification}
					onUpdateGamelists={handleUpdateGamelists}
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

			{/* Notifications Layer (General and Controller - Center Top) */}
			<div className="riescade-notifications-container">
				{notifications
					.filter((n) => n.category !== 'scraper')
					.map((n) => (
						<div key={n.id} className={`riescade-notification ${n.type}`}>
							<div className="riescade-notification-status" />
							<span className="riescade-notification-message">{n.message}</span>
						</div>
					))}
			</div>

			{/* Notifications Layer (Scraper - Right Top) */}
			<div className="riescade-notifications-container scraper-notifications">
				{notifications
					.filter((n) => n.category === 'scraper')
					.map((n) => (
						<div key={n.id} className={`riescade-notification ${n.type}`}>
							<div className="riescade-notification-status" />
							<span className="riescade-notification-message">{n.message}</span>
						</div>
					))}
			</div>

			{/* Song Title Notification Overlay */}
			<div className={`riescade-music-title-overlay ${showMusicTitle && currentTrackName ? 'visible' : ''}`}>
				<div className="music-title-container">
					<div className="music-icon-glow" />
					<div className="music-title-text-wrap">
						<span className="music-title-label">REPRODUZINDO AGORA</span>
						<span className="music-title-value">{currentTrackName}</span>
					</div>
				</div>
			</div>

			{/* Floating Background Scraper Progress Card */}
			{bulkScrapeStatus && bulkScrapeStatus.active && (
				<div className="scraper-progress-card">
					<div className="scraper-spinner" />
					<div className="scraper-info-wrap">
						<span className="scraper-progress-title">
							PROCURANDO MÍDIAS {bulkScrapeStatus.current}/{bulkScrapeStatus.total}
						</span>
						<span className="scraper-progress-sub">
							<span className="scraper-system-tag">{bulkScrapeStatus.systemCode}</span>: {bulkScrapeStatus.gameName}
						</span>
					</div>
				</div>
			)}

			{/* Glassmorphic Gamelist Completion/Reload Modal */}
			{showGamelistUpdateModal && (
				<div className="scraper-completion-overlay">
					<div className="scraper-completion-modal">
						<div className="scraper-completion-icon">⚡</div>
						<div className="scraper-completion-title">SCRAPE CONCLUÍDO</div>
						<div className="scraper-completion-text">
							Deseja atualizar a lista de jogos agora para aplicar as novas mídias baixadas?
						</div>
						<div className="scraper-completion-buttons">
							<button 
								className={`scraper-completion-btn primary ${reloadModalSelectedIndex === 0 ? 'selected' : ''}`}
								onClick={handleFastReload}
							>
								SIM
							</button>
							<button 
								className={`scraper-completion-btn secondary ${reloadModalSelectedIndex === 1 ? 'selected' : ''}`}
								onClick={() => setShowGamelistUpdateModal(false)}
							>
								NÃO
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Graphical Gamelist Update Overlay */}
			{isUpdatingGamelist && (
				<div 
					className="scraper-modal-overlay"
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						background: 'rgba(0, 0, 0, 0.85)',
						backdropFilter: 'blur(15px)',
						WebkitBackdropFilter: 'blur(15px)',
						zIndex: 10000000,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						fontFamily: "'Outfit', 'Inter', sans-serif",
						color: '#fff'
					}}
				>
					<div 
						className="scraper-modal-container searching-modal"
						style={{
							background: 'rgba(20, 20, 20, 0.85)',
							backdropFilter: 'blur(10px)',
							WebkitBackdropFilter: 'blur(10px)',
							border: '2px solid rgba(240, 66, 176, 0.2)',
							borderRadius: '16px',
							padding: '40px 30px',
							width: '420px',
							boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							textAlign: 'center'
						}}
					>
						<div 
							className="scraper-spinner" 
							style={{ 
								width: '50px', 
								height: '50px', 
								border: '5px solid rgba(255, 255, 255, 0.1)', 
								borderTopColor: 'var(--theme-color, #f042b0)', 
								borderRadius: '50%',
								animation: 'scraper-spin 1s linear infinite'
							}} 
						/>
						<p 
							className="searching-text"
							style={{ 
								fontSize: '1.25rem', 
								fontWeight: 900, 
								color: 'var(--theme-color, #f042b0)', 
								margin: '25px 0 8px 0',
								letterSpacing: '2px',
								textTransform: 'uppercase'
							}}
						>
							ATUALIZANDO GAMELISTS
						</p>
					</div>
				</div>
			)}

			{/* Save State Manager Overlay */}
			{isSaveStateManagerOpen && saveManagerGame && saveManagerSystem && (
				<SaveStateManagerOverlay
					isOpen={isSaveStateManagerOpen}
					game={saveManagerGame}
					system={saveManagerSystem}
					onClose={() => {
						setIsSaveStateManagerOpen(false);
						setSaveManagerGame(null);
						setSaveManagerSystem(null);
					}}
					onLaunch={(slot) => {
						setIsSaveStateManagerOpen(false);
						setIsLaunching(true);
						window.api
							.launchGame(saveManagerGame, saveManagerSystem, slot)
							.then(() => {
								setTimeout(() => setIsLaunching(false), 5000);
							})
							.catch((err) => {
								console.error('Launch game failed or exited with code:', err);
								setTimeout(() => setIsLaunching(false), 5000);
							});
						setSaveManagerGame(null);
						setSaveManagerSystem(null);
					}}
				/>
			)}

			{/* FPS Counter Layer */}
			<FPSCounter visible={settings.DrawFramerate?.value === true || settings.DrawFramerate?.value === 'true'} />
		</div>
	);
}

// Sleek, highly-optimized FPS counter component using requestAnimationFrame
const FPSCounter: React.FC<{ visible: boolean }> = ({ visible }) => {
	const [fps, setFps] = React.useState(0);
	const frameCount = React.useRef(0);
	const lastTime = React.useRef(performance.now());

	React.useEffect(() => {
		if (!visible) return;

		let animId: number;
		const tick = () => {
			frameCount.current++;
			const now = performance.now();
			const elapsed = now - lastTime.current;

			if (elapsed >= 1000) {
				setFps(Math.round((frameCount.current * 1000) / elapsed));
				frameCount.current = 0;
				lastTime.current = now;
			}
			animId = requestAnimationFrame(tick);
		};

		animId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(animId);
	}, [visible]);

	if (!visible) return null;

	return (
		<div
			style={{
				position: 'fixed',
				top: '12px',
				right: '12px',
				background: 'rgba(0, 0, 0, 0.75)',
				color: '#00ff66',
				fontFamily: '"Outfit", "Inter", monospace',
				fontSize: '11px',
				fontWeight: 800,
				letterSpacing: '1px',
				padding: '4px 8px',
				borderRadius: '4px',
				zIndex: 999999,
				pointerEvents: 'none',
				boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
				border: '1px solid rgba(0, 255, 102, 0.25)',
				display: 'flex',
				alignItems: 'center',
				gap: '4px',
				textShadow: '0 0 4px rgba(0, 255, 102, 0.4)',
			}}
		>
			<span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff66', display: 'inline-block', boxShadow: '0 0 6px #00ff66' }} />
			{fps} FPS
		</div>
	);
};

export default App;
