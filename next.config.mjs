/** @type {import('next').NextConfig} */
const nextConfig = {
  // Temporarily remove output: "export" to fix webpack compilation issues
  // output: "export", // Enable static export for frontend-only deployment
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
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  // Disable server-side features for static export
};

export default nextConfig;
