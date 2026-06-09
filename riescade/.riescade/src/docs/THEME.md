# RIESCADE Theme Documentation

Welcome to the **RIESCADE Frontend**. Our engine uses a hybrid approach of HTML, CSS/SCSS, and React components to allow maximum flexibility and performance.

---

## Folder Structure

Each theme is a folder located in `.riescade/themes/`.

```text
theme_name/
├── assets/
│   ├── css/          # Compiled CSS files
│   ├── css/scss/     # Source SCSS files (auto-compiled)
│   ├── fonts/        # Custom fonts
│   └── images/       # Theme assets (backgrounds, logos, etc.)
├── locales/          # Translation files (JSON)
│   ├── en_US.json
│   ├── pt_BR.json
│   └── ...
├── system.html       # Layout for the System View
├── gamelist.html     # Layout for the Game List View
├── loading.html      # Splash screen during game launch
├── start.html        # Initial app splash screen
├── theme.json        # Main manifest & custom settings definition (name, author, version, options)
└── config.json       # (Auto-generated) Current user settings for this theme
```

---

## Configuration Files

### `theme.json`
Defines the theme identity, default locale, templates, and custom theme configuration options.
```json
{
  "name": "My Epic Theme",
  "author": "DesignerName",
  "version": "1.0.0",
  "defaultLocale": "en_US",
  "templates": {
    "system": "system.html",
    "gamelist": "gamelist.html",
    "start": "start.html",
    "loading": "loading.html"
  },
  "options": [
    {
      "id": "theme_color",
      "name": "PRIMARY COLOR",
      "type": "select",
      "options": [
        { "value": "#ff0000", "label": "RED" },
        { "value": "#0000ff", "label": "BLUE" }
      ],
      "default": "#ff0000"
    }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name of the theme. |
| `author` | No | Theme author credit. |
| `version` | No | Semantic version string. |
| `defaultLocale` | No | Default locale code used as fallback when the user's language is not available. Defaults to `en_US`. |
| `templates` | No | Map of view names to HTML file names. If omitted, defaults to `system.html`, `gamelist.html`, `start.html`, `loading.html`. |
| `options` | No | Array of custom theme settings definition that appear in the **"THEME CONFIGURATION"** menu. |

---

## Translations (i18n)

Themes support full multi-language translations through JSON locale files.

### Setup

1. Create a `locales/` folder inside your theme directory.
2. Add one JSON file per language, named with the locale code (e.g. `en_US.json`, `pt_BR.json`, `fr_FR.json`, `ja_JP.json`).
3. Each file contains key-value pairs of translated strings.

### Locale File Format

**`locales/en_US.json`**
```json
{
  "EMPTY_GAMELIST": "No games in this system.",
  "LOADING_GAMELIST": "Loading Game List",
  "LOADING": "Loading",
  "LOADING_PLATFORMS": "Loading platforms...",
  "ALL_GAMES": "All Games",
  "FAVORITES": "Favorites"
}
```

**`locales/pt_BR.json`**
```json
{
  "EMPTY_GAMELIST": "Nao temos jogos neste sistema.",
  "LOADING_GAMELIST": "Carregando Lista de Jogos",
  "LOADING": "Carregando",
  "LOADING_PLATFORMS": "Carregando plataformas...",
  "ALL_GAMES": "Todos os jogos",
  "FAVORITES": "Favoritos"
}
```

### Usage in HTML Templates

Use the `{t:KEY}` syntax anywhere in your HTML templates (text content, attributes, class names):

```html
<p>{t:EMPTY_GAMELIST}</p>
<span class="loading-text">{t:LOADING}</span>
<h1>{t:ALL_GAMES}</h1>
```

### Fallback Chain

When resolving a `{t:KEY}` placeholder, the engine follows this priority:

1. **User's current language** (e.g. `fr_FR.json` if the user selected French).
2. **Theme's `defaultLocale`** (defined in `theme.json`).
3. **`en_US.json`** (universal fallback).
4. **The raw key name** (e.g. `EMPTY_GAMELIST`) if no translation is found at all.

### Supported Languages

The engine supports the same 38 languages as the main application:

`ar`, `ca`, `cs_CZ`, `cy_GB`, `de`, `el`, `en_GB`, `en_US`, `es`, `es_ES`, `es_MX`, `eu_ES`, `fi_FI`, `fr`, `fr_FR`, `gl_ES`, `he`, `hu`, `id_ID`, `it`, `ja_JP`, `ko`, `nb_NO`, `nl`, `nn_NO`, `oc_FR`, `pl`, `pt_BR`, `pt_PT`, `ro_RO`, `ru_RU`, `sk_SK`, `sv_SE`, `tr`, `uk_UA`, `vi_VN`, `zh_CN`, `zh_TW`

> **Tip for theme authors:** You only need to provide translations for the languages you want to support. Any missing language will automatically fall back to your `defaultLocale` or `en_US`.

---

## Variables Injection

Variables are dynamic strings injected into your HTML and CSS at runtime. Use the syntax `{category:property}`.

### Global Variables
These are always available regardless of the view.
- `{global:time}`: Current system time (e.g., `14:30`).
- `{global:screenWidth}`: Current window width in pixels.
- `{global:screenHeight}`: Current window height in pixels.
- `{global:themeRevision}`: An incrementing number used for cache-busting assets during development.

### Start Screen Variables (`start.html`)
These variables are specifically designed for the initial app splash screen layout (`start.html`).
- `{systems-loading}`: Returns the current progress percentage of system/emulator parsing and cache loading (an integer from `0` to `100`). This is extremely useful for rendering dynamic loading text or custom styled progress bar widths (e.g., `<div style="width: {systems-loading}%;"></div>`).

### Gamelist Loading Overlay (`gamelist:loading`)
To optimize performance, gamelists are loaded dynamically. While the games are loading/scanning, you can show a loading overlay directly inside your `gamelist.html`.
The following variables are available to control this state:
- `{gamelist:loading}`: Evaluates to `true` while the list is loading, and `false` once loading completes.

You can toggle visibility of your overlay using inline styles:
```html
<div class="gamelist-loading-view" style="{gamelist:loading ? 'display: flex;' : 'display: none;'}">
  {t:LOADING}
