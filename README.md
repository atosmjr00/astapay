# AstaPay

Painel Next.js responsivo para uma plataforma de vendas com checkout Pix e taxa de plataforma planejada de R$ 0,50 por venda.

## Rodar localmente

1. Instale Node.js 20+.
2. Copie `.env.example` para `.env.local` e preencha as variáveis.
3. Execute `npm install` e `npm run dev`.
4. Aplique, em ordem, `supabase/migrations/0001_initial.sql` e `supabase/migrations/0002_nomapay_checkout.sql` no projeto Supabase.
5. Configure no painel NOMAPAY o webhook público `https://SEU-DOMINIO/api/webhooks/nomapay` e coloque o segredo dedicado `whsec_...` em `NOMAPAY_WEBHOOK_SECRET`.

## O que está implementado no backend

- Rota `POST /api/pix`: consulta preço no banco (não confia no valor enviado pelo navegador), cria pedido, chama `POST https://nomaofficial.com.br/api/v1/transactions`, usa chave de idempotência e devolve o Pix.
- Rota `POST /api/webhooks/nomapay`: verifica HMAC-SHA256 sobre o corpo bruto, compara a assinatura em tempo constante, registra delivery IDs para deduplicação e só marca pedido como pago quando o ID e o valor em centavos correspondem ao pedido.
- Cliente administrativo do Supabase isolado em módulo server-only; a chave service-role nunca deve ser exposta ao browser.
- Migration para idempotência e armazenamento de eventos recebidos.

## Importante: ainda não é lançamento de produção

A interface do painel continua sendo uma demonstração: cadastro de produtos local no navegador, sem fluxo completo de autenticação, persistência de catálogo, aprovação KYC, ledger financeiro, saques ou notificações de venda. O backend Pix foi integrado conforme a especificação NOMAPAY colada no projeto, mas ainda precisa de teste ponta a ponta em ambiente controlado, revisão de segurança e confirmação do comportamento real do gateway.

Antes de aceitar dinheiro real:
- Configure somente segredos válidos no ambiente de servidor; nunca os commite.
- Faça testes de sandbox para cobrança, timeout, repetição da mesma chave de idempotência, webhook duplicado/fora de ordem, divergência de valor e indisponibilidade do banco.
- Garanta que pedidos com resposta perdida do gateway possam ser reconciliados sem duplicar cobrança.
- Implemente rate limiting e proteção contra abuso no checkout.
- Implemente autenticação, verificação de e-mail, KYC com aprovação manual e auditoria.
- Criptografe CPF e chaves Pix em repouso; mantenha apenas o hash de documento quando possível.
- Implemente ledger imutável, saldo disponível/reservado, conciliação e aprovação de saques. Não use apenas o status de um pedido como fonte do saldo do vendedor.
- Valide requisitos legais, LGPD, regras do provedor de pagamentos e termos de uso.
