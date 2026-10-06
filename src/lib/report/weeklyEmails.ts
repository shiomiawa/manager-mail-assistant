// 週次レポートのメール（チーム向け・個人向け）を組み立てる
// 数字と要点はコードで作り、AIのコメントは決まった区画にだけ入れる
import type { EmailBlock, EmailDocument, EmailSection, Status } from "@/lib/email/template";
import type { IndividualComment, TeamComment } from "./comments";
import {
  formatCount,
  formatDate,
  formatDiff,
  formatMinutes,
  formatSatisfaction,
  formatScore,
  formatWeekRange,
} from "./format";
import type { Achievement, EmployeeReport, WeekMetrics, WeekPoint, WeeklyReport } from "./types";

const ACHIEVEMENT_LABELS = {
  weeklyCount: "対応件数",
  avgMinutes: "平均対応時間",
  avgSatisfaction: "満足度",
} as const;
type AchievementSet = Record<keyof typeof ACHIEVEMENT_LABELS, Achievement>;

export function buildTeamEmail(report: WeeklyReport, comment: TeamComment): EmailDocument {
  const { team } = report;
  const achieved = countAchieved(team.achievement);
  const top = report.employees.filter((e) => e.rank.total <= 3);

  const sections: EmailSection[] = [
    {
      heading: "今週の数字",
      blocks: [
        kpis(team.thisWeek, team.achievement, team.changeFromLastWeek, null),
        {
          type: "table",
          headers: ["チャンネル", "対応件数", "平均対応時間", "満足度"],
          rows: Object.entries(team.byChannel).map(([channel, m]) => [
            channel,
            formatCount(m.count),
            formatMinutes(m.avgMinutes),
            formatSatisfaction(m.avgSatisfaction),
          ]),
        },
      ],
    },
    { heading: "過去4週間の推移", blocks: [trendTable(team.trend)] },
    {
      heading: "今週の上位3名（総合スコア）",
      blocks: [
        {
          type: "table",
          headers: ["順位", "社員ID", "総合", "満足度", "平均対応時間"],
          align: ["center", "left", "right", "right", "right"],
          rows: top.map((e) => [
            `${e.rank.total}位`,
            e.employeeId,
            formatScore(e.scores.total),
            formatSatisfaction(e.thisWeek.avgSatisfaction),
            formatMinutes(e.thisWeek.avgMinutes),
          ]),
        },
      ],
    },
    {
      heading: "振り返り",
      blocks: [
        { type: "bullets", label: "よかった点", items: comment.goodPoints },
        { type: "bullets", label: "気になる点", items: comment.concerns },
      ],
    },
    { heading: "来週に向けて", blocks: [{ type: "bullets", items: comment.nextActions }] },
  ];

  return {
    subject: `【週次レポート】${formatDate(team.weekStart)}週　目標達成${achieved}/3・満足度${formatSatisfaction(team.thisWeek.avgSatisfaction)}`,
    kind: "週次レポート｜チーム",
    title: "チーム週次パフォーマンス",
    meta: `${formatWeekRange(team.weekStart)}（Week${team.weekNumber}）・${team.headcount}名`,
    greeting: "チームの皆さん、今週もお疲れさまでした。",
    highlightsLabel: "今週の要点",
    highlights: [
      achievementLine(team.achievement),
      satisfactionLine(team.thisWeek, team.achievement.avgSatisfaction, team.changeFromLastWeek),
      countLine(team.thisWeek, team.changeFromLastWeek),
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
  const achieved = countAchieved(employee.achievement);
  const headcount = report.employees.length;

  const sections: EmailSection[] = [
    {
      heading: "今週の数字",
      blocks: [
        kpis(employee.thisWeek, employee.achievement, employee.changeFromLastWeek, `出勤${employee.thisWeek.workDays}日分`),
      ],
    },
    {
      heading: "スコア（チーム内の相対評価・100点満点）",
      blocks: [
        {
          type: "table",
          headers: ["項目", "スコア", `順位（${headcount}名中）`],
          rows: [
            ["総合", formatScore(employee.scores.total), `${employee.rank.total}位`],
            ["品質（満足度）", formatScore(employee.scores.quality), `${employee.rank.quality}位`],
            ["効率（件数・対応時間）", formatScore(employee.scores.efficiency), `${employee.rank.efficiency}位`],
          ],
        },
      ],
    },
    { heading: "過去4週間の推移", blocks: [trendTable(employee.trend)] },
    { heading: "よかった点", blocks: [{ type: "bullets", items: comment.goodPoints }] },
    {
      heading: "次に向けて",
      blocks: [
        {
          type: "bullets",
          items: comment.nextSteps.map((step) => (step.principle ? `［${step.principle}］${step.text}` : step.text)),
        },
      ],
    },
  ];

  return {
    subject: `【個人レポート】${formatDate(report.team.weekStart)}週　${employee.employeeId}さん　目標達成${achieved}/3・満足度${formatSatisfaction(employee.thisWeek.avgSatisfaction)}`,
    kind: "週次レポート｜個人",
    title: `${employee.employeeId}さんの週次パフォーマンス`,
    meta: `${formatWeekRange(report.team.weekStart)}（Week${report.team.weekNumber}）`,
    greeting: `${employee.employeeId}さん、今週もお疲れさまでした。`,
    highlightsLabel: "今週の要点",
    highlights: [
      achievementLine(employee.achievement),
      satisfactionLine(employee.thisWeek, employee.achievement.avgSatisfaction, employee.changeFromLastWeek),
      `総合スコアは${formatScore(employee.scores.total)}点（${headcount}名中${employee.rank.total}位）です。`,
    ],
    sections,
    closing: comment.closing,
  };
}

function countAchieved(set: AchievementSet): number {
  return Object.values(set).filter((a) => a.achieved).length;
}

/** 例：「目標は3項目中1項目を達成しました（平均対応時間）。」 */
function achievementLine(set: AchievementSet): string {
  const names = (Object.keys(ACHIEVEMENT_LABELS) as (keyof AchievementSet)[])
    .filter((key) => set[key].achieved)
    .map((key) => ACHIEVEMENT_LABELS[key]);
  if (names.length === 3) return "目標の3項目をすべて達成しました。";
  if (names.length === 0) return "目標の3項目は、いずれも未達でした。";
  return `目標は3項目中${names.length}項目を達成しました（${names.join("・")}）。`;
}

function satisfactionLine(
  metrics: WeekMetrics,
  achievement: Achievement,
  change: { avgSatisfaction: number } | null,
): string {
  const value = formatSatisfaction(metrics.avgSatisfaction);
  const vsTarget = achievement.achieved
    ? `目標${formatSatisfaction(achievement.target)}を達成`
    : `目標${formatSatisfaction(achievement.target)}まであと${formatSatisfaction(-achievement.diff)}`;
  if (!change) return `満足度は${value}で、${vsTarget}です。`;
  return `満足度は${value}（先週比${formatDiff(change.avgSatisfaction, 2)}）で、${vsTarget}です。`;
}

function countLine(metrics: WeekMetrics, change: { count: number } | null): string {
  const value = formatCount(metrics.count);
  if (!change) return `対応件数は${value}でした。`;
  if (change.count === 0) return `対応件数は${value}で、先週と同じでした。`;
  const direction = change.count > 0 ? "増えました" : "減りました";
  return `対応件数は${value}で、先週より${formatCount(Math.abs(change.count))}${direction}。`;
}

const statusOf = (achievement: Achievement): Status => (achievement.achieved ? "good" : "bad");
const badgeOf = (achievement: Achievement) => (achievement.achieved ? "達成" : "未達");

function kpis(
  metrics: WeekMetrics,
  achievement: AchievementSet,
  change: { count: number; avgMinutes: number; avgSatisfaction: number } | null,
  countTargetNote: string | null,
): EmailBlock {
  const vsLastWeek = (text: string) => (change ? [`先週比 ${text}`] : []);
  return {
    type: "kpis",
    items: [
      {
        label: "対応件数",
        value: formatCount(metrics.count),
        notes: [
          `目標${formatCount(achievement.weeklyCount.target)}${countTargetNote ? `（${countTargetNote}）` : ""}`,
          ...vsLastWeek(formatDiff(change?.count ?? 0, 0, "件")),
        ],
        status: statusOf(achievement.weeklyCount),
        badge: badgeOf(achievement.weeklyCount),
      },
      {
        label: "平均対応時間",
        value: formatMinutes(metrics.avgMinutes),
        notes: [
          `目標${formatMinutes(achievement.avgMinutes.target)}以内`,
          ...vsLastWeek(formatDiff(change?.avgMinutes ?? 0, 1, "分")),
        ],
        status: statusOf(achievement.avgMinutes),
        badge: badgeOf(achievement.avgMinutes),
      },
      {
        label: "満足度",
        value: formatSatisfaction(metrics.avgSatisfaction),
        notes: [
          `目標${formatSatisfaction(achievement.avgSatisfaction.target)}`,
          ...vsLastWeek(formatDiff(change?.avgSatisfaction ?? 0, 2)),
        ],
        status: statusOf(achievement.avgSatisfaction),
        badge: badgeOf(achievement.avgSatisfaction),
      },
    ],
  };
}

function trendTable(trend: WeekPoint[]): EmailBlock {
  return {
    type: "table",
    headers: ["週", "対応件数", "平均対応時間", "満足度"],
    rows: trend.map((point) => [
      `Week${point.weekNumber}（${formatDate(point.weekStart).slice(5)}〜）`,
      point.metrics ? formatCount(point.metrics.count) : "—",
      point.metrics ? formatMinutes(point.metrics.avgMinutes) : "—",
      point.metrics ? formatSatisfaction(point.metrics.avgSatisfaction) : "—",
    ]),
  };
}
