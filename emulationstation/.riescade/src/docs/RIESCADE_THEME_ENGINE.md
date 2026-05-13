# RIESCADE Theme Engine - Documentação Oficial

O novo motor de temas do RIESCADE abandona a rigidez do XML do EmulationStation em favor de um ecossistema moderno, flexível e baseado em padrões web universais (HTML5 e CSS3). 

Criar um tema para o RIESCADE agora é exatamente como criar um site. Você tem controle total sobre o DOM, classes, animações CSS e posicionamentos absolutos ou flexbox.

## Estrutura de um Tema RIESCADE

Um tema RIESCADE deve possuir a seguinte estrutura de arquivos:

```text
themes/MEU_TEMA/
├── theme.json         # (Opcional) Metadados do tema
├── system.html        # Estrutura HTML da tela de Seleção de Sistemas
├── gamelist.html      # Estrutura HTML da tela de Lista de Jogos
├── styles.css         # Todo o estilo visual do tema (pode ser dividido e importado usando @import)
└── assets/            # Pasta para imagens, vídeos, fontes e sons
```

## Como o Motor Funciona

O frontend lê o seu `system.html` ou `gamelist.html` e injeta ele na tela. Antes de injetar, o motor procura por **Variáveis de Dados** e **Componentes Customizados (Web Components)**.

### 1. Variáveis de Dados (Data Tags)

Você pode usar chaves `{}` para imprimir informações dinâmicas diretamente no seu HTML.

**Variáveis de Sistema (Disponíveis em `system.html` e `gamelist.html`):**
- `{system:name}` -> Nome curto do sistema (ex: `megadrive`)
- `{system:fullName}` -> Nome completo (ex: `Sega Mega Drive`)
- `{system:hardwareType}` -> Tipo de hardware (ex: `console`, `arcade`)
- `{system:manufacturer}` -> Fabricante (ex: `Sega`)
- `{system:releaseYear}` -> Ano de lançamento
- `{system:theme}` -> Nome do tema (usado para buscar logos)

**Variáveis de Jogos (Disponíveis apenas em `gamelist.html`):**
- `{game:name}` -> Nome do jogo selecionado
- `{game:path}` -> Caminho do arquivo da ROM
- `{game:image}` -> Caminho da Boxart / Imagem
- `{game:video}` -> Caminho do Snap de Vídeo
- `{game:marquee}` -> Caminho do Logo do jogo (Wheel)
- `{game:developer}` -> Desenvolvedora
- `{game:publisher}` -> Publicadora
- `{game:genre}` -> Gênero
- `{game:players}` -> Número de jogadores
- `{game:rating}` -> Nota (0.0 a 1.0)
- `{game:releasedate}` -> Data de lançamento

**Exemplo de uso no HTML:**
```html
<div class="game-info">
    <h1>{game:name}</h1>
    <p>Desenvolvedor: {game:developer} | Ano: {game:releasedate}</p>
</div>
<img src="{game:image}" class="boxart" />
```

### 2. Componentes Customizados (Riescade Tags)

Como a navegação (Carousel, Lista de Jogos) requer muita lógica de JavaScript (foco, controle, animação), nós fornecemos "Tags Mágicas" que você insere no HTML e o nosso motor transforma em componentes interativos perfeitos.

#### `<riescade-system-carousel>`
Gera a roleta de sistemas.
**Atributos:**
- `type` (horizontal, vertical) - Direção do carousel.

**Exemplo:**
```html
<riescade-system-carousel class="meu-carousel"></riescade-system-carousel>
```

#### `<riescade-gamelist>`
Gera a lista de jogos vertical.

#### `<riescade-video>`
Toca o vídeo do jogo em loop se existir.
**Atributos:**
- `src` - Caminho do vídeo (use `{game:video}`).
- `fallback` - Imagem a ser exibida se o vídeo não existir (ex: `{game:image}`).

**Exemplo:**
```html
<riescade-video src="{game:video}" fallback="{game:image}" class="video-preview"></riescade-video>
```

### 3. Escopo de CSS (Obrigatório)

Para evitar que os temas quebrem o frontend inteiro, você deve colocar tudo dentro de classes específicas nos seus arquivos HTML. 
Por exemplo, defina a raiz da sua tela com a tag de visualização:

```html
<!-- system.html -->
<div data-riescade-view="system" class="theme-wrapper">
    <!-- seu tema aqui -->
</div>
```

E no seu `styles.css`:
```css
[data-riescade-view="system"] {
    width: 100vw;
    height: 100vh;
    background: url('./assets/bg.jpg') no-repeat center center;
    background-size: cover;
    color: white;
}
```

## Benefícios Desta Abordagem
- **Flexibilidade Infinita**: Você usa CSS puro. Pode usar Flexbox, Grid, Animações com Keyframes, variáveis CSS (`var(--main-color)`).
- **Sem limite de tags**: Quer colocar 10 imagens de fundo e 5 vídeos? É só escrever as tags HTML.
- **Fácil depuração**: Abra o arquivo HTML no seu próprio Chrome, edite e veja em tempo real!
