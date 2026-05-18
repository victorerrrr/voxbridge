"use client";

import { AdminPageShell } from "@/components/admin-page-shell";
import { AiVoiceMatchingLab } from "@/components/admin/ai-voice-matching-lab";

export default function AdminAiVoiceMatchingPage() {
  return (
    <AdminPageShell activeItem="ai-voice-matching">
      <AiVoiceMatchingLab />
    </AdminPageShell>
  );
}
