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
  { name: 'Global X', keywords: ['Global X', 'BetaPro'], slug: 'global-x' },
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

function findProvider(etfName: string) {
  const normalizedName = etfName.toLowerCase();
  return providers.find(p =>
    p.keywords.some(k => {
      const lowerKeyword = k.toLowerCase();
      // Escape special regex characters
      const escapedKeyword = lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Use word boundaries to prevent partial matches (e.g. 'ARK' in 'Market')
      const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
      return regex.test(normalizedName);
    })
  );
}

export function getProviderLogo(etfName: string): string | null {
  const match = findProvider(etfName);

  if (match) {
    const missing = ['agfiq', 'advisorshares', 'alpha-architect', 'american-century-investments', 'cibc-asset-management'];
    if (missing.includes(match.slug)) return null;
    return `/logos/${match.slug}.png`;
  }
  return null;
}

// Using jsDelivr for faster, cached delivery
const ICON_BASE_URL = 'https://cdn.jsdelivr.net/gh/nvstly/icons@main';

export function getAssetIconUrl(ticker: string, name: string, assetType: string = 'ETF'): string | null {
  const upperTicker = ticker.toUpperCase();

  // STOCK logic
  if (assetType === 'STOCK') {
    return `${ICON_BASE_URL}/ticker_icons/${upperTicker}.png`;
  }

  // ETF logic
  if (assetType === 'ETF') {
    const match = findProvider(name);

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

    // Fallback: If no provider matched, assume it might be a stock or an ETF with a ticker icon.
    // This supports mixed lists where stocks are present, or ETFs without a known provider but with a ticker icon.
    return `${ICON_BASE_URL}/ticker_icons/${upperTicker}.png`;
  }

  return null;
}
