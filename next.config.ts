import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactStrictMode: true,
  serverExternalPackages: ["searoute-js", "geojson-path-finder"]
};

export default nextConfig;
