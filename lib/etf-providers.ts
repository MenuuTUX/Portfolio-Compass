
const providers = [
  { name: 'AGFiQ', keywords: ['AGFiQ'], slug: 'agfiq' }, // No logo yet
  { name: 'AdvisorShares', keywords: ['AdvisorShares'], slug: 'advisorshares' }, // No logo yet
  { name: 'Alpha Architect', keywords: ['Alpha Architect'], slug: 'alpha-architect' }, // No logo yet
  { name: 'American Century', keywords: ['American Century'], slug: 'american-century-investments' }, // No logo yet
  { name: 'ARK Invest', keywords: ['ARK'], slug: 'ark-invest' },
  { name: 'iShares', keywords: ['iShares', 'BlackRock'], slug: 'ishares' },
  { name: 'BMO', keywords: ['BMO', 'Bank of Montreal'], slug: 'bmo-asset-management' },
  { name: 'BNY Mellon', keywords: ['BNY Mellon'], slug: 'bny-mellon' },
  { name: 'Schwab', keywords: ['Schwab', 'Charles Schwab'], slug: 'charles-schwab' },
  { name: 'CI Global', keywords: ['CI Global', 'CI Galaxy', 'CI'], slug: 'ci-global-asset-management' },
  { name: 'CIBC', keywords: ['CIBC'], slug: 'cibc-asset-management' }, // No logo yet
  { name: 'Desjardins', keywords: ['Desjardins'], slug: 'desjardins-investments' },
  { name: 'Direxion', keywords: ['Direxion'], slug: 'direxion' },
  { name: 'Dynamic', keywords: ['Dynamic Funds', 'Dynamic'], slug: 'dynamic-funds' },
  { name: 'Evolve', keywords: ['Evolve'], slug: 'evolve-etfs' },
  { name: 'Fidelity', keywords: ['Fidelity'], slug: 'fidelity' },
  { name: 'First Trust', keywords: ['First Trust'], slug: 'first-trust' },
  { name: 'Franklin', keywords: ['Franklin', 'Franklin Templeton'], slug: 'franklin-templeton' },
  { name: 'Global X', keywords: ['Global X'], slug: 'global-x' },
  { name: 'Goldman Sachs', keywords: ['Goldman Sachs'], slug: 'goldman-sachs' },
  { name: 'GraniteShares', keywords: ['GraniteShares'], slug: 'graniteshares' },
  { name: 'Hamilton', keywords: ['Hamilton'], slug: 'hamilton-etfs' },
  { name: 'Harvest', keywords: ['Harvest'], slug: 'harvest-portfolios-group' },
  { name: 'Invesco', keywords: ['Invesco'], slug: 'invesco' },
  { name: 'J.P. Morgan', keywords: ['JPMorgan', 'J.P. Morgan'], slug: 'j-p-morgan-asset-management' },
  { name: 'KraneShares', keywords: ['KraneShares'], slug: 'kraneshares' },
  { name: 'Mackenzie', keywords: ['Mackenzie'], slug: 'mackenzie-investments' },
  { name: 'Manulife', keywords: ['Manulife'], slug: 'manulife-investments' },
  { name: 'Morgan Stanley', keywords: ['Morgan Stanley'], slug: 'morgan-stanley' },
  { name: 'National Bank', keywords: ['NBI', 'National Bank'], slug: 'national-bank-investments' },
  { name: 'PIMCO', keywords: ['PIMCO'], slug: 'pimco' },
  { name: 'ProShares', keywords: ['ProShares'], slug: 'proshares' },
  { name: 'Purpose', keywords: ['Purpose'], slug: 'purpose-investments' },
  { name: 'RBC', keywords: ['RBC'], slug: 'rbc-global-asset-management' },
  { name: 'Scotia', keywords: ['Scotia'], slug: 'scotia-global-asset-management' },
  { name: 'SPDR', keywords: ['SPDR', 'State Street'], slug: 'spdr' }, // Use SPDR logo for State Street too as they brand ETFs as SPDR often, or use state-street... let's check
  { name: 'TD', keywords: ['TD', 'Toronto-Dominion'], slug: 'td-asset-management' },
  { name: 'VanEck', keywords: ['VanEck'], slug: 'vaneck' },
  { name: 'Vanguard', keywords: ['Vanguard'], slug: 'vanguard' },
  { name: 'VictoryShares', keywords: ['VictoryShares'], slug: 'victoryshares' },
  { name: 'WisdomTree', keywords: ['WisdomTree'], slug: 'wisdomtree' },
  { name: 'Xtrackers', keywords: ['Xtrackers', 'DWS'], slug: 'xtrackers' },
];

export function getProviderLogo(etfName: string): string | null {
  const normalizedName = etfName.toLowerCase();

  // Find the first provider whose keyword appears in the name
  const match = providers.find(p =>
    p.keywords.some(k => normalizedName.includes(k.toLowerCase()))
  );

  if (match) {
    // Return path to logo
    // Some logos are not downloaded, so we might want to check existence or just return null for now.
    // But since I can't check file existence efficiently in client code synchronously without importing a map of existing files...
    // I will assume the ones I downloaded exist.
    // The ones I failed to download: agfiq, advisorshares, alpha-architect, american-century-investments, blackrock(ishares covered), cibc-asset-management.

    // Explicit exclusions for missing logos
    const missing = ['agfiq', 'advisorshares', 'alpha-architect', 'american-century-investments', 'cibc-asset-management'];
    if (missing.includes(match.slug)) return null;

    return `/logos/${match.slug}.png`;
  }

  return null;
}
