import type { Metadata } from "next";
import { AppProviders } from "@/components/shell/app-providers";
import { AppShell } from "@/components/shell/app-shell";
import { ConfirmHost } from "@/components/ui/confirm";
import { PromptHost } from "@/components/ui/prompt";
import { AssistantWidget } from "@/features/assistant/assistant-widget";
import { TransactionHost } from "@/features/transactions/transaction-modal";

// App screens are personal and render from local data: nothing useful for search engines.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppProviders>
      <AppShell>
        {children}
        <ConfirmHost />
        <PromptHost />
        <TransactionHost />
        <AssistantWidget />
      </AppShell>
    </AppProviders>
  );
}
