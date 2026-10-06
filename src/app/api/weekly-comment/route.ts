// 週次レポートのコメント（AIが書く区画）を返す
// いまはダミーだけ。Claude API は最後につなぐ（USE_MOCK_AI が "false" でない間はダミーを返す）
import { loadPrinciples } from "@/lib/olp";
import { mockIndividualComment, mockTeamComment } from "@/lib/report/mockComments";
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

  if (process.env.USE_MOCK_AI === "false") {
    return error("AIとの接続はまだ準備中です。", 501);
  }

  if (body.type === "team") {
    return Response.json({ comment: mockTeamComment(body.report), mock: true });
  }
  if (body.type === "individual") {
    const employee = body.report.employees.find((e) => e.employeeId === body.employeeId);
    if (!employee) return error("指定した社員が見つかりません。", 400);
    if (typeof body.memo === "string" && body.memo.length > MAX_MEMO_LENGTH) {
      return error(`行動メモは${MAX_MEMO_LENGTH}文字以内にしてください。`, 400);
    }
    const principleNames = loadPrinciples().map((p) => p.name);
    return Response.json({
      comment: mockIndividualComment(body.report, employee, principleNames),
      mock: true,
    });
  }
  return error("コメントの種類が正しくありません。", 400);
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
