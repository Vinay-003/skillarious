/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'ykllmcwljsfeluhpvzbv.supabase.co',
      }
    ],
    unoptimized: true // Add this if you want to skip image optimization
  },
};

export default nextConfig;

