const fs = require('fs');
const path = require('path');

const mockElectron = {
  app: {
    isPackaged: false,
    getAppPath: () => '.',
    getPath: () => '.',
    whenReady: () => ({ then: () => {} }),
    on: () => {}
  },
  ipcMain: {
    handle: () => {},
    on: () => {}
  },
  BrowserWindow: {
    getAllWindows: () => []
  }
};
require.cache[require.resolve('electron')] = {
  id: 'electron',
  filename: 'mock-electron',
  loaded: true,
  exports: mockElectron
};

const { LibraryService } = require('./main/services/LibraryService.js');
const libraryService = new LibraryService();

function testFullQuickCounts() {
  const start = Date.now();
  
  const displayed = libraryService.getDisplayedSystems();
  console.log(`Scanning ${displayed.length} systems...`);

  // Let's assume these are the auto-collections we want to count
  const autoCols = [
    'all', 'favorites', 'recent', 'neverplayed', 'retroachievements',
    '2players', '4players', 'vertical', 'lightgun', 'wheel', 'trackball', 'spinner',
    '_various', '_action', 'zcapcom' // test some custom genre/publisher ones
  ];

  const counts = {};
  autoCols.forEach(c => counts[c] = 0);

  const romsPath = 'C:/tmp/RIESCADE_SYSTEM/roms';
  const configPath = 'C:/tmp/RIESCADE_SYSTEM/emulationstation/.emulationstation';

  for (const sys of displayed) {
    const paths = [
      path.join(romsPath, sys.name, 'gamelist.xml'),
      path.join(configPath, 'gamelists', sys.name, 'gamelist.xml'),
      sys.path ? path.join(sys.path, 'gamelist.xml') : ''
    ].filter(Boolean);
    
    let content = '';
    for (const p of paths) {
      if (fs.existsSync(p)) {
        try {
          content = fs.readFileSync(p, 'utf8');
        } catch (e) {}
        break;
      }
    }
    
    if (!content) continue;

    // Split by </game>
    const blocks = content.split('</game>');
    // The last block is usually after the last </game> (e.g. </gameList>), so we discard it
    const gameCount = blocks.length - 1;
    if (gameCount <= 0) continue;

    counts['all'] += gameCount;

    for (let i = 0; i < gameCount; i++) {
      const block = blocks[i].toLowerCase();

      // favorites
      if (block.includes('<favorite>true</favorite>') || block.includes('<favorite>1</favorite>')) {
        counts['favorites']++;
      }

      // recent
      const hasLastPlayed = block.includes('<lastplayed>');
      if (hasLastPlayed) {
        counts['recent']++;
      } else {
        counts['neverplayed']++;
      }

      // retroachievements
      if (block.includes('<cheevosid>') || block.includes('<cheevoshash>')) {
        counts['retroachievements']++;
      }

      // 2players
      const playersMatch = block.match(/<players>\s*([^\s<]+)\s*<\/players>/);
      if (playersMatch) {
        const p = playersMatch[1];
        if (p === '2' || p.includes('2') || (p.includes('-') && p.split('-')[0] <= '2' && p.split('-')[1] >= '2')) {
          counts['2players']++;
        }
        if (p === '4' || p.includes('4') || (p.includes('-') && p.split('-')[0] <= '4' && p.split('-')[1] >= '4')) {
          counts['4players']++;
        }
      }

      // custom collections (vertical, lightgun, wheel, trackball, spinner, _various, _action, zcapcom)
      const customCols = ['vertical', 'lightgun', 'wheel', 'trackball', 'spinner', '_various', '_action', 'zcapcom'];
      customCols.forEach(col => {
        const searchKey = (col.startsWith('_') || col.startsWith('z')) ? col.substring(1) : col;
        
        // Match inside name, desc, genre, developer, publisher tags
        // To be safe and fast, we can extract text content or just search the block.
        // Searching the block is fast, but we should make sure we don't match paths.
        // Let's extract <name>, <desc>, <genre>, <developer>, <publisher>
        const getTagContent = (tag) => {
          const m = block.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
          return m ? m[1] : '';
        };

        const nameVal = getTagContent('name');
        const descVal = getTagContent('desc');
        const genreVal = getTagContent('genre');
        const devVal = getTagContent('developer');
        const pubVal = getTagContent('publisher');

        if (nameVal.includes(searchKey) || descVal.includes(searchKey) || genreVal.includes(searchKey) || devVal.includes(searchKey) || pubVal.includes(searchKey)) {
          counts[col]++;
        }
      });
    }
  }

  const end = Date.now();
  console.log(`Benchmark completed in ${end - start}ms`);
  autoCols.forEach(c => {
    console.log(`  Count for ${c}: ${counts[c]}`);
  });
}

testFullQuickCounts();
