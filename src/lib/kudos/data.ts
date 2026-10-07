// 称賛メールのデータ：読み込んだExcelがあれば、その人の直近4週間の Kudos と推移を用意する
import { formatMinutes, formatNumber, formatSatisfaction } from "@/lib/report/format";
import type { CustomerComment, EmployeeReport, WeeklyReport } from "@/lib/report/types";

export const MAX_QUOTES = 3;
export const MAX_CANDIDATES = 10;

/** その人の、推移と同じ4週間の「良い」のコメント（新しい順・同じ文章は1つ） */
export function kudosCandidates(report: WeeklyReport, comments: CustomerComment[], employeeId: string): CustomerComment[] {
  const employee = report.employees.find((e) => e.employeeId === employeeId);
  if (!employee) return [];
  const first = employee.trend[0]?.weekStart ?? report.team.weekStart;
  const end = addDays(report.team.weekStart, 7);
  const seen = new Set<string>();
  return comments
    .filter((c) => c.employeeId === employeeId && c.rating === "良い" && c.date >= first && c.date < end)
    .sort((a, b) => b.date.localeCompare(a.date) || a.commentId.localeCompare(b.commentId))
    .filter((c) => (seen.has(c.text) ? false : (seen.add(c.text), true)))
    .slice(0, MAX_CANDIDATES);
}

/** 4週間の推移を、AIにそのまま渡せる文にする（AIには計算させない）。最新の週には「（今週）」を付ける */
export function trendLines(employee: EmployeeReport): string[] {
  const last = employee.trend.at(-1)?.weekNumber;
  return employee.trend.flatMap((p) =>
    p.metrics
      ? [
          `Week ${p.weekNumber}${p.weekNumber === last ? "（今週）" : ""}：CSAT ${formatSatisfaction(p.metrics.avgSatisfaction)}、Cases ${formatNumber(p.metrics.count)}件、AHT ${formatMinutes(p.metrics.avgMinutes)}`,
        ]
      : [],
  );
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
