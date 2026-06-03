# RIESCADE Theme Documentation

Welcome to the **RIESCADE Modern Theme Engine**. Our engine uses a hybrid approach of HTML, CSS/SCSS, and React components to allow maximum flexibility and performance.

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
