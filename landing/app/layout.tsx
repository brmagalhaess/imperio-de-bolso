import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Company } from "@/components/Company";
import { SITE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — jogo de construir negócios`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  icons: { icon: "/favicon.ico", apple: "/icon.png" },
  openGraph: {
    title: SITE.name,
    description: SITE.description,
    url: SITE.url,
    siteName: SITE.name,
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/img/icone.png", width: 512, height: 512, alt: SITE.name }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#0c8a85", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="top">
          <div className="wrap">
            <Link className="brand" href="/">
              <img src="/icon.png" alt="" width={40} height={40} />
              {SITE.name}
            </Link>
            <nav aria-label="Principal">
              <Link href="/#como-jogar">Como jogar</Link>
              <Link href="/#perguntas">Perguntas</Link>
              <Link href="/suporte/">Suporte</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="bottom">
          <div className="wrap">
            <div>
              <strong>{SITE.name}</strong> — <Company field="legalName" />, CNPJ{" "}
              <Company field="cnpj" />
              <br />
              Contato: <Company field="email" />
            </div>
            <nav aria-label="Políticas">
              <Link href="/privacidade/">Privacidade</Link>
              <Link href="/termos/">Termos de uso</Link>
              <Link href="/excluir-conta/">Excluir conta</Link>
              <Link href="/suporte/">Suporte</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
