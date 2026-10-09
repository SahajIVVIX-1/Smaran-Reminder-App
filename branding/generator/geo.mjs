// Geometry for the Smaran symbol: a monoline geometric S plus a reminder dot.
const rad = (d) => (d * Math.PI) / 180;
const f = (n) => +n.toFixed(3);
/** S centreline: two bowls of radius r stacked on (cx, cy); top terminal at angle a0 (deg, y down). */
export function sPath(cx, cy, r, a0, a1 = a0) {
  const tx = cx + r * Math.cos(rad(a0)), ty = cy - r + r * Math.sin(rad(a0));
  const bx = cx + r * Math.cos(rad(a1 + 180)), by = cy + r + r * Math.sin(rad(a1 + 180));
  const big0 = a0 + 270 > 180 ? 1 : 0, big1 = a1 + 270 > 180 ? 1 : 0;
  return `M${f(tx)} ${f(ty)}A${f(r)} ${f(r)} 0 ${big0} 0 ${f(cx)} ${f(cy)}A${f(r)} ${f(r)} 0 ${big1} 1 ${f(bx)} ${f(by)}`;
}
export { f, rad };
