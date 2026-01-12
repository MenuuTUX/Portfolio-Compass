export const SP500_FALLBACK = ['AAPL', 'MSFT', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA'];

export const TOP_ETFS = [
  'SPY', 'IVV', 'VOO', 'VTI', 'QQQ', 'VEA', 'VTV', 'IEFA', 'BND', 'AGG',
  'VUG', 'VIG', 'IJR', 'IWF', 'VWO', 'IJH', 'VGT', 'XLK', 'IWM', 'GLD',
  'XIU.TO', 'XIC.TO', 'VFV.TO', 'VUN.TO', 'XEQT.TO', 'VEQT.TO', 'VGRO.TO', 'XGRO.TO',
  'ZEB.TO', 'VDY.TO', 'ZSP.TO', 'HQU.TO', 'HOU.TO', 'HOD.TO', 'HNU.TO',
  'ZAG.TO', 'XBB.TO', 'VAB.TO', 'XSP.TO',
  'XLV', 'XLF', 'XLY', 'XLP', 'XLE', 'XLI', 'XLB', 'XLRE', 'XLU', 'SMH',
  'SCHD', 'JEPI', 'JEPQ', 'DIA', 'IWD', 'IWB', 'MDY', 'RSP', 'VYM', 'DVY',
  'USMV', 'QUAL', 'MTUM', 'VLUE', 'SIZE', 'SPLG', 'SPYG', 'SPYD', 'SCHG', 'SCHX',
  'SCHB', 'SCHA', 'ITOT', 'IXUS', 'ACWI', 'VT', 'BNDX', 'MUB', 'TIP', 'LQD',
  'HYG', 'JNK', 'PFF', 'PGX', 'VNQ', 'REM', 'INDA', 'MCHI', 'EWJ', 'EWZ'
];

// MAG-7 + TSM (Taiwan Semiconductor) - Tech Giants
export const MAG7_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'TSM'];

// r/justbuythis Canadian ETFs - Popular in r/PersonalFinanceCanada, r/CanadianInvestor
export const JUST_BUY_TICKERS = [
  'XEQT.TO', 'VEQT.TO', 'VGRO.TO', 'XGRO.TO', 
  'VFV.TO', 'VUN.TO', 'ZEB.TO', 'ZEQT.TO'
];

// Natural Resources - Energy, Mining, Precious Metals, Agriculture
export const NATURAL_RESOURCES_TICKERS = [
  // Energy
  'XLE', 'XOP', 'CVX', 'XOM', 'SHEL', 'COP',
  // Mining
  'RIO', 'BHP', 'VALE', 'NEM', 'FCX',
  // Precious Metals ETFs
  'GLD', 'SLV', 'GDX', 'SIL',
  // Agriculture & Water
  'MOO', 'PHO'
];

// Reddit Community Associations for Tickers
// Maps tickers to their most relevant Reddit communities
export interface RedditCommunity {
  name: string;      // Subreddit name without r/
  displayName: string; // Display name
  url: string;       // Full Reddit URL
}

/**
 * Helper function to create a Reddit community entry
 * Usage: createCommunity('wallstreetbets', 'r/WSB') or createCommunity('investing')
 */
export function createCommunity(subreddit: string, displayName?: string): RedditCommunity {
  return {
    name: subreddit,
    displayName: displayName || `r/${subreddit}`,
    url: `https://reddit.com/r/${subreddit}`,
  };
}

// Common community presets for easier assignment
const COMMUNITIES = {
  // Canadian
  justbuy: createCommunity('justbuythis', 'r/justbuy'),
  pfc: createCommunity('PersonalFinanceCanada', 'r/PFC'),
  canadianInvestor: createCommunity('CanadianInvestor'),
  // US General
  investing: createCommunity('investing'),
  stocks: createCommunity('stocks'),
  dividends: createCommunity('dividends'),
  bogleheads: createCommunity('Bogleheads'),
  wsb: createCommunity('wallstreetbets', 'r/WSB'),
  // Sector-specific
  energy: createCommunity('energy'),
  oilAndGas: createCommunity('oilandgasworkers', 'r/OilGas'),
  mining: createCommunity('mining'),
  gold: createCommunity('Gold'),
  silverbugs: createCommunity('Silverbugs'),
  wss: createCommunity('wallstreetsilver', 'r/WSS'),
  agriculture: createCommunity('agriculture'),
  semiconductors: createCommunity('semiconductors'),
  nvidia: createCommunity('nvidia'),
  tesla: createCommunity('teslainvestorsclub', 'r/TeslaInvestors'),
  apple: createCommunity('apple'),
};

