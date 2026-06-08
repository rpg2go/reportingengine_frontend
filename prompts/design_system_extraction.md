# Design System Extraction — text2sql_frontend
> **MacBook Neo / Apple Pro** aesthetic · Light + Dark · Next.js + Tailwind CSS
> Extracted with ui-ux-pro-max skill for reuse in other projects.

---

## 1. Design Language

| Attribute | Value |
|-----------|-------|
| **Style** | Apple-inspired glassmorphism · Neo-minimalist · Premium SaaS |
| **Mood** | Clean, authoritative, data-dense but breathable |
| **Icon set** | Lucide React (consistent stroke width) |
| **Animation lib** | Framer Motion |
| **Font stack** | Geist Sans (primary) · Geist Mono (code/data) · system-ui fallback |

---

## 2. Color Tokens

### Light Theme (`:root.light`)

| Token | Variable | Value | Usage |
|-------|----------|-------|-------|
| Page background | `--background` | `#F5F5F7` | Body / page fill |
| Foreground text | `--foreground` | `#1D1D1F` | Default text |
| Card surface | `--card-bg` | `rgba(255,255,255,0.7)` | Glass cards |
| Border | `--border-color` | `rgba(0,0,0,0.1)` | All dividers & outlines |
| Primary text | `--text-primary` | `#1D1D1F` | Headings, labels |
| Secondary text | `--text-secondary` | `#86868B` | Subtitles, metadata |
| Accent / CTA | `--accent-blue` | `#0076DF` | Buttons, links, active states |
| Depth accent | `--accent-depth` | `#F5F5F7` | Surface depth helper |
| Input bg | `--input-bg` | `rgba(0,0,0,0.04)` | Text fields |
| App background | `--color-apple-bg` | `#F5F5F7` | Full page bg |
| Card fill | `--color-apple-card` | `#FFFFFF` | Card/panel bg |
| Body text | `--color-apple-text` | `#1D1D1F` | Body copy |
| Muted text | `--color-apple-grey` | `#86868B` | Placeholders, captions |
| Silver/divider | `--color-apple-silver` | `#E3E4E5` | Subtle separators |
| Brand blue | `--color-apple-blue` | `#0076DF` | All accent use |
| Warning | `--color-warning` | `#d97706` | Amber warning states |

### Dark Theme (`:root` default)

| Token | Variable | Value |
|-------|----------|-------|
| Page background | `--background` | `#000000` |
| Foreground text | `--foreground` | `#F5F5F7` |
| Card surface | `--card-bg` | `rgba(30,41,59,0.7)` |
| Border | `--border-color` | `rgba(255,255,255,0.1)` |
| Primary text | `--text-primary` | `#F5F5F7` |
| Secondary text | `--text-secondary` | `#94A3B8` |
| Accent / CTA | `--accent-blue` | `#0076DF` |
| App background | `--color-apple-bg` | `#0B1120` |
| Card fill | `--color-apple-card` | `#1E293B` |
| Body text | `--color-apple-text` | `#F5F5F7` |
| Muted text | `--color-apple-grey` | `#94A3B8` |
| Silver | `--color-apple-silver` | `#F5F5F7` |
| Brand blue | `--color-apple-blue` | `#0076DF` |
| Warning | `--color-warning` | `#f59e0b` |

> **Key insight**: The accent blue `#0076DF` is **identical** in both themes — only surfaces and text colors flip.

---

## 3. Typography

### Font Families

```css
font-family: 'Geist Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
font-family: 'Geist Mono', monospace; /* code / tabular data */
```

### Type Scale

| Role | CSS Class | Size | Weight | Notes |
|------|-----------|------|--------|-------|
| Page title | `.typography-page-title` | `20px` | `600` | Section headers |
| Question / H2 | `.typography-question` | `16px` | `500` | Sub-headings |
| Step title | `.typography-step-title` | `14px` | `600` | Card inner labels |
| Body | `.typography-body` | `16px` | `400` | Default body copy |
| Metadata | `.typography-metadata` | `12px` | `400` | Timestamps, badges |

### Additional Typography Rules

| Property | Value | Rationale |
|----------|-------|-----------|
| `line-height` (body) | `1.4` | Tight, information-dense |
| `letter-spacing` (body) | `-0.374px` | Apple-style tight tracking |
| Nav links | `12px / uppercase / tracking-widest` | Small-caps label style |
| Logo / Brand | `17px / semibold / tracking-[-0.022em]` | Apple title style |
| Badges / buttons | `10px / bold / uppercase / tracking-widest` | All-caps label micro-copy |

