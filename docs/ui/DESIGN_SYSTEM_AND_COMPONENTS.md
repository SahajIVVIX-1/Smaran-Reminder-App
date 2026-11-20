# UI Design System, Obsidian Theme & Components

## 1. Design Philosophy

Smaran's visual interface is built upon a dark, elevated **Obsidian Atmosphere** inspired by modern technical desktop tools and physical tactile interfaces:
- **Depth without Distraction:** Dark background hues (`#0d0d11`, `#16161f`) layered with subtle border lines (`rgba(255, 255, 255, 0.08)`) and soft radial lighting.
- **Warm Terracotta Accent:** The signature Smaran accent (`#e06c43`) is used deliberately for primary actions, active indicator dots, focus states, and key badges.
- **Typography:** Refined serif and sans fonts (`Anthropic Serif`, `Inter`, `JetBrains Mono`) optimized for micro-legibility at 11-14px.

---

## 2. Color Palette & Design Tokens

| Token | CSS Value | Usage |
|---|---|---|
| `--bg-base` | `#0d0d11` | Application window background |
| `--bg-surface` | `#16161f` | Cards, panels, sidebars, modal surfaces |
| `--bg-surface-elevated`| `#1c1c26` | Hovered cards, inputs, secondary buttons |
| `--bg-accent` | `#e06c43` | Primary action buttons, active tab indicators, glowing dots |
| `--text-ink` | `#f5f4ef` | High-contrast primary headings and data values |
| `--text-muted` | `#9ca3af` | Secondary labels, descriptions, and timestamps |
| `--text-faint` | `#6b7280` | Tertiary placeholders and disabled states |
| `--border-subtle` | `rgba(255, 255, 255, 0.08)`| Standard container borders and dividers |
| `--border-accent` | `rgba(224, 108, 67, 0.45)` | Focused inputs and highlighted cards |
| `--status-success` | `#34d399` | Server running, valid license, completed reminder |
| `--status-warning` | `#fbbf24` | Overdue reminder, port conflict, delayed notification |
| `--status-error` | `#f87171` | Failed login attempt, invalid license, automation error |

---

## 3. UI Component Specifications

### Buttons
- **Primary Action (`.btn-primary`):** Gradient `linear-gradient(135deg, #e06c43 0%, #c8532a 100%)`, white text (`#ffffff`), 8px border-radius, subtle shadow `0 2px 8px rgba(224, 108, 67, 0.25)`.
- **Secondary Action (`.btn-secondary`):** Dark surface `#1c1c25`, border `1px solid rgba(255, 255, 255, 0.12)`, text `#f5f4ef`, hover border `rgba(224, 108, 67, 0.45)`.
- **Danger Action (`.btn-danger`):** Soft red background `rgba(239, 68, 68, 0.1)`, red text `#fca5a5`, border `rgba(239, 68, 68, 0.25)`.

### Modals & Dialogs
- Rendered with an animated blur backdrop (`backdrop-filter: blur(14px)`).
- Centered layout, max-height `calc(100vh - 4rem)` with smooth custom scrollbars.
- Close button positioned at top-right with rounded hover feedback.
- Escape key dismisses modals automatically via keyboard listeners.

### Toggles & Sliders
- Custom animated switch with smooth spring physics (`motion/react`).
- Numeric range sliders with real-time value badges for fine-tuning card width, border thickness, and brightness.
