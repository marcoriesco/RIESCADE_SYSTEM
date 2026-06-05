import * as dgram from 'dgram'
import * as http from 'http'
import * as path from 'path'
import * as fs from 'fs'
import { LibraryService } from './LibraryService'
import { SettingsParser } from '../parsers/SettingsParser'
import { getRomCRC32 } from '../utils/crc32'

interface NetplayRoom {
  isLan: boolean
  username: string
  game_name: string
  game_crc: string
  core_name: string
  frontend: string
  retroarch_version: string
  ip: string
  port: number
  mitm_ip?: string
  mitm_port?: number
  mitm_session?: string
  host_method: number
  has_password: boolean
  country: string
  
  // Local match info
  localGame?: {
    id: string
    name: string
    path: string
    system: string
    absolutePath: string
    matchStatus: 'SAME_ROM' | 'DIFFERENT_ROM' | 'UNAVAILABLE'
    localCrc: string
  }
}

function normalizeGameName(name: string): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // Remove parenthesis (USA), (Japan), etc.
    .replace(/\[.*?\]/g, '') // Remove brackets [snesbr], [!], etc.
    .replace(/[^a-z0-9]/g, ' ') // Replace special characters with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim()
}

export class NetplayService {
  private settingsParser: SettingsParser

  constructor() {
    this.settingsParser = new SettingsParser()
  }

  /**
   * Fetches active Netplay sessions from local LAN (UDP broadcast) and official WAN lobby.
   */
  public async getLobbyList(): Promise<NetplayRoom[]> {
    console.log('[Netplay] getLobbyList() called')
    const netplayPort = parseInt(this.settingsParser.getSetting('global.netplay.port', 'string') || '55435', 10)
    console.log('[Netplay] Using port:', netplayPort)
    
    // 1. Scan WAN & LAN lobbies in parallel
    const [lanRooms, wanRooms] = await Promise.all([
      this.scanLanLobby(netplayPort),
      this.fetchWanLobby()
    ])

    console.log(`[Netplay] LAN rooms found: ${lanRooms.length}, WAN rooms found: ${wanRooms.length}`)
    const allRooms = [...lanRooms, ...wanRooms]

    // 2. Perform on-demand ROM matching and CRC32 checks
    await this.matchLocalRoms(allRooms)

    const matched = allRooms.filter(r => r.localGame).length
    console.log(`[Netplay] Returning ${allRooms.length} rooms (${matched} matched locally)`)
    return allRooms
  }

