# RIESCADE SYSTEM

Um frontend retro moderno e premium para sistemas de emulação (compatível com a estrutura do EmulationStation e RetroBat), construído com Electron, React, TypeScript e uma integração direta de alto desempenho via C#.

---

## 📂 Estrutura do Repositório

O repositório é organizado para manter uma estrutura portátil e fácil de implantar:

```
RIESCADE_SYSTEM/               # Raiz do sistema (portátil)
├── RIESCADE.exe               # Inicializador compilado principal (executável portátil)
├── README.md                  # Este arquivo de documentação
├── bios/                      # Diretório para BIOS de emuladores
├── roms/                      # Diretório para jogos (ROMs)
├── saves/                     # Diretório para salvamentos de jogos
├── screenshots/               # Capturas de tela dos jogos
├── emulators/                 # Emuladores autónomos e retroarch
├── riescade/                  # Pasta do frontend e utilitários
│   ├── .riescade/             # Binários e configurações do Frontend Electron
│   │   ├── configs/           # Arquivos de configurações do sistema (ex: systems.json)
│   │   ├── logs/              # Logs de execução (gerados em runtime, vazios no release)
│   │   └── src/               # Código-fonte do Frontend (Electron + React + TS)
│   ├── launcher/              # Binários do lançador de emuladores
│   │   ├── emulatorLauncher.exe   # Lançador compilado
│   │   ├── src/               # Código-fonte do Emulator Launcher (C# .NET)
│   │   └── *.dll              # Dependências do lançador (SDL, SharpDX, etc.)
│   └── updater/               # Atualizador do sistema
│       └── RIESCADEUpdater.exe    # Executável do atualizador
```

---

## 🛠️ Instruções de Compilação e Desenvolvimento

### 1. Frontend do RIESCADE (Electron + React)

O código-fonte do frontend está localizado em [riescade/.riescade/src](file:///c:/tmp/RIESCADE_SYSTEM/riescade/.riescade/src).

#### Pré-requisitos
- **Node.js** instalado (Recomendado v18 ou superior).

#### Passos para desenvolvimento e compilação:
1. Abra o prompt de comando (CMD ou PowerShell) na pasta do código-fonte:
   ```bash
   cd riescade/.riescade/src
   ```
2. Instale as dependências do projeto:
   ```bash
   npm install
   ```
3. Para executar o projeto em modo de desenvolvimento (Hot Reloading):
   ```bash
   npm run dev
   ```
4. Para compilar e implantar na estrutura de pastas (Gera o Electron unpackaged, compila o launcher portátil `RIESCADE.exe` no diretório raiz e o `RIESCADEUpdater.exe` no diretório de updater):
   ```bash
   npm run deploy
   ```
5. Para publicar uma nova release (Gera o arquivo compactado `.7z` excluindo pastas de código e arquivos temporários/logs, faz o commit, tag no Git e publica automaticamente no GitHub Releases):
   ```bash
   npm run release
   ```

---

### 2. Emulator Launcher (C# .NET)

O código-fonte do lançador de emuladores está localizado em [riescade/launcher/src](file:///c:/tmp/RIESCADE_SYSTEM/riescade/launcher/src). Ele gerencia a inicialização dos emuladores e mapeamento de controles.

#### Pré-requisitos
- **MSBuild.exe** instalado (Geralmente incluído no .NET Framework v4.0+, disponível em `C:\Windows\Microsoft.NET\Framework\v4.0.30319\MSBuild.exe`).

#### Passos para compilação:
1. Abra o prompt de comando (CMD) na pasta do código-fonte do launcher:
   ```cmd
   cd riescade\launcher\src
   ```
2. Execute o arquivo de lote para iniciar a compilação via MSBuild:
   ```cmd
   build.bat
   ```
3. O script irá restaurar os compiladores necessários e compilar a solução C#. Após o término da compilação com sucesso, ele copiará automaticamente o `emulatorLauncher.exe` e as DLLs de dependência atualizadas para a pasta pai `riescade/launcher/`.

---

## ⚙️ Funcionamento das Rotas e Portabilidade

O sistema é 100% portátil. O executável principal `RIESCADE.exe` na raiz executa a chamada ao executável interno do Electron resolvendo o caminho relativo a si mesmo. Desta forma, a pasta do projeto pode ser movida para qualquer diretório ou unidade (ex: `D:\Games\RIESCADE_SYSTEM`) sem quebrar os vínculos com as ROMs, emuladores e decorações.
