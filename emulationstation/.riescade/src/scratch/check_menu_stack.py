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
        
    lines = content.split('\n')
    
    # Search for stack operations
    print("Searching for activeMenuStack or selectedIndex changes...")
    for i, line in enumerate(lines):
        if 'activeMenuStack' in line or 'selectedIndex' in line or 'setActiveMenuStack' in line:
            if 'const' in line or 'let' in line or 'set' in line or 'push' in line or 'slice' in line:
                print(f"Line {i+1}: {line.strip()}")

if __name__ == '__main__':
    main()
