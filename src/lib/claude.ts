import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

// Claude API を呼ぶ共通の処理（サーバー側だけで使う。APIキーは環境変数から読むので画面には出ない）

// モデル名はコードに書かず、環境変数で切り替える。未設定なら安い Haiku 4.5
const DEFAULT_MODEL = "claude-haiku-4-5";
export const claudeModel = () => process.env.CLAUDE_MODEL || DEFAULT_MODEL;

// USE_MOCK_AI が "false" のときだけ本物のAIを使う（設定し忘れても費用がかからない側に倒す）
export const isMockAI = () => process.env.USE_MOCK_AI !== "false";

let client: Anthropic | null = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new AIConfigError("APIキー（ANTHROPIC_API_KEY）が設定されていません。");
  client ??= new Anthropic();
  return client;
}

export class AIConfigError extends Error {}
export class AIResponseError extends Error {}

export type Usage = { inputTokens: number; outputTokens: number };

/** 決まった形（JSON）で答えを受け取る。形はスキーマで決め、答えが読めなければエラーにする */
export async function askForJson<T extends z.ZodType>(options: {
  system: string;
  user: string;
  schema: T;
  maxTokens?: number;
}): Promise<{ output: z.infer<T>; usage: Usage; model: string }> {
  const model = claudeModel();
  const response = await getClient().messages.parse({
    model,
    max_tokens: options.maxTokens ?? 8000,
    system: options.system,
    messages: [{ role: "user", content: options.user }],
    output_config: { format: zodOutputFormat(options.schema) },
  });
  if (response.stop_reason === "refusal") throw new AIResponseError("AIが下書きの作成を断りました。内容を見直してください。");
  if (response.stop_reason === "max_tokens") throw new AIResponseError("AIの回答が長すぎて途中で切れました。");
  const output = response.parsed_output;
  if (!output) throw new AIResponseError("AIの回答を読み取れませんでした。もう一度お試しください。");
  return {
    output,
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    model,
  };
}

/** AIの呼び出しで起きたエラーを、画面に出せる日本語とHTTPの状態に直す */
export function describeAIError(error: unknown): { message: string; status: number } {
  if (error instanceof AIConfigError) return { message: error.message, status: 500 };
  if (error instanceof AIResponseError) return { message: error.message, status: 502 };
  if (error instanceof Anthropic.AuthenticationError) {
    return { message: "APIキーが正しくないか、無効になっています。", status: 500 };
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return { message: "このAPIキーでは、指定したモデルを使えません。", status: 500 };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { message: "AIの利用が混み合っています。少し待ってからもう一度お試しください。", status: 429 };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return { message: "AIへの依頼の形が正しくありませんでした（残高不足の場合もあります）。", status: 502 };
  }
  if (error instanceof Anthropic.APIError) {
    return { message: `AIの呼び出しに失敗しました（${error.status ?? "通信エラー"}）。`, status: 502 };
  }
  return { message: "AIの呼び出しに失敗しました。", status: 500 };
}

// プロンプトに共通で入れる、文章のルール（CLAUDE.md の表記ルールと同じ）
export const WRITING_RULES = `文章のルール：
- 口調は「です・ます」で統一する
- 用語：Quality（＝満足度）、Efficiency（＝対応件数と対応時間）。指標は CSAT（平均満足度）、Cases（対応件数）、AHT（平均対応時間）と書く。「品質」「効率」とは書かない
- 数字は、渡されたデータにあるものだけを使う。自分で計算した数字や、データにない数字は書かない
- 「増えた・減った・伸びた・改善した」などの変化は、推移や先週のデータがある指標についてだけ書く
- 数字に正直に書く：下がっている人を「安定」と書かない。目標との差が大きいのに「あと少し」「少し上回る」と書かない
- 数字だけで、本人の行動や姿勢を決めつけない（例：「満足度が下がった＝手を抜いた」とは書かない）。改善点は責めずに、問いかけや提案の形にする
- くどくしない。同じことを繰り返さない`;
