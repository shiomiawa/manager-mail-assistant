import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CSマネージャー メール下書き",
  description: "週次パフォーマンスレポートや会議メモから、同じ型で読みやすいメールの下書きを作ります。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
