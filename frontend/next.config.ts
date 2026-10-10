import type { NextConfig } from "next";
import { validatePublicEnvironment } from "./src/utils/publicEnvSafety";

validatePublicEnvironment(process.env);

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
