// AIにつなぐまでのダミーのコメント。数字の傾向から決まった文を選ぶだけ
import { axisLabel } from "@/lib/labels";
import { formatSatisfaction } from "./format";
import type { IndividualComment, TeamComment } from "./comments";
import type { EmployeeReport, VoiceSummary, WeeklyReport } from "./types";

// Kudos（良いコメント）の評価軸ごとのほめ言葉
const PRAISE: Record<string, string> = {
  解決: "一度で解決する力が、お客様に伝わっています。",
  時間: "スピーディーな対応が、お客様に喜ばれています。",
  親身さ: "親身な対応が、お客様の安心につながっています。",
  知識: "分かりやすい説明が、お客様に届いています。",
  態度: "感じのよい対応が、お客様に届いています。",
};
// 改善点（悪いコメント）の評価軸ごとの、前向きな声かけ
const IMPROVE: Record<string, string> = {
  解決: "解決しきれなかった案件を、一緒に振り返りませんか。",
  時間: "時間がかかった案件の共通点を、一緒に探しませんか。",
  親身さ: "お客様の状況を確かめる一言を、意識してみませんか。",
  知識: "伝わりにくかった説明を、一緒に見直しませんか。",
  態度: "言葉選びで工夫できることを、一緒に考えませんか。",
};

/** Kudosがいちばん多い評価軸へのほめ言葉（例：「Kudosが3件届きました。親身な対応が…」） */
function kudosPraise(voice: VoiceSummary): string | null {
  const top = [...voice.byAxis].sort((a, b) => b.positive - a.positive)[0];
  if (!top || top.positive === 0) return null;
  return `${axisLabel(top.axis)}のKudosが${top.positive}件届きました。${PRAISE[top.axis] ?? "お客様に喜ばれています。"}`;
}

/** 「悪い」がいちばん多い評価軸への声かけ */
function improvementTip(voice: VoiceSummary): string | null {
  const top = voice.byAxis[0]; // 「悪い」の多い順に並んでいる
  if (!top || top.negative === 0) return null;
  return `${axisLabel(top.axis)}に関する声が${top.negative}件ありました。${IMPROVE[top.axis] ?? "一緒に振り返りませんか。"}`;
}

export function mockTeamComment(report: WeeklyReport): TeamComment {
  const { team, employees } = report;
  const goodPoints: string[] = [];
  const concerns: string[] = [];

  if (team.voice.positive > 0) {
    goodPoints.push(`お客様からKudosが${team.voice.positive}件届きました。ありがとうございます。`);
  }
  if (team.achievement.avgMinutes.achieved) goodPoints.push("AHTが目標の範囲内に収まりました。");
  if (team.changeFromLastWeek && team.changeFromLastWeek.count > 0) goodPoints.push("Casesが先週より増えました。");
  if (employees.some((e) => (e.changeFromLastWeek?.avgSatisfaction ?? 0) >= 0.1)) {
    goodPoints.push("CSATが大きく上がったメンバーがいます。");
  }
  if (goodPoints.length === 0) goodPoints.push("全体として安定した対応が続いています。");

  if (!team.achievement.avgSatisfaction.achieved) concerns.push("CSATが目標に届いていません。");
  if (!team.achievement.weeklyCount.achieved) concerns.push("Casesが目標を下回りました。");
  if (!team.achievement.avgMinutes.achieved) concerns.push("AHTが目標を上回りました。");
  const topNegative = team.voice.byAxis[0];
  if (topNegative && topNegative.negative > 0) {
    concerns.push(`${axisLabel(topNegative.axis)}に関するお客様の声が${topNegative.negative}件ありました。`);
  }

  return {
    goodPoints: goodPoints.slice(0, 3),
    concerns: concerns.slice(0, 3),
    nextActions: [
      "CSATの高かった対応の工夫を、朝会で1つずつ共有しましょう。",
      "対応に迷った案件は、早めに相談してください。",
    ],
    closing: "今週もありがとうございました。来週もよろしくお願いします。",
  };
}

/** 4週間の推移（データのある週だけ）。2週分なければ null */
function trendOf(employee: EmployeeReport) {
  const points = employee.trend.flatMap((p) => (p.metrics ? [p.metrics] : []));
  if (points.length < 2) return null;
  const first = points[0];
  const last = points.at(-1)!;
  const range = (pick: (m: (typeof points)[number]) => number) => [
    Math.min(...points.map(pick)),
    Math.max(...points.map(pick)),
  ];
  return {
    weeks: `${points.length}週間`,
    csat: { first: first.avgSatisfaction, last: last.avgSatisfaction, range: range((m) => m.avgSatisfaction) },
    aht: { first: first.avgMinutes, last: last.avgMinutes, range: range((m) => m.avgMinutes) },
    cases: { first: first.count, last: last.count },
  };
}

/**
 * 個人向けのダミーのコメント。Good Points・Next Steps は2〜3文で、4週間の推移にも触れる
 * （AIにつないだあとも同じ方針で書かせる）
 */
