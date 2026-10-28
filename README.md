# AstaPay

Painel Next.js responsivo para uma plataforma de vendas com checkout Pix e taxa de plataforma planejada de R$ 0,50 por venda.

## Rodar localmente

1. Instale Node.js 20+.
2. Copie `.env.example` para `.env.local` e preencha as variáveis do Supabase.
3. Execute `npm install` e `npm run dev`.
4. Aplique `supabase/migrations/0001_initial.sql` no projeto Supabase.

## Estado real do projeto

O painel atual é uma demonstração de interface; o cadastro de produtos ainda é local no navegador. A rota Pix exige sessão Supabase e valida o produto no servidor, mas permanece deliberadamente bloqueada: a documentação NOMAPAY fornecida não foi possível de verificar nesta sessão e o contrato de autenticação, endpoint, payload e assinatura do webhook ainda precisa ser confirmado. Não configure credenciais live nem aceite pagamentos até concluir esse adaptador, deduplicação/idempotência, conciliação e testes em sandbox.

## Segurança antes do lançamento

- Nunca commitar segredos. Use variáveis de ambiente no servidor.
- Rotacionar imediatamente qualquer chave privada que tenha sido publicada ou enviada a repositórios.
- Implementar login, verificação de e-mail, KYC com aprovação manual e auditoria.
- Criptografar CPF e chave Pix em repouso; não devolver esses campos ao navegador.
- Implementar webhook com validação de assinatura, idempotência e conferência de valor/ordem.
- Implementar ledger financeiro imutável, reserva de saldo, antifraude, limites e aprovação de saques.
- Validar requisitos legais, LGPD, regras do provedor de pagamentos e termos de uso.
