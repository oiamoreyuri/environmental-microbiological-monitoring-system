// =============================================================================
// Notifications.gs
// Composição e envio de e-mails de alerta.
// Módulo puro — recebe dados prontos, não acessa Sheets diretamente.
// Dependências: Config.gs, Utils.gs
// Usada por: Results.gs, Code.gs (triggers diário e mensal)
// =============================================================================


/**
 * Resolve os endereços de e-mail a partir dos níveis de destinatários.
 * @param  {string[]} levels  Ex: ['primary', 'production']
 * @returns {string[]}
 */
function _resolveEmails(levels) {
  var recipients = getEmailRecipients();
  return levels.map(function(level) {
    return recipients[level];
  }).filter(function(email) {
    return !isEmpty(email);
  });
}


/**
 * Envia um e-mail com tratamento de erro silencioso.
 * @param  {string[]} to
 * @param  {string}   subject
 * @param  {string}   body
 * @returns {void}
 */
function _sendEmail(to, subject, body) {
  if (!to || to.length === 0) {
    logError('Notifications', '_sendEmail', new Error('Nenhum destinatário definido para: ' + subject));
    return;
  }
  try {
    MailApp.sendEmail({
      to:       to.join(','),
      subject:  subject,
      htmlBody: body
    });
  } catch (e) {
    logError('Notifications', '_sendEmail', e);
  }
}


/**
 * Cabeçalho HTML padrão dos e-mails.
 */
function _emailHeader(titulo, cor) {
  return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">' +
    '<div style="background:' + cor + ';padding:16px 20px">' +
    '<h2 style="color:#fff;margin:0;font-size:16px">' + titulo + '</h2>' +
    '</div>' +
    '<div style="padding:20px;background:#f9f9f9">';
}


/**
 * Rodapé HTML padrão dos e-mails.
 */
function _emailFooter() {
  return '</div>' +
    '<div style="padding:12px 20px;background:#eeeeee;font-size:11px;color:#888">' +
    'Sistema de Monitoramento Ambiental &nbsp;|&nbsp; Mensagem automática &nbsp;|&nbsp; Não responda este e-mail' +
    '</div></div>';
}


/**
 * Envia notificação de resultado não conforme com instrução de recoleta.
 * @param  {Object} payload
 */
function sendNonConformingAlert(payload) {
  var to      = _resolveEmails(payload.recipientLevels);
  var isCAPA  = payload.recentNcCount >= 3;
  var cor     = isCAPA ? '#b71c1c' : '#e65100';
  var tag     = isCAPA ? '[CAPA OBRIGATÓRIA]' : '[NÃO CONFORME]';
  var subject = tag + ' ' + payload.sector + ' — ' + payload.pointFullName + ' (' + payload.assay + ')';

  var body = _emailHeader(tag + ' Alerta de Monitoramento Ambiental', cor) +
    '<p><strong>Ponto de coleta:</strong> ' + payload.pointFullName + '</p>' +
    '<p><strong>Setor:</strong> ' + payload.sector + '</p>' +
    '<p><strong>Ensaio:</strong> ' + payload.assay + '</p>' +
    '<p><strong>Data da coleta:</strong> ' + payload.collectionDate + '</p>' +
    '<hr>' +
    '<p><strong>Resultado:</strong> <span style="color:' + cor + ';font-size:18px">' +
    payload.result + ' UFC/mL</span></p>' +
    '<p><strong>Limite:</strong> ' + payload.limit + ' UFC/mL</p>' +
    '<p><strong>Percentual do limite:</strong> ' + payload.percentage + '%</p>' +
    '<p><strong>NCs nos últimos 6 meses (este ponto):</strong> ' + payload.recentNcCount + '</p>' +
    '<hr>' +
    (isCAPA
      ? '<p style="color:#b71c1c"><strong>AÇÃO NECESSÁRIA: Abrir CAPA — ' + payload.actionId + '</strong><br>' +
        'Prazo: ' + payload.deadline + '</p>' +
        '<p>Este ponto apresenta ' + payload.recentNcCount + ' resultados não conformes nos últimos 6 meses. ' +
        'É necessária investigação de causa raiz e implementação de ação corretiva e preventiva.</p>'
      : '<p><strong>Ação necessária: Recoleta — ' + payload.actionId + '</strong><br>' +
        'Prazo: ' + payload.deadline + '</p>' +
        '<p>Realize nova coleta no ponto indicado para confirmar ou descartar a contaminação.</p>'
    ) +
    _emailFooter();

  _sendEmail(to, subject, body);
}


/**
 * Envia notificação de tendência crescente detectada.
 * @param  {Object} payload
 */
function sendTrendAlert(payload) {
  var to      = _resolveEmails(payload.recipientLevels);
  var subject = '[TENDÊNCIA CRESCENTE] ' + payload.sector + ' — ' + payload.pointFullName + ' (' + payload.assay + ')';
  var historico = payload.resultHistory.join(' → ');

  var body = _emailHeader('[ATENÇÃO] Tendência Crescente Identificada', '#f9a825') +
    '<p><strong>Ponto de coleta:</strong> ' + payload.pointFullName + '</p>' +
    '<p><strong>Setor:</strong> ' + payload.sector + '</p>' +
    '<p><strong>Ensaio:</strong> ' + payload.assay + '</p>' +
    '<hr>' +
    '<p><strong>Últimos resultados (UFC/mL):</strong> ' + historico + '</p>' +
    '<p>Foram identificados três resultados consecutivos crescentes neste ponto. ' +
    'Os valores ainda estão dentro do limite, mas a tendência requer atenção.</p>' +
    '<p><strong>Ação recomendada:</strong> Revisar o protocolo de higienização deste ponto.</p>' +
    _emailFooter();

  _sendEmail(to, subject, body);
}


