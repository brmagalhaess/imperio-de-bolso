import type { NextConfig } from "next";

// Site estático (landing + políticas exigidas pelas lojas), servido por nginx.
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default config;
