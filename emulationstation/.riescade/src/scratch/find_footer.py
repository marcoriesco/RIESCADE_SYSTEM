import os

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    menu_path = os.path.join(base_dir, 'src', 'renderer', 'src', 'components', 'Menu.tsx')
    
    if not os.path.exists(menu_path):
        print("Menu.tsx not found!")
        return
        
    with open(menu_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    print("Searching for footer or bottom section inside Menu.tsx...")
    for i, line in enumerate(lines):
        if 'footer' in line.lower() or 'version' in line.lower() or 'riescade v' in line.lower() or 'versions.app' in line.lower():
            print(f"Line {i+1}: {line.strip()}")

if __name__ == '__main__':
    main()
