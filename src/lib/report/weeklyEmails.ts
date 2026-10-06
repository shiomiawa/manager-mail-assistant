// 週次レポートのメール（チーム向け・個人向け）を組み立てる
// 数字と要点はコードで作り、AIのコメントは決まった区画にだけ入れる
// 説明文は日本語、見出し・項目名・順位などのラベルは英語（src/lib/labels.ts）
import type { EmailBlock, EmailDocument, EmailSection, Status } from "@/lib/email/template";
import { L, axisLabel, channelLabel, rankLabel } from "@/lib/labels";
import type { IndividualComment, TeamComment } from "./comments";
import {
  formatCount,
  formatDate,
  formatDiff,
  formatMin,
  formatMinutes,
  formatNumber,
  formatSatisfaction,
  formatScore,
  formatWeekRange,
} from "./format";
import type {
  Achievement,
  CustomerComment,
  EmployeeReport,
  VoiceSummary,
  WeekMetrics,
  WeekPoint,
  WeeklyReport,
} from "./types";

type AchievementSet = { weeklyCount: Achievement; avgMinutes: Achievement; avgSatisfaction: Achievement };
type Change = { count: number; avgMinutes: number; avgSatisfaction: number } | null;

const ACHIEVEMENT_LABELS: Record<keyof AchievementSet, string> = {
  avgSatisfaction: L.csat,
  weeklyCount: L.cases,
  avgMinutes: L.aht,
};

export function buildTeamEmail(report: WeeklyReport, comment: TeamComment): EmailDocument {
  const { team } = report;
  const top = report.employees.filter((e) => e.rank.total <= 3);

  const sections: EmailSection[] = [
    {
      heading: L.thisWeek,
      blocks: [
        ...kpis(team.thisWeek, team.achievement, team.changeFromLastWeek, null),
        {
          type: "table",
          headers: [L.channel, L.cases, L.aht, L.csat],
          rows: Object.entries(team.byChannel).map(([channel, m]) => [
            channelLabel(channel),
            formatNumber(m.count),
            formatMin(m.avgMinutes),
            formatSatisfaction(m.avgSatisfaction),
          ]),
        },
      ],
    },
    ...customerVoiceSection(team.voice, "team"),
    { heading: L.trend, blocks: [trendTable(team.trend)] },
    {
      heading: L.top3,
      blocks: [
        {
          type: "table",
          headers: [L.rank, L.employeeId, L.total, L.quality, L.efficiency],
          align: ["center", "left", "right", "right", "right"],
          rows: top.map((e) => [
            rankLabel(e.rank.total),
            e.employeeId,
            formatScore(e.scores.total),
            formatScore(e.scores.quality),
            formatScore(e.scores.efficiency),
          ]),
        },
      ],
    },
    {
      heading: L.review,
      blocks: [
        { type: "bullets", label: L.goodPoints, items: comment.goodPoints },
        { type: "bullets", label: L.concerns, items: comment.concerns },
      ],
    },
    { heading: L.nextWeek, blocks: [{ type: "bullets", items: comment.nextActions }] },
  ];

  return {
    subject: `【${L.weeklyReport}】${formatDate(team.weekStart)}　${subjectSummary(team.achievement, team.thisWeek)}`,
    kind: `${L.weeklyReport.toUpperCase()} | TEAM`,
    title: "Team Weekly Performance",
    meta: `${formatWeekRange(team.weekStart)} · ${L.week} ${team.weekNumber} · ${team.headcount} members`,
    greeting: "チームの皆さん、今週もお疲れさまでした。",
    highlightsLabel: L.keyPoints,
    highlights: [
      achievementLine(team.achievement),
      qualityLine(team.thisWeek, team.achievement.avgSatisfaction, team.changeFromLastWeek),
      efficiencyLine(team.thisWeek, team.changeFromLastWeek),
    ],
    sections,
    closing: comment.closing,
  };
}

