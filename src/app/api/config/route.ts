import { claudeModel, isMockAI } from "@/lib/claude";
import { dailyLimit, passcodeRequired } from "@/lib/usageGuard";

// 画面に「いま使える機能」を伝えるAPI（キーなどの中身は返さない）
export function GET() {
  return Response.json({
    aiMode: isMockAI() ? "mock" : "ai",
    model: isMockAI() ? null : claudeModel(),
    passcodeRequired: passcodeRequired(),
    limits: {
      weeklyComments: dailyLimit("weeklyComments"),
      meetingDrafts: dailyLimit("meetingDrafts"),
      briefingNotes: dailyLimit("briefingNotes"),
      coaching: dailyLimit("coaching"),
    },
  });
}
