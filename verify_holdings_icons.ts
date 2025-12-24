
import { getAssetIconUrl } from './lib/etf-providers';

console.log('--- Current Behavior Check ---');

// Case 1: Vanguard ETF passed as ETF
const vunEtf = getAssetIconUrl('VUN.TO', 'Vanguard US Total Market Index ETF', 'ETF');
console.log(`VUN.TO (ETF): ${vunEtf}`);
// Expected: /logos/vanguard.png

// Case 2: Apple passed as ETF (simulating mixed holdings list)
const aaplEtf = getAssetIconUrl('AAPL', 'Apple Inc', 'ETF');
console.log(`AAPL (ETF): ${aaplEtf}`);
// Expected (Current): null (because Apple is not a provider)
// Expected (Target): .../ticker_icons/AAPL.png

// Case 3: Vanguard ETF passed as STOCK (simulating current buggy component)
const vunStock = getAssetIconUrl('VUN.TO', 'Vanguard US Total Market Index ETF', 'STOCK');
console.log(`VUN.TO (STOCK): ${vunStock}`);
// Expected: .../ticker_icons/VUN.TO.png (This is what we want to avoid for ETFs)

if (vunEtf && vunEtf.includes('vanguard')) {
    console.log('PASS: Vanguard ETF matched correctly.');
} else {
    console.log('FAIL: Vanguard ETF did not match.');
}

if (aaplEtf === null) {
    console.log('PASS (Current): Apple as ETF returns null.');
} else {
    console.log('FAIL (Current): Apple as ETF returned: ' + aaplEtf);
}
