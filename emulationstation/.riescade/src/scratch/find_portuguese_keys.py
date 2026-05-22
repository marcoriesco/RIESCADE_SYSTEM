import os
import json
import re

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # emulationstation/.riescade/src
    src_dir = os.path.join(base_dir, 'src')
    locales_dir = os.path.join(src_dir, 'renderer', 'src', 'locales')
    
    en_us_path = os.path.join(locales_dir, 'en_US.json')
    if not os.path.exists(en_us_path):
        print("en_US.json not found!")
        return
        
    with open(en_us_path, 'r', encoding='utf-8') as f:
        master_keys = json.load(f)
        
    # Find keys that are different from their en_US values
    pt_to_en = {}
    for key, val in master_keys.items():
        # A simple heuristic: if the value is different from the key, OR if the key has Portuguese accented characters,
        # or if the key itself is definitely Portuguese (we can list them or check if key != val)
        if key != val:
            pt_to_en[key] = val
        elif any(c in key for c in 'áéíóúçãõâêôÁÉÍÓÚÇÃÕÂÊÔ') or key in ['SIM', 'NÃO', 'ESTÁVEL', 'BETA', 'INSTÁVEL', 'AÇÕES', 'TEMA', 'ÁUDIO', 'VÍDEO', 'OPÇÕES', 'CONFIGURAÇÃO', 'SAIR', 'NENHUM', 'SALVAR', 'APLICAR']:
            pt_to_en[key] = val # or we can find English equivalent
            
    print(f"Found {len(pt_to_en)} keys that need conversion to English baseline.")
    for pt, en in list(pt_to_en.items())[:20]:
        print(f"  '{pt}' -> '{en}'")
    if len(pt_to_en) > 20:
        print("  ...")
        
    # Let's save this mapping to a json file in scratch to inspect
    mapping_path = os.path.join(base_dir, 'scratch', 'pt_to_en_mapping.json')
    with open(mapping_path, 'w', encoding='utf-8') as f:
        json.dump(pt_to_en, f, indent=2, ensure_ascii=False)
    print(f"Mapping saved to {mapping_path}")

if __name__ == '__main__':
    main()
