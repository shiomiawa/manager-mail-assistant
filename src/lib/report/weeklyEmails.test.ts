import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderEmailHtml, renderEmailText } from "@/lib/email/template";
import { buildWeeklyReport } from "./aggregate";
import { mockIndividualComment, mockTeamComment } from "./mockComments";
import { parseWorkbook } from "./parseWorkbook";
import { loadTargets } from "./targets";
import { buildIndividualEmail, buildTeamEmail } from "./weeklyEmails";

const file = readFileSync("sample-data/cs-performance-sample.xlsx");
const { rows, comments } = await parseWorkbook(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
const report = buildWeeklyReport(rows, loadTargets(), undefined, comments);
const employee = (id: string) => report.employees.find((e) => e.employeeId === id)!;

describe("チーム向けメール", () => {
  const doc = buildTeamEmail(report, mockTeamComment(report));

  it("件名は「【種類】日付 宛先」の短い形", () => {
    expect(doc.subject).toBe("【Weekly】9/28 Team");
  });

  it("要点は3行以内", () => {
    expect(doc.highlights.length).toBeLessThanOrEqual(3);
    expect(doc.highlights).toEqual([
      "目標は3項目中1項目を達成しました（AHT）。",
      "Quality：CSATは4.33（先週比±0.00）で、目標4.40まであと0.07です。",
      "Efficiency：Casesは2,280件（先週比−63件）、AHTは7.4分です。",
    ]);
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
    expect(doc.subject).toBe("【Weekly】9/28 E005");
    expect(doc.highlights).toHaveLength(3);
    expect(doc.highlights[1]).toMatch(/^Quality：CSATは3\.87（先週比−0\.\d\d）で、目標4\.30まであと0\.43です。$/);
    expect(renderEmailText(doc)).toContain("Total | 16.1 | #20");
  });

  it("先週のデータがない人でも作れる", () => {
    const rowsWithoutLastWeek = rows.filter((r) => !(r.employeeId === "E006" && r.weekNumber === 39));
    const r = buildWeeklyReport(rowsWithoutLastWeek, loadTargets(), undefined, comments);
    const e = r.employees.find((x) => x.employeeId === "E006")!;
    const doc = buildIndividualEmail(r, e, mockIndividualComment(r, e, []));
    expect(doc.highlights[1]).not.toContain("先週比");
    expect(renderEmailHtml(doc)).toContain("—");
  });

  it("行動指針の項目名があれば［］で添える", () => {
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
    expect(renderEmailText(doc)).not.toContain("【Next Week】");
  });
});

describe("ラベルは英語、説明文は日本語", () => {
  const doc = buildTeamEmail(report, mockTeamComment(report));
  const text = renderEmailText(doc);

  it("見出しと項目名は英語", () => {
    for (const label of ["Key Points", "This Week", "Quality", "Efficiency", "4-Week Trend", "Top 3 (Total Score)", "Good Points", "Concerns", "Next Week"]) {
      expect(text).toContain(label);
    }
    expect(text).toContain("Channel | Cases | AHT | CSAT");
    expect(text).toContain("Phone |");
    expect(text).toContain("#1 | E001");
  });

  it("日本語のラベルは残っていない", () => {
    for (const label of ["今週の数字", "過去4週間の推移", "上位3名", "振り返り", "よかった点", "気になる点", "来週に向けて", "達成）", "未達）", "電話", "満足度"]) {
      expect(text).not.toContain(label);
    }
  });
});

describe("個人向けの Good Points・Next Steps", () => {
  it("全員分、1項目100字以内で、どこかで4週間の推移に触れる", () => {
    for (const e of report.employees) {
      const comment = mockIndividualComment(report, e, []);
      const items = [...comment.goodPoints, ...comment.nextSteps.map((step) => step.text)];
      for (const item of items) expect(item.length, `${e.employeeId}: ${item}`).toBeLessThanOrEqual(100);
      if (e.weeksWithData >= 2 && e.voice.total + items.length > 0) {
        expect(items.join(""), e.employeeId).toMatch(/週間/);
      }
    }
  });

  it("下がっている人を「安定」とは書かない。目標との差を「少し」とごまかさない", () => {
    for (const e of report.employees) {
      const comment = mockIndividualComment(report, e, []);
      const text = [...comment.goodPoints, ...comment.nextSteps.map((step) => step.text)].join("");
      expect(text, e.employeeId).not.toMatch(/少し上回|あと少し/);
    }
    expect(mockIndividualComment(report, employee("E005"), []).goodPoints.join("")).not.toContain("安定");
  });

  it("E005（下降中）は Next Steps で推移に触れて、責めずに問いかける", () => {
    const e = employee("E005");
    const steps = mockIndividualComment(report, e, []).nextSteps.map((step) => step.text);
    expect(steps).toContain("CSATは4週間で4.47→3.87と下がってきています。気になった対応があれば、次の1on1で聞かせてください。");
  });
});

describe("お客様の声（Customer Voice）", () => {
  it("個人向け：Kudosと改善点を引用し、ほめ言葉と声かけを添える", () => {
    const e = employee("E002");
    const doc = buildIndividualEmail(report, e, mockIndividualComment(report, e, []));
    const text = renderEmailText(doc);
    expect(text).toContain("【Customer Voice】");
    expect(text).toContain("［Kudos］");
    expect(text).toContain("［Areas to Improve］");
    expect(text).toMatch(/・「.+」（(Resolution|Speed|Empathy|Knowledge|Attitude)）/);
    // 改善点への声かけが Next Steps の先頭に入る
    const nextSteps = doc.sections.find((section) => section.heading === "Next Steps")!.blocks[0];
    expect(nextSteps.type === "bullets" && nextSteps.items[0]).toMatch(/^(Resolution|Speed|Empathy|Knowledge|Attitude)に関する声が\d+件ありました。/);
  });

  it("Kudosがあれば Good Points の先頭でほめる", () => {
    const e = employee("E015"); // 今週 Kudos 9件
    const comment = mockIndividualComment(report, e, []);
    expect(comment.goodPoints[0]).toBe(
      "EmpathyのKudosが4件届きました。親身な対応が、お客様の安心につながっています。Efficiencyはチーム#3で、AHTも4週間5.5〜5.7分と安定しています。",
    );
  });

  it("チーム向け：改善点の引用は出さず、Kudosは社員IDつきで別々の人から", () => {
    const doc = buildTeamEmail(report, mockTeamComment(report));
    const text = renderEmailText(doc);
    expect(text).not.toContain("Areas to Improve");
    const kudos = report.team.voice.kudos;
    expect(kudos.length).toBe(3);
    expect(new Set(kudos.map((k) => k.employeeId)).size).toBe(3);
    expect(text).toContain(`「${kudos[0].text}」${kudos[0].employeeId}`);
    expect(text).toContain("Topic | Positive | Negative");
  });

  it("コメントがない人は Customer Voice の区画を出さない", () => {
    const e = employee("E009");
    expect(e.voice.total).toBe(0);
    const doc = buildIndividualEmail(report, e, mockIndividualComment(report, e, []));
    expect(renderEmailText(doc)).not.toContain("Customer Voice");
  });
});
