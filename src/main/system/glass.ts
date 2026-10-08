import { release } from 'node:os';

/**
 * Windows 11 22H2 (build 22621) and later can draw an acrylic backdrop behind a window.
 * Older Windows gets the same design with solid colours.
 */
export function supportsGlass(
  platform: string = process.platform,
  osRelease: string = release(),
): boolean {
  if (platform !== 'win32') return false;
  const build = Number(osRelease.split('.')[2]);
  return Number.isFinite(build) && build >= 22621;
}
