// 週次パフォーマンスの集計（数字はすべてここで計算し、AIには計算させない）
import type {
  Achievement,
  CustomerComment,
  EmployeeReport,
  PerformanceRow,
  Scores,
  Targets,
  TeamReport,
  VoiceSummary,
  WeekMetrics,
  WeekPoint,
  WeeklyReport,
} from "./types";

/** 推移に出す週の数（今週を含む） */
export const TREND_WEEKS = 4;
/** 1週間の基準の営業日数（目標を出勤日数で按分するときに使う） */
const STANDARD_WORK_DAYS = 5;
/** メールに載せるお客様の声の数 */
const KUDOS_PER_EMPLOYEE = 2;
const IMPROVEMENTS_PER_EMPLOYEE = 2;
const KUDOS_FOR_TEAM = 3;
/** 表示する桁数（平均対応時間は小数1桁、満足度は小数2桁） */
const MINUTES_DIGITS = 1;
const SATISFACTION_DIGITS = 2;

/**
 * 週次レポートを作る。
 * @param weekStart 対象の週（省略するとデータの最新の週）
 * @param comments お客様のコメント（なければ空）
 */
export function buildWeeklyReport(
  rows: PerformanceRow[],
  targets: Targets,
  weekStart?: string,
  comments: CustomerComment[] = [],
): WeeklyReport {
  const weeks = listWeeks(rows);
  const current = weekStart ?? weeks.at(-1)?.weekStart;
  const currentIndex = weeks.findIndex((week) => week.weekStart === current);
  if (currentIndex === -1) throw new Error(`指定した週のデータがありません：${current}`);
  const trendWeeks = weeks.slice(Math.max(0, currentIndex - TREND_WEEKS + 1), currentIndex + 1);
  const thisWeek = weeks[currentIndex];
  const lastWeek = currentIndex > 0 ? weeks[currentIndex - 1] : null;

  const weekRows = rows.filter((row) => row.weekStart === thisWeek.weekStart);
  // その週にチームとして稼働した日数（祝日などで5日に満たない週は、目標を按分する）
  const teamWorkDays = countDays(weekRows);

  const weekComments = comments.filter((c) => isInWeek(c.date, thisWeek.weekStart));

  const team = buildTeamReport(rows, weekRows, thisWeek, lastWeek, trendWeeks, targets, teamWorkDays);
  team.voice = summarizeVoice(weekComments, { kudos: KUDOS_FOR_TEAM, improvements: 0, distinctEmployees: true });
  const employees = buildEmployeeReports(rows, weekRows, lastWeek, trendWeeks, targets, weekComments);
  return { team, employees };
}

export type WeekInfo = { weekStart: string; weekNumber: number };

