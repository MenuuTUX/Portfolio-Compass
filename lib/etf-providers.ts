const providers = [
  { name: 'AGFiQ', keywords: ['AGFiQ'], slug: 'agfiq' },
  { name: 'AdvisorShares', keywords: ['AdvisorShares'], slug: 'advisorshares' },
  { name: 'Alpha Architect', keywords: ['Alpha Architect'], slug: 'alpha-architect' },
  { name: 'American Century', keywords: ['American Century'], slug: 'american-century-investments' },
  { name: 'ARK Invest', keywords: ['ARK'], slug: 'ark-invest' },
  { name: 'iShares', keywords: ['iShares', 'BlackRock'], slug: 'ishares', stockTicker: 'BLK' },
  { name: 'BMO', keywords: ['BMO', 'Bank of Montreal'], slug: 'bmo-asset-management', stockTicker: 'BMO' },
  { name: 'BNY Mellon', keywords: ['BNY Mellon'], slug: 'bny-mellon', stockTicker: 'BK' },
  { name: 'Schwab', keywords: ['Schwab', 'Charles Schwab'], slug: 'charles-schwab', stockTicker: 'SCHW' },
  { name: 'CI Global', keywords: ['CI Global', 'CI Galaxy', 'CI'], slug: 'ci-global-asset-management' },
  { name: 'CIBC', keywords: ['CIBC'], slug: 'cibc-asset-management' },
  { name: 'Desjardins', keywords: ['Desjardins'], slug: 'desjardins-investments' },
  { name: 'Direxion', keywords: ['Direxion'], slug: 'direxion' },
  { name: 'Dynamic', keywords: ['Dynamic Funds', 'Dynamic'], slug: 'dynamic-funds' },
  { name: 'Evolve', keywords: ['Evolve'], slug: 'evolve-etfs' },
  { name: 'Fidelity', keywords: ['Fidelity'], slug: 'fidelity' },
  { name: 'First Trust', keywords: ['First Trust'], slug: 'first-trust' },
  { name: 'Franklin', keywords: ['Franklin', 'Franklin Templeton'], slug: 'franklin-templeton', stockTicker: 'BEN' },
  { name: 'Global X', keywords: ['Global X'], slug: 'global-x' },
  { name: 'Goldman Sachs', keywords: ['Goldman Sachs'], slug: 'goldman-sachs', stockTicker: 'GS' },
  { name: 'GraniteShares', keywords: ['GraniteShares'], slug: 'graniteshares' },
  { name: 'Hamilton', keywords: ['Hamilton'], slug: 'hamilton-etfs' },
  { name: 'Harvest', keywords: ['Harvest'], slug: 'harvest-portfolios-group' },
  { name: 'Invesco', keywords: ['Invesco'], slug: 'invesco', stockTicker: 'IVZ' },
  { name: 'J.P. Morgan', keywords: ['JPMorgan', 'J.P. Morgan'], slug: 'j-p-morgan-asset-management', stockTicker: 'JPM' },
  { name: 'KraneShares', keywords: ['KraneShares'], slug: 'kraneshares' },
  { name: 'Mackenzie', keywords: ['Mackenzie'], slug: 'mackenzie-investments' },
  { name: 'Manulife', keywords: ['Manulife'], slug: 'manulife-investments', stockTicker: 'MFC' },
  { name: 'Morgan Stanley', keywords: ['Morgan Stanley'], slug: 'morgan-stanley', stockTicker: 'MS' },
  { name: 'National Bank', keywords: ['NBI', 'National Bank'], slug: 'national-bank-investments', stockTicker: 'NA' },
  { name: 'PIMCO', keywords: ['PIMCO'], slug: 'pimco' },
  { name: 'ProShares', keywords: ['ProShares'], slug: 'proshares' },
  { name: 'Purpose', keywords: ['Purpose'], slug: 'purpose-investments' },
  { name: 'RBC', keywords: ['RBC'], slug: 'rbc-global-asset-management', stockTicker: 'RY' },
  { name: 'Scotia', keywords: ['Scotia'], slug: 'scotia-global-asset-management', stockTicker: 'BNS' },
  { name: 'SPDR', keywords: ['SPDR', 'State Street'], slug: 'spdr', stockTicker: 'STT' },
  { name: 'TD', keywords: ['TD', 'Toronto-Dominion'], slug: 'td-asset-management', stockTicker: 'TD' },
  { name: 'VanEck', keywords: ['VanEck'], slug: 'vaneck' },
  { name: 'Vanguard', keywords: ['Vanguard'], slug: 'vanguard' },
  { name: 'VictoryShares', keywords: ['VictoryShares'], slug: 'victoryshares' },
  { name: 'WisdomTree', keywords: ['WisdomTree'], slug: 'wisdomtree', stockTicker: 'WT' },
  { name: 'Xtrackers', keywords: ['Xtrackers', 'DWS'], slug: 'xtrackers', stockTicker: 'DWS' },
];

