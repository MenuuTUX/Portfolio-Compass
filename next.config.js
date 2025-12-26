/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'cdn.jsdelivr.net',
            },
        ],
    },
    serverExternalPackages: ['yahoo-finance2', 'prisma', '@prisma/client'],
};

export default nextConfig;
