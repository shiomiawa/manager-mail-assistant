import type { ReactNode } from "react";

/**
 * 各フォルダの作業画面：左に作成の手順、右にプレビュー（メールソフトの閲覧画面のような下地）。
 * 狭い画面では縦に積む
 */
export function Workspace({ compose, reader }: { compose: ReactNode; reader: ReactNode }) {
  return (
    <div className="grid min-h-full lg:grid-cols-[minmax(340px,440px)_minmax(0,1fr)]">
      <section aria-label="作成" className="min-w-0 space-y-3 border-b border-line bg-white p-4 lg:border-r lg:border-b-0">
        {compose}
      </section>
      <section aria-label="プレビュー" className="flex min-w-0 flex-col bg-reader">
        {reader}
      </section>
    </div>
  );
}

/** 作成の手順の1つ（見出しの帯つき） */
export function Step({ n, label, title, children }: { n: number; label: string; title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line-soft bg-white">
      <p className="border-b border-line-soft bg-brand-50 px-3 py-1 text-[11px] tracking-wider text-muted uppercase">
        Step {n} · {label}
      </p>
      <div className="space-y-2 p-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** 下書きを作る前のプレビュー欄 */
export function EmptyReader({ children }: { children: ReactNode }) {
  return (
    <div className="m-4 flex flex-1 items-center justify-center rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
      <div className="max-w-sm space-y-2">{children}</div>
    </div>
  );
}