### Font Smoothing

```css
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

---

## 4. Spacing & Layout

| Token | Value | Usage |
|-------|-------|-------|
| Nav height | `48px` | Fixed top navbar |
| Max content width | `1400px` | Page containers |
| Card border-radius | `20px` (`apple-card`) | Standard cards |
| Pill border-radius | `980px` (`apple-pill`) | Pill buttons / badges |
| Card padding | `24px` (p-6) | Standard card inner |
| Section gap (bento) | `24px` (gap-6) | Bento grid gap |
| Input min-height | `56px` mobile · `72px` desktop | Touch-friendly inputs |
| Button min-height | `44px–48px` | Touch target compliance |

### Breakpoints

```
xs: 480px
sm: 640px  (Tailwind default)
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

---

## 5. Component Patterns

### Glassmorphism Card (`.apple-glass` / `.glass-panel`)

```css
background: var(--card-bg);                     /* rgba(255,255,255,0.7) light */
backdrop-filter: blur(20px) saturate(180%);
-webkit-backdrop-filter: blur(20px) saturate(180%);
border: 1px solid rgba(255,255,255,0.1);         /* light: rgba(0,0,0,0.1) */
border-radius: 20px;
box-shadow: 0 4px 24px -1px rgba(0,0,0,0.5);
```

### Navigation Bar (`.apple-nav`)

```css
height: 48px;
background: var(--color-apple-bg);
backdrop-filter: saturate(1.8) blur(20px);
-webkit-backdrop-filter: saturate(1.8) blur(20px);
border-bottom: 1px solid var(--border-color);
position: fixed; top: 0; left: 0; right: 0; width: 100%;
z-index: 100;
padding: 0 20px;
```

### Primary Button (`.apple-button`)

```css
background: var(--color-apple-blue);            /* #0076DF */
color: white;
padding: 12px 32px;
border-radius: 9999px;                           /* full pill */
font-weight: 700;
font-size: 14px;
min-height: 48px;
transition: all 300ms;

/* Hover */
filter: brightness(1.1);
transform: translateY(-1px);

/* Active */
transform: scale(0.98);
```

### Secondary Button (`.apple-button-secondary`)

```css
background: rgba(255,255,255,0.1);
color: var(--text-primary);
border: 1px solid rgba(255,255,255,0.1);
padding: 8px 24px;
border-radius: 9999px;
min-height: 44px;
font-weight: 600;
font-size: 14px;

/* Hover */
background: rgba(255,255,255,0.15);
border-color: rgba(255,255,255,0.2);
```

### Compact Button (`.btn-primary`)

```css
/* Tailwind classes */
px-6 py-2.5
bg-gradient-to-br from-[#0076DF] to-blue-600
text-white rounded-xl font-bold text-[10px] uppercase tracking-widest
shadow-lg shadow-blue-500/30
hover:shadow-blue-500/50 hover:shadow-xl
transition-all active:scale-95
disabled:opacity-30
border border-blue-500/20 hover:border-blue-500/40
```

### Text Input (`.input-field`)

```css
width: 100%;
background: var(--input-bg);
border: 1px solid var(--border-color);
border-radius: 24px;
padding: 16px 64px 16px 24px;    /* right leaves room for action button */
font-size: 16px;
color: var(--color-apple-text);
min-height: 56px;  /* mobile: 72px desktop */
resize: none;      /* textarea */

/* Focus */
border-color: rgba(0,118,223,0.4);
ring: 2px rgba(0,118,223,0.2);
```

### Input Glow Effect (`.input-glow`)

```css
/* Resting */
box-shadow: 0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08);
transition: box-shadow 0.25s ease, border-color 0.25s ease;

/* Focus-within */
box-shadow:
  0 0 0 3px rgba(0,118,223,0.22),
  0 0 48px rgba(0,118,223,0.14),
  0 8px 32px rgba(0,0,0,0.14);

/* Light mode resting */
box-shadow: 0 2px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06);

/* Light mode focus */
box-shadow:
  0 0 0 3px rgba(0,118,223,0.20),
  0 0 40px rgba(0,118,223,0.10),
  0 8px 24px rgba(0,0,0,0.08);
```

### Message Bubbles

