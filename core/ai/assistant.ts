import { z } from "zod";
import { CYCLES, GOAL_KINDS } from "../domain/finance";
import type { AIGateway } from "./gateway";
import type { ChatMessage } from "./types";

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const positive = z.coerce.number().positive();

// Everything the assistant is allowed to change. Anything else the model invents is dropped.
export const assistantActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add_transaction"),
    date: dayKey,
    amount: positive,
    kind: z.enum(["expense", "income"]),
    description: z.string().min(1),
    category: z.string().nullish(),
    account: z.string().nullish(),
  }),
  z.object({ type: z.literal("delete_transaction"), id: z.string().min(1) }),
  z.object({
    type: z.literal("add_recurring"),
    name: z.string().min(1),
    amount: positive,
    cycle: z.enum(CYCLES).catch("monthly"),
    startDate: dayKey,
    kind: z.enum(["subscription", "bill", "income"]).catch("subscription"),
    category: z.string().nullish(),
  }),
  z.object({ type: z.literal("add_purchase"), name: z.string().min(1), price: positive, targetDate: dayKey.nullish(), need: z.boolean().nullish() }),
  z.object({ type: z.literal("add_goal"), name: z.string().min(1), target: positive, deadline: dayKey.nullish(), monthlyContribution: z.coerce.number().nonnegative().nullish(), kind: z.enum(GOAL_KINDS).catch("other") }),
  z.object({ type: z.literal("set_balance"), account: z.string().min(1), balance: z.coerce.number() }),
  z.object({ type: z.literal("add_event"), title: z.string().min(1), date: dayKey, amount: z.coerce.number().nullish(), notes: z.string().nullish() }),
]);
export type AssistantAction = z.infer<typeof assistantActionSchema>;

const responseSchema = z.object({
  reply: z.string().default(""),
  actions: z.array(z.unknown()).nullish(),
});

export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantResult {
  reply: string;
  actions: AssistantAction[];
  dropped: number;
}

const GUIDE = `You are the assistant built into FireNances, a personal-finance web app (Spain, euros by default). The app tracks accounts and net worth, transactions (manual, CSV or AI-imported statements), recurring subscriptions and bills, payroll (Spanish IRPF/SS estimate) and the monthly forecast of free money, planned purchases, savings goals, an investment portfolio with quotes/news/AI analysis, a tax and market calendar, and FIRE projections.
Answer questions using ONLY the context below; do the maths for the user. Be concise and concrete. You are not a licensed financial adviser: give education and scenarios, never tell the user to buy or sell a specific security.
Reply with ONLY a JSON object: {"reply": string, "actions": Action[]}. "reply" is plain text in Spanish (no markdown tables). Use "actions": [] when nothing must change.
Action types (exact field names):
 {"type":"add_transaction","date":"YYYY-MM-DD","amount":number>0,"kind":"expense"|"income","description":string,"category":string|null,"account":string|null}
 {"type":"delete_transaction","id":string}
 {"type":"add_recurring","name":string,"amount":number,"cycle":"weekly"|"monthly"|"quarterly"|"semiannual"|"yearly","startDate":"YYYY-MM-DD" (next charge date),"kind":"subscription"|"bill"|"income","category":string|null}
 {"type":"add_purchase","name":string,"price":number,"targetDate":"YYYY-MM-DD"|null,"need":boolean}
 {"type":"add_goal","name":string,"target":number,"deadline":"YYYY-MM-DD"|null,"monthlyContribution":number|null,"kind":"emergency"|"house"|"car"|"travel"|"education"|"retirement"|"wedding"|"other"}
 {"type":"set_balance","account":string (exact account name),"balance":number}
 {"type":"add_event","title":string,"date":"YYYY-MM-DD","amount":number|null,"notes":string|null}
Rules: category/account names must match the lists in the context. Never invent transaction ids: delete only ids listed in the context. Resolve relative dates ("ayer", "el viernes") with today's date. If something essential is missing, ask in "reply" and return no actions. Never claim you did something that is not in "actions".`;

export function buildAssistantMessages(input: { context: string; history: AssistantTurn[]; message: string }): ChatMessage[] {
  return [
    { role: "system", content: `${GUIDE}\n\n${input.context}` },
    ...input.history.slice(-8).map((m): ChatMessage => ({ role: m.role, content: m.content })),
    { role: "user", content: input.message },
  ];
}

export function parseAssistantResponse(data: z.infer<typeof responseSchema>): AssistantResult {
  const actions: AssistantAction[] = [];
  let dropped = 0;
  for (const raw of data.actions ?? []) {
    const parsed = assistantActionSchema.safeParse(raw);
    if (parsed.success) actions.push(parsed.data);
    else dropped += 1;
  }
  return { reply: data.reply.trim(), actions, dropped };
}

export async function runAssistant(gateway: AIGateway, input: { context: string; history: AssistantTurn[]; message: string }, signal?: AbortSignal): Promise<AssistantResult> {
  const { data } = await gateway.chatJSON({ messages: buildAssistantMessages(input), temperature: 0.2, maxTokens: 1500, signal }, responseSchema);
  return parseAssistantResponse(data);
}