  private scanLanLobby(port: number): Promise<NetplayRoom[]> {
    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4')
      const rooms: NetplayRoom[] = []

      socket.on('error', (err) => {
        console.error('LAN UDP scan error:', err)
        try { socket.close() } catch {}
        resolve([])
      })

      socket.on('message', (msg, rinfo) => {
        // ad_packet structure signature signature: PK\1\2 or similar, total size 688 bytes
        if (msg.length < 688) return

        const header = msg.readUInt32BE(0)
        if (header !== 0x52414E53) return // RANS

        const content_crc = msg.readInt32BE(4)
        const roomPort = msg.readInt32BE(8)
        const has_password = msg.readUInt32BE(12)

        const nick = msg.toString('utf8', 16, 48).replace(/\0/g, '').trim()
        const frontend = msg.toString('utf8', 48, 80).replace(/\0/g, '').trim()
        const core = msg.toString('utf8', 80, 112).replace(/\0/g, '').trim()
        const core_version = msg.toString('utf8', 112, 144).replace(/\0/g, '').trim()
        const retroarch_version = msg.toString('utf8', 144, 176).replace(/\0/g, '').trim()
        const content = msg.toString('utf8', 176, 432).replace(/\0/g, '').trim()
        const subsystem_name = msg.toString('utf8', 432, 688).replace(/\0/g, '').trim()

        const crcHex = ((content_crc ^ 0xffffffff) === 0 || content_crc === 0)
          ? '00000000'
          : (content_crc >>> 0).toString(16).padStart(8, '0').toUpperCase()

        if (rooms.some((r) => r.ip === rinfo.address && r.port === roomPort)) return

        rooms.push({
          isLan: true,
          username: nick,
          game_name: content,
          game_crc: crcHex,
          core_name: core,
          frontend: frontend,
          retroarch_version: retroarch_version,
          ip: rinfo.address,
          port: roomPort,
          has_password: has_password > 0,
          host_method: 0,
          country: 'lan'
        })
      })

      socket.bind(0, () => {
        try {
          socket.setBroadcast(true)
          const magic = Buffer.alloc(4)
          magic.writeUInt32BE(0x52414E51, 0) // RANQ

          socket.send(magic, 0, 4, port, '255.255.255.255', (err) => {
            if (err) console.error('Failed to broadcast LAN query:', err)
          })
        } catch (e) {
          console.error('Failed to set up broadcast socket:', e)
        }
      })

      // Scan for 1.2 seconds
      setTimeout(() => {
        try { socket.close() } catch {}
        resolve(rooms)
      }, 1200)
    })
  }

  private fetchWanLobby(): Promise<NetplayRoom[]> {
    return new Promise((resolve) => {
      const url = 'http://lobby.libretro.com/list/'
      console.log('[Netplay] Fetching WAN lobby from:', url)
      const startTime = Date.now()
      const req = http.get(url, { timeout: 15000 }, (res) => {
        console.log(`[Netplay] WAN response status: ${res.statusCode} (${Date.now() - startTime}ms)`)
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          console.log(`[Netplay] WAN data received: ${data.length} bytes (${Date.now() - startTime}ms)`)
          try {
            const arr = JSON.parse(data)
            if (!Array.isArray(arr)) {
              console.log('[Netplay] WAN response is not an array, resolving empty')
              resolve([])
              return
            }

            const rooms: NetplayRoom[] = arr.map((item: any) => {
              const f = item.fields || {}
              return {
                isLan: false,
                username: f.username || '',
                game_name: f.game_name || '',
                game_crc: (f.game_crc || '').toUpperCase(),
                core_name: f.core_name || '',
                frontend: f.frontend || '',
                retroarch_version: f.retroarch_version || '',
                ip: f.ip || '',
                port: f.port || 0,
                mitm_ip: f.mitm_ip || '',
                mitm_port: f.mitm_port || 0,
                mitm_session: f.mitm_session || '',
                host_method: f.host_method || 0,
                has_password: !!f.has_password,
                country: f.country || ''
              }
            })
            console.log(`[Netplay] Parsed ${rooms.length} WAN rooms`)
            resolve(rooms)
          } catch (e) {
            console.error('[Netplay] Failed to parse WAN lobby JSON:', e)
            resolve([])
          }
        })
      })

      req.on('timeout', () => {
        console.error(`[Netplay] WAN request timed out after ${Date.now() - startTime}ms`)
        req.destroy()
      })

      req.on('error', (err) => {
        console.error(`[Netplay] WAN request error after ${Date.now() - startTime}ms:`, err.message || err)
        resolve([])
      })
    })
  }

  private async matchLocalRoms(rooms: NetplayRoom[]): Promise<void> {
    console.log(`[Netplay] matchLocalRoms() called with ${rooms.length} rooms`)
    try {
      console.log('[Netplay] Opening database...')
      const db = LibraryService.getDatabase().ensureOpen()
      console.log('[Netplay] Database opened successfully')
      
      let roomIdx = 0
      for (const room of rooms) {
        roomIdx++
        if (!room.game_name) continue

        const normalizedName = normalizeGameName(room.game_name)
        if (!normalizedName) continue

        // 1. Search SQLite database for fuzzy match by title or filename
        let candidates: any[] = []
        try {
          candidates = db.prepare(`
            SELECT g.*, s.path as system_path
            FROM games g
            JOIN systems s ON g.system = s.name
            WHERE g.name LIKE ? OR g.path LIKE ?
          `).all(`%${normalizedName}%`, `%${normalizedName}%`) as any[]
        } catch (dbErr) {
          console.error(`[Netplay] DB query failed for room ${roomIdx} "${room.game_name}":`, dbErr)
          continue
        }

        if (candidates.length === 0) continue

        console.log(`[Netplay] Room ${roomIdx}/${rooms.length} "${room.game_name}" -> ${candidates.length} candidates`)

        let bestMatch: any = null
        let matchedStatus: 'SAME_ROM' | 'DIFFERENT_ROM' = 'DIFFERENT_ROM'
        let matchedCrc = ''

        // 2. Perform on-demand hashing on candidate files (limit to first 3 to avoid long blocking)
        const maxCandidates = Math.min(candidates.length, 3)
        for (let ci = 0; ci < maxCandidates; ci++) {
          const candidate = candidates[ci]
          const absolutePath = path.resolve(candidate.system_path, candidate.path)
          if (!fs.existsSync(absolutePath)) continue

          try {
            console.log(`[Netplay]   Hashing candidate ${ci + 1}/${maxCandidates}: ${candidate.path}`)
            const localCrc = await getRomCRC32(absolutePath)
            console.log(`[Netplay]   CRC: ${localCrc} vs room CRC: ${room.game_crc}`)
            
            // If direct CRC match, we've found our ROM!
            if (localCrc === room.game_crc) {
              bestMatch = candidate
              matchedStatus = 'SAME_ROM'
              matchedCrc = localCrc
              break
            }

            // Otherwise, keep first name-matched candidate as fallback
            if (!bestMatch) {
              bestMatch = candidate
              matchedCrc = localCrc
            }
          } catch (err) {
            console.error(`[Netplay]   CRC failed for ${absolutePath}:`, err)
          }
        }

        if (bestMatch) {
          const absolutePath = path.resolve(bestMatch.system_path, bestMatch.path)
          room.localGame = {
            id: bestMatch.id,
            name: bestMatch.name,
            path: bestMatch.path,
            system: bestMatch.system,
            absolutePath,
            matchStatus: matchedStatus,
            localCrc: matchedCrc
          }
        }
      }
      console.log('[Netplay] matchLocalRoms() completed')
    } catch (err) {
      console.error('[Netplay] Error during local ROM matching:', err)
    }
  }
}
