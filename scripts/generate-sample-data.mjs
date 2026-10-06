// 週次パフォーマンスレポート用の架空サンプルExcelを作る
// 使い方：npm run sample-data
// 乱数の種を固定しているので、何度実行しても同じ内容になる
import ExcelJS from "exceljs";
import { mkdirSync } from "node:fs";

const OUTPUT = "sample-data/cs-performance-sample.xlsx";

// 6週間分（月〜金）。最後の週を「今週」として扱う
const FIRST_MONDAY = Date.UTC(2026, 7, 24); // 2026-08-24
const WEEKS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

// チャンネルごとの基準値（件数／日、平均対応時間（分）、平均満足度）
const CHANNELS = {
  電話: { count: 18, minutes: 7.5, csat: 4.3 },
  メール: { count: 14, minutes: 11.0, csat: 4.2 },
  チャット: { count: 28, minutes: 5.5, csat: 4.4 },
};

// 架空の社員。週ごとの変化は6週分の配列で持つ（null の週は在籍していない）
// count・minutes は基準値への倍率、csat は基準値への加算
const flat = (v) => Array(WEEKS).fill(v);
const EMPLOYEES = [
  // 安定して上位
  { id: "E001", channels: ["電話", "メール"], count: flat(1.1), minutes: flat(0.9), csat: flat(0.35) },
  // 件数が多く対応も早いが、満足度は低め
  { id: "E002", channels: ["電話", "チャット"], count: flat(1.35), minutes: flat(0.75), csat: flat(-0.45) },
  // 満足度は高いが、対応時間が長め
  { id: "E003", channels: ["電話", "メール"], count: flat(0.8), minutes: flat(1.35), csat: flat(0.45) },
  // 週を追って改善している
  { id: "E004", channels: ["メール", "チャット"], count: flat(1.0),
    minutes: [1.2, 1.15, 1.1, 1.05, 1.0, 0.95], csat: [-0.4, -0.3, -0.15, 0, 0.15, 0.25] },
  // 直近2週で満足度が下がっている
  { id: "E005", channels: ["電話", "メール", "チャット"], count: flat(1.0),
    minutes: [1.0, 1.0, 1.0, 1.0, 1.05, 1.1], csat: [0.2, 0.2, 0.15, 0, -0.3, -0.5] },
  // 3週目から配属された新人
  { id: "E006", channels: ["チャット", "メール"],
    count: [null, null, 0.6, 0.75, 0.85, 0.95], minutes: [null, null, 1.4, 1.3, 1.2, 1.1],
    csat: [null, null, -0.2, -0.1, 0, 0.05] },
  // 平均的。今週は木・金が休み
  { id: "E007", channels: ["電話", "メール"], count: flat(1.0), minutes: flat(1.0), csat: flat(0),
    daysOff: ["2026-10-01", "2026-10-02"] },
  // チャット専任
  { id: "E008", channels: ["チャット"], count: flat(1.2), minutes: flat(0.95), csat: flat(0.1) },
  // 時短勤務（件数は少なめ）
  { id: "E009", channels: ["メール"], count: flat(0.6), minutes: flat(1.0), csat: flat(0.15) },
  // Week36に夏休み（1週間不在）
  { id: "E010", channels: ["電話", "チャット"], count: [1.05, null, 1.05, 1.0, 1.05, 1.0],
    minutes: [0.95, null, 0.95, 0.95, 0.95, 0.95], csat: [0.05, null, 0.05, 0.1, 0.05, 0.1] },
  // ここから下は、特別な傾向を持たない平均的なメンバー
  { id: "E011", channels: ["電話"], count: flat(1.05), minutes: flat(1.05), csat: flat(0.0) },
  { id: "E012", channels: ["電話", "メール"], count: flat(0.95), minutes: flat(0.95), csat: flat(0.1) },
  { id: "E013", channels: ["チャット", "メール"], count: flat(1.1), minutes: flat(1.0), csat: flat(-0.1) },
  { id: "E014", channels: ["電話"], count: flat(0.95), minutes: flat(1.1), csat: flat(0.2) },
  { id: "E015", channels: ["電話", "チャット"], count: flat(1.0), minutes: flat(0.9), csat: flat(-0.05) },
  { id: "E016", channels: ["メール"], count: flat(1.1), minutes: flat(0.95), csat: flat(0.05) },
  { id: "E017", channels: ["電話", "メール"], count: flat(1.0), minutes: flat(1.05), csat: flat(-0.15) },
  { id: "E018", channels: ["チャット"], count: flat(1.0), minutes: flat(1.05), csat: flat(0.0) },
  { id: "E019", channels: ["電話", "メール", "チャット"], count: flat(1.05), minutes: flat(1.0), csat: flat(0.15) },
  { id: "E020", channels: ["電話"], count: flat(1.1), minutes: flat(0.9), csat: flat(0.05) },
];

