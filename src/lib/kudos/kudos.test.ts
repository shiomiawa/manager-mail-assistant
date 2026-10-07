import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderEmailText } from "@/lib/email/template";
import { buildWeeklyReport } from "@/lib/report/aggregate";
import { parseWorkbook } from "@/lib/report/parseWorkbook";
import { loadTargets } from "@/lib/report/targets";
import { kudosCandidates, trendLines } from "./data";
import { aiKudosReady } from "./guard";
import { buildKudosEmails } from "./kudosEmails";
import { mockKudosDraft } from "./mockKudos";
import type { KudosInput } from "./types";

const file = readFileSync("sample-data/cs-performance-sample.xlsx");
const { rows, comments } = await parseWorkbook(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
const report = buildWeeklyReport(rows, loadTargets(), undefined, comments);

describe("称賛メールのデータ", () => {
  it("お客様の声の候補は、その人の直近4週間の「良い」だけ（新しい順・同じ文章は1つ）", () => {
    const quotes = kudosCandidates(report, comments, "E015");
    expect(quotes.length).toBeGreaterThan(0);
    expect(quotes.every((q) => q.employeeId === "E015" && q.rating === "良い" && q.date >= "2026-09-07")).toBe(true);
    expect(new Set(quotes.map((q) => q.text)).size).toBe(quotes.length);
    expect(quotes.map((q) => q.date)).toEqual([...quotes.map((q) => q.date)].sort().reverse());
  });

  it("推移は文にして渡す（データのある週だけ）", () => {
    const e = report.employees.find((x) => x.employeeId === "E006")!;
    expect(trendLines(e).at(-1)).toMatch(/^Week 40（今週）：/);
    expect(trendLines(e)[0]).toMatch(/^Week 37：CSAT 4\.\d\d、Cases \d+件、AHT \d+\.\d分$/);
  });
});

describe("称賛メールの入力チェック", () => {
  const base: KudosInput = { name: "E015", episode: "返金の案内をテンプレートにまとめて共有してくれた", quotes: [], trend: [], tenureMonths: null, includeTeam: false };
  it("名前とエピソード（10字以上）が必要", () => {
    expect(aiKudosReady(base)).toBeNull();
    expect(aiKudosReady({ ...base, name: " " })).toMatch(/ほめる人/);
    expect(aiKudosReady({ ...base, episode: "ありがとう" })).toMatch(/10字以上/);
  });
  it("お客様の声は3件まで", () => {
    const q = kudosCandidates(report, comments, "E015")[0];
    expect(aiKudosReady({ ...base, quotes: [q, q, q, q] })).toMatch(/3件まで/);
  });
});

describe("称賛メール（ダミー）", () => {
  const quotes = kudosCandidates(report, comments, "E015").slice(0, 2);
  const input: KudosInput = { name: "E015", episode: "返金の案内をテンプレートにまとめて、チームに共有してくれた。おかげで対応が早くなった。", quotes, trend: [], tenureMonths: 70, includeTeam: true };

  it("本人向けとチーム向けを作り、件名は短い形", () => {
    const emails = buildKudosEmails(mockKudosDraft(input, []), input, "2026-10-07");
    expect(emails.map((e) => e.doc.subject)).toEqual(["【Kudos】10/7 E015", "【Kudos】10/7 Team"]);
    expect(emails[0].doc.accent).toBe("#946a0c");
    const text = renderEmailText(emails[0].doc);
    expect(text).toContain("【What You Did】");
    expect(text).toContain(`「${quotes[0].text}」`);
  });

  it("チーム向けを選ばなければ、本人向けだけ", () => {
    const emails = buildKudosEmails(mockKudosDraft({ ...input, includeTeam: false }, []), input, "2026-10-07");
    expect(emails.map((e) => e.key)).toEqual(["toEmployee"]);
  });
});

describe("書き出しの名前の重複を防ぐ", () => {
  it("先頭の「名前さん、」だけを取り除く", async () => {
    const { stripLeadingName } = await import("./aiKudos");
    expect(stripLeadingName("E006さん、配属から3か月で…", "E006")).toBe("配属から3か月で…");
    expect(stripLeadingName("配属から3か月のE006さんが…", "E006")).toBe("配属から3か月のE006さんが…");
  });
});
