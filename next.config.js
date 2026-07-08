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
    // yahoo-finance2 is intentionally bundled (not external): the bun runtime
    // cannot resolve Turbopack's hashed external aliases for it in dev
    serverExternalPackages: ['prisma', '@prisma/client'],
};

export default nextConfig;
