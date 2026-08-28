/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '100mb' },
  },
  serverExternalPackages: [
    '@prisma/client',
    'prisma',
    'better-auth',
    'jose',
  ],
  transpilePackages: ['@tldraw/tldraw', '@tldraw/editor', '@tldraw/store', '@tldraw/utils', '@tldraw/validate'],
};