/** データに含まれる週（古い順） */
export function listWeeks(rows: PerformanceRow[]): WeekInfo[] {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.weekStart, row.weekNumber);
  return [...map.entries()]
    .map(([weekStart, weekNumber]) => ({ weekStart, weekNumber }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/** 行をまとめて1週間分の数字にする。平均は件数で重みづけする */
export function summarize(rows: PerformanceRow[]): WeekMetrics {
  const count = sum(rows, (row) => row.count);
  return {
    count,
    avgMinutes: count === 0 ? 0 : sum(rows, (row) => row.avgMinutes * row.count) / count,
    avgSatisfaction: count === 0 ? 0 : sum(rows, (row) => row.avgSatisfaction * row.count) / count,
    workDays: countDays(rows),
  };
}

function buildTeamReport(
  rows: PerformanceRow[],
  weekRows: PerformanceRow[],
  thisWeek: WeekInfo,
  lastWeek: WeekInfo | null,
  trendWeeks: WeekInfo[],
  targets: Targets,
  teamWorkDays: number,
): TeamReport {
  const metrics = summarize(weekRows);
  const lastWeekRows = lastWeek ? rows.filter((row) => row.weekStart === lastWeek.weekStart) : [];
  const byChannel: Record<string, WeekMetrics> = {};
  for (const channel of unique(weekRows.map((row) => row.channel))) {
    byChannel[channel] = summarize(weekRows.filter((row) => row.channel === channel));
  }

  return {
    weekStart: thisWeek.weekStart,
    weekNumber: thisWeek.weekNumber,
    headcount: unique(weekRows.map((row) => row.employeeId)).length,
    thisWeek: metrics,
    byChannel,
    achievement: {
      weeklyCount: higherIsBetter(
        metrics.count,
        targets.team.weeklyCount * (teamWorkDays / STANDARD_WORK_DAYS),
      ),
      avgMinutes: lowerIsBetter(metrics.avgMinutes, targets.team.avgMinutes, MINUTES_DIGITS),
      avgSatisfaction: higherIsBetter(metrics.avgSatisfaction, targets.team.avgSatisfaction, SATISFACTION_DIGITS),
    },
    trend: trendWeeks.map((week) => toWeekPoint(week, rows.filter((row) => row.weekStart === week.weekStart))),
    changeFromLastWeek: lastWeekRows.length > 0 ? change(metrics, summarize(lastWeekRows)) : null,
    voice: summarizeVoice([], { kudos: 0, improvements: 0 }), // 呼び出し元で入れる
  };
}

function buildEmployeeReports(
  rows: PerformanceRow[],
  weekRows: PerformanceRow[],
  lastWeek: WeekInfo | null,
  trendWeeks: WeekInfo[],
  targets: Targets,
  weekComments: CustomerComment[],
): EmployeeReport[] {
  const employeeIds = unique(weekRows.map((row) => row.employeeId));
  const scores = calculateScores(weekRows, targets.scoreWeights);

  const reports = employeeIds.map((employeeId): EmployeeReport => {
    const own = weekRows.filter((row) => row.employeeId === employeeId);
    const metrics = summarize(own);
    const ownAll = rows.filter((row) => row.employeeId === employeeId);
    const lastWeekRows = lastWeek ? ownAll.filter((row) => row.weekStart === lastWeek.weekStart) : [];
    const trend = trendWeeks.map((week) =>
      toWeekPoint(week, ownAll.filter((row) => row.weekStart === week.weekStart)),
    );

    return {
      employeeId,
      tenureMonths: latestTenure(own),
      channels: unique(own.map((row) => row.channel)),
      thisWeek: metrics,
      scores: scores.get(employeeId)!,
      rank: { total: 0, quality: 0, efficiency: 0 }, // 下でまとめて付ける
      achievement: {
        // 休みや時短で出勤日数が少ない人を不当に低く評価しないよう、件数の目標は出勤日数で按分する
        weeklyCount: higherIsBetter(
          metrics.count,
          targets.individual.weeklyCount * (metrics.workDays / STANDARD_WORK_DAYS),
        ),
        avgMinutes: lowerIsBetter(metrics.avgMinutes, targets.individual.avgMinutes, MINUTES_DIGITS),
        avgSatisfaction: higherIsBetter(
          metrics.avgSatisfaction,
          targets.individual.avgSatisfaction,
          SATISFACTION_DIGITS,
        ),
      },
      trend,
      changeFromLastWeek: lastWeekRows.length > 0 ? change(metrics, summarize(lastWeekRows)) : null,
      weeksWithData: trend.filter((point) => point.metrics !== null).length,
      voice: summarizeVoice(
        weekComments.filter((c) => c.employeeId === employeeId),
        { kudos: KUDOS_PER_EMPLOYEE, improvements: IMPROVEMENTS_PER_EMPLOYEE },
      ),
    };
  });

  const totalRanks = rankBy(reports, (report) => report.scores.total);
  const qualityRanks = rankBy(reports, (report) => report.scores.quality);
  const efficiencyRanks = rankBy(reports, (report) => report.scores.efficiency);
  for (const report of reports) {
    report.rank = {
      total: totalRanks.get(report.employeeId)!,
      quality: qualityRanks.get(report.employeeId)!,
      efficiency: efficiencyRanks.get(report.employeeId)!,
    };
  }
  return reports.sort(
    (a, b) => a.rank.total - b.rank.total || a.employeeId.localeCompare(b.employeeId),
  );
}

/**
 * スコアを計算する（その週のチーム内での相対評価、0〜100）。
 *
 * チャンネルによって1件の重さが違う（チャットは短く多い、メールは長く少ない）ため、
 * 対応件数と対応時間は「チャンネルごとのチーム平均時間」を物差しにしてから比べる。
 * - 対応件数：件数 × そのチャンネルのチーム平均時間 を、出勤1日あたりにしたもの（処理量）
 * - 対応時間：チーム平均どおりなら掛かるはずの時間 ÷ 実際の時間（1より大きいほど速い）
 * - 満足度：件数で重みづけした平均
 * それぞれを、その週のチームの最小＝0・最大＝100 にそろえてから重みを掛ける。
 */
export function calculateScores(
  weekRows: PerformanceRow[],
  weights: Targets["scoreWeights"],
): Map<string, Scores> {
  const channelMinutes = new Map<string, number>();
  for (const channel of unique(weekRows.map((row) => row.channel))) {
    channelMinutes.set(channel, summarize(weekRows.filter((row) => row.channel === channel)).avgMinutes);
  }

  const raw = unique(weekRows.map((row) => row.employeeId)).map((employeeId) => {
    const own = weekRows.filter((row) => row.employeeId === employeeId);
    const standardMinutes = sum(own, (row) => row.count * channelMinutes.get(row.channel)!);
    const actualMinutes = sum(own, (row) => row.count * row.avgMinutes);
    return {
      employeeId,
      volumePerDay: standardMinutes / countDays(own),
      speed: actualMinutes === 0 ? 0 : standardMinutes / actualMinutes,
      satisfaction: summarize(own).avgSatisfaction,
    };
  });

  const volume = normalize(raw.map((item) => item.volumePerDay));
  const speed = normalize(raw.map((item) => item.speed));
  const satisfaction = normalize(raw.map((item) => item.satisfaction));
  const weightSum = weights.count + weights.minutes + weights.satisfaction;
  const efficiencyWeightSum = weights.count + weights.minutes;

  return new Map(
    raw.map((item, i) => [
      item.employeeId,
      {
        total: round1(
          (weights.count * volume[i] + weights.minutes * speed[i] + weights.satisfaction * satisfaction[i]) /
            weightSum,
        ),
        quality: round1(satisfaction[i]),
        efficiency: round1(
          efficiencyWeightSum === 0
            ? 0
            : (weights.count * volume[i] + weights.minutes * speed[i]) / efficiencyWeightSum,
        ),
      },
    ]),
  );
}

/**
 * お客様の声をまとめ、メールに載せるコメントを選ぶ（毎回同じ結果になるよう、決まった順で選ぶ）。
 * - Kudos：「良い」のコメントから、件数の多い評価軸の順に1件ずつ（同じ評価軸・同じ文章は重ねない）
 * - 改善点：「悪い」のコメントから、件数の多い評価軸の順に1件ずつ
 */
export function summarizeVoice(
  comments: CustomerComment[],
  limits: { kudos: number; improvements: number; distinctEmployees?: boolean },
): VoiceSummary {
  const axes = unique(comments.map((c) => c.axis));
  const byAxis = axes
    .map((axis) => ({
      axis,
      positive: comments.filter((c) => c.axis === axis && c.rating === "良い").length,
      negative: comments.filter((c) => c.axis === axis && c.rating === "悪い").length,
    }))
    .sort((a, b) => b.negative - a.negative || b.positive - a.positive || a.axis.localeCompare(b.axis));

  return {
    total: comments.length,
    positive: comments.filter((c) => c.rating === "良い").length,
    neutral: comments.filter((c) => c.rating === "普通").length,
    negative: comments.filter((c) => c.rating === "悪い").length,
    byAxis,
    kudos: pickComments(comments, "良い", limits.kudos, limits.distinctEmployees),
    improvements: pickComments(comments, "悪い", limits.improvements, limits.distinctEmployees),
  };
}

function pickComments(
  comments: CustomerComment[],
  rating: CustomerComment["rating"],
  limit: number,
  distinctEmployees = false,
): CustomerComment[] {
  const candidates = comments.filter((c) => c.rating === rating);
  const axisCount = (axis: string) => candidates.filter((c) => c.axis === axis).length;
  // 件数の多い評価軸 → 新しい日付 → 社員ID・コメントIDの順
  const sorted = [...candidates].sort(
    (a, b) =>
      axisCount(b.axis) - axisCount(a.axis) ||
      a.axis.localeCompare(b.axis) ||
      b.date.localeCompare(a.date) ||
      a.employeeId.localeCompare(b.employeeId) ||
      a.commentId.localeCompare(b.commentId),
  );
  const picked: CustomerComment[] = [];
  for (const comment of sorted) {
    if (picked.length >= limit) break;
    if (picked.some((p) => p.axis === comment.axis || p.text === comment.text)) continue;
    if (distinctEmployees && picked.some((p) => p.employeeId === comment.employeeId)) continue;
    picked.push(comment);
  }
  return picked;
}

/** 日付がその週（週開始日から7日間）に入っているか */
function isInWeek(date: string, weekStart: string): boolean {
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  const time = Date.parse(`${date}T00:00:00Z`);
  return time >= start && time < start + 7 * 24 * 60 * 60 * 1000;
}

/** 最小＝0、最大＝100 にそろえる。全員同じ値なら全員50 */
function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min < 1e-9) return values.map(() => 50);
  return values.map((value) => ((value - min) / (max - min)) * 100);
}