</div>
```

### System Variables (`system:`)
Refers to the currently selected system (e.g., "NES", "Genesis").
- `{system:fullName}`: The full display name (e.g., `Super Nintendo Entertainment System`).
- `{system:name}`: The internal short name (e.g., `snes`).
- `{system:theme}`: The theme folder name used for this system.
- `{system:gamecount}`: Total number of games available in this system.
- `{system:hardwareType}`: The hardware category (e.g., `console`, `handheld`, `arcade`).
- `{system:isCollections}`: `true` if currently looking at the list of dynamic custom collections folders (Layer 2), `false` otherwise. Useful for applying collection-specific styles.

### Game Variables (`game:`)
Refers to the currently highlighted game in the gamelist.
- `{game:name}`: The game's title.
- `{game:desc}`: The game's description/biography.
- `{game:path}`: Full path to the game ROM.
- `{game:rating}`: A float from `0.0` to `1.0`.
- `{game:releasedate}`: Release date in `YYYYMMDD` format.
- `{game:lastplayed}`: Last played date in `YYYYMMDD` format.
- `{game:developer}`: Company that developed the game.
- `{game:publisher}`: Company that published the game.
- `{game:genre}`: Game genre (e.g., `Platform`, `RPG`).
- `{game:players}`: Number of supported players (e.g., `1-2`).
- `{game:playcount}`: Number of times this game has been launched.

#### Media Variables
All media variables return a full, resolved path to the file.
- `{game:image}`: Main boxart or screenshot.
- `{game:video}`: Preview video path.
- `{game:marquee}`: Game logo/marquee.
- `{game:wheel}`: Logo wheel (falls back to marquee if unavailable).
- `{game:thumbnail}`: Smaller preview image.
- `{game:fanart}`: Background fanart image.
- `{game:titleshot}`: Screenshot of the title screen.
- `{game:mix}`: Pre-rendered mix image (box + screen + logo).

#### Handling Missing Media
To avoid showing broken image icons when a piece of media is missing (e.g., a game without fanart), use the special attribute:
- `data-riescade-hide-on-error="true"`: Add this to any `<img>` tag. If the image fails to load or the variable is empty, the element will be automatically hidden (`display: none`).

Example:
```html
<img src="{game:fanart}" data-riescade-hide-on-error="true" />
```

#### Date Formatting
For date variables (`releasedate`, `lastplayed`), you can specify a format:
- `{game:releasedate:Y}`: Shows only the year (e.g., `1991`).
- `{game:releasedate:d/m/Y}`: Shows full date (e.g., `23/08/1991`).
- `{game:releasedate:m-Y}`: Shows month and year (e.g., `08-1991`).

### Theme Options (`options:`)
Values defined by the user in the "THEME CONFIGURATION" menu.
- `{options:your_option_id}`: Returns the current value (e.g., a hex color code if used for styling).

---

## Expressions & Conditionals

You can use basic logic inside curly braces to make your theme dynamic. This works anywhere in your HTML (attributes, text, classes).

### Ternary Operator
Syntax: `{condition ? 'true_value' : 'false_value'}`
If the condition is truthy (not empty and not false), it returns the first value; otherwise, it returns the second.

#### Comparisons
You can use `==` and `!=` to compare variables with literal strings or other variables.
- `{system:hardwareType == 'arcade' ? 'active' : ''}`
- `{game:players != '1' ? 'Multiplayer' : 'Single Player'}`

Example:
```html
<!-- Dynamic Avatar -->
<img src="{global.cheevos.username ? 'https://media.retroachievements.org/UserPic/{global.cheevos.username}.png' : './assets/images/guest.png'}" />

