// 週次パフォーマンスのExcelを読み込み、行の配列にする
// 「データ」シート（必須）と「コメント」シート（任意・お客様のコメント）を読む
import ExcelJS from "exceljs";
import { parseTenure } from "./tenure";
import { COMMENT_RATINGS, type CommentRating, type CustomerComment, type PerformanceRow } from "./types";

const REQUIRED_COLUMNS = [
  "日付",
  "社員ID",
  "対応チャンネル",
  "対応件数",
  "平均対応時間",
  "平均満足度",
  "週開始日",
  "Week番号",
] as const;
const TENURE_COLUMN = "在籍期間";
const DATA_SHEET = "データ";
const COMMENT_SHEET = "コメント";
const COMMENT_COLUMNS = ["日付", "社員ID", "対応チャンネル", "評価", "評価軸", "コメント"] as const;
const MAX_COMMENT_LENGTH = 500;
const MAX_ROWS = 20000;
const MAX_ERRORS = 10;

/** 読み込めなかったときのエラー。messages は画面にそのまま出せる日本語 */
export class WorkbookParseError extends Error {
  constructor(public readonly messages: string[]) {
    super(messages.join("\n"));
    this.name = "WorkbookParseError";
  }
}

export type ParsedWorkbook = { rows: PerformanceRow[]; comments: CustomerComment[] };

export async function parseWorkbook(data: ArrayBuffer): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data);
  } catch {
    throw new WorkbookParseError(["Excelファイル（.xlsx）として読み込めませんでした。"]);
  }

  // 「データ」シートがあればそれを、なければ最初のシートを読む
  const sheet = workbook.getWorksheet(DATA_SHEET) ?? workbook.worksheets[0];
  if (!sheet) throw new WorkbookParseError(["シートが見つかりませんでした。"]);
  const rows = parseDataSheet(sheet);

  // 「コメント」シートはなくてもよい
  const commentSheet = workbook.getWorksheet(COMMENT_SHEET);
  const comments = commentSheet && commentSheet !== sheet ? parseCommentSheet(commentSheet) : [];
  return { rows, comments };
}

function readHeaders(sheet: ExcelJS.Worksheet): Map<string, number> {
  const columnIndex = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    const header = cellText(cell.value);
    if (header) columnIndex.set(header, col);
  });
  return columnIndex;
}

function parseDataSheet(sheet: ExcelJS.Worksheet): PerformanceRow[] {
  const columnIndex = readHeaders(sheet);
  const missing = REQUIRED_COLUMNS.filter((name) => !columnIndex.has(name));
  if (missing.length > 0) {
    throw new WorkbookParseError([`1行目に次の列が見つかりません：${missing.join("、")}`]);
  }
  if (sheet.rowCount - 1 > MAX_ROWS) {
    throw new WorkbookParseError([`行数が多すぎます（上限 ${MAX_ROWS.toLocaleString()} 行）。`]);
  }

  const rows: PerformanceRow[] = [];
  const errors: string[] = [];
  const get = (row: ExcelJS.Row, name: string) => {
    const col = columnIndex.get(name);
    return col === undefined ? null : row.getCell(col).value;
  };

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || errors.length >= MAX_ERRORS) return;
    const problems: string[] = [];

    const date = toIsoDate(get(row, "日付"));
    if (!date) problems.push("日付");
    const employeeId = cellText(get(row, "社員ID"));
    if (!employeeId) problems.push("社員ID");
    const channel = cellText(get(row, "対応チャンネル"));
    if (!channel) problems.push("対応チャンネル");
    const count = toNumber(get(row, "対応件数"));
    if (count === null || count < 0 || !Number.isInteger(count)) problems.push("対応件数");
    const avgMinutes = toNumber(get(row, "平均対応時間"));
    if (avgMinutes === null || avgMinutes <= 0) problems.push("平均対応時間");
    const avgSatisfaction = toNumber(get(row, "平均満足度"));
    if (avgSatisfaction === null || avgSatisfaction < 1 || avgSatisfaction > 5) problems.push("平均満足度");
    const weekStart = toIsoDate(get(row, "週開始日"));
    if (!weekStart) problems.push("週開始日");
    const weekNumber = toNumber(get(row, "Week番号"));
    if (weekNumber === null || !Number.isInteger(weekNumber)) problems.push("Week番号");

    const tenureText = cellText(get(row, TENURE_COLUMN));
    const tenureMonths = tenureText ? parseTenure(tenureText) : null;
    if (tenureText && tenureMonths === null) problems.push("在籍期間");

    // 何も入っていない行は飛ばす
    if (problems.length === REQUIRED_COLUMNS.length) return;
    if (problems.length > 0) {
      errors.push(`${rowNumber}行目：${problems.join("、")} の値を確認してください。`);
      return;
    }
    rows.push({
      date: date!,
      employeeId,
      channel,
      count: count!,
      avgMinutes: avgMinutes!,
      avgSatisfaction: avgSatisfaction!,
      weekStart: weekStart!,
      weekNumber: weekNumber!,
      tenureMonths,
    });
  });

  if (errors.length > 0) {
    if (errors.length >= MAX_ERRORS) errors.push("（ほかにもある可能性があります）");
    throw new WorkbookParseError(errors);
  }
  if (rows.length === 0) throw new WorkbookParseError(["データの行がありません。"]);
  return rows;
}

