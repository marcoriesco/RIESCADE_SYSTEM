import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname, basename, extname } from 'path'

export class SassService {
  private loadSass(): any | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('sass')
    } catch {
      return null
    }
  }

  /**
   * Compiles a single SCSS file to CSS.
   * Target directory is one level up from the 'scss' folder by default.
   */
  public compileFile(scssFilePath: string): string | null {
    if (!scssFilePath.endsWith('.scss') || basename(scssFilePath).startsWith('_')) {
      return null
    }

    try {
      const sass = this.loadSass()
      if (!sass) return null

      console.log(`Compiling SCSS: ${scssFilePath}`)
      const result = sass.compile(scssFilePath)
      
      const scssDir = dirname(scssFilePath)
      const cssDir = join(scssDir, '..')
      
      if (!existsSync(cssDir)) {
        mkdirSync(cssDir, { recursive: true })
      }

      const fileName = basename(scssFilePath, extname(scssFilePath)) + '.css'
      const cssFilePath = join(cssDir, fileName)

      writeFileSync(cssFilePath, result.css)
      console.log(`Successfully compiled to: ${cssFilePath}`)
      
      return cssFilePath
    } catch (error) {
      console.error(`Sass compilation error in ${scssFilePath}:`, error)
      return null
    }
  }

  public compileTheme(themePath: string): string[] {
    const scssRoot = join(themePath, 'assets', 'css', 'scss')
    if (!existsSync(scssRoot)) return []

    const compiled: string[] = []

    const walk = (dirPath: string) => {
      const entries = readdirSync(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name)
        if (entry.isDirectory()) {
          walk(fullPath)
          continue
        }
        if (!entry.isFile()) continue
        if (!fullPath.endsWith('.scss')) continue
        if (basename(fullPath).startsWith('_')) continue

        const out = this.compileFile(fullPath)
        if (out) compiled.push(out)
      }
    }

    walk(scssRoot)
    return compiled
  }
}
