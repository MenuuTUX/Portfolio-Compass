// Mapping of stock tickers to their specific Reddit communities
// This list is curated manually and maps tickers to their most active subreddit.

export const REDDIT_COMMUNITIES: Record<string, string> = {
  // Tech & Magnificent 7
  'AAPL': 'AAPL',
  'MSFT': 'Microsoft',
  'GOOG': 'google',
  'GOOGL': 'google',
  'AMZN': 'Amazon',
  'NVDA': 'NVDA_Stock',
  'TSLA': 'teslamotors',
  'META': 'MetaPlatforms',
  'NFLX': 'Netflix',
  'AMD': 'AMD_Stock',
  'INTC': 'Intel',
  'IBM': 'IBM',
  'ORCL': 'Oracle',
  'CRM': 'Salesforce',
  'ADBE': 'Adobe',
  'CSCO': 'Cisco',
  'AVGO': 'Broadcom',
  'QCOM': 'Qualcomm',
  'TXN': 'TI_Calculators', // Often discussed here, or general tech subs. TI stock specific is rare, maybe skip? Let's use TexasInstruments if exists or skip.
  'MU': 'Micron',
  'AMAT': 'AppliedMaterials',

  // Meme / Retail Favorites
  'GME': 'Superstonk',
  'AMC': 'amcstock',
  'PLTR': 'PLTR',
  'SOFI': 'sofistock',
  'HOOD': 'RobinHood', // Or HOODstock
  'COIN': 'CoinBase',
  'RIVN': 'Rivian',
  'LCID': 'LCID',
  'NIO': 'Nio',
  'DKNG': 'DKNG',
  'ROKU': 'Roku',
  'SQ': 'Square',
  'PYPL': 'PayPal',
  'SNAP': 'Snapchat',
  'PINS': 'Pinterest',
  'UBER': 'Uber',
  'LYFT': 'Lyft',
  'ABNB': 'Airbnb',
  'DASH': 'doordash',

  // Legacy / Blue Chip
  'DIS': 'Disney',
  'KO': 'CocaCola',
  'PEP': 'Pepsi',
  'MCD': 'McDonalds',
  'SBUX': 'Starbucks',
  'NKE': 'Nike',
  'WMT': 'Walmart',
  'TGT': 'Target',
  'COST': 'Costco',
  'HD': 'HomeDepot',
  'LOW': 'Lowes',
  'F': 'Ford',
  'GM': 'GeneralMotors',
  'GE': 'GeneralElectric',
  'BA': 'Boeing',
  'LMT': 'LockheedMartin',
  'RTX': 'Raytheon',
  'XOM': 'ExxonMobil',
  'CVX': 'Chevron',
  'JPM': 'JP_Morgan_Chase', // Often just finance/investing
  'BAC': 'BankofAmerica',
  'WFC': 'WellsFargo',
  'C': 'Citigroup',
  'GS': 'GoldmanSachs',
  'MS': 'MorganStanley',
  'V': 'Visa',
  'MA': 'Mastercard',
  'AXP': 'AmericanExpress',
  'JNJ': 'JNJ',
  'PFE': 'Pfizer',
  'MRK': 'Merck',
  'LLY': 'Lilly', // Eli Lilly
  'ABBV': 'AbbVie',
  'UNH': 'UnitedHealth',
  'CVS': 'CVS',

  // ETFs (Often discussed in broader subs, but some have specifics)
  'SPY': 'SPY',
  'QQQ': 'QQQ',
  'TQQQ': 'TQQQ',
  'UPRO': 'LETFs', // Leveraged ETFs
  'VOO': 'Bogleheads', // Proxy
  'VTI': 'Bogleheads', // Proxy
  'SCHD': 'dividends', // Proxy
  'JEPI': 'JEPI',
  'ARKK': 'ArkInvestorsClub',

  // Crypto Related (if applicable, though crypto functionality removed, stocks still exist)
  'MSTR': 'MSTR',
  'MARA': 'MarathonPatentGroup',
  'RIOT': 'RiotBlockchain',

  // Others
  'BABA': 'Baba',
  'JD': 'JDcom',
  'BIDU': 'Baidu',
  'TSM': 'TSMC',
  'SONY': 'Sony',
  'TM': 'Toyota',
  'HMC': 'Honda',
  'SHOP': 'Shopify',
  'SPOT': 'Spotify',

  // Canadian (often cross-listed or TSX specific)
  'RY': 'RoyalBank',
  'TD': 'TD',
  'BMO': 'BMO',
  'BNS': 'Scotiabank',
  'CM': 'CIBC',
  'SU': 'Suncor',
  'ENB': 'Enbridge',
  'CNQ': 'CanadianNatural',
  'CNR': 'CNRail',
  'CP': 'CPRail',
  'ATD': 'CoucheTard',
  'DOL': 'Dollarama',
  'L': 'Loblaws',
  'WN': 'Weston',
  'MG': 'Magna',
  'BCE': 'Bell',
  'T': 'Telus',
  'RCI.B': 'Rogers',
};

export function getRedditUrl(ticker: string): string | null {
  // Normalize ticker (remove exchange suffixes for checking, though mapping has strict keys)
  // For now, simple lookup.
  const subreddit = REDDIT_COMMUNITIES[ticker.toUpperCase()];
  if (subreddit) {
    return `https://www.reddit.com/r/${subreddit}`;
  }

  // Fallback for some common patterns if we wanted, but sticking to explicit map is safer.
  return null;
}