export function buildIndividualEmail(
  report: WeeklyReport,
  employee: EmployeeReport,
  comment: IndividualComment,
): EmailDocument {
  const headcount = report.employees.length;

  const sections: EmailSection[] = [
    {
      heading: L.thisWeek,
      blocks: kpis(employee.thisWeek, employee.achievement, employee.changeFromLastWeek, employee.thisWeek.workDays),
    },
    ...customerVoiceSection(employee.voice, "individual"),
    {
      heading: L.scores,
      blocks: [
        {
          type: "paragraph",
          text: `チーム内の相対評価（100点満点）です。${L.quality}は満足度、${L.efficiency}は対応件数と対応時間から計算しています。`,
        },
        {
          type: "table",
          headers: [L.item, L.score, `${L.rank} (of ${headcount})`],
          rows: [
            [L.total, formatScore(employee.scores.total), rankLabel(employee.rank.total)],
            [L.quality, formatScore(employee.scores.quality), rankLabel(employee.rank.quality)],
            [L.efficiency, formatScore(employee.scores.efficiency), rankLabel(employee.rank.efficiency)],
          ],
        },
      ],
    },
    { heading: L.trend, blocks: [trendTable(employee.trend)] },
    { heading: L.goodPoints, blocks: [{ type: "bullets", items: comment.goodPoints }] },
    {
      heading: L.nextSteps,
      blocks: [
        {
          type: "bullets",
          items: comment.nextSteps.map((step) => (step.principle ? `［${step.principle}］${step.text}` : step.text)),
        },
      ],
    },
  ];

  return {
    subject: `【${L.individualReport}】${formatDate(report.team.weekStart)}　${employee.employeeId}　${subjectSummary(employee.achievement, employee.thisWeek)}`,
    kind: `${L.weeklyReport.toUpperCase()} | INDIVIDUAL`,
    title: `${employee.employeeId} Weekly Performance`,
    meta: `${formatWeekRange(report.team.weekStart)} · ${L.week} ${report.team.weekNumber}`,
    greeting: `${employee.employeeId}さん、今週もお疲れさまでした。`,
    highlightsLabel: L.keyPoints,
    highlights: [
      achievementLine(employee.achievement),
      qualityLine(employee.thisWeek, employee.achievement.avgSatisfaction, employee.changeFromLastWeek),
      efficiencyLine(employee.thisWeek, employee.changeFromLastWeek),
    ],
    sections,
    closing: comment.closing,
  };
}

/** 件名の結論部分（例：Targets Met 1/3 · CSAT 4.33） */
function subjectSummary(set: AchievementSet, metrics: WeekMetrics): string {
  const achieved = Object.values(set).filter((a) => a.achieved).length;
  return `Targets Met ${achieved}/3 · ${L.csat} ${formatSatisfaction(metrics.avgSatisfaction)}`;
}

/** 例：「目標は3項目中1項目を達成しました（AHT）。」 */
function achievementLine(set: AchievementSet): string {
  const names = (Object.keys(ACHIEVEMENT_LABELS) as (keyof AchievementSet)[])
    .filter((key) => set[key].achieved)
    .map((key) => ACHIEVEMENT_LABELS[key]);
  if (names.length === 3) return "目標の3項目をすべて達成しました。";
  if (names.length === 0) return "目標の3項目は、いずれも未達でした。";
  return `目標は3項目中${names.length}項目を達成しました（${names.join("・")}）。`;
}

/** 例：「Quality：CSATは4.33（先週比±0.00）で、目標4.40まであと0.07です。」 */
function qualityLine(metrics: WeekMetrics, achievement: Achievement, change: Change): string {
  const value = formatSatisfaction(metrics.avgSatisfaction);
  const vsLastWeek = change ? `（先週比${formatDiff(change.avgSatisfaction, 2)}）` : "";
  const vsTarget = achievement.achieved
    ? `目標${formatSatisfaction(achievement.target)}を達成しました`
    : `目標${formatSatisfaction(achievement.target)}まであと${formatSatisfaction(-achievement.diff)}です`;
  return `${L.quality}：${L.csat}は${value}${vsLastWeek}で、${vsTarget}。`;
}

/** 例：「Efficiency：Casesは2,280件（先週比−63件）、AHTは7.4分です。」 */
function efficiencyLine(metrics: WeekMetrics, change: Change): string {
  const cases = `${formatCount(metrics.count)}${change ? `（先週比${formatDiff(change.count, 0, "件")}）` : ""}`;
  return `${L.efficiency}：${L.cases}は${cases}、${L.aht}は${formatMinutes(metrics.avgMinutes)}です。`;
}

