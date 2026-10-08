import type { CSSProperties } from 'react';
import type { StyleFields } from '@shared/schema';

/** CSS for a popup card. Shared by the real popup and the settings preview so they always match. */
export function popupCardCss(style: StyleFields, visibility = 1, transitionMs = 0): CSSProperties {
  const fixed = style.size.mode === 'fixed';
  return {
    boxSizing: 'border-box',
    display: fixed ? 'flex' : 'inline-block',
    alignItems: 'center',
    justifyContent: 'center',
    width: fixed ? style.size.widthPx : undefined,
    height: fixed ? style.size.heightPx : undefined,
    maxWidth: fixed ? undefined : style.size.maxWidthPx,
    overflow: 'hidden',
    padding: style.paddingPx,
    fontFamily: `"${style.font.family}", "Segoe UI", sans-serif`,
    fontSize: style.font.sizePx,
    fontWeight: style.font.weight,
    fontStyle: style.font.italic ? 'italic' : 'normal',
    lineHeight: 1.3,
    color: style.colors.text,
    background: style.colors.background,
    border: `${style.border.widthPx}px solid ${style.colors.border}`,
    borderRadius: style.border.radiusPx,
    textAlign: 'center',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    opacity: style.opacity * visibility,
    transition: transitionMs > 0 ? `opacity ${transitionMs}ms ease` : undefined,
    userSelect: 'none',
  };
}