```css
/* Shared */
.message-bubble: px-4 py-3 (md: px-5 py-4), rounded-2xl, shadow-md, leading-relaxed

/* User (right) */
background: linear-gradient(to br, #0076DF, blue-600);
color: white;
border-top-right-radius: 4px;   /* rounded-tr-none */

/* Assistant (left) */
background: var(--color-apple-card) at 98% opacity;
backdrop-filter: blur;
border: 1px solid var(--border-color);
border-top-left-radius: 4px;    /* rounded-tl-none */
```

### Badge (`.metadata-badge`)

```css
padding: 4px 10px;
border-radius: 8px;
font-size: 10px;
font-weight: 700;
text-transform: uppercase;
letter-spacing: 0.1em;
border: 1px solid;

/* Success */
border: emerald-500/30; color: emerald-400; background: emerald-500/10;

/* Warning */
border: yellow-500/30; color: yellow-400; background: yellow-500/10;
```

### Left Accent Indicator (`.left-indicator`)

```css
position: relative;
overflow: hidden;

::before {
  content: "";
  width: 3px;
  background: var(--accent-blue);   /* #0076DF */
  position: absolute;
  left: 0; top: 0; bottom: 0;
  border-radius: 0 4px 4px 0;
}
```

---

## 6. Effects & Surfaces

### Glassmorphism Blur

```css
/* Nav level */
backdrop-filter: saturate(1.8) blur(20px);

/* Card level */
backdrop-filter: blur(20px) saturate(180%);

/* Sticky table header */
backdrop-filter: blur(14px) saturate(140%);
```

### Ambient Glow / Radial Background

```css
/* Page hero glow */
.absolute.top-0: width 600px, height 300px
background: rgba(0,118,223,0.10)   /* apple-blue/10 */
border-radius: 9999px;
filter: blur(120px);
pointer-events: none;

/* Login ambient blobs */
top-left:    40% × 40%, bg-blue-600/10, blur-[120px]
bottom-right: 40% × 40%, bg-indigo-600/10, blur-[120px]
```

### Text Gradient

```css
.text-gradient {
  background: linear-gradient(180deg, var(--color-apple-text) 0%, var(--color-apple-grey) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

### Pro Gradient (dark bg)

```css
background-image: linear-gradient(180deg, #1D1D1F 0%, #000000 100%);
```

### Scrollbar Styling

```css
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }

/* Hide scrollbar utility */
.no-scrollbar: -ms-overflow-style: none; scrollbar-width: none;
```

### Selection Highlight

```css
::selection {
  background: rgba(0,118,223,0.30);
  color: white;
}
```

---

## 7. Animation

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| Page enter | `500ms` | `[0.2, 0.8, 0.2, 1]` | Framer initial/animate |
| Login card | `500ms` | `[0.22, 1, 0.36, 1]` | scale 0.95→1 |
| Error message | `200ms` | default | opacity+y slide |
| Scroll reveal | `1000ms` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | `.reveal-on-scroll` |
| Float | `6s` | `ease-in-out infinite` | decorative float |
| Slow spin | `20s` | `linear infinite` | background decoration |
| Pulse slow | `10s` | `cubic-bezier(0.4,0,0.6,1) infinite` | soft pulse effect |
| Button hover lift | `translateY(-1px)` | `300ms` | `.apple-button` |
| Button press | `scale(0.98)` | `300ms` | `.apple-button` |
| Bento hover | `scale(1.01)` | `700ms` | `.bento-item` |
| Chat card | `300ms` | `cubic-bezier(0.2,0.8,0.2,1)` | `.chat-card` |

### Keyframes

```css
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

