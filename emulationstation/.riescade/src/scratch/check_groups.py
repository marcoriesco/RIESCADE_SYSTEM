import os
import re

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    menu_path = os.path.join(base_dir, 'src', 'renderer', 'src', 'components', 'Menu.tsx')
    
    if not os.path.exists(menu_path):
        print("Menu.tsx not found!")
        return
        
    with open(menu_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # We want to find lines containing type: 'group' or 'group_...'
    # Let's search for objects inside Menu.tsx that look like: { ... type: 'group' ... }
    # To do this safely, let's find all occurrences of t('...') in lines that contain 'group'
    lines = content.split('\n')
    groups_found = []
    for i, line in enumerate(lines):
        if 'group' in line:
            # Extract t('...') or similar
            matches = re.findall(r"t\(\s*'([^'\\]*)'\s*\)", line)
            matches_double = re.findall(r't\(\s*"([^"\\]*)"\s*\)', line)
            for m in matches + matches_double:
                groups_found.append((i+1, m, line.strip()))
                
    print(f"Found {len(groups_found)} translation keys in lines containing 'group':")
    for line_num, key, raw_line in groups_found:
        print(f"Line {line_num}: t('{key}') -> {raw_line}")

if __name__ == '__main__':
    main()
