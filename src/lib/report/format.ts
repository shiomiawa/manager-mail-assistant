// 数字・日付の表示（画面とメールで同じ書き方にする）

export const formatCount = (value: number) => `${Math.round(value).toLocaleString("ja-JP")}件`;
export const formatMinutes = (value: number) => `${value.toFixed(1)}分`;
export const formatSatisfaction = (value: number) => value.toFixed(2);
export const formatScore = (value: number) => value.toFixed(1);

/** 差の表示（例：+0.05、−63件）。0 は ±0 */
export function formatDiff(value: number, digits: number, unit = ""): string {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return `±0${unit}`;
  const sign = rounded > 0 ? "+" : "−";
  return `${sign}${Math.abs(rounded).toLocaleString("ja-JP", { minimumFractionDigits: digits, maximumFractionDigits: digits })}${unit}`;
}

/** 2026-09-28 → 2026/09/28 */
export const formatDate = (iso: string) => iso.replaceAll("-", "/");

/** 週の期間（例：2026/09/28〜10/02） */
export function formatWeekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start.getTime() + 4 * 24 * 60 * 60 * 1000);
  const mm = String(end.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(end.getUTCDate()).padStart(2, "0");
  return `${formatDate(weekStart)}〜${mm}/${dd}`;
}
