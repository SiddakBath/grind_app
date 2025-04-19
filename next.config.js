/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove static export to support server components with cookies
  // output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Images can now use the Next.js Image Optimization API
  images: { unoptimized: false },
  // Modern settings for Next.js 14
  reactStrictMode: true,
  swcMinify: true,
};

module.exports = nextConfig;
