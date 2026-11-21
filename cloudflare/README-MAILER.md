# My Natural Care — automação de avisos por e-mail

## Regras atuais (versão 2)
- Remetente: support@mynaturalcare.app, domínio autenticado pelo Resend.
- **Três e-mails de cuidados são agendados automaticamente após a compra paga**, sem ação de cadastro dentro do aplicativo:
  1. **D+3** — Comece sua rotina de cuidados.
  2. **D+6** — Academia em casa e movimento leve (com avisos de segurança).
  3. **D+9** — Confira seu progresso, hábitos e avaliação.
- O programa é de **três e-mails no total por endereço**; não repete indefinidamente.
- Cada mensagem inclui link de descadastro; uma pessoa que cancelou não será reinscrita automaticamente se comprar novamente.
- Somente compradores com pedidos criados a partir de 2026-11-21T20:14:00Z entram nesta campanha; não há disparo retroativo em massa.
- O aviso de envio continua separado e é disparado uma única vez após observar a transição real de preparing para shipped ou partially_shipped. Pedidos já enviados no primeiro escaneamento não recebem alerta retroativo.
- Não são incluídos dados de saúde pessoais nos e-mails.

## Infraestrutura
- Render: servidor rastreio-cartpanda; consulta interna da Cartpanda e API de status do mailer.
- Cloudflare: Worker mnc-mailer, rota mynaturalcare.app/_mail/* e agendamento */30 * * * *.
- D1: mnc-customer-email-events; tabelas orders, subscriptions, dispatches e job_runs.
- Resend: chave Sending Access restrita ao domínio, não incluir chave no GitHub.

## Segredos que precisam existir
No Worker Cloudflare mnc-mailer > Settings > Variables and Secrets:
- RESEND_API_KEY (Secret)
- INTERNAL_TOKEN (Secret)

No Render rastreio-cartpanda > Environment:
- MNC_MAIL_INTERNAL_TOKEN (mesmo valor do INTERNAL_TOKEN do Worker)

O Worker também usa CAMPAIGN_START, RENDER_ORIGIN e DB, configurados no deploy.
NÃO publicar tokens ou chaves em arquivos nem em relatórios.

## Verificações
- GET /api/mail-status — retorna apenas se o servidor Render possui token.
- GET /_mail/health — informa se o Worker possui os segredos exigidos, sem revelar valores.
- Cloudflare Worker > Secrets mostra os NOMES, nunca os valores. A ausência de secrets significa que não haverá envios.
- A execução agendada precisa conseguir consultar o endpoint /api/internal/email-orders do Render, protegido por Bearer token.
- A data created_at de cada pedido precisa ser fornecida pela Cartpanda. Pedidos sem data válida não entram na campanha, evitando inclusão incorreta.
- Mensagens enviadas utilizam chaves de idempotência do Resend e registros persistentes no D1.

## Compliance e operação
Mensagens de cuidados são relacionamento pós-venda, não notificações essenciais de transporte. Antes de habilitar envios a todos os compradores, certifique-se de que há base legal adequada e informação transparente no checkout/política de privacidade, respeitando oposição e descadastro conforme LGPD. O envio automático não substitui essa obrigação.

O serviço de Render não usa autodeploy; cada alteração exige implantação manual. O Worker não é atualizado automaticamente pelo GitHub, portanto alterações no arquivo cloudflare/mnc-mailer-worker.js exigem publicação separada.
