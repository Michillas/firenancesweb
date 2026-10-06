import { accountSchema, assetSchema, calendarEventSchema, categorySchema, goalSchema, holdingSchema, purchaseSchema, recurringSchema, snapshotSchema, transactionSchema } from "@/core/domain/finance";
import { analysisSchema, feedSchema, fxSchema, quoteSchema } from "@/core/domain/market";
import { planSchema } from "@/core/domain/plan";
import { deviceSettingsSchema, userSettingsSchema } from "@/core/domain/settings";
import { createCollectionStore } from "./create-collection-store";
import { createDocStore } from "./create-doc-store";

// Collection names are storage keys: never rename one without a migration.
export const accounts = createCollectionStore({ name: "accounts", prefix: "acc", schema: accountSchema });
export const categories = createCollectionStore({ name: "categories", prefix: "cat", schema: categorySchema });
export const transactions = createCollectionStore({ name: "transactions", prefix: "tx", schema: transactionSchema });
export const recurring = createCollectionStore({ name: "recurring", prefix: "rec", schema: recurringSchema });
export const holdings = createCollectionStore({ name: "holdings", prefix: "hld", schema: holdingSchema });
export const assets = createCollectionStore({ name: "assets", prefix: "ast", schema: assetSchema });
export const snapshots = createCollectionStore({ name: "snapshots", prefix: "nw", schema: snapshotSchema });
export const goals = createCollectionStore({ name: "goals", prefix: "gol", schema: goalSchema });
export const purchases = createCollectionStore({ name: "purchases", prefix: "pur", schema: purchaseSchema });
export const events = createCollectionStore({ name: "events", prefix: "evt", schema: calendarEventSchema });
// Market cache: re-fetchable, kept so the app works offline and opens instantly.
export const quotes = createCollectionStore({ name: "quotes", prefix: "q", schema: quoteSchema });
export const feeds = createCollectionStore({ name: "feeds", prefix: "fd", schema: feedSchema });
export const analyses = createCollectionStore({ name: "analyses", prefix: "an", schema: analysisSchema });
export const fxRates = createCollectionStore({ name: "fx", prefix: "fx", schema: fxSchema });

export const settings = createDocStore({ name: "settings", schema: userSettingsSchema });
export const plan = createDocStore({ name: "plan", schema: planSchema });
// Secrets (AI keys): persisted locally, excluded from exports.
export const device = createDocStore({ name: "device", schema: deviceSettingsSchema, syncs: false });

// The user's data (what a backup contains).
export const dataCollections = [accounts, categories, transactions, recurring, holdings, assets, snapshots, goals, purchases, events, analyses] as const;
export const cacheCollections = [quotes, feeds, fxRates] as const;
export const collections = [...dataCollections, ...cacheCollections] as const;
export const docs = [settings, plan, device] as const;
