import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync, readdirSync, createWriteStream } from 'fs'
import { exec } from 'child_process'
import { getUserThemesPath } from '../utils/paths'

export interface ThemeCatalogItem {
  id: string
  name: string
  github: string
  version: string
  author?: string
  preview?: string
  featured?: boolean
}

export interface CommunityThemeItem {
  id: string
  name: string
  github: string
  version: string
  author: string
  preview: string
  downloadUrl: string
  stars: number
  updatedAt: string
}

const GH_HEADERS = {
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'RIESCADE-ThemeStore'
}

const COMMUNITY_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export class ThemeStoreService {
  private communityCache: { data: CommunityThemeItem[]; timestamp: number } | null = null
  /**
   * Read the bundled themes.json catalog from inside the ASAR,
   * then resolve each repo's default branch from GitHub API.
   */
  public getOfficialThemes(): ThemeCatalogItem[] {
    try {
      const themesJsonPath = join(app.getAppPath(), 'src', 'themes.json')
      if (!existsSync(themesJsonPath)) {
        console.warn('[ThemeStore] themes.json not found at:', themesJsonPath)
        return []
      }
      const raw = readFileSync(themesJsonPath, 'utf-8')
      const catalog = JSON.parse(raw) as ThemeCatalogItem[]
      // Default to 'main' (GitHub default branch for all new repos).
      // Avoids per-repo API calls that consume the unauthenticated rate limit.
      return catalog.map(item => ({ ...item, _branch: 'main' }))
    } catch (e) {
      console.error('[ThemeStore] Failed to read themes.json:', e)
      return []
    }
  }

  /**
   * Search GitHub for repositories with topic "riescade-theme",
   * then fetch each repo's theme.json manifest.
   */
  public async getCommunityThemes(): Promise<CommunityThemeItem[]> {
    // Return cached result if still fresh (avoids redundant API calls on tab revisit)
    if (this.communityCache && (Date.now() - this.communityCache.timestamp) < COMMUNITY_CACHE_TTL) {
      console.log('[ThemeStore] Returning cached community themes')
      return this.communityCache.data
    }

    try {
      const searchUrl = 'https://api.github.com/search/repositories?q=riescade-theme%20in:name'
      const searchResponse = await fetch(searchUrl)

      if (!searchResponse.ok) {
        const statusMsg = searchResponse.status === 403 || searchResponse.status === 429
          ? 'GitHub API rate limit reached. Try again later.'
          : `GitHub search failed: ${searchResponse.status}`
        console.warn('[ThemeStore] Search failed:', searchResponse.status)
        throw new Error(statusMsg)
      }

      const searchData = await searchResponse.json()
      const items = searchData.items || []
      if (items.length === 0) {
        return []
      }

      const results = await this.processGitHubRepos(items)

      // Cache successful result
      this.communityCache = { data: results, timestamp: Date.now() }

      return results
    } catch (e: any) {
      console.error('[ThemeStore] getCommunityThemes error:', e)
      throw e
    }
  }

  private async processGitHubRepos(repos: any[]): Promise<CommunityThemeItem[]> {
    // Fetch all theme.json files in parallel (not sequential)
    const settled = await Promise.allSettled(
      repos.map(async (repo): Promise<CommunityThemeItem | null> => {
        const owner = repo.owner?.login
        const repoName = repo.name
        const defaultBranch = repo.default_branch || 'main'
        if (!owner || !repoName) return null

        // Fetch theme.json from the repo
        const themeJsonUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${defaultBranch}/theme.json`
        const themeResponse = await fetch(themeJsonUrl, {
          headers: { 'User-Agent': 'RIESCADE-ThemeStore' }
        })

        if (!themeResponse.ok) {
          // Try 'master' branch as fallback
          const masterUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/master/theme.json`
          const masterResponse = await fetch(masterUrl, {
            headers: { 'User-Agent': 'RIESCADE-ThemeStore' }
          })
          if (!masterResponse.ok) return null
          const masterManifest = await masterResponse.json()
          return this.buildCommunityItem(repo, masterManifest, owner, repoName, 'master')
        }

        const manifest = await themeResponse.json()
        return this.buildCommunityItem(repo, manifest, owner, repoName, defaultBranch)
      })
    )

    return settled
      .filter((r): r is PromiseFulfilledResult<CommunityThemeItem | null> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter((item): item is CommunityThemeItem => item !== null)
  }

  private buildCommunityItem(
    repo: any,
    manifest: any,
    owner: string,
    repoName: string,
    branch: string
  ): CommunityThemeItem | null {
    if (!manifest || !manifest.name) return null

    // Use the manifest's preview field as-is (no extension fallback)
    const previewUrl = manifest.preview
      ? `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/${manifest.preview.replace(/^\.?\//, '')}`
      : ''

    return {
      id: repoName,
      name: manifest.name || repoName,
      github: repo.html_url || `https://github.com/${owner}/${repoName}`,
      version: manifest.version || '1.0.0',
      author: manifest.author || owner,
      preview: previewUrl,
      downloadUrl: `https://github.com/${owner}/${repoName}/archive/refs/heads/${branch}.zip`,
      stars: repo.stargazers_count || 0,
      updatedAt: repo.updated_at || ''
    }
  }

  /**
   * Download a theme ZIP from GitHub, extract it, and install to the user themes directory.
   * GitHub ZIPs have a wrapper folder: repoName-branchName/
   * We strip that and place contents in themes/{themeId}/
   */
  public async installTheme(
    zipUrl: string,
    themeId: string,
    progressCallback?: (percent: number, status: string) => void
  ): Promise<boolean> {
    const themesDir = getUserThemesPath()
    const tempDir = join(app.getPath('temp'), `riescade-theme-${themeId}`)
    const zipPath = join(app.getPath('temp'), `riescade-theme-${themeId}.zip`)

    try {
      // Ensure themes directory exists
      if (!existsSync(themesDir)) {
        mkdirSync(themesDir, { recursive: true })
      }

      progressCallback?.(0, 'Downloading...')

      // Download ZIP
      const response = await fetch(zipUrl, {
        headers: { 'User-Agent': 'RIESCADE-ThemeStore' }
      })

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`)
      }

      const totalBytesStr = response.headers.get('content-length')
      const totalBytes = totalBytesStr ? parseInt(totalBytesStr, 10) : 0
      let downloadedBytes = 0

      const fileStream = createWriteStream(zipPath)

      for await (const chunk of response.body as any) {
        fileStream.write(chunk)
        downloadedBytes += chunk.length
        const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 50) : 0
        progressCallback?.(percent, 'Downloading...')
      }
      fileStream.end()

      await new Promise<void>((resolve, reject) => {
        fileStream.on('finish', resolve)
        fileStream.on('error', reject)
      })

      progressCallback?.(50, 'Extracting...')

      // Clean temp dir if exists
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true })
      }
      mkdirSync(tempDir, { recursive: true })

      // Extract using .NET System.IO.Compression (works in all PowerShell versions)
      const zipPathEsc = zipPath.replace(/'/g, "''")
      const tempDirEsc = tempDir.replace(/'/g, "''")
      const psScript = [
        'Add-Type -AssemblyName System.IO.Compression.FileSystem',
        `[System.IO.Compression.ZipFile]::ExtractToDirectory('${zipPathEsc}', '${tempDirEsc}')`
      ].join('; ')

      await new Promise<void>((resolve, reject) => {
        exec(`powershell.exe -NoProfile -Command "${psScript}"`, (error) => {
          if (error) reject(error)
          else resolve()
        })
      })

      progressCallback?.(80, 'Installing...')

      // GitHub ZIPs extract to a wrapper folder: repoName-branchName/
      const extractedItems = readdirSync(tempDir, { withFileTypes: true })
      const wrapperFolder = extractedItems.find((d: any) => d.isDirectory())

      if (!wrapperFolder) {
        throw new Error('No folder found in extracted ZIP')
      }

      const wrapperPath = join(tempDir, wrapperFolder.name)
      const targetPath = join(themesDir, themeId)

      // Remove existing theme if present
      if (existsSync(targetPath)) {
        rmSync(targetPath, { recursive: true, force: true })
      }

      // Move the wrapper folder contents to themes/{themeId}/
      renameSync(wrapperPath, targetPath)

      progressCallback?.(100, 'Installed!')

      // Cleanup temp files
      try {
        if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true })
        if (existsSync(zipPath)) rmSync(zipPath, { force: true })
      } catch (cleanupErr) {
        console.warn('[ThemeStore] Cleanup warning:', cleanupErr)
      }

      return true
    } catch (e) {
      console.error('[ThemeStore] installTheme error:', e)

      // Cleanup on failure
      try {
        if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true })
        if (existsSync(zipPath)) rmSync(zipPath, { force: true })
      } catch (_) { /* ignore cleanup errors */ }

      throw e
    }
  }
}