/**
 * Envia notificação de coletas atrasadas.
 * @param  {Object[]} overdueList
 * @param  {string[]} levels
 */
function sendOverdueCollectionsAlert(overdueList, levels) {
  if (!overdueList || overdueList.length === 0) return;

  var to      = _resolveEmails(levels);
  var subject = '[COLETA ATRASADA] ' + overdueList.length + ' coleta(s) em atraso — Monitoramento Ambiental';

  var linhas = overdueList.map(function(item) {
    return '<tr>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee">' + item.sector + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee">' + item.fullName + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee">' + item.plannedDate + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee;color:#c62828">' + item.delayDays + ' dias</td>' +
      '</tr>';
  }).join('');

  var body = _emailHeader('[ATENÇÃO] Coletas em Atraso', '#c62828') +
    '<p>' + overdueList.length + ' coleta(s) não foram realizadas na data prevista.</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
    '<thead><tr style="background:#eee">' +
    '<th style="padding:8px 10px;text-align:left">Setor</th>' +
    '<th style="padding:8px 10px;text-align:left">Ponto</th>' +
    '<th style="padding:8px 10px;text-align:left">Data prevista</th>' +
    '<th style="padding:8px 10px;text-align:left">Atraso</th>' +
    '</tr></thead><tbody>' + linhas + '</tbody></table>' +
    _emailFooter();

  _sendEmail(to, subject, body);
}


/**
 * Envia notificação de ações com prazo vencido.
 * @param  {Object[]} overdueList
 * @param  {string[]} levels
 */
function sendOverdueActionsAlert(overdueList, levels) {
  if (!overdueList || overdueList.length === 0) return;

  var to      = _resolveEmails(levels);
  var subject = '[AÇÃO VENCIDA] ' + overdueList.length + ' ação(ões) com prazo vencido — Monitoramento Ambiental';

  var linhas = overdueList.map(function(item) {
    var tipo = item.actionType === 'Resample' ? 'Recoleta' :
               item.actionType === 'CAPA'     ? 'CAPA'     : 'Observação';
    return '<tr>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee">' + item.actionId + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee">' + tipo + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee">' + item.originResultId + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee">' + item.deadline + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee">' + item.responsible + '</td>' +
      '</tr>';
  }).join('');

  var body = _emailHeader('[ATENÇÃO] Ações com Prazo Vencido', '#c62828') +
    '<p>' + overdueList.length + ' ação(ões) não foram concluídas dentro do prazo.</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
    '<thead><tr style="background:#eee">' +
    '<th style="padding:8px 10px;text-align:left">ID da Ação</th>' +
    '<th style="padding:8px 10px;text-align:left">Tipo</th>' +
    '<th style="padding:8px 10px;text-align:left">Resultado de origem</th>' +
    '<th style="padding:8px 10px;text-align:left">Prazo</th>' +
    '<th style="padding:8px 10px;text-align:left">Responsável</th>' +
    '</tr></thead><tbody>' + linhas + '</tbody></table>' +
    _emailFooter();

  _sendEmail(to, subject, body);
}


/**
 * Envia lembrete anual para atualização da aba HOLIDAYS.
 * @param  {number}   year
 * @param  {string[]} levels
 */
function sendHolidayUpdateReminder(year, levels) {
  var to      = _resolveEmails(levels);
  var subject = '[AÇÃO NECESSÁRIA] Atualizar feriados de ' + year + ' — Monitoramento Ambiental';

  var body = _emailHeader('[AÇÃO NECESSÁRIA] Calendário de Feriados Desatualizado', '#e65100') +
    '<p>A aba <strong>HOLIDAYS</strong> da planilha de Monitoramento Ambiental ' +
    'não possui registros para o ano <strong>' + year + '</strong>.</p>' +
    '<p>O sistema utiliza esta aba para calcular corretamente os prazos de recoleta e CAPA, ' +
    'desconsiderando fins de semana e feriados.</p>' +
    '<p><strong>Ação necessária:</strong> Acesse a aba HOLIDAYS e adicione os feriados ' +
    'e pontes praticados pela empresa em ' + year + '.</p>' +
    '<p>Este lembrete será enviado diariamente até que a aba seja atualizada.</p>' +
    _emailFooter();

  _sendEmail(to, subject, body);
}


/**
 * Envia relatório mensal em PDF por e-mail.
 * @param  {string}   month
 * @param  {string}   pdfFileUrl
 * @param  {string[]} levels
 */
function sendMonthlyReport(month, pdfFileUrl, levels) {
  var to      = _resolveEmails(levels);
  var subject = '[RELATÓRIO MENSAL] Monitoramento Ambiental — ' + month;

  var body = _emailHeader('Relatório Mensal de Monitoramento Ambiental — ' + month, '#2e7d32') +
    '<p>O relatório mensal de monitoramento ambiental referente a <strong>' + month + '</strong> ' +
    'foi gerado automaticamente e está disponível no link abaixo.</p>' +
    '<p><a href="' + pdfFileUrl + '" style="color:#2e7d32">Baixar relatório (PDF)</a></p>' +
    _emailFooter();

  _sendEmail(to, subject, body);
}