/** 順位を付ける。同じスコアは同じ順位（1, 2, 2, 4 …） */
function rankBy(reports: EmployeeReport[], score: (report: EmployeeReport) => number) {
  const ranks = new Map<string, number>();
  for (const report of reports) {
    ranks.set(report.employeeId, 1 + reports.filter((other) => score(other) > score(report)).length);
  }
  return ranks;
}

// 達成の判定は、画面・メールに出す桁で行う（「8.0分」なのに目標8.0分で未達、とならないように）
function higherIsBetter(actual: number, target: number, digits = 0): Achievement {
  return { actual, target, diff: actual - target, achieved: roundTo(actual, digits) >= target };
}

function lowerIsBetter(actual: number, target: number, digits = 0): Achievement {
  return { actual, target, diff: actual - target, achieved: roundTo(actual, digits) <= target };
}

function roundTo(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

function change(current: WeekMetrics, previous: WeekMetrics) {
  return {
    count: current.count - previous.count,
    avgMinutes: current.avgMinutes - previous.avgMinutes,
    avgSatisfaction: current.avgSatisfaction - previous.avgSatisfaction,
  };
}

function toWeekPoint(week: WeekInfo, rows: PerformanceRow[]): WeekPoint {
  return { ...week, metrics: rows.length > 0 ? summarize(rows) : null };
}

/** その週でいちばん新しい日の在籍期間 */
function latestTenure(rows: PerformanceRow[]): number | null {
  const withTenure = rows.filter((row) => row.tenureMonths !== null);
  if (withTenure.length === 0) return null;
  return withTenure.reduce((a, b) => (b.date > a.date ? b : a)).tenureMonths;
}

function countDays(rows: PerformanceRow[]): number {
  return new Set(rows.map((row) => row.date)).size;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