function parseCommentSheet(sheet: ExcelJS.Worksheet): CustomerComment[] {
  const columnIndex = readHeaders(sheet);
  const missing = COMMENT_COLUMNS.filter((name) => !columnIndex.has(name));
  if (missing.length > 0) {
    throw new WorkbookParseError([`「${COMMENT_SHEET}」シートの1行目に次の列が見つかりません：${missing.join("、")}`]);
  }
  if (sheet.rowCount - 1 > MAX_ROWS) {
    throw new WorkbookParseError([`「${COMMENT_SHEET}」シートの行数が多すぎます（上限 ${MAX_ROWS.toLocaleString()} 行）。`]);
  }

  const comments: CustomerComment[] = [];
  const errors: string[] = [];
  const get = (row: ExcelJS.Row, name: string) => {
    const col = columnIndex.get(name);
    return col === undefined ? null : row.getCell(col).value;
  };

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || errors.length >= MAX_ERRORS) return;
    const date = toIsoDate(get(row, "日付"));
    const employeeId = cellText(get(row, "社員ID"));
    const channel = cellText(get(row, "対応チャンネル"));
    const rating = cellText(get(row, "評価"));
    const axis = cellText(get(row, "評価軸"));
    const text = cellText(get(row, "コメント"));
    // 何も入っていない行は飛ばす
    if (!date && !employeeId && !channel && !rating && !axis && !text) return;

    const problems: string[] = [];
    if (!date) problems.push("日付");
    if (!employeeId) problems.push("社員ID");
    if (!channel) problems.push("対応チャンネル");
    if (!isRating(rating)) problems.push(`評価（${COMMENT_RATINGS.join("／")}）`);
    if (!axis) problems.push("評価軸");
    if (!text || text.length > MAX_COMMENT_LENGTH) problems.push("コメント");
    if (problems.length > 0) {
      errors.push(`「${COMMENT_SHEET}」シート ${rowNumber}行目：${problems.join("、")} の値を確認してください。`);
      return;
    }
    comments.push({
      date: date!,
      employeeId,
      channel,
      commentId: cellText(get(row, "コメントID")),
      rating: rating as CommentRating,
      axis,
      text,
    });
  });

  if (errors.length > 0) {
    if (errors.length >= MAX_ERRORS) errors.push("（ほかにもある可能性があります）");
    throw new WorkbookParseError(errors);
  }
  return comments;
}

const isRating = (value: string): value is CommentRating => (COMMENT_RATINGS as readonly string[]).includes(value);

/** セルの値を文字列にする（数式の結果・リッチテキストにも対応） */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return toIsoDate(value) ?? "";
  if (typeof value === "object") {
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
    if ("text" in value) return String(value.text).trim();
    return "";
  }
  return String(value).trim();
}

function toNumber(value: ExcelJS.CellValue): number | null {
  if (value && typeof value === "object" && "result" in value) {
    return toNumber(value.result as ExcelJS.CellValue);
  }
  const number = typeof value === "number" ? value : Number(cellText(value));
  if (cellText(value) === "" || !Number.isFinite(number)) return null;
  return number;
}

/** Excelの日付（Date）や「2026-08-24」「2026/8/24」を YYYY-MM-DD にする */
function toIsoDate(value: ExcelJS.CellValue): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (value && typeof value === "object" && "result" in value) {
    return toIsoDate(value.result as ExcelJS.CellValue);
  }
  const match = (typeof value === "string" ? value.trim() : "").match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}
