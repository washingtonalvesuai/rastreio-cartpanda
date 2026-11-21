# My Natural Care — automação de avisos por e-mail

## Regras atuais (versão 4 — identidade NervLief em todos os e-mails)
- Remetente: support@mynaturalcare.app, domínio autenticado pelo Resend.
- Marca do produto: **NervLief — Advanced Nerve Support**. Todo e-mail HTML de produção possui bloco com **imagem dos frascos + nome NervLief**, em layout compartilhado, além de **NervLief no assunto, corpo HTML e texto simples**.
- A imagem atual usa o arquivo de produto enviado pelo proprietário e hospedado em uma URL de mídia HTTPS. Se a URL mudar, atualizar `PRODUCT_IMAGE` no código e republicar o Worker; alguns clientes de e-mail podem bloquear imagens, por isso o nome do produto permanece em texto.
- **E-mails anteriores não podem ser modificados retroativamente** e não devem ser reenviados em massa somente por ajustes visuais.
- **Novo: agradecimento de compra confirmada (D+0).** Enviado automaticamente a cada pedido pago elegível desde a implantação, no máximo uma vez por ID de pedido. Mensagem em inglês, com botão de acesso ao aplicativo. A checagem rápida ocorre a cada minuto na primeira página de pedidos recentes; a checagem completa a cada 30 minutos serve de contingência. O envio não é necessariamente instantâneo ao segundo.
- **Três e-mails de cuidados são agendados automaticamente após a compra paga**, sem ação de cadastro dentro do aplicativo:
  1. **D+3** — `NervLief Care Guide: Start with one small step`.
  2. **D+6** — `NervLief Care Guide: Gentle movement for your day`.
  3. **D+9** — `NervLief Care Guide: Every small habit counts`.
- O programa é de **três e-mails no total por endereço**; não repete indefinidamente.
- Cada mensagem inclui link de descadastro; uma pessoa que cancelou não será reinscrita automaticamente se comprar novamente.
- Compradores com pedidos a partir de 2026-11-21T20:14:00Z entram na campanha; houve **exceção explícita para pedidos reais #4 a #11 feitos em 20 e 21 de novembro de 2026**. Os pedidos #1, #2 e #3 são testes e permanecem excluídos.
- O aviso de envio, com assunto **Your NervLief order is on its way**, continua separado e é disparado uma única vez após observar a transição real de preparing para shipped ou partially_shipped. Pedidos já enviados no primeiro escaneamento não recebem alerta retroativo.
- Não são incluídos dados de saúde pessoais nos e-mails.


## Modelo de verificação de endereço (Resend)
- Alias publicado: `nervlief-contact-verification` — **My Natural Care — Please confirm your NervLief email**.
- O template inclui a imagem e o nome NervLief, usando identidade visual próxima aos e-mails de produção.
- É um modelo **avulso**, disponível no Resend para futuras verificações. **Não é disparado automaticamente pelo Worker**; um contato sugerido não deve ser presumido como titular da compra.
- Não menciona número do pedido, produtos comprados, valores ou outras informações privadas até a verificação do destinatário.
- Os e-mails de verificação enviados antes deste modelo continuarão com aparência anterior.

## Infraestrutura
- Render: servidor rastreio-cartpanda; consulta interna da Cartpanda e API de status do mailer.
- Cloudflare: Worker mnc-mailer, rota mynaturalcare.app/_mail/* e agendamentos * * * * * (verificação rápida) e */30 * * * * (completa).
- D1: mnc-customer-email-events; tabelas orders, subscriptions, dispatches e job_runs.
- Resend: chave Sending Access restrita ao domínio, não incluir chave no GitHub.

## Segredos que precisam existir
No Worker Cloudflare mnc-mailer > Settings > Variables and Secrets:
- RESEND_API_KEY (Secret)
- INTERNAL_TOKEN (Secret)

No Render rastreio-cartpanda > Environment:
- MNC_MAIL_INTERNAL_TOKEN (mesmo valor do INTERNAL_TOKEN do Worker)

O Worker também usa CAMPAIGN_START, RENDER_ORIGIN e DB, configurados no deploy.

## Webhook opcional para envio quase imediato
- O Worker tem um endpoint protegido `POST https://mynaturalcare.app/_mail/cartpanda-paid?key=<token>`, para receber o evento `order.paid` da Cartpanda.
- **A conexão direta ainda não está ativa:** é preciso configurar `WEBHOOK_TOKEN` como Secret do Worker e cadastrar o webhook de **Pedido pago** no painel Cartpanda em **Admin → Notificações → Configurar Webhooks**. A plataforma envia um JSON contendo `event: "order.paid"` e `order.id`.
- O webhook não confia em dados externos para determinar pagamento: verifica o pedido na API interna autenticada do Render antes de disparar. Resend e D1 impedem repetição por ID de pedido.
- Até configurar o webhook, a verificação a cada minuto funciona automaticamente para pedidos mais recentes, mantendo a verificação completa de contingência.
- Nunca expor nem publicar o valor do `WEBHOOK_TOKEN` no GitHub; não publicar esse endpoint com um token real em documentação pública.
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
