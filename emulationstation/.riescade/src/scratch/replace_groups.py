import os
import json
import re

PT_TO_EN_GROUPS = {
  "FERRAMENTAS": "TOOLS",
  "CONTAS": "ACCOUNTS",
  "JOGADORES": "PLAYERS"
}

def replace_keys_in_content(content):
    for pt, en in PT_TO_EN_GROUPS.items():
        escaped_pt = re.escape(pt)
        content = re.sub(r"t\(\s*'" + escaped_pt + r"'\s*\)", f"t('{en}')", content)
        content = re.sub(r't\(\s*"' + escaped_pt + r'"\s*\)', f"t('{en}')", content)
        content = re.sub(r't\(\s*`' + escaped_pt + r'`\s*\)', f"t('{en}')", content)
    return content

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src_dir = os.path.join(base_dir, 'src')
    locales_dir = os.path.join(src_dir, 'renderer', 'src', 'locales')
    
    print(f"Refactoring groups at: {src_dir}")
    
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
                    print(f"Updated group keys in codebase file: {file}")
                    typescript_files_updated += 1
                    
    # 2. Update JSON files
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
        
        # Copy non-group portuguese keys
        for key, val in original_data.items():
            if key not in PT_TO_EN_GROUPS:
                new_data[key] = val
                
        # Map group keys
        for key, val in original_data.items():
            if key in PT_TO_EN_GROUPS:
                en_key = PT_TO_EN_GROUPS[key]
                if is_en_us:
                    new_data[en_key] = en_key
                else:
                    new_data[en_key] = val
                    
        # Sort keys alphabetically
        sorted_new_data = {k: new_data[k] for k in sorted(new_data.keys())}
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(sorted_new_data, f, indent=2, ensure_ascii=False)
            
        print(f"Updated group translations in: {json_file}")
        
    print("Group key refactoring complete!")

if __name__ == '__main__':
    main()
