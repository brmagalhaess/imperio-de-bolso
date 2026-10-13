import { SITE } from "@/lib/site";

/** Moldura das páginas legais (título, data de atualização e conteúdo). */
export function Legal({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="legal">
      <div className="wrap">
        <article className="doc">
          <h1>{title}</h1>
          <p className="updated">Última atualização: {SITE.policiesUpdatedAt}</p>
          {children}
        </article>
      </div>
    </div>
  );
}
