/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // All NSE MCP traffic stays server-side (API routes). No client fetch to MCP hosts.
};
module.exports = nextConfig;