<!-- Conditional Class based on Hardware -->
<div class="ns2-menu-item {system:hardwareType == 'arcade' ? 'active' : ''}">
```

### Nested Resolution (Dot Notation)
You can access nested properties using dots.
- `{global.cheevos.username}`
- `{system.details.manufacturer}`

---

## Custom HTML Elements

Our engine provides special tags that you can use in your `system.html` and `gamelist.html` files. These elements are highly optimized and handle all input and logic automatically.

### `<riescade-system-carousel />`
Used in `system.html` to display the list of systems.
- `type`: Either `horizontal` (default) or `vertical`.
- `itemWidth` / `itemHeight`: Dimensions of each system logo/item.
- `gap`: Spacing between items.
- `logoScale`: Scale of the logo when not selected (e.g., `0.8`).
- `logoSelectedScale`: Scale of the logo when selected (e.g., `1.2`).
- `itemsCount`: Number of items to keep in DOM (for performance).

### `<riescade-game-carousel />`
Used in `gamelist.html` to display a carousel of games.
- Supports the same attributes as the system carousel.
- `media-source`: Which media type to display (`marquee`, `wheel`, `image`, `thumbnail`).
- `itemMarquee`: If `true`, uses the marquee/wheel image as the primary asset.
- `itemBackground`: If `true`, shows a background box behind the asset.

### `<riescade-gamelist />`
Used in `gamelist.html` to display a classic vertical text list of games.
- Automatically handles scrolling and selection.
- Stylable via CSS using standard list selectors.

### `<riescade-clock />`
- `format`: `12h` or `24h` (or a custom format string like `HH:mm`).
- `display-date`: If `true`, shows the current date below the time.
- `date-format`: Specify date layout (e.g., `d/m/Y`).

### `<riescade-video />`
A specialized video player that handles auto-play, looping, and fallbacks.
- `src`: Path to the video file (use `{game:video}`).
- `fallback`: Path to an image if the video is missing (use `{game:image}`).
- `mute`: If `true` (default), the video plays without sound.

### `<riescade-menu-items />`
Renders the main menu items inside a custom container. Useful for themes that want to embed menu items directly in the layout.

### `<riescade-controller-activity />`
Displays controller connection activity indicators.

---

## Animations & Effects

The theme engine supports CSS animations that replay automatically when the user navigates between games or systems. The key mechanism is the `data-riescade-key` attribute.

### The `data-riescade-key` Attribute

This attribute tells the rendering engine when to **destroy and recreate** a DOM element, which is what makes CSS animations restart.

| Value | Behavior | Used in |
|-------|----------|--------|
| `data-riescade-key="game"` | Element is destroyed and recreated when the selected **game** changes | `gamelist.html` |
| `data-riescade-key="system"` | Element is destroyed and recreated when the selected **system** changes | `system.html` |
| *(not present)* | Element **persists** in the DOM; only its attributes (`src`, text, etc.) are updated. **Animations do NOT replay.** | — |

#### How It Works

Internally, the engine uses React's `key` prop. When `data-riescade-key="game"` is set, the React key becomes `${index}-${gameId}`. A new game produces a new key, which forces React to unmount the old element and mount a fresh one — restarting all CSS animations from the beginning. Without the attribute, the key is a static index, so React reuses the same DOM node and only patches updated attributes.

#### Example

```html
<!-- Fanart: fades in on every game change -->
<div class="system-fanart animate__animated animate__fadeIn" data-riescade-key="game">
  <img src="{game:fanart ? {game:fanart} : './assets/arts/{system:theme}.webp'}" />
