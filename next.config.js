/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['bullmq', 'ioredis'],
  },
};

module.exports = nextConfig;
