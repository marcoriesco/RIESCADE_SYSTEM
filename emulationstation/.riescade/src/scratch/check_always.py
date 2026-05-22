import os

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    po_path = os.path.join(base_dir, '..', '..', 'resources', 'locale', 'pt_BR', 'LC_MESSAGES', 'emulationstation2.po')
    
    if not os.path.exists(po_path):
        print("PO file not found!")
        return
        
    with open(po_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Search for always translations
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'always' in line.lower():
            print(f"Line {i+1}: {line}")
            # Print next 3 lines
            for j in range(1, 4):
                if i + j < len(lines):
                    print(f"  +{j}: {lines[i+j]}")

if __name__ == '__main__':
    main()
