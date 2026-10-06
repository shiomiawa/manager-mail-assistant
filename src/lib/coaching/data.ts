// コーチング用のデータを、週次レポートと同じ集計から作る（ブラウザ側で計算してサーバーに送る）
import { formatWeekRange } from "@/lib/report/format";
import type { CustomerComment, WeeklyReport } from "@/lib/report/types";
import type { CoachingInput } from "./types";

const MAX_POSITIVES = 4;
const MAX_NEGATIVES = 6;

/**
 * 1人分のコーチング用データ。期間は週次レポートの推移と同じ4週間。
 * 引用するコメントは、評価軸ごとに新しい順で、偏らないように選ぶ
 */
export function buildCoachingInput(
  report: WeeklyReport,
  comments: CustomerComment[],
  employeeId: string,
  memo: string,
): CoachingInput | null {
  const employee = report.employees.find((e) => e.employeeId === employeeId);
  if (!employee) return null;
  const trend = employee.trend;
  const first = trend[0]?.weekStart ?? report.team.weekStart;
  const last = report.team.weekStart;
  const end = addDays(last, 7);
  const own = comments.filter((c) => c.employeeId === employeeId && c.date >= first && c.date < end);

  const axes = [...new Set(own.map((c) => c.axis))];
  const count = (axis: string, rating: CustomerComment["rating"]) =>
    own.filter((c) => c.axis === axis && c.rating === rating).length;
  const byAxis = axes
    .map((axis) => ({ axis, positive: count(axis, "良い"), neutral: count(axis, "普通"), negative: count(axis, "悪い") }))
    .sort((a, b) => b.negative - a.negative || b.positive - a.positive || a.axis.localeCompare(b.axis));

  return {
    employeeId,
    tenureMonths: employee.tenureMonths,
    weekLabel: `Week ${trend[0]?.weekNumber ?? report.team.weekNumber}〜${report.team.weekNumber}（${formatWeekRange(first).slice(0, 10)}〜${formatWeekRange(last).slice(11)}）`,
    csatTarget: employee.achievement.avgSatisfaction.target,
    weeks: trend.map((p) => ({
      weekNumber: p.weekNumber,
      csat: p.metrics?.avgSatisfaction ?? null,
      cases: p.metrics?.count ?? null,
      aht: p.metrics?.avgMinutes ?? null,
    })),
    totals: {
      total: own.length,
      positive: own.filter((c) => c.rating === "良い").length,
      neutral: own.filter((c) => c.rating === "普通").length,
      negative: own.filter((c) => c.rating === "悪い").length,
    },
    byAxis,
    positives: spread(own.filter((c) => c.rating === "良い"), MAX_POSITIVES),
    negatives: spread(own.filter((c) => c.rating === "悪い"), MAX_NEGATIVES),
    memo: memo.trim(),
  };
}

/** 評価軸ごとに新しい順に並べ、軸を順番に回しながら選ぶ（同じ文章は1回だけ） */
function spread(list: CustomerComment[], limit: number): CustomerComment[] {
  const groups = new Map<string, CustomerComment[]>();
  for (const c of [...list].sort((a, b) => b.date.localeCompare(a.date) || a.commentId.localeCompare(b.commentId))) {
    groups.set(c.axis, [...(groups.get(c.axis) ?? []), c]);
  }
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const picked: CustomerComment[] = [];
  for (let round = 0; picked.length < limit; round++) {
    let added = false;
    for (const [, items] of ordered) {
      const c = items[round];
      if (!c || picked.length >= limit) continue;
      added = true;
      if (!picked.some((p) => p.text === c.text)) picked.push(c);
    }
    if (!added) break;
  }
  return picked;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
