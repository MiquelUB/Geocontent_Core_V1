/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require("next-intl/plugin");
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig = {
  serverExternalPackages: ["pdf-parse", "puppeteer"],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.openstreetmap.org' },
      { protocol: 'https', hostname: 'tile.openstreetmap.org' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.cartocdn.com' },
    ],
  },
  reactStrictMode: true,
  experimental: {
    externalDir: true,
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: [
        process.env.NEXTAUTH_URL ? process.env.NEXTAUTH_URL.replace(/^https?:\/\//, '') : '',
        'localhost:3000'
      ].filter(Boolean)
    }
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors. (Used to prevent OOM in Docker)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Audit 2026: TypeScript strict mode. Els errors de tipus han de blocar la build.
    ignoreBuildErrors: false,
  },
  webpack: (config) => {
    return config;
  },
  output: 'standalone',
};

module.exports = withNextIntl(nextConfig);
