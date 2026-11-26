import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "privacidade/", "termos/", "excluir-conta/", "suporte/"].map(
    (p) => ({
      url: `${SITE.url}/${p}`,
      changeFrequency: "monthly",
    }),
  );
}
