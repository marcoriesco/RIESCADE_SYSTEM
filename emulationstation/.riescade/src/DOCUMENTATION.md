# RIESCADE - Documentação Técnica

## 1. Visão Geral
O **RIESCADE** é um frontend moderno para retrogaming, construído sobre o ecossistema do **RetroBat/EmulationStation**. Ele substitui a interface clássica por uma engine baseada em **Electron + React + Vite**, permitindo temas dinâmicos em HTML/CSS com performance nativa.

## 2. Arquitetura do Projeto

O projeto segue a estrutura padrão do Electron-Vite:

- **Main Process (`src/main`)**: Gerencia o sistema operacional, leitura de arquivos XML, execução de comandos e o lançamento de emuladores.
- **Preload Script (`src/preload`)**: Ponte segura (Context Bridge) que expõe as APIs do Main para o Renderer.
- **Renderer Process (`src/renderer`)**: Interface do usuário construída em React.
- **Shared (`src/shared`)**: Definições de tipos TypeScript compartilhadas.

### Diretórios Principais:
- `src/main/services`: Lógica de negócio (Launcher, Library, Theme, System).
- `src/main/parsers`: Interpretadores de arquivos de configuração (.cfg, .xml, .json).
- `src/renderer/src/components`: Componentes React (Menu, Overlays, Views).
- `src/renderer/src/components/theme`: Engine de renderização de temas.

---

## 3. Sistemas Principais

### 3.1. Library Service (Gestão de Jogos)
Lê as configurações do RetroBat:
- **Systems**: Analisa `es_systems.cfg` para identificar consoles e emuladores.
- **Gamelists**: Analisa `gamelist.xml` em cada pasta de ROMs para extrair metadados, capas e vídeos.
- **Persistence**: Suporta a edição de metadados (como Favoritos e escolha de Emulador) gravando diretamente nos XMLs originais.

### 3.2. Launcher Service (Lançamento de Jogos)
Executa o `emulatorLauncher.exe` do RetroBat com os seguintes recursos:
- **XML Temporário**: Gera um `game.xml` temporário para comunicação com o launcher nativo.
- **Hardware Discovery**: Utiliza **PowerShell** para mapear o GUID do controle (via Web Gamepad API) ao **InstanceID USB** real do Windows (`p1path`).
- **Mapeamento SDL2**: Converte GUIDs de controles para o formato Little-Endian esperado pelo SDL2.

### 3.3. Engine de Temas (WebThemeRenderer)
Permite que temas do EmulationStation sejam escritos em HTML/CSS:
- Mapeia tags customizadas (ex: `<riescade-game-carousel>`) para componentes React.
- Resolve variáveis de metadados dinamicamente (ex: `{game:name}`, `{game:image}`).

---

## 4. Instruções de Desenvolvimento e Build

### Requisitos
- Node.js 18+
- Windows (para execução do `emulatorLauncher.exe`)

### Comandos Principais
- `npm install`: Instala as dependências.
- `npm run dev`: Inicia o ambiente de desenvolvimento com HMR (Hot Module Replacement).
- `npm run build`: Compila os arquivos para produção.
- `npm run dist`: Gera a versão "unpacked" (descompactada) do executável.
- **`npm run deploy`**: O comando mais importante para produção. Ele faz o seguinte:
    1. Compila o projeto.
    2. Move os arquivos para `emulationstation/.riescade`.
    3. Cria um link direto (Hard Link) em `c:\tmp\RIESCADE_SYSTEM\RIESCADE.exe`.
    4. Sincroniza o tema padrão.

---

## 5. Fluxo de Deploy Customizado
O projeto foi configurado para residir dentro da estrutura do RetroBat em `.riescade/src`. O script `scripts/deploy.js` automatiza a migração do build para a pasta pai, permitindo que o frontend rode de forma integrada ao sistema de pastas original.

## 6. Configurações Técnicas Importantes
- **Entity Expansion Limit**: Definido como `99999` via `processEntities.maxTotalExpansions` nos parsers para permitir a leitura de arquivos `gamelist.xml` gigantescos sem erros de memória.
- **XInput Support**: GUIDs de controles Xbox 360 são forçados para o padrão SDL2 para garantir compatibilidade imediata.
