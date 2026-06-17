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
      allowedOrigins: [
        process.env.NEXTAUTH_URL ? process.env.NEXTAUTH_URL.replace(/^https?:\/\//, '') : '',
        'localhost:3000'
      ].filter(Boolean)
    }
  },
  webpack: (config) => {
    return config;
  },
  output: 'standalone',
};

module.exports = withNextIntl(nextConfig);
