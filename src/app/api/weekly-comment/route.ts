// 週次レポートのコメント（AIが書く区画）を返す
// USE_MOCK_AI が "false" のときだけ Claude を使う。それ以外はダミー（費用はかからない）
import { describeAIError, isMockAI } from "@/lib/claude";
import { loadPrinciples } from "@/lib/olp";
import { individualCommentWithClaude, teamCommentWithClaude } from "@/lib/report/aiComments";
import { mockIndividualComment, mockTeamComment } from "@/lib/report/mockComments";
import { checkPasscode, refundQuota, takeQuota } from "@/lib/usageGuard";
import type { WeeklyReport } from "@/lib/report/types";

const MAX_BODY_LENGTH = 300_000;
const MAX_MEMO_LENGTH = 1000;

type RequestBody =
  | { type: "team"; report: WeeklyReport }
  | { type: "individual"; report: WeeklyReport; employeeId: string; memo?: string };

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_LENGTH) return error("送信するデータが大きすぎます。", 413);

  let body: RequestBody;
  try {
    body = JSON.parse(text);
  } catch {
    return error("リクエストの形式が正しくありません。", 400);
  }
  if (!isReport(body?.report)) return error("集計結果が正しくありません。もう一度読み込んでください。", 400);

  if (body.type !== "team" && body.type !== "individual") return error("コメントの種類が正しくありません。", 400);
  const employee =
    body.type === "individual" ? body.report.employees.find((e) => e.employeeId === body.employeeId) : undefined;
  if (body.type === "individual" && !employee) return error("指定した社員が見つかりません。", 400);
  const memo = body.type === "individual" && typeof body.memo === "string" ? body.memo : "";
  if (memo.length > MAX_MEMO_LENGTH) return error(`行動メモは${MAX_MEMO_LENGTH}文字以内にしてください。`, 400);
  const principles = loadPrinciples();

  if (isMockAI()) {
    const comment =
      body.type === "team"
        ? mockTeamComment(body.report)
        : mockIndividualComment(body.report, employee!, principles.map((p) => p.name));
    return Response.json({ comment, mock: true });
  }

  // 本物のAIは費用がかかるので、パスコードと1日の上限を確かめる
  const denied = checkPasscode(request) ?? takeQuota("weeklyComments");
  if (denied) return denied;
  try {
    const result =
      body.type === "team"
        ? await teamCommentWithClaude(body.report)
        : await individualCommentWithClaude(body.report, employee!, memo, principles);
    return Response.json({ ...result, mock: false });
  } catch (err) {
    refundQuota("weeklyComments");
    const { message, status } = describeAIError(err);
    console.error("週次コメントの作成に失敗:", message);
    return error(message, status);
  }
}

function isReport(value: unknown): value is WeeklyReport {
  const report = value as WeeklyReport | undefined;
  return (
    typeof report === "object" &&
    report !== null &&
    typeof report.team?.weekStart === "string" &&
    Array.isArray(report.employees)
  );
}

function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
