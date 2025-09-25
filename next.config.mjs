/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed output: "export" to allow dynamic API routes
  trailingSlash: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
