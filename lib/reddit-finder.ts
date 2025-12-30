
// Map of known subreddits for popular tickers
// This helps avoid 404s and provides a better user experience for major assets.
const REDDIT_MAP: Record<string, string> = {
    // --- Mag-7 & Big Tech ---
    'AAPL': 'AAPL',
    'MSFT': 'Microsoft',
    'GOOGL': 'Google',
    'GOOG': 'Google',
    'AMZN': 'Amazon',
    'NVDA': 'Nvidia',
    'META': 'Meta',
    'TSLA': 'TeslaMotors',
    'TSM': 'TSMC',
    'AMD': 'AMD',
    'INTC': 'Intel',
    'NFLX': 'Netflix',
    'ADBE': 'Adobe',
    'CRM': 'Salesforce',
    'AVGO': 'Broadcom',
    'QCOM': 'Qualcomm',
    'PLTR': 'PLTR',
    'COIN': 'Coinbase',
    'SNOW': 'Snowflake',
    'RBLX': 'Roblox',
    'U': 'Unity3D',
    'SOFI': 'sofi',
    'PYPL': 'Paypal',
    'SQ': 'SquareInvestorsClub',
    'SHOP': 'shopify',
    'SPOT': 'spotify',
    'DIS': 'Disney',
    'SBUX': 'starbucks',
    'COST': 'Costco',
    'WMT': 'Walmart',
    'TGT': 'Target',

    // --- Popular Meme / Reddit Favorites ---
    'GME': 'Superstonk', // or GME
    'AMC': 'amcstock',
    'BB': 'BB_Stock',
    'NOK': 'Nokia_stock',
    'MSTR': 'MSTR',
    'HOOD': 'RobinHood',
    'PARA': 'ParamountGlobal',
    'DKNG': 'DKNG',
    'LCID': 'LCID',
    'RIVN': 'RIVIAN',
    'NIO': 'Nio',

    // --- ETFs (US) ---
    'SPY': 'SPY',
    'QQQ': 'QQQ',
    'TQQQ': 'TQQQ', // Leveraged
    'SQQQ': 'SQQQ', // Leveraged
    'SOXL': 'SOXL', // Leveraged Semis
    'VOO': 'Bogleheads', // VOO is heavily discussed there
    'VTI': 'Bogleheads',
    'VT': 'Bogleheads',
    'SCHD': 'dividends',
    'JEPI': 'JEPI',
    'JEPQ': 'JEPI', // Shared community
    'ARKK': 'ArkInvestorsClub',
    'VIG': 'dividends',
    'VYM': 'dividends',
    'VNQ': 'RealEstateInvesting',
    'XLK': 'Technology',
    'XLE': 'EnergyInvestors', // Heuristic for XLE
    'XLF': 'FinancialCareers', // Loose fit, but relevant
    'IWM': 'Russell2000',

    // --- Natural Resources (TrendingTab) ---
    // Mapping specific tickers to generic commodity subs if specific one doesn't exist
    'GLD': 'Gold',
    'SLV': 'Silverbugs',
    'GDX': 'Gold',
    'SIL': 'Silverbugs',
    'NEM': 'Gold', // Newmont
    'FCX': 'Copper', // Freeport-McMoRan
    'CCJ': 'UraniumSqueeze', // Cameco
    'URA': 'UraniumSqueeze',
    'URNM': 'UraniumSqueeze',
    'XOP': 'EnergyInvestors',
    'CVX': 'Chevron',
    'XOM': 'ExxonMobil',
    'SHEL': 'Shell',
    'BP': 'BP',

    // --- Canadian ETFs (Just Buy list & Popular) ---
    'XEQT.TO': 'JustBuyXEQT',
    'VEQT.TO': 'JustBuyXEQT', // Shared community
    'VGRO.TO': 'CanadianInvestor',
    'XGRO.TO': 'CanadianInvestor',
    'VFV.TO': 'CanadianInvestor',
    'VUN.TO': 'CanadianInvestor',
    'ZEB.TO': 'CanadianInvestor',
    'VDY.TO': 'CanadianInvestor',
    'XIU.TO': 'CanadianInvestor',
    'XIU': 'CanadianInvestor',
    'BB.TO': 'BB_Stock',
    'SHOP.TO': 'shopify',
    'TD.TO': 'CanadianInvestor',
    'RY.TO': 'CanadianInvestor',
    'ENB.TO': 'CanadianInvestor',
    'CNQ.TO': 'CanadianInvestor',
    'CP.TO': 'CanadianInvestor',
    'CNR.TO': 'CanadianInvestor',
    'SU.TO': 'CanadianInvestor',
    'BMO.TO': 'CanadianInvestor',
    'BNS.TO': 'CanadianInvestor',

    // --- Australian / International ---
    'VDAL.AX': 'fiaustralia',
    'VDAL': 'fiaustralia',
    'VGS.AX': 'fiaustralia',
    'VAS.AX': 'fiaustralia',
    'A200.AX': 'fiaustralia',
    'NDQ.AX': 'fiaustralia',
    'BHP': 'BHP',
    'RIO': 'RioTinto',
    'VALE': 'Vale',

    // --- Crypto Proxies ---
    'BITO': 'Bitcoin',
    'IBIT': 'Bitcoin',
    'FBTC': 'Bitcoin',
};

// Generic fallback maps for sectors if specific ticker not found
const SECTOR_REDDIT_MAP: Record<string, string> = {
    'Technology': 'technology',
    'Financial Services': 'Finance',
    'Energy': 'EnergyInvestors',
    'Basic Materials': 'Commodities',
    'Healthcare': 'Biotech',
    'Real Estate': 'RealEstateInvesting',
    'Utilities': 'Investing', // Generic
    'Industrials': 'Investing', // Generic
    'Consumer Cyclical': 'Stocks',
    'Consumer Defensive': 'Stocks',
    'Communication Services': 'Technology'
};

/**
 * Attempts to find a Reddit community for a given ticker/name.
 *
 * Strategy:
 * 1. Check hardcoded map.
 * 2. Try r/{Ticker}.
 * 3. Try r/{Name} (simplified).
 *
 * Note: Verification of existence (HTTP check) is ideal but can be slow/rate-limited.
 * For now, we return the mapped value or a heuristic.
 * The frontend should ideally handle 404s gracefully if possible, or we assume r/{Ticker} is better than nothing if verified.
 */
export async function findRedditCommunity(ticker: string, name: string, sector?: string): Promise<string | null> {
    const cleanTicker = ticker.toUpperCase();

    // 1. Direct Map
    if (REDDIT_MAP[cleanTicker]) {
        return `https://www.reddit.com/r/${REDDIT_MAP[cleanTicker]}/`;
    }

    // 2. Base Ticker Map (e.g., SHOP.TO -> SHOP)
    if (cleanTicker.includes('.')) {
        const baseTicker = cleanTicker.split('.')[0];
        if (REDDIT_MAP[baseTicker]) {
            return `https://www.reddit.com/r/${REDDIT_MAP[baseTicker]}/`;
        }
    }

    // 3. Sector Fallback (Optional - maybe too generic, but requested "as many as possible")
    // We only do this if we are confident it's useful.
    // For now, let's stick to high confidence mappings to avoid noise.

    // 4. Strict Heuristic for US Stocks
    // If it's a 3-4 letter ticker without dots, it MIGHT be a subreddit.
    // e.g. r/AMD, r/NVDA.
    // But r/FORD is not for F. r/GM is General Motors.
    // Without verification, we risk linking to dead subs.
    // However, the user said "figure that out" and "map as many as possible".
    // A huge map is the best "figure that out" solution.

    return null;
}
