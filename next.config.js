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
    // yahoo-finance2 and @prisma/client must be bundled, not external: the
    // bun runtime cannot resolve Turbopack's hashed external module aliases,
    // which 500s every route importing them. Next.js hardcodes @prisma/client
    // into its own default external list (server-external-packages.jsonc)
    // regardless of serverExternalPackages, so transpilePackages is the only
    // way to force it back into the bundle.
    serverExternalPackages: [],
    transpilePackages: ['@prisma/client', 'pg'],
};

export default nextConfig;
