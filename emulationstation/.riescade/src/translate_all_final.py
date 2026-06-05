import os
import re
import json
import urllib.request
import urllib.parse
import time

# Base directories
src_dir = os.path.join(os.path.dirname(__file__), 'src', 'renderer', 'src')
locales_dir = os.path.join(src_dir, 'locales')

# Skip translation for these terms as they are technical terms, proper nouns, abbreviations, or numbers
SKIP_WORDS = {
    "atlus", "atomiswave", "banpresto", "capcom", "cave", "cps1", "cps2", "cps3", "cpu", "crt",
    "daphne", "data east", "exidy", "gaelco", "igdb", "igs", "irem", "jaleco", "kaneko", "konami",
    "midway", "mitchell", "namco", "naomi", "neogeo", "nichibutsu", "nintendo", "nmk", "sammy",
    "sega", "sega st-v", "seibu kaihatsu", "semicom", "seta", "snk", "taito", "toaplan", "visco",
    "vulkan", "xinput", "sdl", "vram", "g-sync", "freesync", "hdr", "wifi", "bios", "ram", "dsp",
    "ini", "ssid", "ags", "winuae", "exodos", "exowin3x", "exowin9x", "citron", "eden", "retrobat",
    "dokan", "sinden", "dolphinbar", "wii", "wiimote", "retroarch", "steam", "epic", "opengl", "n64",
    "l2", "r2", "7z", "squashfs", "m3u", "ccd", "cue", "gdi", "crc", "ip", "fps", "yes", "no", "ok", "t",
    "st", "v", "p", "a", "b", "c", "d"
}

def should_skip(key):
    if re.match(r'^[\d\W_]+$', key):
        return True
    if len(key.strip()) <= 1:
        return True
    words = re.findall(r'[a-zA-Z0-9]+', key.lower())
    if all(w in SKIP_WORDS or w.isdigit() for w in words):
        return True
    return False

def get_lang_code(filename):
    name = filename.split('.')[0]
    if name == 'zh_CN':
        return 'zh-CN'
    if name == 'zh_TW':
        return 'zh-TW'
    if '_' in name:
        return name.split('_')[0]
    return name

def get_source_lang(key):
    words = set(re.findall(r'[a-zA-Z0-9áéíóúâêôãõçÀ-ÿ]+', key.lower()))
    pt_indicators = {
        'pressione', 'fechar', 'sobreposição', 'moldura', 'atualizar', 
        'finalizado', 'sucesso', 'voltar', 'senha', 'falhas', 'selecionar', 
        'tudo', 'nenhum', 'preparando', 'carregando', 'jogadores', 'baixar', 'ausente'
    }
    if words.intersection(pt_indicators) or ('ou' in words and 'para' in words) or ('com' in words and 'sucesso' in words):
        return 'pt'
    return 'en'

def translate_individual(text, source_lang, target_lang):
    try:
        url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={source_lang}&tl={target_lang}&dt=t&q=" + urllib.parse.quote(text)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            res = json.loads(response.read().decode('utf-8'))
            return "".join([part[0] for part in res[0] if part[0]]).strip()
    except Exception as e:
        print(f"Error translating individual '{text}' (sl={source_lang}) to {target_lang}: {e}")
        return text

def translate_batch(texts, source_lang, target_lang):
    if not texts:
        return []
    combined_text = "\n".join(texts)
    try:
        url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={source_lang}&tl={target_lang}&dt=t&q=" + urllib.parse.quote(combined_text)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as response:
            res = json.loads(response.read().decode('utf-8'))
            translated_combined = "".join([part[0] for part in res[0] if part[0]])
            translated_lines = [line.strip() for line in translated_combined.split("\n")]
            if len(translated_lines) == len(texts):
                return translated_lines
            else:
                print(f"Warning: Line mismatch for sl={source_lang} -> tl={target_lang}: expected {len(texts)}, got {len(translated_lines)}. Using individual fallback.")
        return [translate_individual(t, source_lang, target_lang) for t in texts]
    except Exception as e:
        print(f"Error batch translating (sl={source_lang} -> tl={target_lang}): {e}. Using individual fallback.")
        return [translate_individual(t, source_lang, target_lang) for t in texts]

