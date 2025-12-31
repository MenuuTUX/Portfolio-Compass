import { fetch } from 'bun';

async function getYahooCredentials() {
  console.log('Fetching Yahoo Finance credentials...');

  try {
    // 1. Get Cookie
    const cookieResponse = await fetch('https://fc.yahoo.com', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });

    // The response might be a redirect or 404, but it sets the cookie.
    const setCookie = cookieResponse.headers.get('set-cookie');

    if (!setCookie) {
        throw new Error('No set-cookie header found from fc.yahoo.com');
    }

    // Extract the cookie
    const cookie = setCookie.split(';')[0];

    // 2. Get Crumb
    const crumbResponse = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Cookie': cookie
        }
    });

    if (!crumbResponse.ok) {
        throw new Error(`Failed to get crumb: ${crumbResponse.status} ${crumbResponse.statusText}`);
    }

    const crumb = await crumbResponse.text();

    console.log('\n✅ Successfully fetched Yahoo Credentials!\n');
    console.log(`YAHOO_COOKIE='${cookie}'`);
    console.log(`YAHOO_CRUMB='${crumb}'`);
    console.log('\nCopy these values to your .env file or Vercel Environment Variables.');

  } catch (error) {
    console.error('Failed to fetch credentials:', error);
  }
}

getYahooCredentials();
