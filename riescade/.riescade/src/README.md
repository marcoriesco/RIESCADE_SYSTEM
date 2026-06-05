# RIESCADE - Frontend (Electron + React)

Esta pasta contém o código-fonte do frontend do RIESCADE, construído com Electron, React, TypeScript e Sass.

Para obter instruções completas sobre o repositório principal e a compilação do lançador de emuladores, consulte o [README.md principal na raiz do repositório](file:///c:/tmp/RIESCADE_SYSTEM/README.md).

---

## 🛠️ Instruções de Compilação e Desenvolvimento

### Pré-requisitos
- **Node.js** instalado (Recomendado v18 ou superior).

### Instalação de Dependências
Para instalar as dependências do projeto (execute dentro desta pasta):
```bash
npm install
```

### Rodar em Desenvolvimento (Hot Reload)
Para iniciar a aplicação em modo de desenvolvimento com hot reloading (recarregamento automático ao salvar alterações):
```bash
npm run dev
```

### Compilação e Implantação local (Build & Deploy)
Para compilar a aplicação de produção e implantá-la na estrutura de pastas correta do sistema:
```bash
npm run deploy
```
Este comando executa a build do vite, empacota com o `electron-builder` na pasta local e executa o script de deploy para gerar o launcher `RIESCADE.exe` portátil no diretório raiz do repositório.

### Publicar Release
Para publicar uma nova versão:
```bash
npm run release
```
*Nota: Este script requer que as variáveis de ambiente `GITHUB_TOKEN` ou `GH_TOKEN` estejam configuradas no arquivo `.env`.*
