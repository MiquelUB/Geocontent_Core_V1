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
  experimental: {
    externalDir: true,
    middlewareClientMaxBodySize: '200mb',
    serverActions: {
      bodySizeLimit: '200mb',
      allowedOrigins: [
        process.env.NEXTAUTH_URL ? process.env.NEXTAUTH_URL.replace(/^https?:\/\//, '') : '',
        'localhost:3000'
      ].filter(Boolean)
    },
    // Prevenció de saturació de RAM (OOM) en servidors de CI/CD (ex: Vercel, Render)
    webpackBuildWorker: true,
    workerThreads: false,
    cpus: 1,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors. (Used to prevent OOM in Docker)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Reversió temporal (Hotfix): Tolerem els errors de TS a producció per evitar que Docker
    // col·lapsi per falta de memòria (OOM) bloquejant el pipeline a "Checking validity of types".
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    return config;
  },
  output: 'standalone',
};

module.exports = withNextIntl(nextConfig);
