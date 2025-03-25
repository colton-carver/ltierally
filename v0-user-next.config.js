/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3000",
  },
  // Explicitly disable the App Router to avoid conflicts
  experimental: {
    appDir: false,
  },
}

module.exports = nextConfig

