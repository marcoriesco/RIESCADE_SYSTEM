const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const rootDir = path.join(__dirname, '..', '..')
const distSource = path.join(__dirname, '..', 'dist', 'win-unpacked')
const distDest = path.join(__dirname, '..', '..') // c:\tmp\RIESCADE_SYSTEM\emulationstation\.riescade
const rootExe = path.join(__dirname, '..', '..', '..', 'RIESCADE.exe') // c:\tmp\RIESCADE_SYSTEM\RIESCADE.exe
const targetExe = path.join(distDest, 'RIESCADE.exe')

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src)
  const stats = exists && fs.statSync(src)
  const isDirectory = exists && stats.isDirectory()
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest)
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName))
    })
  } else {
    fs.copyFileSync(src, dest)
  }
}

console.log('🚀 Starting deployment...')

// 1. Copy unpacked build to .riescade root
if (fs.existsSync(distSource)) {
  console.log(`📦 Copying build from ${distSource} to ${distDest}...`)
  copyRecursiveSync(distSource, distDest)
} else {
  console.log('⚠️ Build source not found. Make sure you ran "npm run build" first.')
  process.exit(1)
}

// 2. Create hard link/copy for RIESCADE.exe in the root
console.log(`🔗 Creating shortcut/launcher at ${rootExe}...`)
try {
  if (fs.existsSync(rootExe)) fs.unlinkSync(rootExe)
  // On Windows, a hard link is better than a copy for "pointing"
  execSync(`mklink /H "${rootExe}" "${targetExe}"`)
  console.log('✅ Hard link created successfully!')
} catch (e) {
  console.log('⚠️ Failed to create hard link (might need admin rights). Copying instead...')
  fs.copyFileSync(targetExe, rootExe)
  console.log('✅ File copied successfully!')
}

// 3. Run theme copy
require('./copy-default-theme.js')

console.log('🎉 Deployment complete!')
