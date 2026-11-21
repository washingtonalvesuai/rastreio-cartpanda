# My Natural Care — automação de e-mails

## Estrutura
O Render consulta pedidos pagos da Cartpanda. O Cloudflare Worker mnc-mailer usa o banco D1 mnc-customer-email-events para registrar envios e preferências, e roda a cada 30 minutos. O Resend está com o domínio mynaturalcare.app verificado e envia como support@mynaturalcare.app.

## Credenciais: colocar APENAS nos dashboards (nunca no GitHub)
1. Cloudflare > Workers & Pages > mnc-mailer > Settings > Variables and Secrets:
   - RESEND_API_KEY = chave de Sending Access do domínio mynaturalcare.app
   - INTERNAL_TOKEN = segredo aleatório compartilhado com o Render
2. Render > rastreio-cartpanda > Environment:
   - MNC_MAIL_INTERNAL_TOKEN = exatamente o mesmo valor de INTERNAL_TOKEN do Worker
3. Configure os campos como Secret, salve e implante o Render.

## Rotina
- O Worker é acionado a cada 30 minutos (cron: */30 * * * *).
- O primeiro escaneamento estabelece uma linha de base de pedidos já existentes, sem envio retroativo de emails de despacho.
- Quando um pedido monitorado passar de preparing para shipped/partially_shipped, envia notificação uma vez (com idempotência).
- Os lembretes de autocuidado só são ativados mediante solicitação por um e-mail que possui pedido pago e confirmação no próprio endereço, por um link de uso único.
- Os lembretes saem a cada 72 horas após a confirmação, e cada e-mail contém um link de descadastro.
- O app oculta a adesão quando não há configuração de notificação no Render.
- O score de cuidados e registros de quiz continuam apenas no dispositivo. E-mails de lembretes não afirmam que uma nova avaliação foi registrada.
- O sistema escaneia até 20 páginas da Cartpanda por execução; o volume deve ser monitorado.
- As respostas recebidas pelo endereço support@ exigem caixa postal configurada separadamente.

## Endpoints
- GET /_mail/health: verificação do Worker
- POST /_mail/subscribe: exige segredo interno e inscrição confirmada no Render
- GET /_mail/confirm?token=...: confirmação do destinatário
- GET ou POST /_mail/unsubscribe?token=...: descadastro
- GET /api/reminders/config: recurso disponível no Render
- POST /api/reminders/subscribe: busca pedido pago antes de emitir confirmação
- GET /api/internal/email-orders?page=1: protegido por segredo; nunca público

## Publicação
A branch GitHub é main. O Render não usa autodeploy, então alterações exigem implantação manual. Alterações futuras no arquivo cloudflare/mnc-mailer-worker.js precisam ser enviadas também ao Worker na Cloudflare. Nunca envie tokens à conversa pública, suporte ou repositório.
