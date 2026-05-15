# RIESCADE Theme Documentation

## Controller Activity Indicator
You can add a visual indicator to show when a controller is active (buttons being pressed or connected).

### Usage
Use the custom tag `<riescade-controller-activity>`:

```html
<riescade-controller-activity class="controller-activity">
    <img src="./assets/indicators/ps4.svg" class="controller-activity-icon" />
</riescade-controller-activity>
```

### CSS Logic
When the system detects controller activity, it automatically appends the `active` class to the tag. You should define the styles in your CSS:

```css
.controller-activity {
    opacity: 0.2;
    transition: opacity 0.3s ease;
}

.controller-activity.active {
    opacity: 1;
}
```

## System Carousel
The main navigation element is the `<riescade-system-carousel>`.

### Attributes
- `type`: "carousel" (horizontal) or "list" (vertical).
- `items-count`: Number of items to render in the DOM.
- `item-class`: CSS class applied to each item.
- `item-background`: Boolean, enables background art loading.
- `is-game`: Set to "true" when rendering the game list.

## Global Variables
Variables available in the templates using `{type:name}` syntax:
- `{system:fullName}`: The full name of the current system.
- `{system:theme}`: The theme/short name of the system (e.g., "mame").
- `{system:hardwareType}`: The hardware type (e.g., "arcade", "console").
- `{game:name}`: Title of the selected game.
- `{game:fanart}`: Fullscreen fanart path for the game.
