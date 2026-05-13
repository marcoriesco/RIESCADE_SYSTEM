const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Caminho padrão do Electron no Windows
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'modern-frontend', 'library.db');

try {
    const db = new Database(dbPath, { readonly: true });
    console.log('--- DIAGNÓSTICO DO BANCO DE DADOS ---');
    console.log('Arquivo:', dbPath);
    
    const game = db.prepare('SELECT * FROM games LIMIT 1').get();
    
    if (game) {
        console.log('\nDados do Jogo Encontrado:');
        console.log(JSON.stringify(game, null, 2));
    } else {
        console.log('\nNenhum jogo encontrado no banco. Verifique se o scan rodou.');
    }
    
    db.close();
} catch (err) {
    console.error('Erro ao abrir o banco:', err.message);
}
