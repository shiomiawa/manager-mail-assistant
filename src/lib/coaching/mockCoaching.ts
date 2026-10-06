// AIにつなぐまでのダミーのコーチング。評価軸ごとに決まった文を選ぶだけ
import { axisLabel } from "@/lib/labels";
import type { CoachingDraft, CoachingInput } from "./types";

// 評価軸ごとの、強みの言い方
const STRENGTH: Record<string, string> = {
  解決: "一度で問題を解決してくれる、という声が届いています。",
  時間: "対応が早く、スムーズだという声が届いています。",
  親身さ: "話をよく聞いてくれて安心した、という声が届いています。",
  知識: "説明が分かりやすく的確だ、という声が届いています。",
  態度: "丁寧で感じがよい、という声が届いています。",
};

// 評価軸ごとの、試すことと言い換えの例
const FOCUS: Record<string, { hypothesis: string; tryThis: string; examplePhrase: string }> = {
  解決: {
    hypothesis: "解決までの道筋が、お客様に見えていなかったのかもしれません。",
    tryThis: "最後に、解決したかどうかと次にすることを確認する。",
    examplePhrase: "「これで解決しそうでしょうか。もしうまくいかなければ、この番号にご連絡ください」",
  },
  時間: {
    hypothesis: "待ち時間の見通しが伝わっていなかったのかもしれません。",
    tryThis: "時間がかかりそうなときは、先に目安を伝える。",
    examplePhrase: "「確認に5分ほどかかります。このままお待ちいただけますか」",
  },
  親身さ: {
    hypothesis: "状況を受け止めたことが、言葉で伝わっていなかったのかもしれません。",
    tryThis: "説明の前に、お客様の状況を一言で言い換えて受け止める。",
    examplePhrase: "「〇〇でお困りなのですね。ご不便をおかけしています」",
  },
  知識: {
    hypothesis: "説明が専門的だったり、長かったりしたのかもしれません。",
    tryThis: "結論を先に、手順は3つまでに分けて伝える。",
    examplePhrase: "「結論から申し上げると、〇〇です。手順は3つあります」",
  },
  態度: {
    hypothesis: "忙しい時間帯に、定型文だけの返答になっていたのかもしれません。",
    tryThis: "定型文の前に、ひとこと気持ちを添える。",
    examplePhrase: "「お問い合わせありがとうございます。すぐに確認いたしますね」",
  },
};

export function mockCoachingDraft(input: CoachingInput, principleNames: string[]): CoachingDraft {
  const strengthAxes = [...input.byAxis].filter((a) => a.positive > 0).sort((a, b) => b.positive - a.positive).slice(0, 2);
  const focusAxes = input.byAxis.filter((a) => a.negative > 0).slice(0, 2);
  const csats = input.weeks.flatMap((w) => (w.csat === null ? [] : [w.csat]));
  const csatText = csats.length >= 2 ? `CSATは4週間で${csats[0].toFixed(2)}→${csats.at(-1)!.toFixed(2)}です。` : "";

  return {
    headline: focusAxes.length > 0 ? `Focus: ${focusAxes.map((a) => axisLabel(a.axis)).join("・")}` : "強みを伸ばす",
    summary: `直近4週間のコメントは${input.totals.total}件（良い ${input.totals.positive}・普通 ${input.totals.neutral}・悪い ${input.totals.negative}）です。${csatText}`,
    strengths: strengthAxes.map((a) => ({ axis: a.axis, point: STRENGTH[a.axis] ?? "お客様から評価する声が届いています。" })),
    focusAreas: focusAxes.map((a, i) => {
      const f = FOCUS[a.axis];
      return {
        axis: a.axis,
        voice: `${axisLabel(a.axis)}について「悪い」の声が${a.negative}件ありました。`,
        hypothesis: f?.hypothesis ?? "どんな場面だったか、本人に聞いてみましょう。",
        tryThis: f?.tryThis ?? "どんな工夫ができそうか、一緒に考える。",
        examplePhrase: f?.examplePhrase ?? "",
        principle: principleNames.length > 0 ? principleNames[i % principleNames.length] : "",
      };
    }),
    questions: [
      "最近の対応で、うまくいったと感じたのはどんな場面でしたか。",
      ...(focusAxes.length > 0 ? [`${axisLabel(focusAxes[0].axis)}の声について、思い当たる場面はありますか。`] : []),
      "来週、ひとつ試すとしたら何をやってみたいですか。",
    ],
    nextCheck: "来週以降の「悪い」の声の件数と、CSATの推移を見ます。",
    messageToEmployee: {
      opening: "いつも丁寧な対応をありがとうございます。直近4週間のお客様の声をまとめました。",
      closing: "次の1on1で、一緒に振り返りましょう。",
    },
  };
}
