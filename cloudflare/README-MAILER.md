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


## Recuperação de checkout abandonado — preparado, NÃO ATIVO

**Status:** Os três modelos foram criados e publicados no Resend; a estrutura de recepção do webhook, banco e cron foi implantada na Cloudflare com o envio em modo desativado até a conexão e as exigências abaixo.

- **Fluxo proposto:** 1h, 12h e 24h após o abandono. Assuntos:
  1. `Your NervLief checkout is ready when you are`
  2. `Still thinking about NervLief?`
  3. `A final reminder about your NervLief checkout`
- Os três e-mails usam imagem e nome NervLief, link individual do checkout (NUNCA usar o link genérico do app no botão de concluir compra), link de descadastro, suporte e endereço postal empresarial válido.
- Templates publicados no Resend: `nervlief-cart-recovery-1`, `nervlief-cart-recovery-2`, `nervlief-cart-recovery-3`. **Os templates são referência visual no Resend; o Worker possui textos equivalentes e usa o `layout()` existente para os disparos. Alterar um template no Resend não modifica automaticamente o Worker.**
- O evento da Cartpanda é `Carrinho abandonado`. Cadastrar em **Admin → Notificações → Configurar Webhooks** a URL HTTPS informada diretamente ao proprietário; não incluir a chave do webhook neste repositório.
- Route da Cloudflare: `POST /_mail/abandoned-cart?key=<RECOVERY_WEBHOOK_KEY>`, autorizada com a Secret `RECOVERY_WEBHOOK_KEY` já configurada. Um payload válido deve conter e-mail do cliente e **link individual de recuperação**; o esquema do evento real precisa ser conferido com teste antes da ativação. URL fora dos domínios permitidos é rejeitada.
- Para colocar em funcionamento, é NECESSÁRIO: (1) confirmar que a recuperação nativa da Cartpanda está desativada, para não duplicar e-mails; (2) fornecer endereço postal empresarial para preencher `RECOVERY_MAILING_ADDRESS`; (3) cadastrar e testar o webhook; (4) configurar a variável `RECOVERY_ENABLED=true` e implantar. **Sem essa variável, nenhum e-mail é enviado**, embora eventos válidos possam ser recebidos e guardados.
- Cada disparo verifica a API interna da Render para identificar compras pagas feitas desde o abandono (com tolerância) e suspende a sequência. Na falha da verificação, não envia. O Resend recebe chave de idempotência única por checkout e passo. A cada 30 minutos, o agendamento existente verifica vencimentos.
- Descadastro: `/_mail/recovery-unsubscribe`, vinculado a um token irreversível; bloqueio do endereço permanece mesmo com novo evento de carrinho.
- O banco de dados D1 foi ampliado somente com tabelas independentes: `recovery_carts`, `recovery_dispatches`, `recovery_optouts`. Os fluxos de compra, envio e e-mails educativos existentes não foram alterados.
- **Não há disparos retroativos a carrinhos antigos**, pois a API de checkouts abandonados da Cartpanda não foi validada como fonte de importação. Sem um webhook configurado, a contagem de eventos é zero.
- Para negócios voltados aos EUA, o endereço postal é necessário nos e-mails comerciais; seguir também requisitos locais de consentimento e descadastro.
