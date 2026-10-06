// 週次パフォーマンスの集計（数字はすべてここで計算し、AIには計算させない）
import type {
  Achievement,
  EmployeeReport,
  PerformanceRow,
  Scores,
  Targets,
  TeamReport,
  WeekMetrics,
  WeekPoint,
  WeeklyReport,
} from "./types";

/** 推移に出す週の数（今週を含む） */
export const TREND_WEEKS = 4;
/** 1週間の基準の営業日数（目標を出勤日数で按分するときに使う） */
const STANDARD_WORK_DAYS = 5;

/**
 * 週次レポートを作る。
 * @param weekStart 対象の週（省略するとデータの最新の週）
 */
export function buildWeeklyReport(
  rows: PerformanceRow[],
  targets: Targets,
  weekStart?: string,
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

  const team = buildTeamReport(rows, weekRows, thisWeek, lastWeek, trendWeeks, targets, teamWorkDays);
  const employees = buildEmployeeReports(rows, weekRows, lastWeek, trendWeeks, targets);
  return { team, employees };
}

type WeekInfo = { weekStart: string; weekNumber: number };

function listWeeks(rows: PerformanceRow[]): WeekInfo[] {
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
      avgMinutes: lowerIsBetter(metrics.avgMinutes, targets.team.avgMinutes),
      avgSatisfaction: higherIsBetter(metrics.avgSatisfaction, targets.team.avgSatisfaction),
    },
    trend: trendWeeks.map((week) => toWeekPoint(week, rows.filter((row) => row.weekStart === week.weekStart))),
    changeFromLastWeek: lastWeekRows.length > 0 ? change(metrics, summarize(lastWeekRows)) : null,
  };
}

function buildEmployeeReports(
  rows: PerformanceRow[],
  weekRows: PerformanceRow[],
  lastWeek: WeekInfo | null,
  trendWeeks: WeekInfo[],
  targets: Targets,
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
        avgMinutes: lowerIsBetter(metrics.avgMinutes, targets.individual.avgMinutes),
        avgSatisfaction: higherIsBetter(metrics.avgSatisfaction, targets.individual.avgSatisfaction),
      },
      trend,
      changeFromLastWeek: lastWeekRows.length > 0 ? change(metrics, summarize(lastWeekRows)) : null,
      weeksWithData: trend.filter((point) => point.metrics !== null).length,
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

function higherIsBetter(actual: number, target: number): Achievement {
  return { actual, target, diff: actual - target, achieved: actual >= target };
}

function lowerIsBetter(actual: number, target: number): Achievement {
  return { actual, target, diff: actual - target, achieved: actual <= target };
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
