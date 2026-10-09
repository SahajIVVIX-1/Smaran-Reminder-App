# Smaran brand kit

The mark is **the bloom**: six rounded petals, each its own colour, turning around a shared centre
where they overlap. It suggests a reminder going round the clock and something worth remembering
coming into flower. It needs no tile or background and stays recognisable at 16 × 16 px.

![Preview](previews/preview-sheet.png)

## Colours

| Petal | Light backgrounds | Dark backgrounds |
| --- | --- | --- |
| Clay | `#D97757` | `#E8876A` |
| Amber | `#F2A93B` | `#F6B955` |
| Green | `#3FA27A` | `#4FB98C` |
| Blue | `#3E7FD8` | `#5A95E6` |
| Violet | `#8A63D2` | `#9B78E0` |
| Rose | `#D9608C` | `#E5739C` |

Petals are 86% opaque (93% on dark backgrounds), so the colours mix where they overlap. There are
no gradients or shadows.

| Role | Hex | Use |
| --- | --- | --- |
| UI accent | `#C96442` | Buttons, links and highlights in the app. It has 3.9:1 contrast on white and 4.2:1 on `#1F1F1F`, which passes WCAG AA for graphics and large text on both |
| Ink | `#1F1E1D` | The wordmark and text on light backgrounds |
| Paper | `#F5F4EF` | The wordmark and text on dark backgrounds |

## Files

| Folder | What |
| --- | --- |
| `svg/` | Editable sources: `symbol-light/dark`, `symbol-adaptive` (switches with `prefers-color-scheme`), horizontal and stacked lockups (light, dark, adaptive), `app-icon.svg` and the small app-icon sizes |
| `logo/` | PNG exports: the symbol at 64–512 px, and the lockups, light and dark |
| `tray/` | `tray-light.ico` (for a light taskbar) and `tray-dark.ico` (brighter petals for a dark taskbar), each with 16, 20, 24, 32 and 48 px. `png/` and `svg/` hold every size, including 40 px |
| `app-icon/` | `app-icon.ico` (16 to 256 px), `app-icon-1024.png` and the PNG sizes |
| `previews/` | The preview sheet |
| `generator/` | The scripts that draw everything (see the top of `build.mjs`) |

At 32 px and below the petals are a little fuller and more opaque, so the colours stay clear.

## Wordmark

"Smaran" is set in **Source Serif 4 SemiBold** (free, SIL Open Font License), which Smaran already
bundles. The lockup SVGs embed the font, so they render the same everywhere. To edit them in a
design tool, install Source Serif 4 from Google Fonts.

## Clear space and minimum size

- **Clear space:** keep a quarter of the bloom's width clear on every side.
- **Minimum size:** the bloom at 16 px; the horizontal lockup at 120 px wide; the stacked lockup at
  72 px wide.
- Keep the petal order and colours. Don't recolour the wordmark in the petal colours, and don't
  put the bloom on a busy photo.
