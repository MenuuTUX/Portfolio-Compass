
import { write, file } from 'bun';

const providers = [
  { name: 'AGFiQ', domain: 'agf.com' },
  { name: 'AdvisorShares', domain: 'advisorshares.com' },
  { name: 'Alpha Architect', domain: 'alphaarchitect.com' },
  { name: 'American Century Investments', domain: 'americancentury.com' },
  { name: 'ARK Invest', domain: 'ark-funds.com' },
  { name: 'BlackRock', domain: 'blackrock.com' },
  { name: 'iShares', domain: 'ishares.com' },
  { name: 'BMO Asset Management', domain: 'bmo.com' },
  { name: 'BNY Mellon', domain: 'bnymellon.com' },
  { name: 'Charles Schwab', domain: 'schwab.com' },
  { name: 'CI Global Asset Management', domain: 'ci.com' },
  { name: 'CIBC Asset Management', domain: 'cibc.com' },
  { name: 'Desjardins Investments', domain: 'desjardins.com' },
  { name: 'Direxion', domain: 'direxion.com' },
  { name: 'Dynamic Funds', domain: 'dynamic.ca' },
  { name: 'Evolve ETFs', domain: 'evolveetfs.com' },
  { name: 'Fidelity', domain: 'fidelity.com' },
  { name: 'First Trust', domain: 'ftportfolios.com' },
  { name: 'Franklin Templeton', domain: 'franklintempleton.com' },
  { name: 'Global X', domain: 'globalxetfs.com' },
  { name: 'Goldman Sachs', domain: 'goldmansachs.com' },
  { name: 'GraniteShares', domain: 'graniteshares.com' },
  { name: 'Hamilton ETFs', domain: 'hamiltonetfs.com' },
  { name: 'Harvest Portfolios Group', domain: 'harvestportfolios.com' },
  { name: 'Invesco', domain: 'invesco.com' },
  { name: 'J.P. Morgan Asset Management', domain: 'jpmorgan.com' },
  { name: 'KraneShares', domain: 'kraneshares.com' },
  { name: 'Mackenzie Investments', domain: 'mackenzieinvestments.com' },
  { name: 'Manulife Investments', domain: 'manulife.com' },
  { name: 'Morgan Stanley', domain: 'morganstanley.com' },
  { name: 'National Bank Investments', domain: 'nbc.ca' },
  { name: 'PIMCO', domain: 'pimco.com' },
  { name: 'ProShares', domain: 'proshares.com' },
  { name: 'Purpose Investments', domain: 'purposeinvest.com' },
  { name: 'RBC Global Asset Management', domain: 'rbcgam.com' },
  { name: 'Scotia Global Asset Management', domain: 'scotiafunds.com' }, // corrected from scotiabank
  { name: 'State Street Global Advisors', domain: 'ssga.com' },
  { name: 'SPDR', domain: 'ssga.com' }, // Alias
  { name: 'TD Asset Management', domain: 'td.com' },
  { name: 'VanEck', domain: 'vaneck.com' },
  { name: 'Vanguard', domain: 'vanguard.com' },
  { name: 'VictoryShares', domain: 'vcm.com' },
  { name: 'WisdomTree', domain: 'wisdomtree.com' },
  { name: 'Xtrackers', domain: 'etf.dws.com' },
];

async function downloadLogos() {
  console.log('Downloading provider logos...');

  for (const provider of providers) {
    const slug = provider.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const url = `https://www.google.com/s2/favicons?domain=${provider.domain}&sz=64`;

    try {
      console.log(`Fetching ${provider.name} from ${url}...`);
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch ${provider.name}: ${response.status}`);
        continue;
      }

      const buffer = await response.arrayBuffer();
      const path = `public/logos/${slug}.png`; // Google favicons are often png, but sometimes jpg/ico. Browsers handle extension mismatch usually, but let's just save as png for consistency in naming.

      await write(path, buffer);
      console.log(`Saved ${path}`);
    } catch (error) {
      console.error(`Error downloading ${provider.name}:`, error);
    }
  }

  console.log('Done.');
}

downloadLogos();
