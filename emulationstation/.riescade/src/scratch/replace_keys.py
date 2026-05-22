import os
import json
import re

PT_TO_EN = {
  "ESTADOS DE SALVAMENTO": "SAVE STATES",
  "SALVAR/CARREGAR AUTOMÁTICO": "AUTO SAVE/LOAD",
  "TIPO DE INCREMENTO": "INCREMENT TYPE",
  "EXIBIR GERENCIADOR": "SHOW MANAGER",
  "POR ESTADO DE SALVAMENTO": "BY SAVE STATE",
  "POR ESPAÇO DE SALVAMENTO": "BY SAVE SLOT",
  "NÃO INCREMENTAR": "DO NOT INCREMENT",
  "SIM": "YES",
  "NÃO": "NO",
  "Carrega o estado de salvamento mais recente ao iniciar o jogo e salva o estado ao sair do jogo.": "Loads the most recent save state when starting the game and saves the state when exiting.",
  "Nunca sobrescreve estados de salvamento antigos, sempre crie novos.": "Never overwrite old save states, always create new ones.",
  "Incrementa novo espaço em um novo jogo.": "Increments a new slot on a new game start.",
  "Usa o espaço atual em um novo jogo.": "Uses the current slot on a new game start.",
  "Exibe o gerenciador de estado de salvamento antes de iniciar um jogo.": "Displays the save state manager before starting a game.",
  "MOSTRAR IMAGEM SOBREPOSTA À MOLDURA": "SHOW TATTOO OVER BEZEL",
  "POSIÇÃO DA SOBREPOSIÇÃO": "TATTOO CORNER",
  "REDIMENSIONAR SOBREPOSIÇÃO": "RESIZE TATTOO",
  "ESCALA INTEIRA (PIXEL PERFEITO)": "INTEGER SCALING (PIXEL PERFECT)",
  "JOGOS SUAVES (FILTRO BILINEAR)": "SMOOTH GAMES (BILINEAR FILTERING)",
  "CONFIGURAR CONTROLES AUTOMATICAMENTE": "AUTOCONFIGURE CONTROLLERS",
  "VÍDEO": "VIDEO",
  "REDUÇÃO DE LATÊNCIA": "LATENCY REDUCTION",
  "TRADUÇÃO DO TEXTO DO JOGO POR IA": "AI GAME TRANSLATION",
  "CONFIGURAÇÃO AVANÇADA POR SISTEMA": "ADVANCED SYSTEM CONFIGURATION",
  "LIGADO": "ON",
  "DESLIGADO": "OFF",
  "AUTOMÁTICO": "AUTOMATIC",
  "Sistemas instalados": "Installed systems",
  "Todos": "All",
  "INSTÁVEL": "UNSTABLE",
  "ESTÁVEL": "STABLE",
  "AÇÕES": "ACTIONS",
  "ORDENAÇÃO DOS SISTEMAS": "SYSTEM SORTING",
  "USUÁRIO": "USERNAME",
  "FALTANDO QUALQUER MÍDIA": "GAMES MISSING ANY MEDIA",
  "PADRÃO": "DEFAULT",
  "COLEÇÕES": "COLLECTIONS",
  "FALTANDO TODAS AS MÍDIAS": "GAMES MISSING ALL MEDIA",
  "SE DISPONÍVEL": "IF AVAILABLE",
  "COLEÇÕES A SEREM EXIBIDAS": "COLLECTIONS TO DISPLAY",
  "OPÇÕES": "OPTIONS",
  "NENHUM SISTEMA AGRUPÁVEL ENCONTRADO": "NO GROUPABLE SYSTEMS FOUND",
  "CONQUISTAS RETRÔ": "RETROACHIEVEMENTS",
  "EXIBIR JOGOS DE SISTEMAS OCULTOS NAS COLEÇÕES": "SHOW GAMES FROM HIDDEN SYSTEMS IN COLLECTIONS",
  "COLEÇÕES DE JOGOS AUTOMÁTICOS": "AUTOMATIC GAME COLLECTIONS",
  "GÊNEROS": "GENRES",
  "BETA": "BETA",
  "BUSCANDO MÍDIAS": "SEARCHING FOR MEDIA",
  "NENHUMA COLEÇÃO ENCONTRADA": "NO COLLECTIONS FOUND",
  "COLEÇÕES DE JOGO PERSONALIZADOS": "CUSTOM GAME COLLECTIONS",
  "ÚLTIMOS JOGADOS": "LAST PLAYED",
  "Reduz/expande a sobreposição para caber na borda da moldura.": "Reduces/expands the overlay to fit inside the bezel."
}

def replace_keys_in_content(content):
    for pt, en in PT_TO_EN.items():
        escaped_pt = re.escape(pt)
        # Replace single quotes
        content = re.sub(r"t\(\s*'" + escaped_pt + r"'\s*\)", f"t('{en}')", content)
        # Replace double quotes
        content = re.sub(r't\(\s*"' + escaped_pt + r'"\s*\)', f"t('{en}')", content)
        # Replace backticks
        content = re.sub(r't\(\s*`' + escaped_pt + r'`\s*\)', f"t('{en}')", content)
    return content

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # emulationstation/.riescade/src
    src_dir = os.path.join(base_dir, 'src')
    locales_dir = os.path.join(src_dir, 'renderer', 'src', 'locales')
    
    print(f"Refactoring codebase at: {src_dir}")
    print(f"Cleaning translation files at: {locales_dir}")
    
    # 1. Scan and replace in all typescript files
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
                    print(f"Updated keys in codebase file: {file}")
                    typescript_files_updated += 1
                    
    print(f"Refactored keys in {typescript_files_updated} source files.")
    
    # 2. Update and clean up JSON locale files
    json_files = [f for f in os.listdir(locales_dir) if f.endswith('.json')]
    for json_file in json_files:
        json_path = os.path.join(locales_dir, json_file)
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                original_data = json.load(f)
        except Exception as e:
            print(f"Error reading {json_file}: {e}")
            continue
            
        # Standardize en_US keys mapping to themselves
        is_en_us = (json_file == 'en_US.json')
        
        new_data = {}
        # Copy over non-portuguese keys
        for key, val in original_data.items():
            if key not in PT_TO_EN:
                new_data[key] = val
                
        # Handle Portuguese keys mapping
        for key, val in original_data.items():
            if key in PT_TO_EN:
                en_key = PT_TO_EN[key]
                if is_en_us:
                    new_data[en_key] = en_key
                else:
                    new_data[en_key] = val
                    
        # Sort keys alphabetically for clean, structured JSON!
        sorted_new_data = {k: new_data[k] for k in sorted(new_data.keys())}
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(sorted_new_data, f, indent=2, ensure_ascii=False)
            
        print(f"Cleaned and updated translations in: {json_file}")
        
    print("Standardization process completed successfully!")

if __name__ == '__main__':
    main()
