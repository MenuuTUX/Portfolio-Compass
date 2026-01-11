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

export const REDDIT_COMMUNITIES: Record<string, RedditCommunity[]> = {
  // Canadian ETFs - Popular in Canadian investing subreddits
  'XEQT.TO': [
    { name: 'justbuythis', displayName: 'r/justbuythis', url: 'https://reddit.com/r/justbuythis' },
    { name: 'PersonalFinanceCanada', displayName: 'r/PFC', url: 'https://reddit.com/r/PersonalFinanceCanada' },
    { name: 'CanadianInvestor', displayName: 'r/CanadianInvestor', url: 'https://reddit.com/r/CanadianInvestor' }
  ],
  'VEQT.TO': [
    { name: 'justbuythis', displayName: 'r/justbuythis', url: 'https://reddit.com/r/justbuythis' },
    { name: 'PersonalFinanceCanada', displayName: 'r/PFC', url: 'https://reddit.com/r/PersonalFinanceCanada' },
    { name: 'CanadianInvestor', displayName: 'r/CanadianInvestor', url: 'https://reddit.com/r/CanadianInvestor' }
  ],
  'VGRO.TO': [
    { name: 'justbuythis', displayName: 'r/justbuythis', url: 'https://reddit.com/r/justbuythis' },
    { name: 'PersonalFinanceCanada', displayName: 'r/PFC', url: 'https://reddit.com/r/PersonalFinanceCanada' }
  ],
  'XGRO.TO': [
    { name: 'justbuythis', displayName: 'r/justbuythis', url: 'https://reddit.com/r/justbuythis' },
    { name: 'PersonalFinanceCanada', displayName: 'r/PFC', url: 'https://reddit.com/r/PersonalFinanceCanada' }
  ],
  'VFV.TO': [
    { name: 'CanadianInvestor', displayName: 'r/CanadianInvestor', url: 'https://reddit.com/r/CanadianInvestor' }
  ],
  'VUN.TO': [
    { name: 'CanadianInvestor', displayName: 'r/CanadianInvestor', url: 'https://reddit.com/r/CanadianInvestor' }
  ],
  'ZEB.TO': [
    { name: 'CanadianInvestor', displayName: 'r/CanadianInvestor', url: 'https://reddit.com/r/CanadianInvestor' }
  ],
  'ZEQT.TO': [
    { name: 'justbuythis', displayName: 'r/justbuythis', url: 'https://reddit.com/r/justbuythis' },
    { name: 'CanadianInvestor', displayName: 'r/CanadianInvestor', url: 'https://reddit.com/r/CanadianInvestor' }
  ],
  // US Popular ETFs
  'VOO': [
    { name: 'Bogleheads', displayName: 'r/Bogleheads', url: 'https://reddit.com/r/Bogleheads' },
    { name: 'investing', displayName: 'r/investing', url: 'https://reddit.com/r/investing' }
  ],
  'VTI': [
    { name: 'Bogleheads', displayName: 'r/Bogleheads', url: 'https://reddit.com/r/Bogleheads' },
    { name: 'investing', displayName: 'r/investing', url: 'https://reddit.com/r/investing' }
  ],
  'SCHD': [
    { name: 'dividends', displayName: 'r/dividends', url: 'https://reddit.com/r/dividends' }
  ],
  // Tech Stocks
  'NVDA': [
    { name: 'wallstreetbets', displayName: 'r/WSB', url: 'https://reddit.com/r/wallstreetbets' },
    { name: 'nvidia', displayName: 'r/nvidia', url: 'https://reddit.com/r/nvidia' }
  ],
  'TSLA': [
    { name: 'wallstreetbets', displayName: 'r/WSB', url: 'https://reddit.com/r/wallstreetbets' },
    { name: 'teslainvestorsclub', displayName: 'r/TeslaInvestors', url: 'https://reddit.com/r/teslainvestorsclub' }
  ],
  'AAPL': [
    { name: 'stocks', displayName: 'r/stocks', url: 'https://reddit.com/r/stocks' },
    { name: 'apple', displayName: 'r/apple', url: 'https://reddit.com/r/apple' }
  ],
  'MSFT': [
    { name: 'stocks', displayName: 'r/stocks', url: 'https://reddit.com/r/stocks' }
  ],
  'GOOGL': [
    { name: 'stocks', displayName: 'r/stocks', url: 'https://reddit.com/r/stocks' }
  ],
  'AMZN': [
    { name: 'stocks', displayName: 'r/stocks', url: 'https://reddit.com/r/stocks' }
  ],
  'META': [
    { name: 'stocks', displayName: 'r/stocks', url: 'https://reddit.com/r/stocks' }
  ],
  'TSM': [
    { name: 'semiconductors', displayName: 'r/semiconductors', url: 'https://reddit.com/r/semiconductors' }
  ],
  // Precious Metals
  'GLD': [
    { name: 'Gold', displayName: 'r/Gold', url: 'https://reddit.com/r/Gold' },
    { name: 'Silverbugs', displayName: 'r/Silverbugs', url: 'https://reddit.com/r/Silverbugs' }
  ],
  'SLV': [
    { name: 'Silverbugs', displayName: 'r/Silverbugs', url: 'https://reddit.com/r/Silverbugs' },
    { name: 'wallstreetsilver', displayName: 'r/WSS', url: 'https://reddit.com/r/wallstreetsilver' }
  ],
};

// Helper function to get Reddit communities for a ticker
export function getRedditCommunities(ticker: string): RedditCommunity[] {
  return REDDIT_COMMUNITIES[ticker.toUpperCase()] || [];
}