export function mockIndividualComment(
  report: WeeklyReport,
  employee: EmployeeReport,
  principleNames: string[],
): IndividualComment {
  const top = Math.max(3, Math.ceil(report.employees.length / 4)); // 上位の目安（4分の1）
  const trend = trendOf(employee);
  const csat = formatSatisfaction;
  const min = (v: number) => v.toFixed(1);

  // ---- よかった点に使う文（推移を含む） ----
  const strengths: string[] = [];
  if (trend) {
    const { weeks, csat: c, aht: a, cases: n } = trend;
    if (c.last - c.first >= 0.1) strengths.push(`CSATは${weeks}で${csat(c.first)}→${csat(c.last)}と上がってきています。`);
    if (a.first - a.last >= 0.3) strengths.push(`AHTも${weeks}で${min(a.first)}分→${min(a.last)}分と短くなりました。`);
    if (n.last >= n.first * 1.2) strengths.push(`Casesは${weeks}で${n.first}件→${n.last}件と着実に伸びています。`);
    if (employee.rank.quality <= top && Math.abs(c.last - c.first) < 0.1) {
      strengths.push(`CSATは${weeks}${csat(c.range[0])}〜${csat(c.range[1])}と、高い水準を保っています。`);
    }
    if (employee.rank.efficiency <= top && Math.abs(a.last - a.first) < 0.3) {
      strengths.push(`Efficiencyはチーム#${employee.rank.efficiency}で、AHTも${weeks}${min(a.range[0])}〜${min(a.range[1])}分と安定しています。`);
    }
    // 目立った変化がなければ、安定していることに触れる（実際に安定しているときだけ）
    if (strengths.length === 0 && Math.abs(c.last - c.first) < 0.1 && Math.abs(a.last - a.first) < 0.3) {
      strengths.push(`${weeks}、CSATは${csat(c.range[0])}〜${csat(c.range[1])}、AHTは${min(a.range[0])}〜${min(a.range[1])}分と安定しています。`);
    }
  }
  if (employee.achievement.weeklyCount.achieved) {
    strengths.push("今週はCasesの目標を達成し、チームの対応量を支えてくれました。");
  }

  const goodPoints: string[] = [];
  const praise = kudosPraise(employee.voice);
  if (praise) goodPoints.push(`${praise}${strengths.shift() ?? ""}`);
  while (goodPoints.length < 2 && strengths.length > 0) {
    goodPoints.push(strengths.splice(0, 2).join(""));
  }
  if (goodPoints.length === 0) goodPoints.push("今週も安定して対応してくれました。引き続き、いまのペースを大切にしてください。");

  // ---- 次に向けて（改善点は責めずに、問いかけ・提案の形で） ----
  const steps: string[] = [];
  const tip = improvementTip(employee.voice);
  if (tip) steps.push(tip);
  if (trend) {
    const { weeks, csat: c, aht: a } = trend;
    if (c.first - c.last >= 0.1) {
      steps.push(`CSATは${weeks}で${csat(c.first)}→${csat(c.last)}と下がってきています。気になった対応があれば、次の1on1で聞かせてください。`);
    } else if (!employee.achievement.avgSatisfaction.achieved) {
      steps.push(`CSATは${weeks}${csat(c.range[0])}〜${csat(c.range[1])}で推移し、目標は${csat(employee.achievement.avgSatisfaction.target)}です。お客様に喜ばれた対応を、一緒に振り返りませんか。`);
    }
    if (a.last - a.first >= 0.3) {
      steps.push(`AHTは${weeks}で${min(a.first)}分→${min(a.last)}分と長くなっています。時間がかかった案件の傾向を、一緒に見てみませんか。`);
    } else if (!employee.achievement.avgMinutes.achieved) {
      steps.push(`AHTは${weeks}${min(a.range[0])}〜${min(a.range[1])}分で推移し、目標は${min(employee.achievement.avgMinutes.target)}分以内です。時間がかかった案件の傾向を、一緒に見てみませんか。`);
    }
  }
  if (employee.tenureMonths !== null && employee.tenureMonths < 12) {
    steps.push("手順や判断で迷う場面があれば、いつでも相談してください。一緒に確認しながら進めましょう。");
  } else if (employee.tenureMonths !== null && employee.tenureMonths >= 60) {
    steps.push("うまくいっている対応のコツを、チームに共有してもらえませんか。後輩の大きな参考になるはずです。");
  }
  if (steps.length === 0) steps.push("来週、挑戦してみたいことがあれば教えてください。一緒に目標を決めましょう。");

  return {
    goodPoints: goodPoints.slice(0, 2),
    nextSteps: steps.slice(0, 3).map((text, i) => ({
      principle: principleNames.length > 0 ? principleNames[i % principleNames.length] : "",
      text,
    })),
    closing: "引き続きよろしくお願いします。",
  };
}
