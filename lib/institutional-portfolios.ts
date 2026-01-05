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
      "Canada's leading robo-advisor uses a passive, index-based approach with a tilt towards low volatility.",
    portfolios: {
      Growth: {
        name: "Growth",
        risk: "Risk 8-10",
        description:
          "Maximize long-term growth with a higher allocation to equities.",
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
        description: "A mix of safety and growth for moderate risk tolerance.",
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
        description:
          "Preserve capital with a focus on bonds and low volatility.",
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
      "A strategic alliance between RBC Global Asset Management and BlackRock Canada, offering the popular 'X-Series' portfolios.",
    portfolios: {
      Growth: {
        name: "Growth (XGRO)",
        risk: "Risk 7-9",
        description:
          "RBC iShares Core Growth ETF Portfolio. 80% Equity / 20% Fixed Income.",
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
        description:
          "RBC iShares Core Balanced ETF Portfolio. 60% Equity / 40% Fixed Income.",
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
        description:
          "RBC iShares Core Conservative Balanced ETF Portfolio. 40% Equity / 60% Fixed Income.",
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
      "TD's One-Click ETF portfolios provide a simple way to access TD's passive investing strategies.",
    portfolios: {
      Growth: {
        name: "Growth (TGRO)",
        risk: "Risk 7-9",
        description:
          "TD One-Click Aggressive ETF Portfolio. 90% Equity / 10% Fixed Income.",
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
        description:
          "TD One-Click Balanced ETF Portfolio. 60% Equity / 40% Fixed Income.",
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
        description:
          "TD One-Click Conservative ETF Portfolio. 40% Equity / 60% Fixed Income.",
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
      "BMO's ETF portfolios use their popular Z-series ETFs, known for tax efficiency and reliability.",
    portfolios: {
      Growth: {
        name: "Growth (ZGRO)",
        risk: "Risk 7-9",
        description: "Growth focused asset allocation using BMO ETFs.",
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
        description: "Balanced asset allocation using BMO ETFs.",
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
        description: "Income focused asset allocation using BMO ETFs.",
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
      "CIBC's Asset Allocation ETFs offer diversified portfolios with a focus on Canadian and Global markets.",
    portfolios: {
      Growth: {
        name: "Growth (CGRW)",
        risk: "Risk 7-9",
        description:
          "CIBC Balanced Growth ETF Portfolio. Focus on long-term capital growth.",
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
        description:
          "CIBC Balanced ETF Portfolio. A moderate mix for balanced growth and income.",
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
        description:
          "CIBC Conservative ETF Portfolio. Prioritizes income and capital preservation.",
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
      "Scotia Index Tracker ETFs offer low-cost exposure to major market indices, combinable for custom portfolios.",
    portfolios: {
      Growth: {
        name: "Growth (Simulated)",
        risk: "Risk 7-9",
        description:
          "Simulated 80/20 portfolio using Scotia Index Tracker ETFs.",
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
        description:
          "Simulated 60/40 portfolio using Scotia Index Tracker ETFs.",
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
        description:
          "Simulated 40/60 portfolio using Scotia Index Tracker ETFs.",
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
      "The pioneer of low-cost investing. Their Asset Allocation ETFs are the gold standard for passive investing.",
    portfolios: {
      Growth: {
        name: "Growth (VGRO)",
        risk: "Risk 7-9",
        description:
          "Standard 80/20 split. Uses broad-market index ETFs to capture global growth.",
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
        description:
          "Classic 60/40 portfolio. The benchmark for balanced investing.",
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
        description:
          "40/60 split prioritizing income and stability over aggressive growth.",
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
      "The world's largest asset manager. These 'Core' portfolios use market-cap weighted indexing.",
    portfolios: {
      Growth: {
        name: "Growth (XGRO)",
        risk: "Risk 7-9",
        description:
          "80% Equity / 20% Fixed Income. Broad diversification at a low cost.",
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
        description:
          "60% Equity / 40% Fixed Income. A simple one-ticket balanced solution.",
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
        description:
          "40% Equity / 60% Fixed Income. Designed for capital preservation.",
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
