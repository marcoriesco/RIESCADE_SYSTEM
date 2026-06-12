import { ipcMain, app } from 'electron'
import { existsSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname, extname, basename } from 'path'
import * as crypto from 'crypto'
import { getConfigPath } from '../utils/paths'
import { SYSTEM_TO_SCREENSCRAPER_PLATFORM } from '../services/ScraperService'
import { Game } from '../shared/types'
import { IpcContext } from './index'

export function registerScrapersIpc(context: IpcContext): void {
  const { scraperService, libraryService, settingsParser } = context

  ipcMain.handle('start-scrape', async () => {
    scraperService.scrape()
    return true
  })

  ipcMain.handle('cancel-scrape', async () => {
    scraperService.cancel()
    return true
  })

  // Helper functions for scrapers
  async function queryScreenScraper(
    systemName: string,
    gameName: string,
    gamePath: string | undefined,
    preferredRegion: string,
    systemLanguage: string,
    ssid: string,
    sspassword: string,
    systemId: number
  ): Promise<any[]> {
    const devid = 'retrobat'
    const devpassword = 'JRLmOtnZXwo'
    const softname = 'retrobat'

    let jeux: any[] = []

    if (gamePath) {
      const romName = basename(gamePath)
      let url = `https://api.screenscraper.fr/api2/jeuInfos.php?devid=${devid}&devpassword=${devpassword}&softname=${softname}&output=json&romnom=${encodeURIComponent(romName)}`
      if (systemId > 0) {
        url += `&systemeid=${systemId}`
      }
      if (ssid) {
        url += `&ssid=${encodeURIComponent(ssid)}`
      }
      if (sspassword) {
        url += `&sspassword=${encodeURIComponent(sspassword)}`
      }

      try {
        const response = await fetch(url)
        if (response.ok) {
          const json = await response.json()
          const jeu = json.response?.jeu
          if (jeu) {
            jeux = [jeu]
          }
        }
      } catch (err) {
        console.error('ScreenScraper romnom search failed:', err)
      }
    }

    if (jeux.length === 0) {
      let cleanedName = gameName.replace(/\.[a-zA-Z0-9]{2,4}$/, '')
      cleanedName = cleanedName.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '')
      cleanedName = cleanedName.replace(/[_-]/g, ' ')
      cleanedName = cleanedName.replace(/\s+/g, ' ').trim()
      if (!cleanedName) cleanedName = gameName

      let url = `https://api.screenscraper.fr/api2/jeuInfos.php?devid=${devid}&devpassword=${devpassword}&softname=${softname}&output=json&recherche=${encodeURIComponent(cleanedName)}`
      if (systemId > 0) {
        url += `&systemeid=${systemId}`
      }
      if (ssid) {
        url += `&ssid=${encodeURIComponent(ssid)}`
      }
      if (sspassword) {
        url += `&sspassword=${encodeURIComponent(sspassword)}`
      }

      const response = await fetch(url)
      if (response.ok) {
        const json = await response.json()
        if (json.response?.jeux) {
          jeux = Array.isArray(json.response.jeux) ? json.response.jeux : [json.response.jeux]
        } else if (json.response?.jeu) {
          jeux = Array.isArray(json.response.jeu) ? json.response.jeu : [json.response.jeu]
        }
      } else {
        throw new Error(`ScreenScraper returned status ${response.status}`)
      }
    }

    const getRipList = (imageSource: string): string[] => {
      if (imageSource === 'ss') return ['ss', 'sstitle']
      if (imageSource === 'sstitle') return ['sstitle', 'ss']
      if (imageSource === 'mixrbv1' || imageSource === 'mixrbv') return ['mixrbv1', 'mixrbv2', 'fanart', 'ss', 'sstitle']
      if (imageSource === 'mixrbv2') return ['mixrbv2', 'mixrbv1', 'fanart', 'ss', 'sstitle']
      if (imageSource === 'box-2D') return ['box-2D', 'box-3D', 'cover']
      if (imageSource === 'box-3D') return ['box-3D', 'box-2D', 'cover']
      if (imageSource === 'wheel') return ['wheel', 'wheel-hd', 'wheel-steel', 'wheel-carbon', 'screenmarqueesmall', 'screenmarquee', 'logo']
      if (imageSource === 'wheel-hd') return ['wheel-hd', 'wheel', 'wheel-steel', 'wheel-carbon', 'screenmarqueesmall', 'screenmarquee', 'logo']
      if (imageSource === 'marquee') return ['screenmarqueesmall', 'screenmarquee', 'wheel', 'wheel-hd', 'wheel-steel', 'wheel-carbon', 'logo']
      if (imageSource === 'video') return ['video-normalized', 'video']
      return [imageSource]
    }

    const imageSrc = settingsParser.getSetting('ScrapperImageSrc', 'string') || 'mixrbv2'
    const thumbSrc = settingsParser.getSetting('ScrapperThumbSrc', 'string') || 'box-2D'
    const logoSrc = settingsParser.getSetting('ScrapperLogoSrc', 'string') || 'wheel-hd'

    const findMediaUrl = (medias: any[], typeList: string[]): string | undefined => {
      if (!medias || !Array.isArray(medias)) return undefined
      const regions = [preferredRegion, 'wor', 'us', 'eu', 'jp', 'ss', '']
      for (const type of typeList) {
        for (const reg of regions) {
          const match = medias.find(m => m.type === type && (reg === '' || String(m.region || '').toLowerCase() === reg.toLowerCase()))
          if (match && match.url) {
            return match.url
          }
        }
      }
      const fallback = medias.find(m => typeList.includes(m.type) && m.url)
      return fallback ? fallback.url : undefined
    }

    const results: any[] = []
    for (const jeu of jeux) {
      const noms = jeu.noms || []
      const regions = [preferredRegion, 'wor', 'us', 'eu', 'jp', 'ss', '']
      let gameNameParsed = ''
      for (const reg of regions) {
        const nomMatch = noms.find((n: any) => reg === '' || String(n.region || '').toLowerCase() === reg.toLowerCase())
        if (nomMatch) {
          gameNameParsed = nomMatch.text
          break
        }
      }
      if (!gameNameParsed && noms.length > 0) gameNameParsed = noms[0].text
      if (!gameNameParsed) gameNameParsed = gameName

      const synopsis = jeu.synopsis || []
      const langs = [systemLanguage, 'en', 'wor']
      let gameDesc = ''
      for (const l of langs) {
        const synMatch = synopsis.find((s: any) => String(s.langue || '').toLowerCase() === l.toLowerCase())
        if (synMatch) {
          gameDesc = synMatch.text
          break
        }
      }
      if (!gameDesc && synopsis.length > 0) gameDesc = synopsis[0].text

      const gameDev = jeu.developpeur?.text || ''
      const gamePub = jeu.editeur?.text || ''

      const genresList = (jeu.genres || []).map((g: any) => {
        const synMatch = (g.noms || []).find((n: any) => String(n.langue || '').toLowerCase() === systemLanguage.toLowerCase()) || 
                         (g.noms || []).find((n: any) => String(n.langue || '').toLowerCase() === 'en')
        return synMatch ? synMatch.text : ''
      }).filter((x: string) => x !== '')
      const gameGenre = genresList.join(', ')

      const gamePlayers = jeu.joueurs?.text || ''
      const gameRating = jeu.note?.text ? parseFloat(jeu.note.text) / 20 : undefined

      const dates = jeu.dates || []
      let relDate = ''
      for (const reg of regions) {
        const dateMatch = dates.find((d: any) => reg === '' || String(d.region || '').toLowerCase() === reg.toLowerCase())
        if (dateMatch) {
          relDate = dateMatch.text
          break
        }
      }
      if (!relDate && dates.length > 0) relDate = dates[0].text
      if (relDate && relDate.includes('-')) {
        relDate = relDate.replace(/-/g, '') + 'T000000'
      }

      results.push({
        id: String(jeu.id),
        name: gameNameParsed,
        db: 'ScreenScraper',
        releasedate: relDate,
        developer: gameDev,
        publisher: gamePub,
        genre: gameGenre,
        rating: gameRating,
        desc: gameDesc,
        players: gamePlayers,
        media: {
          image: findMediaUrl(jeu.medias, getRipList(imageSrc)),
          thumbnail: findMediaUrl(jeu.medias, getRipList(thumbSrc)),
          marquee: findMediaUrl(jeu.medias, getRipList(logoSrc)),
          video: findMediaUrl(jeu.medias, getRipList('video'))
        }
      })
    }

    return results
  }

  async function queryArcadeDB(gameName: string): Promise<any[]> {
    let cleanName = gameName.replace(/\.[a-zA-Z0-9]{2,4}$/, '')
    cleanName = cleanName.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '')
    cleanName = cleanName.replace(/[_-]/g, '')
    cleanName = cleanName.replace(/[\s.]/g, '').toLowerCase().trim()
    if (!cleanName) cleanName = gameName.toLowerCase().replace(/[\s.]/g, '')

    const url = `http://adb.arcadeitalia.net/service_scraper.php?ajax=query_mame&lang=en&use_parent=1&game_name=${encodeURIComponent(cleanName)}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`ArcadeDB status ${response.status}`)
    }

    const json = await response.json()
    if (!json.result || !Array.isArray(json.result)) {
      return []
    }

    const results: any[] = []
    for (const game of json.result) {
      const gameNameParsed = game.short_title || game.title || gameName
      let relDate = ''
      if (game.year) {
        relDate = `${game.year}0101T000000`
      }

      results.push({
        id: `arcadedb-${gameNameParsed.replace(/\s+/g, '-').toLowerCase()}`,
        name: gameNameParsed,
        db: 'ArcadeDB',
        releasedate: relDate,
        developer: game.manufacturer || '',
        publisher: game.manufacturer || '',
        genre: game.genre || '',
        rating: undefined,
        desc: game.history || '',
        players: game.players ? String(game.players) : '',
        media: {
          image: game.url_image_ingame || game.url_image_flyer || '',
          thumbnail: game.url_image_flyer || game.url_image_ingame || '',
          marquee: game.url_image_marquee || game.url_image_title || '',
          video: game.url_video_shortplay_hd || game.url_video_shortplay || ''
        }
      })
    }

    return results
  }

  async function queryIGDB(gameName: string, clientID: string, secret: string): Promise<any[]> {
    if (!clientID || !secret) {
      throw new Error('CREDENCIAIS_AUSENTES: IGDB Client ID ou Client Secret ausentes.')
    }

    const authUrl = 'https://id.twitch.tv/oauth2/token'
    const tokenResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `client_id=${encodeURIComponent(clientID)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`
    })

    if (!tokenResponse.ok) {
      throw new Error(`IGDB OAuth falhou com status ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token
    if (!accessToken) {
      throw new Error('IGDB OAuth falhou em obter token de acesso.')
    }

    let cleanedName = gameName.replace(/\.[a-zA-Z0-9]{2,4}$/, '')
    cleanedName = cleanedName.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '')
    cleanedName = cleanedName.replace(/[_-]/g, ' ')
    cleanedName = cleanedName.replace(/\s+/g, ' ').trim()
    if (!cleanedName) cleanedName = gameName

    const searchUrl = 'https://api.igdb.com/v4/games'
    const query = `fields id, name, platforms.name, genres.name, game_modes.name, multiplayer_modes.offlinemax, release_dates.date, release_dates.region, release_dates.platform, cover.*, screenshots.*, artworks.*, url, summary, aggregated_rating, involved_companies.company.name, involved_companies.developer, involved_companies.publisher; search "${cleanedName}"; limit 10;`

    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Client-ID': clientID,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'text/plain',
        'Accept': 'application/json'
      },
      body: query
    })

    if (!searchResponse.ok) {
      throw new Error(`IGDB Search falhou com status ${searchResponse.status}`)
    }

    const games = await searchResponse.json()
    if (!Array.isArray(games)) return []

    const results: any[] = []
    for (const game of games) {
      let dev = ''
      let pub = ''
      if (game.involved_companies && Array.isArray(game.involved_companies)) {
        for (const comp of game.involved_companies) {
          const name = comp.company?.name
          if (name) {
            if (comp.developer) dev = name
            if (comp.publisher) pub = name
          }
        }
      }

      let relDate = ''
      if (game.release_dates && Array.isArray(game.release_dates) && game.release_dates.length > 0) {
        const timestamp = game.release_dates[0].date
        if (timestamp) {
          const dateObj = new Date(timestamp * 1000)
          relDate = dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'T000000'
        }
      }

      const genreStr = game.genres ? game.genres.map((g: any) => g.name).join(', ') : ''
      const playersStr = game.multiplayer_modes ? String(Math.max(...game.multiplayer_modes.map((m: any) => m.offlinemax || 1))) : ''
      const ratingNum = game.aggregated_rating ? game.aggregated_rating / 100 : undefined

      results.push({
        id: `igdb-${game.id}`,
        name: game.name || gameName,
        db: 'IGDB',
        releasedate: relDate,
        developer: dev,
        publisher: pub,
        genre: genreStr,
        rating: ratingNum,
        desc: game.summary || '',
        players: playersStr,
        media: {
          image: game.screenshots && game.screenshots.length > 0 ? `https://images.igdb.com/igdb/image/upload/t_screenshot_huge/${game.screenshots[0].image_id}.jpg` : '',
          thumbnail: game.cover ? `https://images.igdb.com/igdb/image/upload/t_original/${game.cover.image_id}.jpg` : '',
          marquee: game.artworks && game.artworks.length > 0 ? `https://images.igdb.com/igdb/image/upload/t_1080p/${game.artworks[0].image_id}.jpg` : '',
          video: ''
        }
      })
    }

    return results
  }

  async function queryTheGamesDB(gameName: string, apiKey: string, configPath: string): Promise<any[]> {
    if (!apiKey) {
      throw new Error('CREDENCIAIS_AUSENTES: TheGamesDB API key ausente.')
    }

    let cleanedName = gameName.replace(/\.[a-zA-Z0-9]{2,4}$/, '')
    cleanedName = cleanedName.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '')
    cleanedName = cleanedName.replace(/[_-]/g, ' ')
    cleanedName = cleanedName.replace(/\s+/g, ' ').trim()
    if (!cleanedName) cleanedName = gameName

    const url = `https://api.thegamesdb.net/v1/Games/ByGameName?apikey=${apiKey}&fields=players,publishers,genres,overview,last_updated,rating,platform,alternates&include=boxart&name=${encodeURIComponent(cleanedName)}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`TheGamesDB status ${response.status}`)
    }

    const json = await response.json()
    if (!json.data || !json.data.games || !Array.isArray(json.data.games)) {
      return []
    }

    let devMap: any = {}
    let pubMap: any = {}
    let genMap: any = {}

    try {
      const devFile = join(configPath, 'scrapers', 'gamesdb_developers.json')
      const pubFile = join(configPath, 'scrapers', 'gamesdb_publishers.json')
      const genFile = join(configPath, 'scrapers', 'gamesdb_genres.json')

      if (existsSync(devFile)) devMap = JSON.parse(fs.readFileSync(devFile, 'utf-8'))?.data?.developers || {}
      if (existsSync(pubFile)) pubMap = JSON.parse(fs.readFileSync(pubFile, 'utf-8'))?.data?.publishers || {}
      if (existsSync(genFile)) genMap = JSON.parse(fs.readFileSync(genFile, 'utf-8'))?.data?.genres || {}
    } catch (err) {
      console.error('Failed to parse TheGamesDB JSON maps:', err)
    }

    const getMappedNames = (ids: any[], map: any) => {
      if (!ids || !Array.isArray(ids)) return ''
      return ids.map(id => map[id]?.name || map[id] || String(id)).join(', ')
    }

    const boxartInclude = json.include?.boxart || {}
    const baseUrlLarge = boxartInclude.base_url?.large || 'https://legacy.thegamesdb.net/images/original/'

    const results: any[] = []
    for (const game of json.data.games) {
      let relDate = ''
      if (game.release_date) {
        relDate = game.release_date.replace(/-/g, '') + 'T000000'
      }

      const devStr = getMappedNames(game.developers, devMap)
      const pubStr = getMappedNames(game.publishers, pubMap)
      const genreStr = getMappedNames(game.genres, genMap)

      let frontBoxart = ''
      const gameId = String(game.id)
      if (boxartInclude.data && boxartInclude.data[gameId] && Array.isArray(boxartInclude.data[gameId])) {
        const matchFront = boxartInclude.data[gameId].find((b: any) => b.type === 'boxart' && b.side === 'front')
        const fallback = boxartInclude.data[gameId][0]
        const relativePath = matchFront ? matchFront.filename : (fallback ? fallback.filename : '')
        if (relativePath) {
          frontBoxart = `${baseUrlLarge}${relativePath}`
        }
      }

      results.push({
        id: `thegamesdb-${game.id}`,
        name: game.game_title || gameName,
        db: 'TheGamesDB',
        releasedate: relDate,
        developer: devStr,
        publisher: pubStr,
        genre: genreStr,
        rating: game.rating ? game.rating / 10 : undefined,
        desc: game.overview || '',
        players: game.players ? String(game.players) : '',
        media: {
          image: frontBoxart,
          thumbnail: frontBoxart,
          marquee: '',
          video: ''
        }
      })
    }

    return results
  }

  async function queryHfsDB(gameName: string, hfsUser: string, hfsPass: string): Promise<any[]> {
    if (!hfsUser || !hfsPass) {
      throw new Error('CREDENCIAIS_AUSENTES: HfsDB username ou password ausentes.')
    }

    const basicAuth = Buffer.from(`${hfsUser}:${hfsPass}`).toString('base64');
    const tokenResponse = await fetch('https://db.hfsplay.fr/api/v1/auth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `username=${encodeURIComponent(hfsUser)}&password=${encodeURIComponent(hfsPass)}`
    });

    if (!tokenResponse.ok) {
      throw new Error(`HfsDB Auth falhou com status ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    const token = tokenData.token
    if (!token) {
      throw new Error('HfsDB Auth falhou em obter token.')
    }

    let cleanedName = gameName.replace(/\.[a-zA-Z0-9]{2,4}$/, '')
    cleanedName = cleanedName.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '')
    cleanedName = cleanedName.replace(/[_-]/g, ' ')
    cleanedName = cleanedName.replace(/\s+/g, ' ').trim()
    if (!cleanedName) cleanedName = gameName

    const searchUrl = `https://db.hfsplay.fr/api/v1/games?search=${encodeURIComponent(cleanedName)}&limit=25`
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Token ${token}`
      }
    })

    if (!searchResponse.ok) {
      throw new Error(`HfsDB Search falhou com status ${searchResponse.status}`)
    }

    const json = await searchResponse.json()
    if (!json.results || !Array.isArray(json.results)) {
      return []
    }

    const findHfsMedia = (game: any, scrapeSource: string): string => {
      if (!game.medias || !Array.isArray(game.medias)) return '';
      const getMediaTagNames = (source: string): string[] => {
        if (source === 'ss' || source === 'mixrbv2' || source === 'mixrbv1' || source === 'mixrbv') {
          return ['screenshot/in game', 'screenshot/title', 'screenshot'];
        }
        if (source === 'sstitle') {
          return ['screenshot/title', 'screenshot/in game', 'screenshot'];
        }
        if (source === 'box-2D') {
          return ['cover2d/front', 'cover2d', 'artwork/Flyer', 'cover3d'];
        }
        if (source === 'box-3D') {
          return ['cover3d', 'cover2d/front'];
        }
        if (source === 'wheel' || source === 'wheel-hd') {
          return ['logo'];
        }
        if (source === 'marquee') {
          return ['wheel', 'artwork/Marquee'];
        }
        if (source === 'video') {
          return ['video'];
        }
        if (source === 'manual') {
          return ['manual'];
        }
        if (source === 'fanart') {
          return ['wallpaper', 'artwork'];
        }
        if (source === 'box-2D-back') {
          return ['cover2d/back'];
        }
        return [];
      };

      const tags = getMediaTagNames(scrapeSource);
      for (const tag of tags) {
        let tagName = tag;
        let tagType = '';
        const idx = tag.indexOf('/');
        if (idx !== -1) {
          tagType = tag.substring(idx + 1);
          tagName = tag.substring(0, idx);
        }

        for (const media of game.medias) {
          if (!media.type || !media.file) continue;
          if (media.type !== tagName) continue;

          if (tagType) {
            if (media.metadata && Array.isArray(media.metadata)) {
              const match = media.metadata.find((m: any) => m.name === tagName + 'type' && m.value === tagType);
              if (match) return media.file;
            }
            if (media.description === tagType) {
              return media.file;
            }
            continue;
          }
          return media.file;
        }
      }
      return '';
    }

    const results: any[] = []
    for (const game of json.results) {
      const gameNameParsed = game.name_pt || game.name_en || game.name || gameName
      const gameDesc = game.description_pt || game.description_en || game.description || ''

      let dev = ''
      let pub = ''
      let gen = ''
      let players = ''

      if (game.metadata && Array.isArray(game.metadata)) {
        for (const meta of game.metadata) {
          if (!meta.name || !meta.value) continue
          if (meta.name === 'genre') gen = meta.value
          else if (meta.name === 'editor') pub = meta.value
          else if (meta.name === 'manufacturer') pub = meta.value
          else if (meta.name === 'developer') dev = meta.value
          else if (meta.name === 'players') {
            players = meta.value
              .replace(' joueurs', '')
              .replace(' joueur', '')
              .replace('+ de ', '')
          }
        }
      }

      let relDate = ''
      for (const rel of ['released_at_WORLD', 'released_at_US', 'released_at_PAL', 'released_at_JPN']) {
        if (game[rel]) {
          relDate = game[rel].replace(/-/g, '').split('T')[0] + 'T000000'
          break
        }
      }

      results.push({
        id: `hfsdb-${game.id}`,
        name: gameNameParsed,
        db: 'HfsDB',
        releasedate: relDate,
        developer: dev,
        publisher: pub,
        genre: gen,
        rating: undefined,
        desc: gameDesc,
        players: players,
        media: {
          image: findHfsMedia(game, 'fanart') || findHfsMedia(game, 'ss'),
          thumbnail: findHfsMedia(game, 'box-2D') || findHfsMedia(game, 'box-3D'),
          marquee: findHfsMedia(game, 'wheel') || findHfsMedia(game, 'marquee'),
          video: findHfsMedia(game, 'video')
        }
      })
    }

    return results
  }

  ipcMain.handle('search-game-media', async (_, systemName: string, gameName: string, databases: string[], gamePath?: string) => {
    try {
      const preferredRegion = settingsParser.getSetting('ScraperRegion', 'string') || 'eu'
      const systemLanguage = (settingsParser.getSetting('Language', 'string') || 'pt').substring(0, 2).toLowerCase()

      const ssid = settingsParser.getSetting('ScreenScraperUser', 'string') || ''
      const sspassword = settingsParser.getSetting('ScreenScraperPass', 'string') || ''

      const systemInfo = libraryService.getSystems().find(s => s.name === systemName)
      const systemId = SYSTEM_TO_SCREENSCRAPER_PLATFORM[systemName.toLowerCase()] || 
                       (systemInfo ? SYSTEM_TO_SCREENSCRAPER_PLATFORM[systemInfo.platform.toLowerCase()] : 0)

      const promises: Promise<any[]>[] = []
      const credentialRequiredSelected: string[] = []

      for (const db of databases) {
        if (db === 'ScreenScraper') {
          promises.push(
            queryScreenScraper(systemName, gameName, gamePath, preferredRegion, systemLanguage, ssid, sspassword, systemId)
              .catch(err => {
                console.error('ScreenScraper failed:', err)
                return []
              })
          )
          credentialRequiredSelected.push('ScreenScraper')
        } else if (db === 'ArcadeDB') {
          promises.push(
            queryArcadeDB(gameName)
              .catch(err => {
                console.error('ArcadeDB failed:', err)
                return []
              })
          )
        } else if (db === 'IGDB') {
          const clientID = settingsParser.getSetting('IGDBClientID', 'string') || 'a6j303y0qtil1b4uzhmwtu7tg1s138'
          const secret = settingsParser.getSetting('IGDBSecret', 'string') || 'bj1qgz4yvsmot64j2ocn1edl0nmdec'
          promises.push(
            queryIGDB(gameName, clientID, secret)
              .catch(err => {
                console.error('IGDB failed:', err)
                return []
              })
          )
          credentialRequiredSelected.push('IGDB')
        } else if (db === 'TheGamesDB') {
          const apiKey = settingsParser.getSetting('TheGamesDBApiKey', 'string') || 'd79b07c4e5715ec00435fa10410ab2b15c2a24762af9c3e0832694a213b74a79'
          promises.push(
            queryTheGamesDB(gameName, apiKey, getConfigPath())
              .catch(err => {
                console.error('TheGamesDB failed:', err)
                return []
              })
          )
        } else if (db === 'HfsDB') {
          const hfsUser = settingsParser.getSetting('HfsDBUser', 'string') || 'riescade'
          const hfsPass = settingsParser.getSetting('HfsDBPass', 'string') || 'ZbrSya@eu8iBNyR'
          promises.push(
            queryHfsDB(gameName, hfsUser, hfsPass)
              .catch(err => {
                console.error('HfsDB failed:', err)
                return []
              })
          )
        }
      }

      const resultsListList = await Promise.all(promises)
      const results = resultsListList.flat()

      if (databases.length > 0 && credentialRequiredSelected.length === databases.length && results.length === 0) {
        throw new Error('CONFIGURAÇÃO INCOMPLETA: Credenciais ausentes ou inválidas nas configurações do menu.')
      }

      return results
    } catch (e: any) {
      console.error('search-game-media error:', e)
      throw e
    }
  })

  ipcMain.handle('download-game-media', async (_, systemName: string, gamePath: string, matchData: any) => {
    try {
      const systems = libraryService.getSystems()
      const system = systems.find(s => s.name === systemName)
      if (!system) throw new Error(`System ${systemName} not found`)

      const games = libraryService.getGames(systemName)
      const game = games.find(g => g.path === gamePath)
      if (!game) throw new Error(`Game ${gamePath} not found in system ${systemName}`)

      const mediaFolder = join(system.path, 'media')
      const romName = basename(game.path)
      const romNameNoExt = romName.replace(/\.[^/.]+$/, '')

      const updatedFields: Partial<Game> = {}

      if (matchData.media?.image) {
        const destPathWithoutExt = join(mediaFolder, 'fanart', romNameNoExt)
        const ext = await downloadFile(matchData.media.image, destPathWithoutExt, 'png')
        updatedFields.image = `./media/fanart/${romNameNoExt}.${ext}`
      }

      if (matchData.media?.thumbnail) {
        const destPathWithoutExt = join(mediaFolder, 'cover', romNameNoExt)
        const ext = await downloadFile(matchData.media.thumbnail, destPathWithoutExt, 'png')
        updatedFields.thumbnail = `./media/cover/${romNameNoExt}.${ext}`
      }

      if (matchData.media?.marquee) {
        const destPathWithoutExt = join(mediaFolder, 'logo', romNameNoExt)
        const ext = await downloadFile(matchData.media.marquee, destPathWithoutExt, 'png')
        updatedFields.marquee = `./media/logo/${romNameNoExt}.${ext}`
      }

      if (matchData.media?.video) {
        const destPathWithoutExt = join(mediaFolder, 'video', romNameNoExt)
        const ext = await downloadFile(matchData.media.video, destPathWithoutExt, 'mp4')
        updatedFields.video = `./media/video/${romNameNoExt}.${ext}`
      }

      if (matchData.name) updatedFields.name = matchData.name
      if (matchData.desc) updatedFields.desc = matchData.desc
      if (matchData.developer) updatedFields.developer = matchData.developer
      if (matchData.publisher) updatedFields.publisher = matchData.publisher
      if (matchData.genre) updatedFields.genre = matchData.genre
      if (matchData.players) updatedFields.players = matchData.players
      if (matchData.rating !== undefined) updatedFields.rating = matchData.rating
      if (matchData.releasedate) updatedFields.releasedate = matchData.releasedate

      const updatedGame = { ...game, ...updatedFields }
      await libraryService.updateGame(systemName, updatedGame)
      return updatedGame
    } catch (e: any) {
      console.error('download-game-media error:', e)
      throw e
    }
  })

  ipcMain.handle('download-temp-media', async (_, url: string) => {
    try {
      if (!url || typeof url !== 'string') return ''
      const hash = crypto.createHash('md5').update(url).digest('hex')
      const tempDir = join(app.getPath('temp'), 'riescade-scraper')
      const destPathWithoutExt = join(tempDir, hash)
      
      const extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'mkv', 'webm']
      for (const ext of extensions) {
        const checkPath = `${destPathWithoutExt}.${ext}`
        if (existsSync(checkPath)) {
          return checkPath
        }
      }

      const defaultExt = url.includes('.mp4') || url.includes('video') ? 'mp4' : 'png'
      const ext = await downloadFile(url, destPathWithoutExt, defaultExt)
      return `${destPathWithoutExt}.${ext}`
    } catch (e) {
      console.error('download-temp-media error:', e)
      return ''
    }
  })
}

async function downloadFile(url: string, destPathWithoutExt: string, defaultExt: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`)
  }

  let ext = defaultExt
  const contentType = response.headers.get('content-type')
  if (contentType) {
    const mime = contentType.toLowerCase().split(';')[0].trim()
    if (mime === 'image/png') ext = 'png'
    else if (mime === 'image/jpeg' || mime === 'image/jpg') ext = 'jpg'
    else if (mime === 'image/gif') ext = 'gif'
    else if (mime === 'image/webp') ext = 'webp'
    else if (mime === 'video/mp4') ext = 'mp4'
    else if (mime === 'video/mkv') ext = 'mkv'
    else if (mime === 'video/webm') ext = 'webm'
    else {
      const parts = mime.split('/')
      if (parts.length === 2 && (parts[0] === 'image' || parts[0] === 'video')) {
        const temp = parts[1]
        if (temp && temp.length > 0 && temp !== 'octet-stream') {
          ext = temp
        }
      }
    }
  } else {
    try {
      const parsed = new URL(url)
      const pathExt = extname(parsed.pathname)
      if (pathExt && pathExt.length > 1) {
        const temp = pathExt.substring(1).toLowerCase()
        if (temp !== 'php') {
          ext = temp
        }
      }
    } catch (e) {}
  }

  if (!ext || ext.length > 5 || ext === 'php') {
    ext = defaultExt
  }

  const destPath = `${destPathWithoutExt}.${ext}`
  const dir = dirname(destPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  writeFileSync(destPath, buffer)
  return ext
}
