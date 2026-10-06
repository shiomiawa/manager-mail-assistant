// AIにつなぐまでのダミーのコメント。数字の傾向から決まった文を選ぶだけ
import { axisLabel } from "@/lib/labels";
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
  return `${axisLabel(top.axis)}のKudosが${top.positive}件。${PRAISE[top.axis] ?? "お客様に喜ばれています。"}`;
}

/** 「悪い」がいちばん多い評価軸への声かけ */
function improvementTip(voice: VoiceSummary): string | null {
  const top = voice.byAxis[0]; // 「悪い」の多い順に並んでいる
  if (!top || top.negative === 0) return null;
  return `${axisLabel(top.axis)}の声が${top.negative}件。${IMPROVE[top.axis] ?? "一緒に振り返りませんか。"}`;
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

export function mockIndividualComment(
  report: WeeklyReport,
  employee: EmployeeReport,
  principleNames: string[],
): IndividualComment {
  const goodPoints: string[] = [];
  const steps: string[] = [];
  const satisfactionChange = employee.changeFromLastWeek?.avgSatisfaction ?? 0;
  const top = Math.max(3, Math.ceil(report.employees.length / 4)); // 上位の目安（4分の1）

  const praise = kudosPraise(employee.voice);
  if (praise) goodPoints.push(praise);
  if (employee.rank.quality <= top) goodPoints.push("Qualityがチームの上位で、丁寧な対応が伝わっています。");
  if (employee.rank.efficiency <= top) goodPoints.push("Efficiencyがチームの上位で、速く多く対応できています。");
  if (satisfactionChange >= 0.1) goodPoints.push("CSATが先週より上がりました。");
  if (employee.achievement.weeklyCount.achieved) goodPoints.push("Casesの目標を達成しました。");
  if (goodPoints.length === 0) goodPoints.push("今週も安定して対応してくれました。");

  const tip = improvementTip(employee.voice);
  if (tip) steps.push(tip);
  if (satisfactionChange <= -0.1) {
    steps.push("CSATが先週より下がっています。気になった対応があれば聞かせてください。");
  } else if (!employee.achievement.avgSatisfaction.achieved) {
    steps.push("CSATを上げるために、試してみたいことはありますか。");
  }
  if (!employee.achievement.avgMinutes.achieved) steps.push("AHTが長くなった案件の傾向を、一緒に見てみませんか。");
  if (employee.tenureMonths !== null && employee.tenureMonths < 12) {
    steps.push("手順や判断で迷う場面はありませんか。いつでも相談してください。");
  } else if (employee.tenureMonths !== null && employee.tenureMonths >= 60) {
    steps.push("うまくいっている対応のコツを、チームに共有してもらえませんか。");
  }
  if (steps.length === 0) steps.push("来週、挑戦してみたいことがあれば教えてください。");

  return {
    goodPoints: goodPoints.slice(0, 2),
    nextSteps: steps.slice(0, 3).map((text, i) => ({
      principle: principleNames.length > 0 ? principleNames[i % principleNames.length] : "",
      text,
    })),
    closing: "引き続きよろしくお願いします。",
  };
}
