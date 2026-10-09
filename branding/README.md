# Smaran brand kit

The symbol is a geometric, single-stroke **S** with a **reminder dot** at its top right, like a
notification badge. It is drawn from two circles of the same radius and one round-capped stroke, so
it stays legible down to 16 × 16 px.

![Preview](previews/preview-sheet.png)

## Colours

| Role | Hex | Use |
| --- | --- | --- |
| Accent | `#C96442` | The reminder dot, the app-icon tile, links and primary buttons |
| Ink | `#1F1E1D` | The mark and text on light backgrounds |
| Paper | `#F5F4EF` | The mark and text on dark backgrounds |
| Tray, light taskbar | `#1A1A1A` | Monochrome tray glyph |
| Tray, dark taskbar | `#FFFFFF` | Monochrome tray glyph |

The accent has a contrast of 3.9:1 on `#FFFFFF` and 4.2:1 on `#1F1F1F`. That passes WCAG AA for
graphics and large text (3:1) on both. No single colour can reach 4.5:1 on both of those
backgrounds (the best possible is about 4.06:1), so don't use the accent for small body text. Use
Ink or Paper for that.

## Files

| Folder | What |
| --- | --- |
| `svg/` | Editable sources. `symbol-light/dark`, `symbol-adaptive` (switches with `prefers-color-scheme`), `symbol-currentcolor` (takes the CSS text colour), horizontal and stacked lockups (light, dark, adaptive), `app-icon.svg` (1024) and the hand-tuned small app icons `app-icon-16…48.svg` |
| `logo/` | PNG exports: symbol at 64–512 px, horizontal and stacked lockups, light and dark |
| `tray/` | `tray-light.ico` (dark glyph, for a light taskbar) and `tray-dark.ico` (white glyph, for a dark taskbar), each with 16, 20, 24, 32 and 48 px. `png/` and `svg/` hold every size, including 40 px |
| `app-icon/` | `app-icon.ico` (16, 20, 24, 32, 40, 48, 64, 128, 256 px), `app-icon-1024.png` and the PNG sizes |
| `previews/` | The preview sheet: lockups, both Windows 11 taskbars, every tray size and the app icon |
| `generator/` | The scripts that draw everything. Run `node build.mjs`, then `npx electron render.cjs jobs.json` |

"Light" means the version for light backgrounds (dark mark). "Dark" means the version for dark
backgrounds (light mark). The geometry is the same in both. Only the colour of the S changes; the
dot stays accent in the full-colour mark.

## Pixel tuning

The tray icon and the small app icons are not just scaled down. Each size (16, 20, 24, 32, 40, 48)
has its own stroke width and bowl radius chosen so that the S's outer edges land on whole pixels,
with at least 1 px between the S and the dot. The stroke is 2 px at 16, 3 px at 20 and 24, then 4, 5
and 6 px.

The `.ico` files store sizes below 256 as 32-bit bitmaps with alpha, the classic format every
Windows tool reads. The 256 px size is stored as PNG, as Windows expects.

## Wordmark

"Smaran" is drawn as SVG paths with the same round, single-weight stroke as the symbol. That way it
needs no font and looks the same everywhere. To set "Smaran" as live text, use **Nunito** (Google
Fonts, SemiBold or Bold). It is the closest free typeface to the drawn letters.

## Clear space and minimum size

- **Clear space:** keep space equal to the dot's diameter clear on every side of the symbol or
  lockup.
- **Minimum size:** symbol 16 px (use the tuned tray or app-icon files below 48 px); horizontal
  lockup 96 px wide; stacked lockup 64 px wide.
- Don't recolour the S in the accent. Don't stretch the mark, outline it or add effects.
