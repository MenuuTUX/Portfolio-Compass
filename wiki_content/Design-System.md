# Design System 🎨

Portfolio Compass features a unique **Biopunk / Eco-Techno Surrealism** aesthetic.

## 🌌 Theme Philosophy

The design merges organic, natural forms with high-tech, futuristic elements. It moves away from the standard "SaaS flat design" to a more immersive, deep experience.

*   **Primary Colors**:
    *   **Stone-950**: Deep, organic dark background (`#0c0a09`).
    *   **Emerald-500**: Bioluminescent accents (`#10b981`).
*   **Textures**:
    *   Glassmorphism (`glass-panel`, `glass-card`).
    *   Grid patterns to denote structure.
    *   Organic glows.

## 🧩 Key Components

### Biopunk Slider
A custom input component (`components/BiopunkSlider.tsx`) that uses `framer-motion` to simulate a vine-like track with organic drag constraints.

### Glass Panels
Used for cards and containers. Defined in `globals.css`:
```css
.glass-panel {
  @apply bg-stone-900/40 border border-emerald-500/10 backdrop-blur-md shadow-lg shadow-black/20;
}
```

### Motion & Animation
*   **Float**: Gentle floating animation for background elements.
*   **Breathe**: Subtle pulsing effect for interactive elements.
*   **Transitions**: Fade-in and Slide-up mount animations used extensively instead of scroll-reveals.

## 🔤 Typography

*   **Display**: `Space Grotesk` - Technical, futuristic.
*   **Body**: `Inter` - Clean, readable.

## 🛠️ Tailwind Configuration

The project uses **Tailwind CSS v4**, configuring variables directly in CSS (`app/globals.css`) via the `@theme` block, replacing the traditional `tailwind.config.js`.

```css
@theme {
  --color-emerald-500: #10b981;
  --font-display: var(--font-space), ui-sans-serif, system-ui;
  /* ... */
}
```
