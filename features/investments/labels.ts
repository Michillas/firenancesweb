import type { AssetType, PriceSource } from "@/core/domain/finance";

export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  index_fund: "Fondo indexado",
  etf: "ETF",
  stock: "Acción",
  crypto: "Cripto",
  bond: "Renta fija",
  reit: "SOCIMI / REIT",
  commodity: "Materias primas",
  pension: "Plan de pensiones",
  cash: "Monetario / liquidez",
  other: "Otro",
};

export const SOURCE_LABEL: Record<PriceSource, string> = {
  auto: "Automático",
  yahoo: "Yahoo Finance",
  nasdaq: "Nasdaq",
  ftstock: "Financial Times (bolsas mundiales)",
  justetf: "justETF (por ISIN)",
  ft: "Financial Times (fondos, por ISIN)",
  coingecko: "CoinGecko",
  manual: "Manual",
};
