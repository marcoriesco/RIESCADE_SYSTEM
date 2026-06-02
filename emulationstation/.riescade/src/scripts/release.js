const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

// Load env files (.env or src/.env)
function loadEnv() {
  const possiblePaths = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '..', '..', '.env')
  ];
  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      const dotenvContent = fs.readFileSync(envPath, 'utf8');
      dotenvContent.split(/\r?\n/).forEach(line => {
        const trimLine = line.trim();
        if (trimLine && !trimLine.startsWith('#')) {
          const index = trimLine.indexOf('=');
          if (index !== -1) {
            const key = trimLine.substring(0, index).trim();
            let val = trimLine.substring(index + 1).trim();
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.substring(1, val.length - 1);
            } else if (val.startsWith("'") && val.endsWith("'")) {
              val = val.substring(1, val.length - 1);
            }
            process.env[key] = val;
          }
        }
      });
    }
  }
}

async function run() {
  loadEnv();
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  
  if (!token) {
    console.error('\x1b[31mError: GITHUB_TOKEN or GH_TOKEN not found in environment or .env file!\x1b[0m');
    console.error('Please create a Personal Access Token (PAT) with "repo" scope on GitHub:');
    console.error('https://github.com/settings/tokens');
    console.error('Then add it to a .env file in the root or src folder as:');
    console.error('GITHUB_TOKEN=your_token_here\n');
    process.exit(1);
  }

  let version = process.argv[2];
  if (!version) {
    const defaultVersionInput = await askQuestion('Enter release version (e.g. 2.1.0): ');
    version = defaultVersionInput.trim();
  }

  // Clean the version tag prefix v if provided
  version = version.replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error('\x1b[31mError: Version must match semver format (X.Y.Z)!\x1b[0m');
    process.exit(1);
  }

  console.log(`\n🚀 Starting RIESCADE release pipeline for version v${version}...`);

  const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  
  // 1. Update version in package.json
  console.log('📝 Updating version in package.json...');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`✅ package.json version bumped to ${version}`);

  // 2. Build & Deploy the project (compile + electron-builder + deploy binaries)
  console.log('🛠️ Building and deploying Electron project...');
  execSync('npm run deploy', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('✅ Electron app built and deployed successfully.');

  // 3. Zip the project (production-only, no source code)
  console.log('📦 Packing project into RIESCADE_SYSTEM.zip...');
  const psCommand = `
    $temp = Join-Path $env:TEMP 'riescade_zip_temp'
    if (Test-Path $temp) { Remove-Item -Path $temp -Recurse -Force }
    New-Item -ItemType Directory -Path $temp | Out-Null
    $exclude = @('bios', 'emulators', 'roms', 'saves', 'screenshots', '.git', '.gitignore', '.env', '.env.local', 'RIESCADE_SYSTEM.zip', 'zip_project.bat', 'node_modules')
    Get-ChildItem -Path . -Force | Where-Object { $_.Name -notin $exclude } | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $temp -Recurse -Force
    }
    # Remove development source code from the packaged output
    $srcDir = Join-Path (Join-Path (Join-Path $temp 'emulationstation') '.riescade') 'src'
    if (Test-Path $srcDir) { Remove-Item -Path $srcDir -Recurse -Force }
    # Create empty placeholder folders with .keep files
    $emptyFolders = @('bios', 'emulators', 'roms', 'saves', 'screenshots')
    foreach ($folder in $emptyFolders) {
        $folderPath = Join-Path $temp $folder
        New-Item -ItemType Directory -Path $folderPath -Force | Out-Null
        New-Item -ItemType File -Path (Join-Path $folderPath '.keep') -Force | Out-Null
    }
    Compress-Archive -Path (Join-Path $temp '*') -DestinationPath 'RIESCADE_SYSTEM.zip' -Force
    Remove-Item -Path $temp -Recurse -Force
  `;
  const base64Command = Buffer.from(psCommand, 'utf16le').toString('base64');
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${base64Command}`, { stdio: 'inherit', cwd: projectRoot });
  console.log('✅ ZIP package created at project root.');

  // 4. Git Commit, Tag & Push
  console.log('🐙 Staging and committing version changes...');
  execSync('git add -A', { stdio: 'inherit', cwd: projectRoot });
  try {
    execSync(`git commit -m "chore(release): v${version}"`, { stdio: 'inherit', cwd: projectRoot });
  } catch (e) {
    console.log('⚠️ No changes to commit (version may already be up to date).');
  }
  
  console.log(`🏷️ Tagging Git commit with v${version}...`);
  try {
    execSync(`git tag -d v${version}`, { stdio: 'ignore', cwd: projectRoot });
  } catch (e) {}
  execSync(`git tag v${version}`, { stdio: 'inherit', cwd: projectRoot });

  console.log('📤 Pushing commits and tag to GitHub repository...');
  execSync('git push origin main', { stdio: 'inherit', cwd: projectRoot });
  execSync(`git push origin v${version} --force`, { stdio: 'inherit', cwd: projectRoot });
  console.log('✅ Git branch and tag pushed.');

  // 5. Create GitHub Release
  const repoOwner = 'marcoriesco';
  const repoName = 'RIESCADE_SYSTEM';
  const createReleaseUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/releases`;

  console.log(`🌐 Creating GitHub Release for v${version}...`);
  const releaseBody = {
    tag_name: `v${version}`,
    target_commitish: 'main',
    name: `RIESCADE v${version}`,
    body: `Automated release for RIESCADE v${version}`,
    draft: false,
    prerelease: false,
    generate_release_notes: true
  };

  const createResponse = await fetch(createReleaseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'RIESCADE-Release-Script',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify(releaseBody)
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Failed to create release: ${createResponse.status} ${createResponse.statusText}\n${errorText}`);
  }

  const releaseData = await createResponse.json();
  const uploadUrlTemplate = releaseData.upload_url;
  const releaseId = releaseData.id;
  console.log(`✅ GitHub Release created (ID: ${releaseId})`);

  // 6. Upload RIESCADE_SYSTEM.zip to GitHub Release
  const uploadUrl = uploadUrlTemplate.replace(/\{.*?\}/, '') + '?name=RIESCADE_SYSTEM.zip';
  console.log(`📤 Uploading RIESCADE_SYSTEM.zip to release assets...`);

  const zipFilePath = path.join(projectRoot, 'RIESCADE_SYSTEM.zip');
  const zipBuffer = fs.readFileSync(zipFilePath);

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/zip',
      'Content-Length': zipBuffer.length.toString(),
      'User-Agent': 'RIESCADE-Release-Script',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: zipBuffer
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to upload asset: ${uploadResponse.status} ${uploadResponse.statusText}\n${errorText}`);
  }

  console.log(`\n🎉 Release v${version} successfully completed and published to GitHub!`);
}

run().catch(err => {
  console.error('\n\x1b[31m❌ Release failed:\x1b[0m');
  console.error(err.message || err);
  process.exit(1);
});
