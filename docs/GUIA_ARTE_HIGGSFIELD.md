# GUIA DE ARTE E PIPELINE HIGGSFIELD — IMPÉRIO DE BOLSO

## Decisão e limites
Godot 4 estável + GDScript é o motor do jogo. Higgsfield é ferramenta de produção de imagens, não motor de jogo nem garantia de sprites prontos. Codex integra e testa os assets no Godot. Verificar disponibilidade real da integração Higgsfield na sessão do Codex, custos/créditos e direitos de uso comercial do plano antes de gerar em escala. Não iniciar geração paga sem autorização.

## Direção de arte v0.2 (vigente) — ver docs/ADRs/0004-direcao-visual-v2.md
Cartoon vibrante, brilhante e quase 3D, formas arredondadas. Alvo: mockup A (cena da ilha), mockup B
(interface) e mockup D (cidade-maquete). Gerar peças com Grok Image 2.0 (edição) usando o mockup
aprovado como referência. Detalhes do fluxo em tools/art/README.md.

## Direção de arte v0.1 (substituída)
Jogo mobile 2D isométrico estilizado, cores vibrantes mas harmoniosas, perspectiva consistente (aprox. 2:1), iluminação suave superior esquerda, silhuetas legíveis em tela pequena, contornos discretos, fundo transparente para objetos isolados, sem texto embutido nas imagens. Interface e textos serão implementados no Godot para tradução e acessibilidade. Referências de terceiros apenas como inspiração; não reproduzir personagens ou marcas protegidas.

## Entrega piloto (gate de aprovação)
Gerar primeiro: (1) carrinho de água com três evoluções coerentes; (2) um tile de piso e um de rua; (3) árvore e banco; (4) personagem vendedor; (5) composição de referência do bairro. Criar cena de teste no Godot com posicionamento, colisão/click, escala e câmera. Solicitar aprovação visual antes de produzir lote grande.

## Catálogo e especificação
Registrar cada item em `docs/ASSET_CATALOG.csv`: id, nome, categoria, versão, prompt, referência, dimensões, transparência, licença/status, custo aprovado, arquivo fonte, arquivo otimizado, cena Godot e revisão. Nomes `snake_case` e versão explícita, por exemplo `water_cart_lv01_v01.png`. Preferir PNG RGBA para objetos isolados e WebP/PNG otimizados quando adequado. Definir dimensões por classe após piloto; não prometer transparência nativa quando o modelo não oferecer. Conferir bordas, recortes, sombra, perspectiva, consistência e legibilidade.

## Prompt base de asset
"Create a single original game-ready asset for a colorful 2D isometric mobile business tycoon game. Subject: {ASSET}. Consistent 2:1 isometric viewpoint, soft upper-left lighting, clean readable silhouette, playful Brazilian tropical neighborhood aesthetic, no lettering, no logo, no watermark, centered isolated object, transparent background if supported, consistent scale with approved reference sheet. Preserve shape and palette across upgrade levels."

## Fluxo Codex → Higgsfield → Godot
1. Ler este guia e o catálogo; verificar ferramentas Higgsfield efetivamente disponíveis.
2. Estimar créditos e obter aprovação antes de gerações pagas; gerar amostra pequena.
3. Salvar originais em `game/assets/source/` e derivados em `game/assets/optimized/`, com proveniência e licença.
4. Preparar cortes, transparência e dimensões; importar no Godot com configurações de filtragem apropriadas.
5. Criar cena de teste, verificar posicionamento em Android/iOS, memória e FPS; registrar resultado.
6. Atualizar catálogo, `docs/IMPLEMENTATION_STATUS.md` e screenshots reais; nunca declarar asset concluído antes da integração.
7. Se integração indisponível, usar placeholders claramente identificados e registrar bloqueio sem interromper o gameplay.

## MVP e expansão
MVP: bairro piloto aprovado, 10 negócios com arte consistente e 3 níveis visuais apenas quando orçamento permitir; priorizar jogabilidade e reutilização de elementos. Completo: bairros, personagens, cosméticos, efeitos, campanhas e materiais de lojas. Manter versões e referências para regenerações consistentes.

## Cuidados
Imagens de IA podem conter artefatos e inconsistências; revisão humana obrigatória. Guardar prompts e IDs de geração sem expor tokens. Verificar direitos de uso comercial e política de privacidade das imagens enviadas ao serviço. Não usar capturas conceituais como screenshots reais nas lojas.
