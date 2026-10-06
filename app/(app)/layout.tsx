import { AppShell } from "@/components/shell/app-shell";
import { ConfirmHost } from "@/components/ui/confirm";
import { PromptHost } from "@/components/ui/prompt";
import { AssistantWidget } from "@/features/assistant/assistant-widget";
import { TransactionHost } from "@/features/transactions/transaction-modal";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell>
      {children}
      <ConfirmHost />
      <PromptHost />
      <TransactionHost />
      <AssistantWidget />
    </AppShell>
  );
}
