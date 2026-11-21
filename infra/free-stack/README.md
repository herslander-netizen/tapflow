# TapFlow — Fundação de infraestrutura gratuita

**Propriedade:** ALVO Digital · **Estado:** preparação técnica em branch, **SEM recursos Cloudflare/Supabase criados**.

Objetivo: conectar uma conta administrativa **exclusiva do TapFlow** nas plataformas, usar Free quando possível, e não assumir cobranças enquanto não houver clientes. O endereço administrativo fornecido na conversa foi intencionalmente omitido do repositório, pois o GitHub está público.

## Passo zero — não executar com conta errada

As conexões Cloudflare e Supabase disponíveis nesta sessão pertencem a contas usadas por outros projetos. **Nenhuma delas corresponde à conta nova do TapFlow**. A configuração em nuvem fica bloqueada até que a nova conta esteja cadastrada e conectada ao ChatGPT.

Usar o mesmo repositório `herslander-netizen/tapflow` para o código é permitido, porém não confundir o dono do GitHub com a identidade proprietária de uma conta Cloudflare ou Supabase. Nunca vincular banco, Workers, tokens ou domínios de Flow, Alvo OS ou KAIRÓS.

## O que este commit entrega

- `manifest.json` é inventário legível por máquina, com zero deploy e zero serviços pagos habilitados.
- `worker.mjs` é um endpoint **de preparação sem credenciais, sem banco e sem pedidos reais**.
- `d1/0001_schema.sql` é um rascunho inicial de esquema, **não foi executado**.
- Testes e CI conferem os bloqueios de cobrança, identidade e ausência de deploy automático.

## Ordem correta de configuração

1. Criar/entrar na conta **Cloudflare** com o endereço dedicado fornecido, confirmar o e-mail e verificar o plano **Workers Free**. Não escolher Workers Paid, nenhuma trial e nenhum plano pago.
2. Criar/entrar na conta **Supabase** com o mesmo endereço, confirmar a conta e manter uma organização Free. **Não criar projeto** até decidir se PostgreSQL é necessário — o D1 é candidato para o primeiro piloto.
3. Conectar a **nova identidade** de Cloudflare e Supabase em ChatGPT → Configurações → Plugins, sem substituir inadvertidamente integrações existentes. Somente prosseguir após confirmar que as duas conexões pertencem à conta TapFlow.
4. No GitHub, considerar tornar o repositório **privado** antes de dados comerciais proprietários. Não há segredos nesta branch.
5. Após a conta Cloudflare estar conectada, configurar **Worker separado** `tapflow-preview` e **D1 separado** `tapflow-preview-db`, somente Free. Uso de recursos reais e deploy precisam ser verificados antes da primeira operação. O serviço de banco não foi provisionado.
6. Publicar uma cópia estática do protótipo no subdomínio `workers.dev`, quando o modo Free e o isolamento estiverem confirmados. Este repositório **não** dispara deploy.
7. Para vídeos, manter posters/arquivos de demonstração pequenos no build. Não ativar R2 sem avaliar a assinatura de billing e a política de cobranças por excedentes. Poster e vídeo do restaurante exigem direito de uso.
8. Antes de atender clientes reais, validar segurança, idempotência persistente, backups, concorrência, autenticação, faturamento, LGPD, disponibilidade e política de incidentes; Free não fornece SLA.

## Escolha dos serviços gratuitos

| Camada | Escolha para prévia | Alternativa ou expansão | Risco/cuidado |
| --- | --- | --- | --- |
| Site | Cloudflare Workers Static Assets Free | Pages legado | Não comprar domínio |
| API | Workers Free + Hono posteriormente | Node em Oracle Always Free | Limites diários e CPU |
| Banco | Cloudflare D1 Free próprio | Supabase PostgreSQL próprio | D1 não tem RLS do PostgreSQL |
| Autenticação | Avaliar Better Auth para D1 | Supabase Auth | Autorização e recuperação de conta são obrigatórias |
| Mídia inicial | Arquivos estáticos compactados | R2 Standard só com controle de billing | R2 pode cobrar se exceder cota |
| Filas | Não ativar por enquanto | Queues Free com necessidade comprovada | Só acrescentar quando houver fluxo assíncrono |
| Anti-abuso | Validações server-side, rate limit | Turnstile Free | Não substitui validação de sessão |
| CI | GitHub Actions: testes | Execuções de deploy com aprovação | Não habilitar credenciais de produção |
| e-mail | Sem envios automáticos na demo | Provedor transacional Free com cotas | Envio e domínio necessitam verificação |
| IA | Nenhuma chamada paga na demo | Free tiers sob teste e limites | Não depender de IA para pedidos |

## Limites para monitorar

- Workers Free: **100 mil requisições dinâmicas/dia**; CPU limitada; requisições de Static Assets são gratuitas/ilimitadas conforme documentação atual.
- D1 Workers Free: **5 milhões de linhas lidas e 100 mil escritas por dia**, 5 GB totais, até 500 MB por banco; o limite gratuito interrompe consultas quando atingido, não se converte automaticamente em escala paga.
- R2 Standard: franquia de **10 GB-mês**, 1 milhão de operações classe A e 10 milhões classe B/mês; excedentes/assinatura exigem análise.
- Supabase Free: regra-base de **até 2 projetos ativos gratuitos por proprietário/admin elegível** entre organizações Free, 500 MB por projeto; pausas e quotas próprias.
- GitHub Actions: quotas dependem do tipo de repositório e da conta; nenhum deploy automático está ativado.

**Custo de infraestrutura pretendido:** R$ 0/mês antes de clientes, **condicionado** a contas gratuitas, quotas respeitadas e nenhuma assinatura paga. Não é possível garantir custo zero absoluto se o proprietário ativar faturamento, transcodificação paga, domínio próprio, SMS, uso acima da franquia, gateway financeiro ou hardware NFC.

## Fontes oficiais (verificadas em 21/11/2026)

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/r2/get-started/
- https://supabase.com/docs/guides/platform/billing-faq
- https://supabase.com/docs/guides/platform/project-transfer/requirements
- https://github.com/pricing
- https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
