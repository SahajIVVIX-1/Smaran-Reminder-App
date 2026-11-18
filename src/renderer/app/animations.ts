import { useReducedMotion, type Transition, type Variants } from 'motion/react';

/**
 * Smaran Fluid Animation System
 *
 * Timings:
 * - Button interactions: 120–180ms
 * - Dropdowns and modals: 180–250ms
 * - Page transitions: 200–300ms
 * - Layout transitions: 250–350ms
 *
 * Easings:
 * - Spring-damped smooth deceleration: [0.16, 1, 0.3, 1]
 * - Standard ease-in-out: [0.4, 0, 0.2, 1]
 */

export const EASING = {
  spring: [0.16, 1, 0.3, 1] as const,
  smooth: [0.2, 0.8, 0.2, 1] as const,
  easeInOut: [0.4, 0, 0.2, 1] as const,
  easeOut: [0, 0, 0.2, 1] as const,
  easeIn: [0.4, 0, 1, 1] as const,
};

export const TIMING = {
  button: 0.14,
  dropdown: 0.18,
  modal: 0.22,
  page: 0.24,
  layout: 0.28,
};

/** Smooth page transitions without layout shifts */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 7 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: TIMING.page,
      ease: EASING.spring,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: 0.16,
      ease: EASING.easeIn,
    },
  },
};

/** Tab panel fluid entrance without abrupt content jump */
export const tabVariants: Variants = {
  initial: { opacity: 0, y: 5 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: EASING.spring,
    },
  },
  exit: {
    opacity: 0,
    y: -3,
    transition: {
      duration: 0.14,
      ease: EASING.easeIn,
    },
  },
};

/** Modal dialog entrance and exit */
export const modalOverlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: TIMING.modal, ease: EASING.smooth },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.16, ease: EASING.easeIn },
  },
};

export const modalCardVariants: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 10 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: TIMING.modal,
      ease: EASING.spring,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 6,
    transition: {
      duration: 0.16,
      ease: EASING.easeIn,
    },
  },
};

/** Popover dropdown animation */
export const popoverVariants: Variants = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: TIMING.dropdown,
      ease: EASING.spring,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -2,
    transition: {
      duration: 0.14,
      ease: EASING.easeIn,
    },
  },
};

/** Card layout animation config */
export const cardLayoutTransition: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

/** Standard button tap feedback */
export const buttonTap = { scale: 0.97 };
export const iconButtonTap = { scale: 0.92 };

/** Hook to get accessible animation settings respecting prefers-reduced-motion */
export function useFluidAnimation() {
  const reducedMotion = useReducedMotion();

  return {
    isReduced: !!reducedMotion,
    pageVariants: reducedMotion
      ? {
          initial: { opacity: 1, y: 0 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 1, y: 0 },
        }
      : pageVariants,
    tabVariants: reducedMotion
      ? {
          initial: { opacity: 1, y: 0 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 1, y: 0 },
        }
      : tabVariants,
  };
}
