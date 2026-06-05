import os
import json
import re

src_dir = os.path.join(os.path.dirname(__file__), 'src', 'renderer', 'src')
locales_dir = os.path.join(src_dir, 'locales')

PORTUGUESE_WORDS = {
    'pressione', 'fechar', 'sobreposição', 'moldura', 'ou'
}

with open(os.path.join(locales_dir, 'pt_BR.json'), 'r', encoding='utf-8') as f:
    pt_br = json.load(f)
with open(os.path.join(locales_dir, 'pt_PT.json'), 'r', encoding='utf-8') as f:
    pt_pt = json.load(f)

files = [f for f in os.listdir(locales_dir) if f.endswith('.json') and not f.startswith('pt_') and f not in ('en_US.json', 'en_GB.json')]

total_leaks = 0
for file in files:
    filepath = os.path.join(locales_dir, file)
    lang = file.split('.')[0].split('_')[0]
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        continue
        
    leaked_keys = []
    for k, v in data.items():
        if k == v:
            # If the key itself contains Portuguese words, it is still a leak
            val_words = set(re.findall(r'[a-zA-Z0-9áéíóúâêôãõçÀ-ÿ]+', k.lower()))
            pt_words_to_match = set(PORTUGUESE_WORDS)
            if lang not in ('es', 'gl', 'it'):
                pt_words_to_match.add('ou')
                pt_words_to_match.add('para')
                pt_words_to_match.add('todos')
            if val_words.intersection(pt_words_to_match):
                leaked_keys.append(k)
            continue
            
        # Check if matches pt_BR or pt_PT translation
        is_pt_match = False
        if k in pt_br and pt_br[k] != k and v == pt_br[k]:
            is_pt_match = True
        elif k in pt_pt and pt_pt[k] != k and v == pt_pt[k]:
            is_pt_match = True
            
        # Check if contains Portuguese words (only if target language is not Spanish/Galician/Italian)
        has_pt_words = False
        if lang not in ('es', 'gl', 'it'):
            words = set(re.findall(r'[a-zA-Z0-9áéíóúâêôãõçÀ-ÿ]+', v.lower()))
            if words.intersection(PORTUGUESE_WORDS):
                has_pt_words = True
                
        if is_pt_match or has_pt_words:
            leaked_keys.append(k)
            
    if leaked_keys:
        total_leaks += len(leaked_keys)
        print(f"{file}: Found {len(leaked_keys)} leaked keys (e.g. {leaked_keys[:5]})")

print(f"\nTotal leaked keys across all non-Portuguese files: {total_leaks}")
