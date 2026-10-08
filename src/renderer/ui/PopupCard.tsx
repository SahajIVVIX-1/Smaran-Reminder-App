import { forwardRef, type HTMLAttributes } from 'react';
import type { StyleFields } from '@shared/schema';
import { popupCardCss } from './popupCardCss';

export interface PopupCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'> {
  text: string;
  style: StyleFields;
  /** 0–1 multiplier for fades; the style's own opacity is applied on top. */
  visibility?: number;
  /** Opacity transition length in ms (fade in / fade out). */
  transitionMs?: number;
}

export const PopupCard = forwardRef<HTMLDivElement, PopupCardProps>(function PopupCard(
  { text, style, visibility = 1, transitionMs = 0, ...rest },
  ref,
) {
  return (
    <div ref={ref} style={popupCardCss(style, visibility, transitionMs)} {...rest}>
      {text}
    </div>
  );
});