def extract_source_keys(src_path):
    keys = set()
    t_pattern = re.compile(r'\bt\(\s*(["\'`])((?:[^\\]|\\.)*?)\1\s*\)')
    
    for root, dirs, files in os.walk(src_path):
        if 'locales' in root:
            continue
        for file in files:
            if file.endswith('.ts') or file.endswith('.tsx'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        for match in t_pattern.finditer(content):
                            key = match.group(2)
                            if '${' in key:
                                continue
                            key = key.replace("\\'", "'").replace('\\"', '"')
                            keys.add(key)
                except Exception as e:
                    print(f"Error reading {filepath}: {e}")
    return keys

def main():
    print("Loading Portuguese reference locales...")
    pt_br_path = os.path.join(locales_dir, 'pt_BR.json')
    with open(pt_br_path, 'r', encoding='utf-8') as f:
        pt_br = json.load(f)
    pt_pt_path = os.path.join(locales_dir, 'pt_PT.json')
    with open(pt_pt_path, 'r', encoding='utf-8') as f:
        pt_pt = json.load(f)

    print("Extracting all translation keys from source files...")
    source_keys = extract_source_keys(src_dir)
    source_keys.add("REMOVE FROM")
    source_keys.add("CLEAR CACHE AND DATABASE")
    source_keys.add("This will clear all media cache and game database.")
    print(f"Extracted {len(source_keys)} keys from source.")

    files = [f for f in os.listdir(locales_dir) if f.endswith('.json')]
    print(f"Found {len(files)} locale files.")

    PORTUGUESE_WORDS = {'pressione', 'fechar', 'sobreposição', 'moldura'}

    for file in files:
        filepath = os.path.join(locales_dir, file)
        lang = get_lang_code(file)
        
        print(f"\nProcessing {file} (language: {lang})...")
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            print(f"Error reading {file}: {e}")
            continue

        # Rename CLEAR CACHES key to CLEAR CACHE AND DATABASE
        if "CLEAR CACHES" in data:
            old_val = data.pop("CLEAR CACHES")
            if old_val == "CLEAR CACHES":
                data["CLEAR CACHE AND DATABASE"] = "CLEAR CACHE AND DATABASE"
            else:
                data["CLEAR CACHE AND DATABASE"] = old_val

        # Ensure all source keys exist in the dictionary
        for key in source_keys:
            if key not in data:
                data[key] = key

        # If English locale, skip translating
        if lang == 'en':
            print("English locale - skipping translation, ensuring values match keys.")
            for key in data:
                data[key] = key
            sorted_data = dict(sorted(data.items(), key=lambda x: x[0]))
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(sorted_data, f, ensure_ascii=False, indent=2)
            continue

        # Identify keys to translate:
        keys_to_translate = []
        for key, val in data.items():
            if should_skip(key):
                continue
                
            is_untranslated = (key == val)
            
            # Check for Portuguese leak (only if this is not a Portuguese file)
            is_leaked_pt = False
            if lang != 'pt':
                # Force translate if the key itself is determined to be in Portuguese
                if get_source_lang(key) == 'pt':
                    is_leaked_pt = True
                elif key in pt_br and pt_br[key] != key and val == pt_br[key]:
                    is_leaked_pt = True
                elif key in pt_pt and pt_pt[key] != key and val == pt_pt[key]:
                    is_leaked_pt = True
                else:
                    # Heuristics checking for Portuguese words in value or key
                    val_words = set(re.findall(r'[a-zA-Z0-9áéíóúâêôãõçÀ-ÿ]+', val.lower()))
                    key_words = set(re.findall(r'[a-zA-Z0-9áéíóúâêôãõçÀ-ÿ]+', key.lower()))
                    all_words = val_words.union(key_words)
                    
                    pt_words_to_match = set(PORTUGUESE_WORDS)
                    if lang not in ('es', 'gl', 'it'):
                        pt_words_to_match.add('ou')
                        pt_words_to_match.add('para')
                        pt_words_to_match.add('todos')
                        
                    if all_words.intersection(pt_words_to_match):
                        is_leaked_pt = True
                    
            if is_untranslated or is_leaked_pt:
                keys_to_translate.append(key)

        print(f"{len(keys_to_translate)} keys need translation/re-translation.")

        if keys_to_translate:
            # Group keys by source language
            en_keys = [k for k in keys_to_translate if get_source_lang(k) == 'en']
            pt_keys = [k for k in keys_to_translate if get_source_lang(k) == 'pt']
            
            # Translate English sourced keys
            if en_keys:
                print(f"Translating {len(en_keys)} English sourced keys...")
                chunk_size = 40
                for i in range(0, len(en_keys), chunk_size):
                    chunk = en_keys[i:i+chunk_size]
                    translated_chunk = translate_batch(chunk, 'en', lang)
                    for original, translated in zip(chunk, translated_chunk):
                        clean_translated = translated.strip()
                        if clean_translated:
                            data[original] = clean_translated
                    time.sleep(0.5)
            
            # Translate Portuguese sourced keys
            if pt_keys:
                print(f"Translating {len(pt_keys)} Portuguese sourced keys...")
                chunk_size = 40
                for i in range(0, len(pt_keys), chunk_size):
                    chunk = pt_keys[i:i+chunk_size]
                    translated_chunk = translate_batch(chunk, 'pt', lang)
                    for original, translated in zip(chunk, translated_chunk):
                        clean_translated = translated.strip()
                        if clean_translated:
                            data[original] = clean_translated
                    time.sleep(0.5)

        # Sort alphabetically
        sorted_data = dict(sorted(data.items(), key=lambda x: x[0]))

        # Save file
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(sorted_data, f, ensure_ascii=False, indent=2)
            print(f"Saved {file} successfully.")
        except Exception as e:
            print(f"Error writing to {file}: {e}")

    print("\nAll translation files have been processed, corrected, and updated!")

if __name__ == '__main__':
    main()
