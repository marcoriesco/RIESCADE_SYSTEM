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
        
    # We want to find the GAME COLLECTION SETTINGS submenu block.
    # Let's find where t('GAME COLLECTION SETTINGS') is used.
    lines = content.split('\n')
    start_idx = -1
    for i, line in enumerate(lines):
        if 'GAME COLLECTION SETTINGS' in line:
            start_idx = i
            break
            
    if start_idx == -1:
        print("GAME COLLECTION SETTINGS not found in Menu.tsx!")
        return
        
    print(f"Found 'GAME COLLECTION SETTINGS' at line {start_idx + 1}:")
    # Print 100 lines after that to see the submenu structure
    for idx in range(start_idx, min(start_idx + 180, len(lines))):
        print(f"Line {idx+1}: {lines[idx]}")

if __name__ == '__main__':
    main()
