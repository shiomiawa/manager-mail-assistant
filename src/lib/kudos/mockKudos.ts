// AIにつなぐまでのダミーの称賛メール。入力されたエピソードとお客様の声を、決まった文に入れるだけ
import { axisLabel } from "@/lib/labels";
import type { KudosDraft, KudosInput } from "./types";

export function mockKudosDraft(input: KudosInput, principleNames: string[]): KudosDraft {
  const episode = input.episode.trim().split(/(?<=[。！!])/)[0]?.trim() || input.episode.trim();
  return {
    toEmployee: {
      opening: `${input.name}さんの最近の対応について、お礼を伝えたくて連絡しました。`,
      whatYouDid: [episode],
      impact: input.quotes.map((q) => `お客様から「${q.text}」という声が届いています（${axisLabel(q.axis)}）。`),
      principle: principleNames[0] ?? "",
      principleNote: principleNames[0] ? `${principleNames[0]}を体現する行動だと感じています。` : "",
      closing: "本当にありがとうございます。これからも頼りにしています。",
    },
    toTeam: input.includeTeam
      ? {
          intro: `${input.name}さんの素晴らしい対応を紹介します。`,
          highlights: [episode],
          whyItMatters: "お客様の安心につながる対応として、チームでも参考にしたい行動です。",
          closing: "皆さんも、良い対応を見つけたらぜひ教えてください。",
        }
      : null,
  };
}
