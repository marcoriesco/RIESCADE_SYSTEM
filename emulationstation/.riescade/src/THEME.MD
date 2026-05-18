# RIESCADE Theme Documentation

Welcome to the **RIESCADE Modern Theme Engine**. Our engine uses a hybrid approach of HTML, CSS/SCSS, and React components to allow maximum flexibility and performance.

---

## 📁 Folder Structure

Each theme is a folder located in `.riescade/themes/`.

```text
theme_name/
├── assets/
│   ├── css/          # Compiled CSS files
│   ├── css/scss/     # Source SCSS files (auto-compiled)
│   ├── fonts/        # Custom fonts
│   └── images/       # Theme assets (backgrounds, logos, etc.)
├── system.html       # Layout for the System View
├── gamelist.html     # Layout for the Game List View
├── loading.html      # Splash screen during game launch
├── start.html        # Initial app splash screen
├── theme.json        # Main manifest (name, author, version)
├── options.json      # Custom settings definition for the theme
└── config.json       # (Auto-generated) Current user settings for this theme
```

---

## 📄 Configuration Files

### `theme.json`
Defines the theme identity.
```json
{
  "name": "My Epic Theme",
  "author": "DesignerName",
  "version": "1.0.0"
}
```

### `options.json`
Defines the settings that appear in the **"THEME CONFIGURATION"** menu.
```json
[
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
```

---

## 🛠 Variables Injection

Variables are dynamic strings injected into your HTML and CSS at runtime. Use the syntax `{category:property}`.

### 🌎 Global Variables
These are always available regardless of the view.
- `{global:time}`: Current system time (e.g., `14:30`).
- `{global:screenWidth}`: Current window width in pixels.
- `{global:screenHeight}`: Current window height in pixels.
- `{global:themeRevision}`: An incrementing number used for cache-busting assets during development.

### 🎮 System Variables (`system:`)
Refers to the currently selected system (e.g., "NES", "Genesis").
- `{system:fullName}`: The full display name (e.g., `Super Nintendo Entertainment System`).
- `{system:name}`: The internal short name (e.g., `snes`).
- `{system:theme}`: The theme folder name used for this system.
- `{system:gamecount}`: Total number of games available in this system.
- `{system:hardwareType}`: The hardware category (e.g., `console`, `handheld`, `arcade`).
- `{system:isCollections}`: `true` if currently looking at the list of dynamic custom collections folders (Layer 2), `false` otherwise. Useful for applying collection-specific styles.

### 🕹️ Game Variables (`game:`)
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

#### 🖼️ Media Variables
All media variables return a full, resolved path to the file.
- `{game:image}`: Main boxart or screenshot.
- `{game:video}`: Preview video path.
- `{game:marquee}`: Game logo/marquee.
- `{game:wheel}`: Logo wheel (falls back to marquee if unavailable).
- `{game:thumbnail}`: Smaller preview image.
- `{game:fanart}`: Background fanart image.
- `{game:titleshot}`: Screenshot of the title screen.
- `{game:mix}`: Pre-rendered mix image (box + screen + logo).

#### 🛡️ Handling Missing Media
To avoid showing broken image icons when a piece of media is missing (e.g., a game without fanart), use the special attribute:
- `data-riescade-hide-on-error="true"`: Add this to any `<img>` tag. If the image fails to load or the variable is empty, the element will be automatically hidden (`display: none`).

Example:
```html
<img src="{game:fanart}" data-riescade-hide-on-error="true" />
```
For date variables (`releasedate`, `lastplayed`), you can specify a format:
- `{game:releasedate:Y}`: Shows only the year (e.g., `1991`).
- `{game:releasedate:d/m/Y}`: Shows full date (e.g., `23/08/1991`).
- `{game:releasedate:m-Y}`: Shows month and year (e.g., `08-1991`).

