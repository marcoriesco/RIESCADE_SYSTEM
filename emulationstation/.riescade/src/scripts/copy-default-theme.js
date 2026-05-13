/**
 * Post-build script: copies the default theme from the compiled app resources
 * to themes/default/ so users can reference it (but the app uses the bundled one).
 */
const fs = require('fs')
const path = require('path')

const srcDir = path.join(__dirname, '..', 'src', 'main', 'theme_default')
const destDir = path.join(__dirname, '..', '..', 'themes', 'default')

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Source not found: ${src}`)
    return
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

console.log('📦 Copying default theme to themes/default/ ...')
console.log(`   From: ${srcDir}`)
console.log(`   To:   ${destDir}`)

copyRecursive(srcDir, destDir)

console.log('✅ Default theme copied successfully!')
