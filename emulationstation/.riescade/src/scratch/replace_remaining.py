import os
import json
import re

REMAINING_PT_TO_EN = {
  "TODOS OS JOGOS": "ALL GAMES",
  "FAVORITOS": "FAVORITES",
  "NUNCA JOGADOS": "NEVER PLAYED",
  "SISTEMAS EXIBIDOS": "SYSTEMS DISPLAYED",
  "OUTROS": "OTHERS",
  "SISTEMAS AGRUPADOS": "GROUPED SYSTEMS",
  "INICIAR NO SISTEMA": "START ON SYSTEM",
  "INICIAR NA LISTA DE JOGOS": "START ON GAMELIST",
  "EXIBIR SISTEMAS VAZIOS": "SHOW EMPTY SYSTEMS",
  "SELECIONADOS": "SELECTED"
}

# Plain hardcoded options in SortSystems and StartupSystem
HARDCODED_REPLACEMENTS = [
  ("{ label: 'NÃO', value: '' }", "{ label: t('NO'), value: '' }"),
  ('{ label: "NÃO", value: "" }', "{ label: t('NO'), value: '' }"),
  
  ("{ label: 'POR ORDEM ALFABÉTICA', value: 'alpha' }", "{ label: t('BY ALPHABETICAL ORDER'), value: 'alpha' }"),
  ('{ label: "POR ORDEM ALFABÉTICA", value: "alpha" }', "{ label: t('BY ALPHABETICAL ORDER'), value: 'alpha' }"),
  
  ("{ label: 'POR FABRICANTE', value: 'manufacturer' }", "{ label: t('BY MANUFACTURER'), value: 'manufacturer' }"),
  ('{ label: "POR FABRICANTE", value: "manufacturer" }', "{ label: t('BY MANUFACTURER'), value: 'manufacturer' }"),
  
  ("{ label: 'POR TIPO DE HARDWARE ENTÃO ALFABETICAMENTE', value: 'hardware' }", "{ label: t('BY HARDWARE TYPE THEN ALPHABETICALLY'), value: 'hardware' }"),
  ('{ label: "POR TIPO DE HARDWARE ENTÃO ALFABETICAMENTE", value: "hardware" }', "{ label: t('BY HARDWARE TYPE THEN ALPHABETICALLY'), value: 'hardware' }"),
  
  ("{ label: 'POR TIPO DE HARDWARE ENTÃO ANO', value: 'hardware-year' }", "{ label: t('BY HARDWARE TYPE THEN YEAR'), value: 'hardware-year' }"),
  ('{ label: "POR TIPO DE HARDWARE ENTÃO ANO", value: "hardware-year" }', "{ label: t('BY HARDWARE TYPE THEN YEAR'), value: 'hardware-year' }"),
  
  ("{ label: 'POR FABRICANTE E TIPO', value: 'subgroup' }", "{ label: t('BY MANUFACTURER AND TYPE'), value: 'subgroup' }"),
  ('{ label: "POR FABRICANTE E TIPO", value: "subgroup" }', "{ label: t('BY MANUFACTURER AND TYPE'), value: 'subgroup' }"),
  
  ("{ label: 'POR ANO DE LANÇAMENTO', value: 'releaseDate' }", "{ label: t('BY RELEASE YEAR'), value: 'releaseDate' }"),
  ('{ label: "POR ANO DE LANÇAMENTO", value: "releaseDate" }', "{ label: t('BY RELEASE YEAR'), value: 'releaseDate' }"),
  
  ("{ label: 'RESTAURAR O ÚLTIMO SELECIONADO', value: 'last' }", "{ label: t('RESTORE LAST SELECTED'), value: 'last' }"),
  ('{ label: "RESTAURAR O ÚLTIMO SELECIONADO", value: "last" }', "{ label: t('RESTORE LAST SELECTED'), value: 'last' }")
]

# Additional translations that are mapped for JSON locales
JSON_ADDITIONAL_PT_TO_EN = {
  "NÃO": "NO",
  "POR ORDEM ALFABÉTICA": "BY ALPHABETICAL ORDER",
  "POR FABRICANTE": "BY MANUFACTURER",
  "POR TIPO DE HARDWARE ENTÃO ALFABETICAMENTE": "BY HARDWARE TYPE THEN ALPHABETICALLY",
  "POR TIPO DE HARDWARE ENTÃO ANO": "BY HARDWARE TYPE THEN YEAR",
  "POR FABRICANTE E TIPO": "BY MANUFACTURER AND TYPE",
  "POR ANO DE LANÇAMENTO": "BY RELEASE YEAR",
  "RESTAURAR O ÚLTIMO SELECIONADO": "RESTORE LAST SELECTED"
}

def replace_keys_in_content(content):
    # 1. Replace translation keys inside t() calls
    for pt, en in REMAINING_PT_TO_EN.items():
        escaped_pt = re.escape(pt)
        content = re.sub(r"t\(\s*'" + escaped_pt + r"'\s*\)", f"t('{en}')", content)
        content = re.sub(r't\(\s*"' + escaped_pt + r'"\s*\)', f"t('{en}')", content)
        content = re.sub(r't\(\s*`' + escaped_pt + r'`\s*\)', f"t('{en}')", content)
        
    # 2. Replace hardcoded options
    for orig, rep in HARDCODED_REPLACEMENTS:
        content = content.replace(orig, rep)
        
    return content

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src_dir = os.path.join(base_dir, 'src')
    locales_dir = os.path.join(src_dir, 'renderer', 'src', 'locales')
    
    print(f"Refactoring remaining codebase at: {src_dir}")
    
    # 1. Update source code files
    typescript_files_updated = 0
    for root, dirs, files in os.walk(src_dir):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if 'dist' in dirs:
            dirs.remove('dist')
        if 'out' in dirs:
            dirs.remove('out')
            
        for file in files:
            if file.endswith('.ts') or file.endswith('.tsx'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        original_content = f.read()
                except Exception as e:
                    print(f"Error reading {file}: {e}")
                    continue
                    
                updated_content = replace_keys_in_content(original_content)
                if updated_content != original_content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(updated_content)
                    print(f"Updated remaining keys in codebase file: {file}")
                    typescript_files_updated += 1
                    
    # 2. Update JSON locales
    # We combine REMAINING_PT_TO_EN and JSON_ADDITIONAL_PT_TO_EN
    full_mapping = {}
    full_mapping.update(REMAINING_PT_TO_EN)
    full_mapping.update(JSON_ADDITIONAL_PT_TO_EN)
    
    json_files = [f for f in os.listdir(locales_dir) if f.endswith('.json')]
    for json_file in json_files:
        json_path = os.path.join(locales_dir, json_file)
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                original_data = json.load(f)
        except Exception as e:
            print(f"Error reading {json_file}: {e}")
            continue
            
        is_en_us = (json_file == 'en_US.json')
        new_data = {}
        
        # Copy non-PT keys
        for key, val in original_data.items():
            if key not in full_mapping:
                new_data[key] = val
                
        # Map PT keys
        for key, val in original_data.items():
            if key in full_mapping:
                en_key = full_mapping[key]
                if is_en_us:
                    new_data[en_key] = en_key
                else:
                    new_data[en_key] = val
                    
        # Sort keys alphabetically
        sorted_new_data = {k: new_data[k] for k in sorted(new_data.keys())}
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(sorted_new_data, f, indent=2, ensure_ascii=False)
            
        print(f"Updated remaining translations in: {json_file}")
        
    print("Standardization of remaining keys completed successfully!")

if __name__ == '__main__':
    main()
