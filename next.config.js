/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require("next-intl/plugin");
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig = {
  serverExternalPackages: ["pdf-parse", "puppeteer", "bullmq"],
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
      allowedOrigins: ['pxxv-pxx-frontend.80opze.easypanel.host', 'localhost:3000']
    }
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    return config;
  },
  output: 'standalone',
};

module.exports = withNextIntl(nextConfig);
