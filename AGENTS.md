# AGENTS — TapFlow (Cardápio Reels)

## Princípios mandatórios

1. Este é um projeto novo e separado de `cortai-app` (Flow), Alvo OS e Evolution Alvo. Nenhuma ação fora deste repositório é autorizada por este documento.
2. Fonte principal de requisitos: `docs/PRD.md`; fluxo de partida: `docs/PROMPT_CODEX_FASE_0_1.md`.
3. Faça **read before write** e proponha mudanças reversíveis, preferencialmente em branch e PR.
4. Não crie nem conecte projetos Supabase, Cloudflare, Railway, Oracle, recursos de DNS ou pagamentos sem autorização adicional.
5. Nenhuma credencial, sessão ou dado real de clientes em código, logs, testes ou commits.
6. Demonstrações devem identificar explicitamente dados e pagamentos simulados.
7. UI mobile-first (360/390/430 px) com revisão desktop (1280 px), WCAG 2.2 AA como objetivo, estados vazios/erro/carregamento e `prefers-reduced-motion`.
8. Backend será fonte da verdade para preço final, pedido, estoque e status; webhooks futuros serão idempotentes.
9. Separar tenants e testar isolamento antes de qualquer banco ou fluxo com usuários reais.
10. O nome do produto é `TapFlow`. O tema `Lime Noir` ainda é proposta visual. Não afirmar registro de marca ou disponibilidade de domínio sem verificação.

## Critério de entrega

Relatar precisamente o que foi implementado, o que foi testado, o que é simulado, pendências, custo potencial e próximos passos. Não afirmar deploy ou pagamentos operacionais sem prova.
