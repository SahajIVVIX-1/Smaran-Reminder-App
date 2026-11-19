// Startup timing instrumentation and diagnostic logger
const startTime = Date.now();
const milestones: Array<{ name: string; timestamp: number; deltaMs: number }> = [
  { name: 'process_init', timestamp: startTime, deltaMs: 0 },
];

export function recordMilestone(name: string): void {
  const now = Date.now();
  const last = milestones[milestones.length - 1];
  milestones.push({
    name,
    timestamp: now,
    deltaMs: now - (last ? last.timestamp : startTime),
  });
}

export function getStartupSummary(): { totalMs: number; milestones: typeof milestones } {
  const totalMs = Date.now() - startTime;
  return {
    totalMs,
    milestones: [...milestones],
  };
}

export function logStartupSummary(): void {
  const total = Date.now() - startTime;
  console.log(`[Startup Diagnostics] Total elapsed: ${total}ms`);
  for (const m of milestones) {
    console.log(`  - ${m.name}: +${m.deltaMs}ms (at ${m.timestamp - startTime}ms)`);
  }
}
