import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderEmailHtml, renderEmailText } from "@/lib/email/template";
import { buildWeeklyReport } from "./aggregate";
import { mockIndividualComment, mockTeamComment } from "./mockComments";
import { parseWorkbook } from "./parseWorkbook";
import { loadTargets } from "./targets";
import { buildIndividualEmail, buildTeamEmail } from "./weeklyEmails";

const file = readFileSync("sample-data/cs-performance-sample.xlsx");
const rows = await parseWorkbook(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
const report = buildWeeklyReport(rows, loadTargets());
const employee = (id: string) => report.employees.find((e) => e.employeeId === id)!;

describe("チーム向けメール", () => {
  const doc = buildTeamEmail(report, mockTeamComment(report));

  it("件名は「【種類】日付　結論や重要な数字」の形", () => {
    expect(doc.subject).toBe("【週次レポート】2026/09/28週　目標達成1/3・満足度4.33");
  });

  it("要点は3行以内", () => {
    expect(doc.highlights.length).toBeLessThanOrEqual(3);
    expect(doc.highlights[0]).toBe("目標は3項目中1項目を達成しました（平均対応時間）。");
  });

  it("上位3名を載せる", () => {
    const html = renderEmailHtml(doc);
    expect(html).toContain("E001");
    expect(html).toContain("E004");
    expect(html).toContain("E008");
  });
});

describe("個人向けメール", () => {
  it("件名と要点", () => {
    const e = employee("E005");
    const doc = buildIndividualEmail(report, e, mockIndividualComment(report, e, []));
    expect(doc.subject).toMatch(/^【個人レポート】2026\/09\/28週　E005さん　目標達成\d\/3・満足度3\.87$/);
    expect(doc.highlights).toHaveLength(3);
    expect(doc.highlights[2]).toBe("総合スコアは16.1点（20名中20位）です。");
  });

  it("先週のデータがない人でも作れる", () => {
    const rowsWithoutLastWeek = rows.filter((r) => !(r.employeeId === "E006" && r.weekNumber === 39));
    const r = buildWeeklyReport(rowsWithoutLastWeek, loadTargets());
    const e = r.employees.find((x) => x.employeeId === "E006")!;
    const doc = buildIndividualEmail(r, e, mockIndividualComment(r, e, []));
    expect(doc.highlights[1]).not.toContain("先週比");
    expect(renderEmailHtml(doc)).toContain("—");
  });

  it("OLPの項目名があれば［］で添える", () => {
    const e = employee("E005");
    const doc = buildIndividualEmail(report, e, mockIndividualComment(report, e, ["項目A"]));
    expect(renderEmailText(doc)).toContain("［項目A］");
  });
});

describe("テンプレート", () => {
  it("AIの文章に含まれるHTMLはエスケープする", () => {
    const e = employee("E001");
    const doc = buildIndividualEmail(report, e, {
      goodPoints: ['<script>alert("x")</script>'],
      nextSteps: [],
      closing: "<b>よろしく</b>",
    });
    const html = renderEmailHtml(doc);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;よろしく&lt;/b&gt;");
  });

  it("要点が4行以上あっても3行だけ出す", () => {
    const doc = { ...buildTeamEmail(report, mockTeamComment(report)), highlights: ["1", "2", "3", "4"] };
    expect(renderEmailText(doc)).not.toMatch(/^4$/m);
  });

  it("空の箇条書きの区画は出さない", () => {
    const doc = buildTeamEmail(report, { goodPoints: [], concerns: [], nextActions: [], closing: "以上です。" });
    expect(renderEmailText(doc)).not.toContain("【来週に向けて】");
  });
});