### 🎨 Theme Options (`options:`)
Values defined by the user in the "THEME CONFIGURATION" menu.
- `{options:your_option_id}`: Returns the current value (e.g., a hex color code if used for styling).

---

## ⚡ Expressions & Conditionals

You can use basic logic inside curly braces to make your theme dynamic. This works anywhere in your HTML (attributes, text, classes).

### ❓ Ternary Operator
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

### 🔗 Nested Resolution (Dot Notation)
You can access nested properties using dots.
- `{global.cheevos.username}`
- `{system.details.manufacturer}`

---

## 🧩 Custom HTML Elements

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
- `itemMarquee`: If `true`, uses the marquee/wheel image as the primary asset.
- `itemBackground`: If `true`, shows a background box behind the asset.

### `<riescade-gamelist />`
Used in `gamelist.html` to display a classic vertical text list of games.
- Automatically handles scrolling and selection.
- Stylable via CSS using standard list selectors.

### `<riescade-clock />`
- `format`: `12h` or `24h`.
- `display-date`: If `true`, shows the current date below the time.
- `date-format`: Specify date layout (e.g., `d/m/Y`).

### `<riescade-video />`
A specialized video player that handles auto-play, looping, and fallbacks.
- `src`: Path to the video file (use `{game:video}`).
- `fallback`: Path to an image if the video is missing (use `{game:image}`).
- `mute`: If `true` (default), the video plays without sound.

---

## 🎨 Styling the Menu & Modals

The menu is **not** custom HTML anymore. It is a React component that you style using CSS classes. This ensures functionality while giving you 100% visual control.

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
    <span class="riescade-menu-label">AJUSTES DE JOGO</span>
  </div>
  <div class="riescade-menu-value">
    <span class="menu-submenu-arrow">›</span>
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
  - `.arrow`: The "«" and "»" symbols.
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

## ⚡ Development Workflow

1. **Live Reload**: Any change to `.html` or `.json` files will trigger an instant reload in the app.
2. **SCSS Compilation**: Place your `.scss` files in `assets/css/scss/`. The app will automatically compile them to `.css` on save.
3. **Hot Reload (Menu)**: When saving settings in the menu, the app performs a soft-refresh (Ctrl+R) to apply CSS changes without closing the process.

---

## 📂 Custom Game Collections (Coleções de Jogos Personalizados)

RIESCADE dynamic custom game collections are compiled from files inside the `emulationstation/.emulationstation/collections/custom-[Name].cfg` path. 

### 🧭 Three-Layer Navigation Flow

When entering the virtual **Coleções** system carousel item, navigation transitions seamlessly through three layers:

1. **Layer 1 (System Carousel):** Shows the virtual **Coleções** system (System name: `collections`, theme folder: `custom-collections`).
2. **Layer 2 (Collections Folders list):** Lists all active custom collections as folder nodes.
   - `{system:isCollections}` evaluates to **`true`**.
   - Game media is dynamically resolved from the theme assets inside subfolders (stripping the `custom-` prefix and pointing to `collections/` subdirectories):
     - `{game:marquee}` and `{game:wheel}` ➔ `themes/[active_theme]/assets/logos/collections/[CollectionName].png`
     - `{game:image}`, `{game:thumbnail}`, `{game:fanart}`, `{game:titleshot}` and `{game:mix}` ➔ `themes/[active_theme]/assets/arts/collections/[CollectionName].jpg`
3. **Layer 3 (Collection Games list):** Selecting a collection folder (pressing `Enter` / Button A) loads its parsed games list.
   - `{system:isCollections}` evaluates to **`false`**.
   - Game media automatically reverts back to the original game ROM's metadata parsed from its home system (e.g., matching boxart/videos from `cps3`, `snes`, etc.), making standard templates fully reusable without visual clutter.
   - Pressionar `Backspace` / `Escape` / Botão B retorna da Camada 3 ➔ Camada 2, e depois da Camada 2 ➔ Camada 1.
