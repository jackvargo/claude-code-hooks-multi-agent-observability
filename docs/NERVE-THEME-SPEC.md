# Nerve UI Theme Specification

> Vective-branded dark & light themes for OpenClaw's operational UI.
> Canonical source: [vectiveai.com/brand](https://vectiveai.com/brand/)

## Overview

Nerve is the operational UI for OpenClaw — mission control for agents, sessions, and system health. These themes align Nerve visually with the Vective brand system.

- **Nerve Dark** — Primary/default. Slate Deep backgrounds with Authority Cyan accents.
- **Nerve Light** — Alternative. White/Slate Wash surfaces with Authority Cyan accents.

Both themes inherit from the [Vective Design Tokens](https://vectiveai.com/brand/tokens/tokens.css).

---

## Color Palette

### Brand Colors (from Vective Brand Kit)

| Token | Hex | Usage |
|-------|-----|-------|
| Authority Cyan | `#0891B2` | CTAs, links, active nav, focus rings, functional UI |
| Brand Cyan | `#22D3EE` | Logo on dark, decorative, highlights, info states |
| Life Emerald | `#059669` | Success states, "on target" indicators only |
| Slate Deep | `#0F172A` | Dark backgrounds, headings on light |
| White | `#FFFFFF` | Light backgrounds, text on dark |

### Nerve Dark Theme

| CSS Variable | Value | Purpose |
|---|---|---|
| `--theme-primary` | `#0891B2` | Primary interactive color |
| `--theme-primary-hover` | `#0E7490` | Hover state |
| `--theme-primary-light` | `#164E63` | Subtle tint backgrounds |
| `--theme-primary-dark` | `#06B6D4` | Emphasized/lighter accent |
| `--theme-bg-primary` | `#0F172A` | Main background |
| `--theme-bg-secondary` | `#1E293B` | Cards, panels |
| `--theme-bg-tertiary` | `#334155` | Nested containers |
| `--theme-bg-quaternary` | `#475569` | Hover/active surfaces |
| `--theme-text-primary` | `#F1F5F9` | Primary text |
| `--theme-text-secondary` | `#CBD5E1` | Secondary text |
| `--theme-text-tertiary` | `#94A3B8` | Tertiary/muted text |
| `--theme-text-quaternary` | `#64748B` | Disabled/placeholder |
| `--theme-border-primary` | `#334155` | Card/section borders |
| `--theme-border-secondary` | `#475569` | Dividers |
| `--theme-border-tertiary` | `#64748B` | Active borders |
| `--theme-accent-success` | `#059669` | Life Emerald (brand) |
| `--theme-accent-warning` | `#D97706` | Warning states |
| `--theme-accent-error` | `#DC2626` | Error states |
| `--theme-accent-info` | `#22D3EE` | Info/highlight (Brand Cyan) |
| `--theme-focus-ring` | `#22D3EE` | Focus indicators |

### Nerve Light Theme

| CSS Variable | Value | Purpose |
|---|---|---|
| `--theme-primary` | `#0891B2` | Primary interactive color |
| `--theme-primary-hover` | `#0E7490` | Hover state |
| `--theme-primary-light` | `#CFFAFE` | Light tint backgrounds |
| `--theme-primary-dark` | `#155E75` | Deep accent |
| `--theme-bg-primary` | `#FFFFFF` | Main background |
| `--theme-bg-secondary` | `#F8FAFC` | Slate Wash panels |
| `--theme-bg-tertiary` | `#F1F5F9` | Cool Panel containers |
| `--theme-bg-quaternary` | `#E2E8F0` | Hover/active surfaces |
| `--theme-text-primary` | `#0F172A` | Slate Deep headings |
| `--theme-text-secondary` | `#334155` | Body text |
| `--theme-text-tertiary` | `#64748B` | Slate Mid descriptions |
| `--theme-text-quaternary` | `#94A3B8` | Placeholder/disabled |
| `--theme-border-primary` | `#E2E8F0` | Steel Border |
| `--theme-border-secondary` | `#CBD5E1` | Dividers |
| `--theme-border-tertiary` | `#94A3B8` | Active borders |
| `--theme-accent-success` | `#059669` | Life Emerald |
| `--theme-accent-warning` | `#D97706` | Warning |
| `--theme-accent-error` | `#DC2626` | Error |
| `--theme-accent-info` | `#0891B2` | Info (Authority Cyan) |
| `--theme-focus-ring` | `#0891B2` | Focus indicators |

---

## Typography

Follows [Vective brand typography](https://vectiveai.com/brand/#typography):

| Role | Family | Weights | Usage |
|------|--------|---------|-------|
| Display | Space Grotesk | 600, 700 | Page headings, section titles |
| Body | Inter | 400, 500, 600, 700 | UI text, labels, paragraphs |
| Data/Code | JetBrains Mono | 400, 500 | Metrics, logs, code blocks, agent output |

Google Fonts import:
```
https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap
```

---

## Logo, Mark & Favicon

### Nerve Mark
The Nerve mark extends the Vective canon mark (Sacred V + breached hex) with an outer dashed signal ring, symbolizing operational monitoring and agent pulse.

| Asset | Path | Usage |
|-------|------|-------|
| Nerve Mark (cyan) | `/brand/nerve-mark.svg` | Dark backgrounds, default |
| Nerve Mark (dark) | `/brand/nerve-mark-dark.svg` | Light backgrounds |
| Favicon (SVG) | `/brand/nerve-favicon.svg` | Browser tab icon |
| Apple Touch Icon | `/brand/nerve-apple-touch-icon.svg` | iOS/macOS bookmarks |

### Sacred V Geometry (immutable)
```
d="M 100 108 L 256 392 L 412 108"
stroke-width="48"
stroke-linecap="butt"
stroke-linejoin="miter"
stroke-miterlimit="10"
```

### Favicon Design
- 32px+: V on Slate Deep rounded rectangle
- Uses Brand Cyan (`#22D3EE`) for the V stroke
- Slate Deep (`#0F172A`) background with `rx="6"` border radius
- `<meta name="theme-color" content="#0F172A">` in HTML

---

## Icon Set Recommendation

**Lucide Icons** — MIT-licensed, consistent 24px stroke-based icons that complement Space Grotesk and the Vective visual language. Already Vue-compatible via `lucide-vue-next`.

Key icons for Nerve:
- `Activity` — agent pulse/health
- `Terminal` — sessions
- `Shield` — security status
- `Cpu` — system resources
- `Zap` — events/triggers
- `Eye` — observability
- `GitBranch` — agent trees

---

## CSS Architecture

### File Structure
```
src/styles/
  themes.css          — All theme definitions (Nerve + legacy)
  main.css            — Tailwind directives

public/brand/
  nerve-mark.svg      — Cyan mark for dark backgrounds
  nerve-mark-dark.svg — Dark mark for light backgrounds
  nerve-favicon.svg   — Favicon
  nerve-apple-touch-icon.svg — Apple touch icon
```

### Theme Application
Themes are applied via CSS class on `<html>`:
- `.theme-nerve-dark` + `.dark` (for Tailwind dark: variants)
- `.theme-nerve-light`

### Custom Extensions
Nerve themes expose additional CSS variables beyond the standard theme system:
```css
--nerve-brand-cyan: #22D3EE;
--nerve-authority-cyan: #0891B2;
--nerve-life-emerald: #059669;
--nerve-glow: rgba(34, 211, 238, 0.15);  /* Cyan glow for active states */
--nerve-header-gradient-from: ...;
--nerve-header-gradient-to: ...;
```

---

## Accessibility

### Contrast Ratios (WCAG 2.1 AA)

**Nerve Dark:**
| Pair | Ratio | Pass |
|------|-------|------|
| Text Primary (#F1F5F9) on BG Primary (#0F172A) | 15.3:1 | ✅ AAA |
| Text Secondary (#CBD5E1) on BG Primary (#0F172A) | 11.1:1 | ✅ AAA |
| Text Tertiary (#94A3B8) on BG Primary (#0F172A) | 6.0:1 | ✅ AA |
| Authority Cyan (#0891B2) on BG Primary (#0F172A) | 4.6:1 | ✅ AA |
| Brand Cyan (#22D3EE) on BG Primary (#0F172A) | 8.5:1 | ✅ AAA |

**Nerve Light:**
| Pair | Ratio | Pass |
|------|-------|------|
| Text Primary (#0F172A) on BG Primary (#FFFFFF) | 15.3:1 | ✅ AAA |
| Text Secondary (#334155) on BG Primary (#FFFFFF) | 10.1:1 | ✅ AAA |
| Text Tertiary (#64748B) on BG Primary (#FFFFFF) | 4.6:1 | ✅ AA |
| Authority Cyan (#0891B2) on BG Primary (#FFFFFF) | 4.0:1 | ✅ AA (large text) |

---

## Implementation Notes

1. **Default theme** changed from `light` to `nerve-dark` in useThemes composable
2. **System preference** detection maps to `nerve-dark`/`nerve-light` instead of generic themes
3. **Tailwind dark:** variants work via `.dark` class added alongside `.theme-nerve-dark`
4. **Legacy themes** preserved — all 9 original themes remain available in theme manager
5. **Google Fonts** loaded via `<link>` in index.html (not CSS @import) for performance
