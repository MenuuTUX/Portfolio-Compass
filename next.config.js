/** @type {import('next').NextConfig} */
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
    },
    // Keep yahoo-finance2 in the server bundle (Bun + Turbopack external
    // aliases can 500 if left as a bare external).
    serverExternalPackages: [],
};

export default nextConfig;
