/** @type {import('next').NextConfig} */

// Applied to every response. Vercel already terminates TLS and redirects
// http -> https; HSTS is what stops a browser from trying http at all.
// `preload` is deliberately omitted: submitting to the preload list is
// effectively irreversible, so that is an owner decision, not a default.
const securityHeaders = [
    {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains',
    },
    // The app renders no user-supplied HTML, but these are cheap insurance.
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=()',
    },
];

// Compass Lab runs code the user writes or pastes, in web workers. Removing
// fetch() and friends inside a worker cannot be made airtight (a strategy can
// reach the prototype's fetch, or start a nested worker), so the browser is told
// to refuse the network instead. A worker takes its policy from the response
// headers of its own script, so the same policy is sent with the JS chunks, and
// every page carries it too. Nothing here lets strategy code send data to a
// host other than this site, the jsDelivr CDN that serves Monaco and Pyodide, and the Bank of Canada's public rate feed.
// Strategy code can still read this site's own storage, but it cannot send it
// anywhere.
const dev = process.env.NODE_ENV !== 'production';
const CDN = 'https://cdn.jsdelivr.net';
// The browser reads the USD/CAD rate straight from the Bank of Canada (hooks/useBankOfCanadaFx.ts).
const BANK_OF_CANADA = 'https://www.bankofcanada.ca';
const labPolicy = [
    "default-src 'self'",
    // 'unsafe-eval' and 'wasm-unsafe-eval': strategies are compiled at run time and Pyodide is WebAssembly.
    // 'unsafe-inline': Next and next-themes inject inline scripts. Network egress is what this policy limits.
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: ${CDN}${dev ? ' https://va.vercel-scripts.com' : ''}`,
    "worker-src 'self' blob:",
    `connect-src 'self' ${CDN} ${BANK_OF_CANADA}${dev ? ' ws: wss:' : ''}`,
    `style-src 'self' 'unsafe-inline' ${CDN}`,
    `font-src 'self' data: ${CDN}`,
    "img-src 'self' data: blob: https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
].join('; ');

const nextConfig = {
    images: {
        // /api/logo falls back to an SVG monogram; the CSP/attachment pair is Next's recommended hardening
        dangerouslyAllowSVG: true,
        contentDispositionType: 'attachment',
        contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'cdn.jsdelivr.net',
            },
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            },
        ],
        // Serve modern formats to browsers that accept them.
        formats: ['image/avif', 'image/webp'],
    },
    // Keep yahoo-finance2 in the server bundle (Bun + Turbopack external
    // aliases can 500 if left as a bare external).
    serverExternalPackages: [],
    async headers() {
        const csp = [{ key: 'Content-Security-Policy', value: labPolicy }];
        return [
            // The same policy on every page, so no page is left without the lab limits.
            { source: '/:path*', headers: [...securityHeaders, ...csp] },
            // Ignored for a script a page loads; applied when the chunk is a worker's own script.
            { source: '/_next/static/chunks/:path*', headers: csp },
        ];
    },
};

export default nextConfig;