export function getProviderLogo(etfName: string): string | null {
  const normalizedName = etfName.toLowerCase();
  const match = providers.find(p =>
    p.keywords.some(k => normalizedName.includes(k.toLowerCase()))
  );

  if (match) {
    const missing = ['agfiq', 'advisorshares', 'alpha-architect', 'american-century-investments', 'cibc-asset-management'];
    if (missing.includes(match.slug)) return null;
    return `/logos/${match.slug}.png`;
  }
  return null;
}

// Using jsDelivr for faster, cached delivery
const ICON_BASE_URL = 'https://cdn.jsdelivr.net/gh/nvstly/icons@main';

const CRYPTO_ASSETS = [
  { id: 'BITCOIN', symbol: 'BTC' },
  { id: 'ETHEREUM', symbol: 'ETH' },
  { id: 'SOLANA', symbol: 'SOL' },
  { id: 'CARDANO', symbol: 'ADA' },
  { id: 'RIPPLE', symbol: 'XRP' },
  { id: 'DOGECOIN', symbol: 'DOGE' },
  { id: 'POLKADOT', symbol: 'DOT' },
  { id: 'CHAINLINK', symbol: 'LINK' },
  { id: 'LITECOIN', symbol: 'LTC' },
  { id: 'STELLAR', symbol: 'XLM' }
];

// Create a lookup map that handles both IDs and Symbols
const CRYPTO_RESOLVER = CRYPTO_ASSETS.reduce((acc, { id, symbol }) => {
  acc[id] = symbol;
  acc[symbol] = symbol;
  return acc;
}, {} as Record<string, string>);

export function getAssetIconUrl(ticker: string, name: string, assetType: string = 'ETF'): string | null {
  const upperTicker = ticker.toUpperCase();

  // STOCK logic
  if (assetType === 'STOCK') {
    return `${ICON_BASE_URL}/ticker_icons/${upperTicker}.png`;
  }

  // CRYPTO logic
  if (assetType === 'CRYPTO') {
    // Explicitly check our known crypto assets map which supports both IDs (BITCOIN) and Symbols (BTC).
    // If not found, fall back to using the ticker as-is (e.g. for unlisted cryptos that might have an icon).
    const symbol = CRYPTO_RESOLVER[upperTicker];
    return `${ICON_BASE_URL}/crypto_icons/${symbol || upperTicker}.png`;
  }

  // ETF logic
  if (assetType === 'ETF') {
    const normalizedName = name.toLowerCase();
    const match = providers.find(p =>
      p.keywords.some(k => normalizedName.includes(k.toLowerCase()))
    );

    if (match) {
        if (match.stockTicker) {
             // Exclude WT if known missing, but try CDN anyway
            if (match.stockTicker === 'WT') return `/logos/${match.slug}.png`;
            return `${ICON_BASE_URL}/ticker_icons/${match.stockTicker}.png`;
        }

        const missing = ['agfiq', 'advisorshares', 'alpha-architect', 'american-century-investments', 'cibc-asset-management'];
        if (missing.includes(match.slug)) return null;
        return `/logos/${match.slug}.png`;
    }
  }

  return null;
}
