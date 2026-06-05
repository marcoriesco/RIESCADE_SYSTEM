import os
import json
import re

src_dir = os.path.join(os.path.dirname(__file__), 'src', 'renderer', 'src')
locales_dir = os.path.join(src_dir, 'locales')

PORTUGUESE_WORDS = {
    'para', 'ou', 'pressione', 'cancelar', 'fechar', 'jogo', 'jogos', 'atualizar', 
    'gamelist', 'gamelists', 'sistema', 'sistemas', 'opção', 'opções', 'configuração', 
    'configurações', 'carregando', 'todos', 'todas', 'sobreposição', 'moldura', 
    'selecionar', 'nenhum', 'tecla', 'botão', 'controles'
}

files = [f for f in os.listdir(locales_dir) if f.endswith('.json') and not f.startswith('pt_') and f not in ('en_US.json', 'en_GB.json')]

for file in files:
    filepath = os.path.join(locales_dir, file)
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        continue
        
    matches = []
    for k, v in data.items():
        if k == v:
            continue
        # Split value into words
        words = set(re.findall(r'[a-zA-Z0-9áéíóúâêôãõçÀ-ÿ]+', v.lower()))
        matched_words = words.intersection(PORTUGUESE_WORDS)
        # Exclude Spanish/Italian/Galician files from matching words like "para", "todos", "sistema", "sistemas" to avoid false positives
        if file.startswith('es') or file.startswith('it') or file.startswith('gl'):
            matched_words = matched_words - {'para', 'todos', 'sistema', 'sistemas', 'cancelar'}
            
        if len(matched_words) >= 2 or (len(matched_words) >= 1 and any(w in ('pressione', 'fechar', 'sobreposição', 'moldura', 'gamelist', 'gamelists') for w in matched_words)):
            matches.append((k, v, list(matched_words)))
            
    if matches:
        print(f"\n{file}: Found {len(matches)} leaks:")
        for k, v, words in matches[:5]:
            print(f"  - Key: {k}")
            print(f"    Val: {v}")
            print(f"    Words: {words}")
