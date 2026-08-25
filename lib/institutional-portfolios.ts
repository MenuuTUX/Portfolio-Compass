export interface PortfolioHolding {
  ticker: string;
  name: string;
  weight: number;
}

export interface InstitutionalPortfolio {
  name: string; // e.g. "Growth", "Balanced"
  risk: string; // e.g. "Risk 8-10"
  description: string;
  holdings: PortfolioHolding[];
  iconName: "TrendingUp" | "Scale" | "Shield"; // Map to Lucide icons in component
}

export interface Institution {
  id: string;
  name: string;
  logo: string;
  themeColor: string; // Tailwind class or hex for accents
  themeGradient: string; // Tailwind class for backgrounds
  description: string;
  portfolios: {
    Growth: InstitutionalPortfolio;
    Balanced: InstitutionalPortfolio;
    Conservative: InstitutionalPortfolio;
  };
}

export const INSTITUTIONAL_DATA: Institution[] = [
  {
    id: "wealthsimple",
    name: "Wealthsimple",
    logo: "/logos/wealthsimple.png",
    themeColor: "text-yellow-500",
    themeGradient: "from-yellow-400/20 to-transparent",
    description:
      "Built-in examples labeled Wealthsimple. Verify current allocations with the issuer.",
    portfolios: {
      Growth: {
        name: "Growth",
        risk: "Risk 8-10",
        description: "Built-in growth example from this app's dataset.",
        iconName: "TrendingUp",
        holdings: [
          { ticker: "VTI", name: "Vanguard Total Stock Market", weight: 25 },
          { ticker: "USMV", name: "iShares Edge MSCI Min Vol USA", weight: 27 },
          { ticker: "EFA", name: "iShares MSCI EAFE", weight: 14 },
          {
            ticker: "EEMV",
            name: "iShares MSCI Emerging Mkts Min Vol",
            weight: 14,
          },
          { ticker: "XIC.TO", name: "iShares Core S&P/TSX Capped", weight: 10 },
          {
            ticker: "ZFL.TO",
            name: "BMO Long Federal Bond Index",
            weight: 7.5,
          },
          { ticker: "GLDM", name: "SPDR Gold MiniShares", weight: 2.5 },
        ],
      },
      Balanced: {
        name: "Balanced",
        risk: "Risk 4-6",
        description: "Built-in balanced example from this app's dataset.",
        iconName: "Scale",
        holdings: [
          { ticker: "VTI", name: "Vanguard Total Stock Market", weight: 15 },
          { ticker: "USMV", name: "iShares Edge MSCI Min Vol USA", weight: 15 },
          { ticker: "EFA", name: "iShares MSCI EAFE", weight: 10 },
          {
            ticker: "EEMV",
            name: "iShares MSCI Emerging Mkts Min Vol",
            weight: 10,
          },
          { ticker: "XIC.TO", name: "iShares Core S&P/TSX Capped", weight: 10 },
          {
            ticker: "ZFL.TO",
            name: "BMO Long Federal Bond Index",
            weight: 37.5,
          },
          { ticker: "GLDM", name: "SPDR Gold MiniShares", weight: 2.5 },
        ],
      },
      Conservative: {
        name: "Conservative",
        risk: "Risk 1-3",
        description: "Built-in conservative example from this app's dataset.",
        iconName: "Shield",
        holdings: [
          { ticker: "VTI", name: "Vanguard Total Stock Market", weight: 10 },
          { ticker: "USMV", name: "iShares Edge MSCI Min Vol USA", weight: 8 },
          { ticker: "EFA", name: "iShares MSCI EAFE", weight: 6 },
          {
            ticker: "EEMV",
            name: "iShares MSCI Emerging Mkts Min Vol",
            weight: 4,
          },
          { ticker: "XIC.TO", name: "iShares Core S&P/TSX Capped", weight: 7 },
          {
            ticker: "ZFL.TO",
            name: "BMO Long Federal Bond Index",
            weight: 62.5,
          },
          { ticker: "GLDM", name: "SPDR Gold MiniShares", weight: 2.5 },
        ],
      },
    },
  },
  {
    id: "rbc",
    name: "RBC iShares",
    logo: "/logos/rbc.svg",
    themeColor: "text-blue-800",
    themeGradient: "from-blue-800/20 to-transparent",
    description:
      "Built-in examples labeled RBC iShares. Verify current allocations with the issuer.",
    portfolios: {
      Growth: {
        name: "Growth (XGRO)",
        risk: "Risk 7-9",
        description: "Built-in growth example from this app's dataset.",
        iconName: "TrendingUp",
        holdings: [
          {
            ticker: "ITOT",
            name: "iShares Core S&P Total US Stock",
            weight: 37.1,
          },
          {
            ticker: "XIC.TO",
            name: "iShares Core S&P/TSX Capped",
            weight: 20.3,
          },
          {
            ticker: "XEF.TO",
            name: "iShares Core MSCI EAFE IMI",
            weight: 19.8,
          },
          {
            ticker: "XEC.TO",
            name: "iShares Core MSCI Emerging Mkts",
            weight: 3.8,
          },
          {
            ticker: "XBB.TO",
            name: "iShares Core Canadian Universe Bond",
            weight: 15.2,
          },
          {
            ticker: "XSH.TO",
            name: "iShares Core Canadian Short Term Bond",
            weight: 3.8,
          },
        ],
      },
      Balanced: {
        name: "Balanced (XBAL)",
        risk: "Risk 4-6",
        description: "Built-in balanced example from this app's dataset.",
        iconName: "Scale",
        holdings: [
          {
            ticker: "ITOT",
            name: "iShares Core S&P Total US Stock",
            weight: 27.2,
          },
          {
            ticker: "XIC.TO",
            name: "iShares Core S&P/TSX Capped",
            weight: 15.3,
          },
          {
            ticker: "XEF.TO",
            name: "iShares Core MSCI EAFE IMI",
            weight: 14.8,
          },
          {
            ticker: "XEC.TO",
            name: "iShares Core MSCI Emerging Mkts",
            weight: 2.7,
          },
          {
            ticker: "XBB.TO",
            name: "iShares Core Canadian Universe Bond",
            weight: 32.0,
          },
          {
            ticker: "XSH.TO",
            name: "iShares Core Canadian Short Term Bond",
            weight: 8.0,
          },
        ],
      },
      Conservative: {
        name: "Conservative (XCNS)",
        risk: "Risk 2-4",
        description: "Built-in conservative example from this app's dataset.",
        iconName: "Shield",
        holdings: [
          {
            ticker: "ITOT",
            name: "iShares Core S&P Total US Stock",
            weight: 18.1,
          },
          {
            ticker: "XIC.TO",
            name: "iShares Core S&P/TSX Capped",
            weight: 10.1,
          },
          { ticker: "XEF.TO", name: "iShares Core MSCI EAFE IMI", weight: 9.9 },
          {
            ticker: "XEC.TO",
            name: "iShares Core MSCI Emerging Mkts",
            weight: 1.9,
          },
          {
            ticker: "XBB.TO",
            name: "iShares Core Canadian Universe Bond",
            weight: 48.0,
          },
          {
            ticker: "XSH.TO",
            name: "iShares Core Canadian Short Term Bond",
            weight: 12.0,
          },
        ],
      },
    },
  },
  {
    id: "td",
    name: "TD Asset Management",
    logo: "/logos/td.svg",
    themeColor: "text-emerald-600",
    themeGradient: "from-emerald-600/20 to-transparent",
    description:
      "Built-in examples labeled TD Asset Management. Verify current allocations with the issuer.",
    portfolios: {
      Growth: {
        name: "Growth (TGRO)",
        risk: "Risk 7-9",
        description: "Built-in growth example from this app's dataset.",
        iconName: "TrendingUp",
        holdings: [
          { ticker: "TPU.TO", name: "TD US Equity Index ETF", weight: 42.0 },
          {
            ticker: "TTP.TO",
            name: "TD Canadian Equity Index ETF",
            weight: 27.0,
          },
          {
            ticker: "TPE.TO",
            name: "TD International Equity Index ETF",
            weight: 21.0,
          },
          {
            ticker: "TDB.TO",
            name: "TD Canadian Aggregate Bond Index",
            weight: 10.0,
          },
        ],
      },
      Balanced: {
        name: "Balanced (TBAL)",
        risk: "Risk 4-6",
        description: "Built-in balanced example from this app's dataset.",
        iconName: "Scale",
        holdings: [
          { ticker: "TPU.TO", name: "TD US Equity Index ETF", weight: 28.0 },
          {
            ticker: "TTP.TO",
            name: "TD Canadian Equity Index ETF",
            weight: 18.0,
          },
          {
            ticker: "TPE.TO",
            name: "TD International Equity Index ETF",
            weight: 14.0,
          },
          {
            ticker: "TDB.TO",
            name: "TD Canadian Aggregate Bond Index",
            weight: 40.0,
          },
        ],
      },
      Conservative: {
        name: "Conservative (TCON)",
        risk: "Risk 2-4",
        description: "Built-in conservative example from this app's dataset.",
        iconName: "Shield",
        holdings: [
          { ticker: "TPU.TO", name: "TD US Equity Index ETF", weight: 18.0 },
          {
            ticker: "TTP.TO",
            name: "TD Canadian Equity Index ETF",
            weight: 12.0,
          },
          {
            ticker: "TPE.TO",
            name: "TD International Equity Index ETF",
            weight: 10.0,
          },
          {
            ticker: "TDB.TO",
            name: "TD Canadian Aggregate Bond Index",
            weight: 60.0,
          },
        ],
      },
    },
  },
  {
    id: "bmo",
    name: "BMO",
    logo: "/logos/bmo.svg",
    themeColor: "text-blue-600",
    themeGradient: "from-blue-600/20 to-transparent",
    description:
      "Built-in examples labeled BMO. Verify current allocations with the issuer.",
    portfolios: {
      Growth: {
        name: "Growth (ZGRO)",
        risk: "Risk 7-9",
        description: "Built-in growth example from this app's dataset.",
        iconName: "TrendingUp",
        holdings: [
          { ticker: "ZSP.TO", name: "BMO S&P 500 Index ETF", weight: 36.5 },
          {
            ticker: "ZCN.TO",
            name: "BMO S&P/TSX Capped Composite",
            weight: 20.5,
          },
          { ticker: "ZEA.TO", name: "BMO MSCI EAFE Index ETF", weight: 17.5 },
          {
            ticker: "ZEM.TO",
            name: "BMO MSCI Emerging Markets Index",
            weight: 5.5,
          },
          {
            ticker: "ZAG.TO",
            name: "BMO Aggregate Bond Index ETF",
            weight: 18.0,
          },
          {
            ticker: "ZMU.TO",
            name: "BMO Mid-Term US IG Corp Bond",
            weight: 2.0,
          },
        ],
      },
      Balanced: {
        name: "Balanced (ZBAL)",
        risk: "Risk 4-6",
        description: "Built-in balanced example from this app's dataset.",
        iconName: "Scale",
        holdings: [
          { ticker: "ZSP.TO", name: "BMO S&P 500 Index ETF", weight: 27.5 },
          {
            ticker: "ZCN.TO",
            name: "BMO S&P/TSX Capped Composite",
            weight: 15.5,
          },
          { ticker: "ZEA.TO", name: "BMO MSCI EAFE Index ETF", weight: 13.0 },
          {
            ticker: "ZEM.TO",
            name: "BMO MSCI Emerging Markets Index",
            weight: 4.0,
          },
          {
            ticker: "ZAG.TO",
            name: "BMO Aggregate Bond Index ETF",
            weight: 36.0,
          },
          {
            ticker: "ZMU.TO",
            name: "BMO Mid-Term US IG Corp Bond",
            weight: 4.0,
          },
        ],
      },
      Conservative: {
        name: "Conservative (ZCON)",
        risk: "Risk 2-4",
        description: "Built-in conservative example from this app's dataset.",
        iconName: "Shield",
        holdings: [
          { ticker: "ZSP.TO", name: "BMO S&P 500 Index ETF", weight: 18.5 },
          {
            ticker: "ZCN.TO",
            name: "BMO S&P/TSX Capped Composite",
            weight: 10.5,
          },
          { ticker: "ZEA.TO", name: "BMO MSCI EAFE Index ETF", weight: 8.5 },
          {
            ticker: "ZEM.TO",
            name: "BMO MSCI Emerging Markets Index",
            weight: 2.5,
          },
          {
            ticker: "ZAG.TO",
            name: "BMO Aggregate Bond Index ETF",
            weight: 54.0,
          },
          {
            ticker: "ZMU.TO",
            name: "BMO Mid-Term US IG Corp Bond",
            weight: 6.0,
          },
        ],
      },
    },
  },
  {
    id: "cibc",
    name: "CIBC",
    logo: "/logos/cibc.svg",
    themeColor: "text-red-800",
    themeGradient: "from-red-800/20 to-transparent",
    description:
      "Built-in examples labeled CIBC. Verify current allocations with the issuer.",
    portfolios: {
      Growth: {
        name: "Growth (CGRW)",
        risk: "Risk 7-9",
        description: "Built-in growth example from this app's dataset.",
        iconName: "TrendingUp",
        holdings: [
          {
            ticker: "CUEI.TO",
            name: "CIBC MSCI USA Equity Index ETF",
            weight: 40.0,
          },
          {
            ticker: "CCEI.TO",
            name: "CIBC MSCI Canada Equity Index ETF",
            weight: 25.0,
          },
          {
            ticker: "CIEI.TO",
            name: "CIBC MSCI EAFE Equity Index ETF",
            weight: 15.0,
          },
          {
            ticker: "CEMI.TO",
            name: "CIBC MSCI Emerging Markets Equity Index ETF",
            weight: 5.0,
          },
          {
            ticker: "CCBI.TO",
            name: "CIBC Canadian Bond Index ETF",
            weight: 15.0,
          },
        ],
      },
      Balanced: {
        name: "Balanced (CBLN)",
        risk: "Risk 4-6",
        description: "Built-in balanced example from this app's dataset.",
        iconName: "Scale",
        holdings: [
          {
            ticker: "CUEI.TO",
            name: "CIBC MSCI USA Equity Index ETF",
            weight: 30.0,
          },
          {
            ticker: "CCEI.TO",
            name: "CIBC MSCI Canada Equity Index ETF",
            weight: 20.0,
          },
          {
            ticker: "CIEI.TO",
            name: "CIBC MSCI EAFE Equity Index ETF",
            weight: 10.0,
          },
          {
            ticker: "CCBI.TO",
            name: "CIBC Canadian Bond Index ETF",
            weight: 40.0,
          },
        ],
      },
      Conservative: {
        name: "Conservative (CCON)",
        risk: "Risk 2-4",
        description: "Built-in conservative example from this app's dataset.",
        iconName: "Shield",
        holdings: [
          {
            ticker: "CUEI.TO",
            name: "CIBC MSCI USA Equity Index ETF",
            weight: 15.0,
          },
          {
            ticker: "CCEI.TO",
            name: "CIBC MSCI Canada Equity Index ETF",
            weight: 10.0,
          },
          {
            ticker: "CIEI.TO",
            name: "CIBC MSCI EAFE Equity Index ETF",
            weight: 5.0,
          },
          {
            ticker: "CCBI.TO",
            name: "CIBC Canadian Bond Index ETF",
            weight: 70.0,
          },
        ],
      },
    },
  },
  {
    id: "scotia",
    name: "Scotiabank",
    logo: "/logos/scotiabank.svg",
    themeColor: "text-red-600",
    themeGradient: "from-red-600/20 to-transparent",
    description:
      "Built-in examples labeled Scotiabank. Verify current allocations with the issuer.",
    portfolios: {
      Growth: {
        name: "Growth (Simulated)",
        risk: "Risk 7-9",
        description: "Built-in growth example from this app's dataset.",
        iconName: "TrendingUp",
        holdings: [
          {
            ticker: "SITU.NE",
            name: "Scotia US Equity Index Tracker ETF",
            weight: 40.0,
          },
          {
            ticker: "SITC.NE",
            name: "Scotia Canadian Large Cap Equity Index",
            weight: 25.0,
          },
          {
            ticker: "SITI.NE",
            name: "Scotia International Equity Index",
            weight: 15.0,
          },
          {
            ticker: "SITB.NE",
            name: "Scotia Canadian Bond Index Tracker",
            weight: 20.0,
          },
        ],
      },
      Balanced: {
        name: "Balanced (Simulated)",
        risk: "Risk 4-6",
        description: "Built-in balanced example from this app's dataset.",
        iconName: "Scale",
        holdings: [
          {
            ticker: "SITU.NE",
            name: "Scotia US Equity Index Tracker ETF",
            weight: 30.0,
          },
          {
            ticker: "SITC.NE",
            name: "Scotia Canadian Large Cap Equity Index",
            weight: 20.0,
          },
          {
            ticker: "SITI.NE",
            name: "Scotia International Equity Index",
            weight: 10.0,
          },
          {
            ticker: "SITB.NE",
            name: "Scotia Canadian Bond Index Tracker",
            weight: 40.0,
          },
        ],
      },
      Conservative: {
        name: "Conservative (Simulated)",
        risk: "Risk 2-4",
        description: "Built-in conservative example from this app's dataset.",
        iconName: "Shield",
        holdings: [
          {
            ticker: "SITU.NE",
            name: "Scotia US Equity Index Tracker ETF",
            weight: 20.0,
          },
          {
            ticker: "SITC.NE",
            name: "Scotia Canadian Large Cap Equity Index",
            weight: 15.0,
          },
          {
            ticker: "SITI.NE",
            name: "Scotia International Equity Index",
            weight: 5.0,
          },
          {
            ticker: "SITB.NE",
            name: "Scotia Canadian Bond Index Tracker",
            weight: 60.0,
          },
        ],
      },
    },
  },
  {
    id: "vanguard",
    name: "Vanguard",
    logo: "/logos/vanguard.svg",
    themeColor: "text-red-700",
    themeGradient: "from-red-600/20 to-transparent",
    description:
      "Built-in examples labeled Vanguard. Verify current allocations with the issuer.",
    portfolios: {
      Growth: {
        name: "Growth (VGRO)",
        risk: "Risk 7-9",
        description: "Built-in growth example from this app's dataset.",
        iconName: "TrendingUp",
        holdings: [
          { ticker: "VUN.TO", name: "Vanguard US Total Market", weight: 35.8 },
          {
            ticker: "VCN.TO",
            name: "Vanguard FTSE Canada All Cap",
            weight: 23.5,
          },
          {
            ticker: "VIU.TO",
            name: "Vanguard FTSE Dev All Cap ex NA",
            weight: 17.6,
          },
          {
            ticker: "VEE.TO",
            name: "Vanguard FTSE Emerging Markets",
            weight: 5.6,
          },
          {
            ticker: "VAB.TO",
            name: "Vanguard Canadian Aggregate Bond",
            weight: 11.8,
          },
          {
            ticker: "VBG.TO",
            name: "Vanguard Global ex-Canada Bond",
            weight: 4.3,
          },
          { ticker: "VBU.TO", name: "Vanguard US Aggregate Bond", weight: 1.4 },
        ],
      },
      Balanced: {
        name: "Balanced (VBAL)",
        risk: "Risk 4-6",
        description: "Built-in balanced example from this app's dataset.",
        iconName: "Scale",
        holdings: [
          { ticker: "VUN.TO", name: "Vanguard US Total Market", weight: 26.8 },
          {
            ticker: "VCN.TO",
            name: "Vanguard FTSE Canada All Cap",
            weight: 17.7,
          },
          {
            ticker: "VIU.TO",
            name: "Vanguard FTSE Dev All Cap ex NA",
            weight: 13.2,
          },
          {
            ticker: "VEE.TO",
            name: "Vanguard FTSE Emerging Markets",
            weight: 4.2,
          },
          {
            ticker: "VAB.TO",
            name: "Vanguard Canadian Aggregate Bond",
            weight: 23.6,
          },
          {
            ticker: "VBG.TO",
            name: "Vanguard Global ex-Canada Bond",
            weight: 8.6,
          },
          { ticker: "VBU.TO", name: "Vanguard US Aggregate Bond", weight: 5.9 },
        ],
      },
      Conservative: {
        name: "Conservative (VCNS)",
        risk: "Risk 2-4",
        description: "Built-in conservative example from this app's dataset.",
        iconName: "Shield",
        holdings: [
          { ticker: "VUN.TO", name: "Vanguard US Total Market", weight: 17.9 },
          {
            ticker: "VCN.TO",
            name: "Vanguard FTSE Canada All Cap",
            weight: 11.8,
          },
          {
            ticker: "VIU.TO",
            name: "Vanguard FTSE Dev All Cap ex NA",
            weight: 8.8,
          },
          {
            ticker: "VEE.TO",
            name: "Vanguard FTSE Emerging Markets",
            weight: 2.8,
          },
          {
            ticker: "VAB.TO",
            name: "Vanguard Canadian Aggregate Bond",
            weight: 35.3,
          },
          {
            ticker: "VBG.TO",
            name: "Vanguard Global ex-Canada Bond",
            weight: 12.9,
          },
          {
            ticker: "VBU.TO",
            name: "Vanguard US Aggregate Bond",
            weight: 10.5,
          },
        ],
      },
    },
  },
  {
    id: "blackrock",
    name: "BlackRock (iShares)",
    logo: "/logos/blackrock.svg", // Using iShares logo as it's the consumer brand
    themeColor: "text-stone-900",
    themeGradient: "from-stone-800/20 to-transparent",
    description:
      "Built-in examples labeled BlackRock iShares. Verify current allocations with the issuer.",
    portfolios: {
      Growth: {
        name: "Growth (XGRO)",
        risk: "Risk 7-9",
        description: "Built-in growth example from this app's dataset.",
        iconName: "TrendingUp",
        holdings: [
          {
            ticker: "ITOT",
            name: "iShares Core S&P Total US Stock",
            weight: 37.1,
          },
          {
            ticker: "XIC.TO",
            name: "iShares Core S&P/TSX Capped",
            weight: 20.3,
          },
          {
            ticker: "XEF.TO",
            name: "iShares Core MSCI EAFE IMI",
            weight: 19.8,
          },
          {
            ticker: "XEC.TO",
            name: "iShares Core MSCI Emerging Mkts",
            weight: 3.8,
          },
          {
            ticker: "XBB.TO",
            name: "iShares Core Canadian Universe Bond",
            weight: 15.2,
          },
          {
            ticker: "XSH.TO",
            name: "iShares Core Canadian Short Term Bond",
            weight: 3.8,
          },
        ],
      },
      Balanced: {
        name: "Balanced (XBAL)",
        risk: "Risk 4-6",
        description: "Built-in balanced example from this app's dataset.",
        iconName: "Scale",
        holdings: [
          {
            ticker: "ITOT",
            name: "iShares Core S&P Total US Stock",
            weight: 27.2,
          },
          {
            ticker: "XIC.TO",
            name: "iShares Core S&P/TSX Capped",
            weight: 15.3,
          },
          {
            ticker: "XEF.TO",
            name: "iShares Core MSCI EAFE IMI",
            weight: 14.8,
          },
          {
            ticker: "XEC.TO",
            name: "iShares Core MSCI Emerging Mkts",
            weight: 2.7,
          },
          {
            ticker: "XBB.TO",
            name: "iShares Core Canadian Universe Bond",
            weight: 32.0,
          },
          {
            ticker: "XSH.TO",
            name: "iShares Core Canadian Short Term Bond",
            weight: 8.0,
          },
        ],
      },
      Conservative: {
        name: "Conservative (XCNS)",
        risk: "Risk 2-4",
        description: "Built-in conservative example from this app's dataset.",
        iconName: "Shield",
        holdings: [
          {
            ticker: "ITOT",
            name: "iShares Core S&P Total US Stock",
            weight: 18.1,
          },
          {
            ticker: "XIC.TO",
            name: "iShares Core S&P/TSX Capped",
            weight: 10.1,
          },
          { ticker: "XEF.TO", name: "iShares Core MSCI EAFE IMI", weight: 9.9 },
          {
            ticker: "XEC.TO",
            name: "iShares Core MSCI Emerging Mkts",
            weight: 1.9,
          },
          {
            ticker: "XBB.TO",
            name: "iShares Core Canadian Universe Bond",
            weight: 48.0,
          },
          {
            ticker: "XSH.TO",
            name: "iShares Core Canadian Short Term Bond",
            weight: 12.0,
          },
        ],
      },
    },
  },
];