// 再現できる乱数（mulberry32）
function createRandom(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = createRandom(20261006);
const jitter = (range) => 1 + (random() * 2 - 1) * range;
const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toIsoDate = (ms) => new Date(ms).toISOString().slice(0, 10);

// ISO週番号（月曜始まり）
function isoWeek(ms) {
  // その週の木曜日が属する年で数える
  const weekday = (new Date(ms).getUTCDay() + 6) % 7; // 月曜=0
  const thursday = new Date(ms + (3 - weekday) * DAY_MS);
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - jan1) / DAY_MS / 7) + 1;
}

const rows = [];
for (let week = 0; week < WEEKS; week++) {
  const weekStart = FIRST_MONDAY + week * 7 * DAY_MS;
  const weekNumber = isoWeek(weekStart);
  for (let day = 0; day < 5; day++) {
    const date = weekStart + day * DAY_MS;
    for (const employee of EMPLOYEES) {
      if (employee.count[week] === null) continue;
      if (employee.daysOff?.includes(toIsoDate(date))) continue;
      for (const channel of employee.channels) {
        const base = CHANNELS[channel];
        // 複数チャンネルを持つ人は、件数を分け合う
        const share = 1.6 / (employee.channels.length + 0.6);
        rows.push({
          date,
          employeeId: employee.id,
          channel,
          count: Math.max(1, Math.round(base.count * share * employee.count[week] * jitter(0.2))),
          minutes: round(base.minutes * employee.minutes[week] * jitter(0.1), 1),
          csat: round(clamp((base.csat + employee.csat[week]) * jitter(0.035), 1, 5), 2),
          weekStart,
          weekNumber,
        });
      }
    }
  }
}

const workbook = new ExcelJS.Workbook();
const font = { name: "Arial", size: 10 };
const headerStyle = {
  font: { ...font, bold: true, color: { argb: "FFFFFFFF" } },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5597" } },
  alignment: { vertical: "middle", horizontal: "center" },
};

const dataSheet = workbook.addWorksheet("データ", { views: [{ state: "frozen", ySplit: 1 }] });
dataSheet.columns = [
  { header: "日付", key: "date", width: 12, style: { font, numFmt: "yyyy-mm-dd" } },
  { header: "社員ID", key: "employeeId", width: 10, style: { font } },
  { header: "対応チャンネル", key: "channel", width: 14, style: { font } },
  { header: "対応件数", key: "count", width: 10, style: { font, numFmt: "0" } },
  { header: "平均対応時間", key: "minutes", width: 13, style: { font, numFmt: "0.0" } },
  { header: "平均満足度", key: "csat", width: 11, style: { font, numFmt: "0.00" } },
  { header: "週開始日", key: "weekStart", width: 12, style: { font, numFmt: "yyyy-mm-dd" } },
  { header: "Week番号", key: "weekNumber", width: 10, style: { font, numFmt: "0" } },
];
for (const row of rows) {
  dataSheet.addRow({ ...row, date: new Date(row.date), weekStart: new Date(row.weekStart) });
}
dataSheet.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));
dataSheet.autoFilter = { from: "A1", to: "H1" };

const notes = workbook.addWorksheet("説明");
notes.columns = [
  { header: "列", key: "column", width: 16, style: { font } },
  { header: "内容", key: "description", width: 70, style: { font, alignment: { wrapText: true } } },
];
notes.addRows([
  { column: "日付", description: "対応した日（月〜金）" },
  { column: "社員ID", description: "架空の社員ID（E001〜E020）" },
  { column: "対応チャンネル", description: "電話／メール／チャット。1人が複数のチャンネルを担当する日は、チャンネルごとに1行" },
  { column: "対応件数", description: "その日・そのチャンネルの対応件数（件）" },
  { column: "平均対応時間", description: "1件あたりの平均対応時間（分）。短いほど高評価" },
  { column: "平均満足度", description: "お客様アンケートの平均（1〜5）" },
  { column: "週開始日", description: "その週の月曜日" },
  { column: "Week番号", description: "ISO週番号（月曜始まり）" },
  { column: "", description: "" },
  { column: "注意", description: "このファイルのデータはすべて架空のものです。実在の社員・お客様とは関係ありません。" },
]);
notes.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));

mkdirSync("sample-data", { recursive: true });
await workbook.xlsx.writeFile(OUTPUT);
console.log(`${OUTPUT} を作成しました（${rows.length}行）`);
