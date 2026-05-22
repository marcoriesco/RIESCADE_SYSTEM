import os
import re

PT_WORDS = [
    'SISTEMAS', 'EXIBIDOS', 'OUTROS', 'JOGOS', 'FAVORITOS', 'NUNCA', 'JOGADOS', 
    'PLAYERS', 'ARCADES', 'AGRUPADOS', 'ORDEM', 'ALFABÉTICA', 'FABRICANTE', 'TIPO', 
    'HARDWARE', 'ENTÃO', 'ALFABETICAMENTE', 'ANO', 'LANÇAMENTO', 'INICIAR', 'SISTEMA', 
    'RESTAURAR', 'ÚLTIMO', 'SELECIONADO', 'LISTA', 'EXIBIR', 'VAZIOS'
]

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    menu_path = os.path.join(base_dir, 'src', 'renderer', 'src', 'components', 'Menu.tsx')
    
    if not os.path.exists(menu_path):
        print("Menu.tsx not found!")
        return
        
    with open(menu_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    print("Scanning for remaining Portuguese strings in Menu.tsx...")
    
    portuguese_instances = []
    
    for i, line in enumerate(lines):
        line_num = i + 1
        # 1. Search for t('...') or t("...") containing accented chars or Portuguese words
        matches_single = re.findall(r"t\(\s*'([^'\\]*)'\s*\)", line)
        matches_double = re.findall(r't\(\s*"([^"\\]*)"\s*\)', line)
        
        for m in matches_single + matches_double:
            is_pt = any(c in m for c in 'áéíóúçãõâêôÁÉÍÓÚÇÃÕÂÊÔ') or any(w in m.upper() for w in PT_WORDS)
            if is_pt:
                portuguese_instances.append((line_num, "t()", m, line.strip()))
                
        # 2. Search for plain string literals that look like Portuguese options
        # E.g. label: 'POR ORDEM ALFABÉTICA' or label: 'NÃO'
        matches_label = re.findall(r"label:\s*'([^'\\]*)'", line) + re.findall(r'label:\s*"([^"\\]*)"', line)
        for m in matches_label:
            is_pt_label = any(c in m for c in 'áéíóúçãõâêôÁÉÍÓÚÇÃÕÂÊÔ') or any(w in m.upper() for w in PT_WORDS)
            # Make sure it's not already in t()
            if is_pt_label and f"t('{m}')" not in line and f't("{m}")' not in line:
                portuguese_instances.append((line_num, "hardcoded", m, line.strip()))
                
    print(f"\nFound {len(portuguese_instances)} Portuguese strings:")
    for num, kind, val, raw in portuguese_instances:
        try:
            print(f"[{kind}] Line {num}: '{val}'")
        except:
            pass
        
    # Write the list to scratch/remaining_pt.json
    out_path = os.path.join(base_dir, 'scratch', 'remaining_pt.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json_data = [{"line": num, "type": kind, "value": val, "raw": raw} for num, kind, val, raw in portuguese_instances]
        json.dump(json_data, f, indent=2, ensure_ascii=False)
    print(f"\nSaved list to {out_path}")

if __name__ == '__main__':
    main()