const statusOf = (achievement: Achievement): Status => (achievement.achieved ? "good" : "bad");
const badgeOf = (achievement: Achievement) => (achievement.achieved ? L.met : L.missed);

/** Quality（CSAT）と Efficiency（Cases・AHT）の2つに分けて並べる */
function kpis(
  metrics: WeekMetrics,
  achievement: AchievementSet,
  change: Change,
  workDays: number | null,
): EmailBlock[] {
  const vsLastWeek = (text: string) => (change ? [`${L.vsLastWeek} ${text}`] : []);
  return [
    {
      type: "kpis",
      label: L.quality,
      items: [
        {
          label: L.csat,
          value: formatSatisfaction(metrics.avgSatisfaction),
          notes: [
            `${L.target} ${formatSatisfaction(achievement.avgSatisfaction.target)}`,
            ...vsLastWeek(formatDiff(change?.avgSatisfaction ?? 0, 2)),
          ],
          status: statusOf(achievement.avgSatisfaction),
          badge: badgeOf(achievement.avgSatisfaction),
        },
      ],
    },
    {
      type: "kpis",
      label: L.efficiency,
      items: [
        {
          label: L.cases,
          value: formatNumber(metrics.count),
          notes: [
            // 個人は出勤日数で按分した目標なので、日数を添える
            `${L.target} ${formatNumber(achievement.weeklyCount.target)}${workDays === null ? "" : ` (${workDays} days)`}`,
            ...vsLastWeek(formatDiff(change?.count ?? 0, 0)),
          ],
          status: statusOf(achievement.weeklyCount),
          badge: badgeOf(achievement.weeklyCount),
        },
        {
          label: L.aht,
          value: formatMin(metrics.avgMinutes),
          notes: [
            `${L.target} ≤ ${formatMin(achievement.avgMinutes.target)}`,
            ...vsLastWeek(formatDiff(change?.avgMinutes ?? 0, 1, " min")),
          ],
          status: statusOf(achievement.avgMinutes),
          badge: badgeOf(achievement.avgMinutes),
        },
      ],
    },
  ];
}

/**
 * お客様の声。コメントがなければ区画ごと出さない。
 * チーム向けは Kudos（社員IDつき）と評価軸ごとの件数だけ。個人の改善点はチームに出さない
 */
function customerVoiceSection(voice: VoiceSummary, audience: "team" | "individual"): EmailSection[] {
  if (voice.total === 0) return [];
  const quote = (c: CustomerComment) =>
    audience === "team" ? `「${c.text}」${c.employeeId}（${axisLabel(c.axis)}）` : `「${c.text}」（${axisLabel(c.axis)}）`;
  const blocks: EmailBlock[] = [
    {
      type: "table",
      headers: [L.comments, L.positive, L.neutral, L.negative],
      align: ["right", "right", "right", "right"],
      rows: [[String(voice.total), String(voice.positive), String(voice.neutral), String(voice.negative)]],
    },
    { type: "bullets", label: L.kudos, items: voice.kudos.map(quote) },
  ];
  if (audience === "individual") {
    blocks.push({ type: "bullets", label: L.toImprove, items: voice.improvements.map(quote) });
  } else {
    blocks.push({
      type: "table",
      headers: [L.axis, L.positive, L.negative],
      rows: voice.byAxis.map((a) => [axisLabel(a.axis), String(a.positive), String(a.negative)]),
    });
  }
  return [{ heading: L.customerVoice, blocks }];
}

function trendTable(trend: WeekPoint[]): EmailBlock {
  return {
    type: "table",
    headers: [L.week, L.cases, L.aht, L.csat],
    rows: trend.map((point) => [
      `${L.week} ${point.weekNumber} (${formatDate(point.weekStart).slice(5)}–)`,
      point.metrics ? formatNumber(point.metrics.count) : "—",
      point.metrics ? formatMin(point.metrics.avgMinutes) : "—",
      point.metrics ? formatSatisfaction(point.metrics.avgSatisfaction) : "—",
    ]),
  };
}
