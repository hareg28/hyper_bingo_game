import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.trycloudflare.com', '*.loca.lt', '*.ngrok-free.app', 'localhost:3000'],
};

export default nextConfig;