@keyframes reveal {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Bento Grid System

```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;   /* 24px */
}

.bento-item {
  /* apple-glass + */
  padding: 32px;
  display: flex; flex-direction: column; justify-content: space-between;
  transition: all 700ms;
  overflow: hidden;
}
.bento-item:hover { transform: scale(1.01); }

.bento-item-large { grid-column: span 2; grid-row: span 2; } /* md+ */
```

---

## 9. Pro Card (`.pro-card`)

```css
background: var(--color-apple-card);
border: 1px solid var(--border-color);
border-radius: 20px;
padding: 24px;
transition: all 500ms;
```

---

## 10. Tailwind Custom Tokens (tailwind.config.ts)

```ts
colors: {
  background:      "var(--background)",
  foreground:      "var(--foreground)",
  primary:         "#3b82f6",
  warning:         "var(--color-warning)",
  "apple-blue":    "var(--color-apple-blue)",    // → #0076DF
  "apple-silver":  "var(--color-apple-silver)",
  "apple-grey":    "var(--color-apple-grey)",
  "apple-bg":      "var(--color-apple-bg)",
  "apple-card":    "var(--color-apple-card)",
  "apple-text":    "var(--color-apple-text)",
  "theme-card":    "var(--card-bg)",
  "theme-border":  "var(--border-color)",
  "theme-input":   "var(--input-bg)",
  accent: {
    vibrant: "var(--color-apple-blue)",
    depth:   "var(--accent-depth)",
    glow:    "var(--color-apple-blue)",
  }
},
borderRadius: {
  "apple-pill": "980px",
  "apple-card": "20px",
},
backgroundImage: {
  "pro-gradient":   "linear-gradient(180deg, #1D1D1F 0%, #000000 100%)",
  "glass-gradient": "linear-gradient(110deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))",
},
animation: {
  "slow-spin":  "spin 20s linear infinite",
  "pulse-slow": "pulse 10s cubic-bezier(0.4,0,0.6,1) infinite",
}
```

---

## 11. Accessibility Patterns

| Pattern | Implementation |
|---------|---------------|
| Focus ring | `focus:ring-2 focus:ring-apple-blue/50 focus:ring-offset-2` |
| Reduced motion | Full `@media (prefers-reduced-motion)` override |
| Aria labels | `aria-label` on icon-only buttons (ThemeToggle) |
| Semantic inputs | `type="email"`, `type="password"` with `<label>` elements |
| Scroll behavior | `html { scroll-behavior: smooth; }` |
| Tabular nums | `font-variant-numeric: tabular-nums` for data tables |
| Placeholder | `opacity: 1` override to ensure consistent rendering |

---

## 12. Z-Index Scale

| Layer | Value | Element |
|-------|-------|---------|
| Base | `0` | Normal content |
| Sticky table | `20` | `.financial-grid-sticky-head` |
| Overlays | `40` | General overlays |
| Nav | `100` | `.apple-nav` (fixed header) |

---

## 13. State Classes

| Class | Effect |
|-------|--------|
| `.step-muted` | `opacity: 0.7; filter: grayscale(0.2)` — completed/inactive steps |
| `.step-final` | `border: 1px solid #0076DF; background: rgba(77,163,255,0.08)` — active/current step |
| `.chat-card` | `contain: layout; transition 300ms` — message cards |

---

## 14. How to Apply This in Another Project

### Step 1 — Copy CSS Variables

Paste both `:root` and `:root.light` blocks into your `globals.css`. The entire theme is driven by these ~20 CSS custom properties.

### Step 2 — Add Tailwind Tokens

Copy the `colors`, `borderRadius`, `backgroundImage`, and `animation` blocks from `tailwind.config.ts` into your project.

### Step 3 — Install Fonts

```ts
// layout.tsx
import { Geist, Geist_Mono } from 'next/font/google';
```
Or via CDN:
```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Step 4 — Copy Utility Classes

These classes are self-contained and portable:
- `.apple-glass` / `.glass-panel` — glassmorphism surface
- `.apple-nav` — sticky blurred nav bar
- `.apple-button` / `.apple-button-secondary` — pill buttons
- `.btn-primary` / `.btn-secondary` — compact CTA buttons
- `.input-field` + `.input-glow` — inputs with glow
- `.text-gradient` — fade text gradient
- `.pro-card` — standard card
- `.bento-grid` + `.bento-item` — grid layout
- `.metadata-badge-success` / `.metadata-badge-warning` — status pills
- `.left-indicator` — colored left border accent
- `.no-scrollbar` — hide scrollbar
- `.reveal-on-scroll` — scroll animation

### Step 5 — Theme Toggle Logic

```tsx
// Add class 'light' to <html> for light mode, remove for dark
document.documentElement.classList.toggle('light', isLight);
```

### Step 6 — Install Dependencies

```bash
npm install framer-motion lucide-react
```

---

## 15. Quick Reference: Light Theme Hex Values

| Purpose | Hex |
|---------|-----|
| Page background | `#F5F5F7` |
| Card / Panel | `#FFFFFF` |
| Primary text | `#1D1D1F` |
| Secondary / Muted | `#86868B` |
| Dividers / Border | `rgba(0,0,0,0.10)` |
| Accent / CTA | `#0076DF` |
| Warning | `#d97706` |
| Input fill | `rgba(0,0,0,0.04)` |
| Success text | `#34d399` (emerald-400) |
| Error text | `#f87171` (red-400) |
| Error bg | `rgba(239,68,68,0.10)` |