</div>

<!-- Thumbnail: slides in on every game change -->
<div class="thumbnail-container animate__animated animate__fadeInLeft" data-riescade-key="game">
  <img src="{game:thumbnail}" onerror="this.src = './assets/logos/{system:theme}.webp'" />
</div>

<!-- Meta info: re-animates on game change -->
<div class="gamelist-meta" data-riescade-key="game">
  <h1>{game:name}</h1>
</div>

<!-- System fanart: fades in on every system change -->
<div class="system-fanart animate__animated animate__fadeIn" data-riescade-key="system">
  <img src="./assets/arts/{system:theme}.webp" />
</div>
```

### Animation Method 1: Animate.css (Built-in)

The default theme bundles [Animate.css](https://animate.style/). Apply animations by adding two classes to any element: `animate__animated` + an effect class.

```html
<div class="animate__animated animate__fadeInLeft" data-riescade-key="game">
  ...
</div>
```

**Commonly available effects:**

| Category | Effects |
|----------|--------|
| **Fading** | `animate__fadeIn`, `animate__fadeOut`, `animate__fadeInLeft`, `animate__fadeInRight`, `animate__fadeInUp`, `animate__fadeInDown` |
| **Sliding** | `animate__slideInLeft`, `animate__slideInRight`, `animate__slideInUp`, `animate__slideInDown` |
| **Attention** | `animate__bounce`, `animate__pulse`, `animate__shakeX`, `animate__shakeY`, `animate__tada` |
| **Zooming** | `animate__zoomIn`, `animate__zoomOut` |
| **Flipping** | `animate__flipInX`, `animate__flipInY` |

> **Important:** Without `data-riescade-key`, Animate.css effects play only once (on initial render) and never replay.

### Animation Method 2: Custom CSS `@keyframes`

Define your own keyframe animations in your theme's CSS files:

```css
@keyframes slideInLeft {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.thumbnail-container {
  animation: slideInLeft 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}
```

Then pair with `data-riescade-key` to replay on navigation:

```html
<div class="thumbnail-container" data-riescade-key="game">
  <img src="{game:thumbnail}" />
</div>
```

### Animation Method 3: Conditional Animations

Use ternary expressions to conditionally apply animation classes:

```html
<!-- Only animate when fanart exists -->
<div class="{game:fanart ? 'animate__animated animate__fadeIn' : ''}" data-riescade-key="game">
  <img src="{game:fanart ? {game:fanart} : './assets/arts/{system:theme}.webp'}" />
</div>
```

### Controlling Animation Duration & Delay

Animate.css supports CSS custom properties for timing:

```html
<div
  class="animate__animated animate__fadeInLeft"
  data-riescade-key="game"
  style="--animate-duration: 0.8s; --animate-delay: 0.2s; animation-delay: var(--animate-delay);"
>
  <img src="{game:thumbnail}" />
</div>
```

Or control timing via your own CSS:

```css
.my-element {
  animation-duration: 0.5s;
  animation-delay: 0.3s;
  animation-timing-function: ease-out;
  animation-fill-mode: forwards;
}
```

### Best Practices

- **Always add `data-riescade-key`** to any element that should animate on game/system change. Without it, animations play only once.
- **Use `forwards` fill mode** (`animation-fill-mode: forwards`) so the element stays in its final animation state.
- **Keep animations short** (0.3s–0.8s) for a responsive feel during rapid navigation.
- **Use `data-riescade-hide-on-error="true"`** on `<img>` tags inside animated containers to prevent broken image icons from appearing during transitions.
- **Scope animations to the correct view:** Use `data-riescade-key="game"` in `gamelist.html` and `data-riescade-key="system"` in `system.html`.

---

## Styling the Menu & Modals

The menu is **not** custom HTML. It is a React component that you style using CSS classes. This ensures functionality while giving you 100% visual control.

### Menu Classes
- `.riescade-menu-overlay`: The full-screen background.
- `.riescade-menu-container`: The menu box.
- `.riescade-menu-header`: Header section.
- `.riescade-menu-title`: Main title (e.g., "MAIN MENU").
- `.riescade-menu-subtitle`: Subtitle (used in Game Options).
- `.riescade-menu-list`: The container for items.
- `.riescade-menu-group`: Label for groups (e.g., "GAME SETTINGS").
- `.riescade-menu-item`: The item row.
  - `.selected`: When the item is focused.
- `.riescade-menu-label-container`: Container wrapping the icon and the text label (only present for first-level main menu items).
- `.riescade-menu-icon`: Icon placeholder inside `riescade-menu-label-container`. The element has its `id` attribute set to the specific item ID (e.g., `id="game_settings"`), allowing easy CSS targeting for icons.
- `.riescade-menu-label`: Item text.
- `.riescade-menu-value`: The area for toggle/select values.
- `.riescade-menu-footer`: Bottom bar.
- `.riescade-menu-version`: App and ES version text.

#### Main Menu Custom Item Layout (with Icons)
For the main menu items, the HTML structure is generated as follows, enabling custom icon additions via CSS:
```html
<div class="riescade-menu-item selected">
  <div class="riescade-menu-label-container">
    <span class="riescade-menu-icon" id="game_settings"></span>
    <span class="riescade-menu-label">GAME SETTINGS</span>
  </div>
  <div class="riescade-menu-value">
    <span class="menu-submenu-arrow">&rsaquo;</span>
  </div>
</div>
```

Example CSS styling for main menu icons:
```css
.riescade-menu-icon {
  display: inline-block;
  width: 20px;
  height: 20px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

#game_settings {
  background-image: url('../images/icons/game_settings.png');
}
#ui_settings {
  background-image: url('../images/icons/ui_settings.png');
}
```

### Toggle/Select Classes
- `.menu-toggle`: The switch container (`.on` / `.off`).
- `.toggle-thumb`: The moving circle inside.
- `.menu-select`: Select container.
  - `.arrow`: The left/right symbols.
  - `.value`: The currently selected option text.

### Modal & Notification Classes
- `.riescade-modal-overlay`: Modal backdrop.
- `.riescade-modal-container`: The dialog box.
- `.riescade-modal-title`, `.riescade-modal-message`.
- `.riescade-modal-button-primary`: Confirmation button.
- `.riescade-modal-button-danger`: Cancel/Discard button.
- `.riescade-modal-button-secondary`: Neutral button.
- `.riescade-notification`: Notification box (`.info`, `.success`, `.warning`).
- `.riescade-notification-message`: Notification text.

---

## Development Workflow

1. **Live Reload**: Any change to `.html` or `.json` files will trigger an instant reload in the app.
2. **SCSS Compilation**: Place your `.scss` files in `assets/css/scss/`. The app will automatically compile them to `.css` on save.
3. **Hot Reload (Menu)**: When saving settings in the menu, the app performs a soft-refresh (Ctrl+R) to apply CSS changes without closing the process.

---

## Custom Game Collections

RIESCADE dynamic custom game collections are compiled from files inside the `emulationstation/.emulationstation/collections/custom-[Name].cfg` path.

### Three-Layer Navigation Flow

When entering the virtual **Collections** system carousel item, navigation transitions seamlessly through three layers:

1. **Layer 1 (System Carousel):** Shows the virtual **Collections** system (System name: `collections`, theme folder: `custom-collections`).
2. **Layer 2 (Collections Folders list):** Lists all active custom collections as folder nodes.
   - `{system:isCollections}` evaluates to **`true`**.
   - Game media is dynamically resolved from the theme assets inside subfolders (stripping the `custom-` prefix and pointing to `collections/` subdirectories):
     - `{game:marquee}` and `{game:wheel}` -> `themes/[active_theme]/assets/logos/collections/[CollectionName].png`
     - `{game:image}`, `{game:thumbnail}`, `{game:fanart}`, `{game:titleshot}` and `{game:mix}` -> `themes/[active_theme]/assets/arts/collections/[CollectionName].jpg`
3. **Layer 3 (Collection Games list):** Selecting a collection folder (pressing `Enter` / Button A) loads its parsed games list.
   - `{system:isCollections}` evaluates to **`false`**.
   - Game media automatically reverts back to the original game ROM's metadata parsed from its home system (e.g., matching boxart/videos from `cps3`, `snes`, etc.), making standard templates fully reusable without visual clutter.
   - Press `Backspace` / `Escape` / Button B to navigate back from Layer 3 -> Layer 2, then Layer 2 -> Layer 1.

---

## Publishing Your Theme to the Community Store

RIESCADE includes a built-in **Theme Store** (under **USER INTERFACE SETTINGS > COMMUNITY**) that automatically discovers themes published on GitHub. If you want your theme to appear there, follow these guidelines.

### Requirements

1. **Repository name must contain `riescade-theme`**

   The Community tab searches GitHub for repositories with `riescade-theme` in the name. Examples:
   - `riescade-theme-neon`
   - `riescade-theme-retro`
   - `my-riescade-theme-dark`

   > The repository must be **public** for the GitHub Search API to find it.

2. **Include a `theme.json` manifest at the repository root**

   The Theme Store reads this file to display your theme in the store. It must follow the standard schema:

   ```json
   {
     "name": "Neon Glow",
     "author": "YourName",
     "version": "1.0.0",
     "preview": "./preview/preview.jpg",
     "defaultLocale": "en_US",
     "templates": {
       "system": "system.html",
       "gamelist": "gamelist.html",
       "start": "start.html",
       "loading": "loading.html"
     },
     "options": []
   }
   ```

   | Field | Required for Store | Description |
   |-------|-------------------|-------------|
   | `name` | **Yes** | Display name shown in the store card. |
   | `author` | **Yes** | Author credit shown below the theme name. |
   | `version` | **Yes** | Version badge displayed on the card (e.g., `v1.0.0`). |
   | `preview` | **Yes** | Relative path to a preview image inside your repo. This image is shown as the store card thumbnail. Recommended size: **960x540** (16:9). Supported formats: `.jpg`, `.png`, `.webp`. |
   | `defaultLocale` | No | Fallback locale for translations. Defaults to `en_US`. |
   | `templates` | No | Map of view names to HTML files. |
   | `options` | No | Custom theme settings definitions. |

3. **Include the preview image**

   The file referenced in the `preview` field must exist in your repository. Example structure:

   ```text
   riescade-theme-neon/
   ├── assets/
   │   ├── css/
   │   └── images/
   ├── preview/
   │   └── preview.jpg      ← This is shown in the store
   ├── system.html
   ├── gamelist.html
   ├── theme.json
   └── ...
   ```

### How Discovery Works

1. When a user opens the **COMMUNITY** tab, RIESCADE queries the GitHub Search API:
   ```
   GET https://api.github.com/search/repositories?q=riescade-theme in:name
   ```
2. For each repository found, it fetches `theme.json` from the default branch (`main` or `master`).
3. The manifest is parsed and a store card is generated showing: preview image, theme name, author, version, and a **DOWNLOAD** button.
4. When the user clicks **DOWNLOAD**, the repository ZIP is downloaded and extracted into the user's `themes/` directory.

### How Installation Works

1. The store downloads the repository as a ZIP from GitHub (`/archive/refs/heads/main.zip`).
2. The ZIP is extracted using the system's built-in compression utilities.
3. GitHub ZIPs contain a wrapper folder (`repo-branch/`). This wrapper is stripped automatically.
4. The theme files are placed in `themes/<repository-name>/`.
5. The user can then select the newly installed theme from **USER INTERFACE SETTINGS > THEMES**.

### Quick-Start Checklist

- [ ] Create a public GitHub repository with `riescade-theme` in the name.
- [ ] Add a valid `theme.json` at the root with `name`, `author`, `version`, and `preview` fields.
- [ ] Add a preview image (recommended 960x540, JPG/PNG/WebP) at the path declared in `preview`.
- [ ] Include your theme files (`system.html`, `gamelist.html`, CSS, assets, etc.).
- [ ] Push to the `main` branch.
- [ ] Wait a few minutes for GitHub Search to index your repository.
- [ ] Open RIESCADE > **USER INTERFACE SETTINGS** > **COMMUNITY** tab — your theme should appear.

### Tips

- **Keep the repository focused** — one theme per repository.
- **Update `version`** in `theme.json` when you release changes so users can see the update.
- **Test locally first** — copy your theme folder to the user `themes/` directory and verify everything works before publishing.
- **Translations** — include a `locales/` folder if you want to support multiple languages (see the Translations section above).
- **License** — consider adding a `LICENSE` file (e.g., MIT) so others know how they can use and modify your theme.
