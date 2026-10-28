# AstaPay

Plataforma de vendas com painel autenticado, catálogo persistente e checkout Pix via NOMAPAY. A taxa de R$ 0,50 por venda está registrada como configuração inicial do produto; a liquidação financeira/ledger e os saques ainda precisam ser concluídos antes de usar essa taxa como saldo real.

## Configuração

1. Node.js 20 ou superior.
2. Copie `.env.example` para `.env.local` e preencha os valores do Supabase e NOMAPAY no servidor.
3. Rode `npm install` e `npm run dev`.
4. Execute as migrations SQL no Supabase, nesta ordem: `0001_initial.sql`, `0002_nomapay_checkout.sql`, `0003_auth_profiles.sql`.
5. Em Supabase Auth, configure URL do site e URLs de redirecionamento e escolha se a confirmação de e-mail será obrigatória.
6. Registre o webhook `https://SEU-DOMINIO/api/webhooks/nomapay` no gateway e configure o segredo dedicado `whsec_...` em `NOMAPAY_WEBHOOK_SECRET`.
7. Configure `APP_URL` com a origem HTTPS pública da aplicação.

## Funcionalidades no código

- Cadastro e login com Supabase Auth, logout e sessão por cookie.
- Criação e persistência de produtos por vendedor; publicação/despublicação e link público `/checkout/[slug]`.
- Checkout público com preço lido no banco, criação de pedido e chamada `POST /api/v1/transactions` na NOMAPAY com valores em centavos.
- Webhook com HMAC-SHA256 sobre o corpo bruto, comparação em tempo constante, deduplicação de delivery ID e conciliação de valor antes de confirmar um pedido.
- Painel de vendas e resumo financeiro baseados em pedidos no banco.
- Chaves de servidor separadas da configuração pública.

## Limitações antes de produção

O código foi atualizado, mas este ambiente não conseguiu executar `npm install` ou `npm run build` contra o repositório remoto; o CI deve confirmar o build. Ainda são necessários testes reais controlados com NOMAPAY/Supabase e revisão do contrato de webhook.

- O cadastro de usuário e o catálogo precisam ser testados após aplicar as três migrations.
- O fluxo de pagamento deve ser validado em sandbox ou com cobrança de valor baixo autorizada pelo proprietário da conta.
- Falta ledger imutável e conciliação financeira de taxas/saldos, KYC e aprovação manual, pedidos de saque, antifraude, rate limiting, política de privacidade/termos e fluxo de reembolso.
- Configure proteção contra abuso no checkout. Não trate apenas o status do pedido como saldo disponível.
- Em falhas/timeout após enviar uma cobrança, reconcilie a transação no gateway antes de tentar criar outra.
- Não comite segredos e não compartilhe a service-role key. Rotacione qualquer chave privada que tenha sido publicada anteriormente.
