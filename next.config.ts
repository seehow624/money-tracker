import type { NextConfig } from "next";
import { execSync } from "node:child_process";

function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  // Hosts allowed to reach the Next dev server cross-origin (e.g. a LAN/Tailscale
  // IP when developing from another device). Set DEV_ORIGINS=ip1,ip2 to add yours.
  allowedDevOrigins: process.env.DEV_ORIGINS?.split(',').filter(Boolean) ?? [],
  devIndicators: false,
  env: {
    NEXT_PUBLIC_GIT_SHA: gitSha(),
    NEXT_PUBLIC_BUILD_TIME: new Date()
      .toISOString()
      .slice(0, 16)
      .replace("T", " "),
  },
};

export default nextConfig;
