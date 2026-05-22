import os
import json
import re

def parse_po(po_path):
    translations = {}
    if not os.path.exists(po_path):
        return translations
    
    try:
        with open(po_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"Error reading PO file {po_path}: {e}")
        return translations
        
    current_msgid = None
    current_msgstr = None
    in_msgid = False
    in_msgstr = False
    
    for line in lines:
        line = line.strip()
        if line.startswith('#'):
            continue
        if line.startswith('msgid'):
            in_msgid = True
            in_msgstr = False
            content = line[5:].strip()
            if content.startswith('"') and content.endswith('"'):
                current_msgid = content[1:-1]
            else:
                current_msgid = ""
        elif line.startswith('msgstr'):
            in_msgid = False
            in_msgstr = True
            content = line[6:].strip()
            if content.startswith('"') and content.endswith('"'):
                current_msgstr = content[1:-1]
            else:
                current_msgstr = ""
        elif line.startswith('"') and line.endswith('"'):
            val = line[1:-1]
            if in_msgid:
                current_msgid += val
            elif in_msgstr:
                current_msgstr += val
        elif line == "":
            if current_msgid is not None and current_msgstr is not None:
                msgid = current_msgid.replace('\\n', '\n').replace('\\t', '\t').replace('\\"', '"')
                msgstr = current_msgstr.replace('\\n', '\n').replace('\\t', '\t').replace('\\"', '"')
                if msgid and msgstr:
                    translations[msgid] = msgstr
                current_msgid = None
                current_msgstr = None
            in_msgid = False
            in_msgstr = False
            
    if current_msgid is not None and current_msgstr is not None:
        msgid = current_msgid.replace('\\n', '\n').replace('\\t', '\t').replace('\\"', '"')
        msgstr = current_msgstr.replace('\\n', '\n').replace('\\t', '\t').replace('\\"', '"')
        if msgid and msgstr:
            translations[msgid] = msgstr
            
    return translations

def extract_keys_from_file(filepath):
    keys = set()
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return keys
    
    matches_single = re.findall(r"t\(\s*'((?:[^'\\]|\\.)*)'\s*\)", content)
    matches_double = re.findall(r't\(\s*"((?:[^"\\]|\\.)*)"\s*\)', content)
    matches_backtick = re.findall(r't\(\s*`((?:[^`\\]|\\.)*)`\s*\)', content)
    
    for m in matches_single + matches_double + matches_backtick:
        key = m.replace("\\'", "'").replace('\\"', '"').replace('\\`', '`')
        if key:
            keys.add(key)
            
    return keys

def main():
    # Paths relative to execution directory
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # emulationstation/.riescade/src
    src_dir = os.path.join(base_dir, 'src')
    locales_dir = os.path.join(src_dir, 'renderer', 'src', 'locales')
    
    system_locale_base = os.path.abspath(os.path.join(base_dir, '..', '..', 'resources', 'locale'))
    
    print(f"Base Directory: {base_dir}")
    print(f"Locales Directory: {locales_dir}")
    print(f"System Locale Base: {system_locale_base}")
    
    # 1. Extract all t(...) keys from ts and tsx files
    extracted_keys = set()
    for root, dirs, files in os.walk(src_dir):
        # Skip node_modules and out/dist folders
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if 'dist' in dirs:
            dirs.remove('dist')
        if 'out' in dirs:
            dirs.remove('out')
            
        for file in files:
            if file.endswith('.ts') or file.endswith('.tsx'):
                filepath = os.path.join(root, file)
                extracted_keys.update(extract_keys_from_file(filepath))
                
    print(f"Extracted {len(extracted_keys)} unique keys from typescript files.")
    
    # 2. Read en_US.json baseline
    en_us_path = os.path.join(locales_dir, 'en_US.json')
    master_keys = {}
    if os.path.exists(en_us_path):
        with open(en_us_path, 'r', encoding='utf-8') as f:
            master_keys = json.load(f)
    else:
        print("Warning: en_US.json not found, initializing empty.")
        
    # Add newly extracted keys to master list
    new_keys_added = 0
    for key in extracted_keys:
        if key not in master_keys:
            master_keys[key] = key
            new_keys_added += 1
            
    if new_keys_added > 0:
        print(f"Added {new_keys_added} new baseline keys to en_US.json.")
        with open(en_us_path, 'w', encoding='utf-8') as f:
            json.dump(master_keys, f, indent=2, ensure_ascii=False)
            
    # Get all available system locale PO directories
    system_folders = []
    if os.path.exists(system_locale_base):
        system_folders = [d for d in os.listdir(system_locale_base) if os.path.isdir(os.path.join(system_locale_base, d))]
    print(f"Found {len(system_folders)} system locale folders in emulationstation/resources/locale.")
    
    # 3. For each locale JSON file, parse PO and update translations
    all_json_files = [f for f in os.listdir(locales_dir) if f.endswith('.json')]
    
    for json_file in all_json_files:
        lang_code = json_file.replace('.json', '')
        if lang_code == 'en_US':
            continue
            
        json_path = os.path.join(locales_dir, json_file)
        
        # Match to appropriate system folder
        matched_folder = None
        if lang_code in system_folders:
            matched_folder = lang_code
        else:
            # Check split part, e.g. es_ES -> es
            lang_prefix = lang_code.split('_')[0]
            if lang_prefix in system_folders:
                matched_folder = lang_prefix
            else:
                # Case insensitive check
                for f in system_folders:
                    if f.lower() == lang_code.lower() or f.lower() == lang_prefix.lower():
                        matched_folder = f
                        break
                        
        if not matched_folder:
            print(f"No C++ PO locale folder found for {json_file}, skipping PO integration.")
            po_translations = {}
        else:
            po_path = os.path.join(system_locale_base, matched_folder, 'LC_MESSAGES', 'emulationstation2.po')
            po_translations = parse_po(po_path)
            print(f"Integrating PO for {json_file} from folder '{matched_folder}' ({len(po_translations)} PO entries found).")
            
        # Parse current translations
        target_keys = {}
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    target_keys = json.load(f)
            except Exception as e:
                print(f"Error loading {json_file}: {e}")
                
        # Build case-insensitive cache for PO
        po_cache_ci = {k.lower().strip(): v for k, v in po_translations.items()}
        
        translations_updated = 0
        for key, en_val in master_keys.items():
            existing = target_keys.get(key)
            
            # Decide if this entry needs translation
            needs_translation = (
                not existing or 
                existing == key or 
                existing == en_val or
                existing.strip() == ""
            )
            
            if needs_translation:
                translated = None
                # Lookup priority:
                # 1. Exact english value
                if en_val in po_translations:
                    translated = po_translations[en_val]
                # 2. Exact key
                elif key in po_translations:
                    translated = po_translations[key]
                # 3. Case-insensitive english value
                elif en_val.lower().strip() in po_cache_ci:
                    translated = po_cache_ci[en_val.lower().strip()]
                # 4. Case-insensitive key
                elif key.lower().strip() in po_cache_ci:
                    translated = po_cache_ci[key.lower().strip()]
                    
                if translated:
                    target_keys[key] = translated
                    translations_updated += 1
                else:
                    if not existing:
                        target_keys[key] = en_val
            else:
                # Keep manually overridden value
                pass
                
        # Save updated target file
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(target_keys, f, indent=2, ensure_ascii=False)
            
        print(f"Saved {json_file} - updated {translations_updated} translations.")

if __name__ == '__main__':
    main()
