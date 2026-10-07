// 称賛メール：To Employee（本人へのお礼）と To Team（チームへの紹介）を組み立てる
import { EMAIL_ACCENTS, type EmailBlock, type EmailDocument } from "@/lib/email/template";
import { L, axisLabel } from "@/lib/labels";
import { formatDate, formatShortDate } from "@/lib/report/format";
import type { KudosDraft, KudosInput } from "./types";

export type KudosEmail = { key: "toEmployee" | "toTeam"; label: string; sendable: boolean; doc: EmailDocument };

export function buildKudosEmails(draft: KudosDraft, input: KudosInput, date: string): KudosEmail[] {
  const short = formatShortDate(date);
  const voices: EmailBlock = {
    type: "bullets",
    items: input.quotes.map((q) => `「${q.text}」（${axisLabel(q.axis)}）`),
  };
  const e = draft.toEmployee;
  const emails: KudosEmail[] = [
    {
      key: "toEmployee",
      label: L.toEmployee,
      sendable: true,
      doc: {
        subject: `【Kudos】${short} ${input.name}`,
        accent: EMAIL_ACCENTS.kudos,
        kind: "KUDOS | THANK YOU",
        title: `Thank You, ${input.name}`,
        meta: formatDate(date),
        greeting: `${input.name}さん、${e.opening}`,
        highlightsLabel: L.whatYouDid,
        highlights: e.whatYouDid,
        sections: [
          { heading: L.impact, blocks: [{ type: "bullets", items: e.impact }] },
          { heading: L.customerVoice, blocks: [voices] },
          {
            heading: e.principle ? `${L.principles}：${e.principle}` : L.principles,
            blocks: e.principleNote ? [{ type: "paragraph", text: e.principleNote }] : [],
          },
        ],
        closing: e.closing,
      },
    },
  ];
  if (draft.toTeam) {
    const t = draft.toTeam;
    emails.push({
      key: "toTeam",
      label: L.toTeam,
      sendable: true,
      doc: {
        subject: `【Kudos】${short} Team`,
        accent: EMAIL_ACCENTS.kudos,
        kind: "KUDOS | SHOUTOUT",
        title: `Kudos to ${input.name}`,
        meta: formatDate(date),
        greeting: `チームの皆さん、${t.intro}`,
        highlightsLabel: L.whatTheyDid,
        highlights: t.highlights,
        sections: [
          { heading: L.whyItMatters, blocks: t.whyItMatters ? [{ type: "paragraph", text: t.whyItMatters }] : [] },
          { heading: L.customerVoice, blocks: [voices] },
        ],
        closing: t.closing,
      },
    });
  }
  return emails;
}
