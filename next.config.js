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

const nextConfig = {
    images: {
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
        return [{ source: '/:path*', headers: securityHeaders }];
    },
};

export default nextConfig;