export const REDDIT_COMMUNITIES: Record<string, RedditCommunity[]> = {
  // ====== Canadian ETFs ======
  'XEQT.TO': [COMMUNITIES.justbuy, COMMUNITIES.pfc, COMMUNITIES.canadianInvestor],
  'VEQT.TO': [COMMUNITIES.justbuy, COMMUNITIES.pfc, COMMUNITIES.canadianInvestor],
  'VGRO.TO': [COMMUNITIES.justbuy, COMMUNITIES.pfc],
  'XGRO.TO': [COMMUNITIES.justbuy, COMMUNITIES.pfc],
  'VFV.TO': [COMMUNITIES.canadianInvestor, COMMUNITIES.bogleheads],
  'VUN.TO': [COMMUNITIES.canadianInvestor, COMMUNITIES.bogleheads],
  'ZEB.TO': [COMMUNITIES.canadianInvestor, COMMUNITIES.dividends],
  'ZEQT.TO': [COMMUNITIES.justbuy, COMMUNITIES.canadianInvestor],

  // ====== US Popular ETFs ======
  'VOO': [COMMUNITIES.bogleheads, COMMUNITIES.investing],
  'VTI': [COMMUNITIES.bogleheads, COMMUNITIES.investing],
  'SPY': [COMMUNITIES.investing, COMMUNITIES.wsb],
  'QQQ': [COMMUNITIES.investing, COMMUNITIES.wsb],
  'SCHD': [COMMUNITIES.dividends, COMMUNITIES.investing],
  'JEPI': [COMMUNITIES.dividends],
  'JEPQ': [COMMUNITIES.dividends],
  'VYM': [COMMUNITIES.dividends, COMMUNITIES.bogleheads],

  // ====== Tech Giants (MAG-7) ======
  'NVDA': [COMMUNITIES.wsb, COMMUNITIES.nvidia, COMMUNITIES.semiconductors],
  'TSLA': [COMMUNITIES.wsb, COMMUNITIES.tesla],
  'AAPL': [COMMUNITIES.stocks, COMMUNITIES.apple],
  'MSFT': [COMMUNITIES.stocks, COMMUNITIES.investing],
  'GOOGL': [COMMUNITIES.stocks, COMMUNITIES.investing],
  'AMZN': [COMMUNITIES.stocks, COMMUNITIES.investing],
  'META': [COMMUNITIES.stocks, COMMUNITIES.investing],
  'TSM': [COMMUNITIES.semiconductors, COMMUNITIES.stocks],

  // ====== Natural Resources - Energy ======
  'XLE': [COMMUNITIES.energy, COMMUNITIES.oilAndGas, COMMUNITIES.investing],
  'XOP': [COMMUNITIES.energy, COMMUNITIES.oilAndGas],
  'CVX': [COMMUNITIES.energy, COMMUNITIES.dividends, COMMUNITIES.stocks],
  'XOM': [COMMUNITIES.energy, COMMUNITIES.dividends, COMMUNITIES.stocks],
  'SHEL': [COMMUNITIES.energy, COMMUNITIES.dividends],
  'COP': [COMMUNITIES.energy, COMMUNITIES.stocks],

  // ====== Natural Resources - Mining ======
  'RIO': [COMMUNITIES.mining, COMMUNITIES.stocks],
  'BHP': [COMMUNITIES.mining, COMMUNITIES.stocks],
  'VALE': [COMMUNITIES.mining, COMMUNITIES.stocks],
  'NEM': [COMMUNITIES.mining, COMMUNITIES.gold],
  'FCX': [COMMUNITIES.mining, COMMUNITIES.stocks],
  'GDX': [COMMUNITIES.gold, COMMUNITIES.mining],
  'SIL': [COMMUNITIES.silverbugs, COMMUNITIES.mining],

  // ====== Natural Resources - Precious Metals ======
  'GLD': [COMMUNITIES.gold, COMMUNITIES.silverbugs, COMMUNITIES.investing],
  'SLV': [COMMUNITIES.silverbugs, COMMUNITIES.wss],

  // ====== Natural Resources - Agriculture & Water ======
  'MOO': [COMMUNITIES.agriculture, COMMUNITIES.investing],
  'PHO': [createCommunity('water'), COMMUNITIES.investing],
};

// Helper function to get Reddit communities for a ticker
export function getRedditCommunities(ticker: string): RedditCommunity[] {
  return REDDIT_COMMUNITIES[ticker.toUpperCase()] || [];
}

/**
 * Add a new Reddit community association for a ticker.
 * This can be called at runtime to dynamically add communities.
 * 
 * @example
 * addRedditCommunity('GME', createCommunity('Superstonk'));
 * addRedditCommunity('AMC', [createCommunity('amcstock'), COMMUNITIES.wsb]);
 */
export function addRedditCommunity(ticker: string, communities: RedditCommunity | RedditCommunity[]): void {
  const upperTicker = ticker.toUpperCase();
  const newCommunities = Array.isArray(communities) ? communities : [communities];
  
  if (REDDIT_COMMUNITIES[upperTicker]) {
    // Add to existing, avoiding duplicates
    newCommunities.forEach(c => {
      if (!REDDIT_COMMUNITIES[upperTicker].some(existing => existing.name === c.name)) {
        REDDIT_COMMUNITIES[upperTicker].push(c);
      }
    });
  } else {
    REDDIT_COMMUNITIES[upperTicker] = newCommunities;
  }
}
