import { describe, expect, it } from 'vitest';
import { IPC } from '@shared/ipc';

describe('IPC channel names', () => {
  it('are unique', () => {
    const names = Object.values(IPC);
    expect(new Set(names).size).toBe(names.length);
  });
});
