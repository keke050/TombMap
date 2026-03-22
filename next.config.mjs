/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Workaround: current ESLint/Next integration crashes while serializing config.
    ignoreDuringBuilds: true
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org'
      },
      {
        protocol: 'https',
        hostname: 'commons.wikimedia.org'
      },
      {
        protocol: 'https',
        hostname: 'bkimg.cdn.bcebos.com'
      }
    ]
  },
  output: 'standalone'
};

export default nextConfig;
