export function formatPoints(points: number): string {
  return `${points} ${points === 1 ? "point" : "points"}`;
}
