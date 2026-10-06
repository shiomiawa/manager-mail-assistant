"use client";

import { useSyncExternalStore } from "react";
import type { CustomerComment, PerformanceRow } from "@/lib/report/types";

// 読み込んだExcel（成績とお客様コメント）を、タブをまたいで共有する（ブラウザの中だけ。サーバーには送らない）
// Weekly Performance Report と Survey Coaching の両方で使う

export const SAMPLE_WORKBOOK_URL = "/sample/cs-performance-sample.xlsx";
const SAMPLE_NAME = "サンプルデータ（架空の20名・6週間）";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export type WorkbookState = {
  rows: PerformanceRow[] | null;
  comments: CustomerComment[];
  fileName: string;
  loading: boolean;
  errors: string[] | null;
  /** 読み込むたびに1ずつ増える（古い下書きを消すときの目印） */
  version: number;
};

let state: WorkbookState = { rows: null, comments: [], fileName: "", loading: false, errors: null, version: 0 };
const listeners = new Set<() => void>();
const setState = (patch: Partial<WorkbookState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const SERVER_STATE = state;

export const useWorkbook = () => useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);

async function load(data: ArrayBuffer, name: string) {
  setState({ loading: true, errors: null });
  // Excelを読む部品は大きいので、使うときに読み込む
  const { parseWorkbook, WorkbookParseError } = await import("@/lib/report/parseWorkbook");
  try {
    const parsed = await parseWorkbook(data);
    setState({
      rows: parsed.rows,
      comments: parsed.comments,
      fileName: name,
      loading: false,
      version: state.version + 1,
    });
  } catch (error) {
    setState({
      loading: false,
      errors: error instanceof WorkbookParseError ? error.messages : ["ファイルを読み込めませんでした。"],
    });
  }
}

export async function loadWorkbookFile(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    setState({ errors: ["ファイルが大きすぎます（5MBまで）。"] });
    return;
  }
  await load(await file.arrayBuffer(), file.name);
}

export async function loadSampleWorkbook() {
  setState({ loading: true, errors: null });
  try {
    const response = await fetch(SAMPLE_WORKBOOK_URL);
    if (!response.ok) throw new Error();
    await load(await response.arrayBuffer(), SAMPLE_NAME);
  } catch {
    setState({ loading: false, errors: ["サンプルデータを読み込めませんでした。"] });
  }
}
