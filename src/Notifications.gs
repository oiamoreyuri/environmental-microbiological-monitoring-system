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
 * @returns {string[]}         Array de endereços de e-mail
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
 * Falha no envio não interrompe o fluxo principal.
 * @param  {string[]} to       Array de endereços
 * @param  {string}   subject  Assunto
 * @param  {string}   body     Corpo em HTML
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
 * Retorna o cabeçalho HTML padrão dos e-mails do sistema.
 * @param  {string} title  Título do e-mail
 * @param  {string} color  Cor da barra de status (#hex)
 * @returns {string}
 */
function _emailHeader(title, color) {
  return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">' +
    '<div style="background:' + color + ';padding:16px 20px">' +
    '<h2 style="color:#fff;margin:0;font-size:16px">' + title + '</h2>' +
    '</div>' +
    '<div style="padding:20px;background:#f9f9f9">';
}


/**
 * Retorna o rodapé HTML padrão dos e-mails do sistema.
 * @returns {string}
 */
function _emailFooter() {
  return '</div>' +
    '<div style="padding:12px 20px;background:#eeeeee;font-size:11px;color:#888">' +
    'Environmental Monitoring System &nbsp;|&nbsp; Automated notification &nbsp;|&nbsp; Do not reply' +
    '</div></div>';
}


/**
 * Envia notificação de resultado não conforme com instrução de recoleta.
 * @param  {Object} payload
 * {
 *   pointFullName:   string,
 *   sector:          string,
 *   assay:           string,
 *   result:          number,
 *   limit:           number,
 *   percentage:      number,
 *   collectionDate:  string,
 *   actionId:        string,
 *   deadline:        string,
 *   recentNcCount:   number,
 *   recipientLevels: string[]
 * }
 * @returns {void}
 */
function sendNonConformingAlert(payload) {
  var to      = _resolveEmails(payload.recipientLevels);
  var isCAPA  = payload.recentNcCount >= 3;
  var color   = isCAPA ? '#b71c1c' : '#e65100';
  var tag     = isCAPA ? '[CAPA REQUIRED]' : '[NON-CONFORMING]';
  var subject = tag + ' ' + payload.sector + ' — ' + payload.pointFullName + ' (' + payload.assay + ')';

  var body = _emailHeader(tag + ' Environmental Monitoring Alert', color) +
    '<p><strong>Point:</strong> ' + payload.pointFullName + '</p>' +
    '<p><strong>Sector:</strong> ' + payload.sector + '</p>' +
    '<p><strong>Assay:</strong> ' + payload.assay + '</p>' +
    '<p><strong>Collection date:</strong> ' + payload.collectionDate + '</p>' +
    '<hr>' +
    '<p><strong>Result:</strong> <span style="color:' + color + ';font-size:18px">' +
    payload.result + ' CFU/mL</span></p>' +
    '<p><strong>Limit:</strong> ' + payload.limit + ' CFU/mL</p>' +
    '<p><strong>% of limit:</strong> ' + payload.percentage + '%</p>' +
    '<p><strong>NCs in last 6 months (this point):</strong> ' + payload.recentNcCount + '</p>' +
    '<hr>' +
    (isCAPA
      ? '<p style="color:#b71c1c"><strong>ACTION REQUIRED: Open CAPA — ' + payload.actionId + '</strong><br>' +
        'Deadline: ' + payload.deadline + '</p>'
      : '<p><strong>Action: Resample required — ' + payload.actionId + '</strong><br>' +
        'Deadline: ' + payload.deadline + '</p>'
    ) +
    _emailFooter();

  _sendEmail(to, subject, body);
}


/**
 * Envia notificação de tendência crescente detectada.
 * @param  {Object} payload
 * {
 *   pointFullName:   string,
 *   sector:          string,
 *   assay:           string,
 *   resultHistory:   number[],
 *   recipientLevels: string[]
 * }
 * @returns {void}
 */
function sendTrendAlert(payload) {
  var to      = _resolveEmails(payload.recipientLevels);
  var subject = '[TREND ALERT] ' + payload.sector + ' — ' + payload.pointFullName + ' (' + payload.assay + ')';

  var historyText = payload.resultHistory.join(' → ');

  var body = _emailHeader('[TREND ALERT] Upward Trend Detected', '#f9a825') +
    '<p><strong>Point:</strong> ' + payload.pointFullName + '</p>' +
    '<p><strong>Sector:</strong> ' + payload.sector + '</p>' +
    '<p><strong>Assay:</strong> ' + payload.assay + '</p>' +
    '<hr>' +
    '<p><strong>Last results (CFU/mL):</strong> ' + historyText + '</p>' +
    '<p>Three consecutive increasing results detected. ' +
    'Results are still within limit but the upward trend requires attention.</p>' +
    '<p><strong>Recommended action:</strong> Review sanitation protocol for this point.</p>' +
    _emailFooter();

  _sendEmail(to, subject, body);
}


/**
 * Envia notificação de coletas atrasadas.
 * Chamada pelo trigger diário quando há coletas com prazo vencido.
 * @param  {Object[]} overdueList  Retorno de Schedule.getOverdueCollections()
 * @param  {string[]} levels       Níveis de destinatários
 * @returns {void}
 */
function sendOverdueCollectionsAlert(overdueList, levels) {
  if (!overdueList || overdueList.length === 0) return;

  var to      = _resolveEmails(levels);
  var subject = '[OVERDUE] ' + overdueList.length + ' overdue collection(s) — Environmental Monitoring';

  var rows = overdueList.map(function(item) {
    return '<tr>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee">' + item.sector + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee">' + item.fullName + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee">' + item.plannedDate + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee;color:#c62828">' + item.delayDays + ' days</td>' +
      '</tr>';
  }).join('');

  var body = _emailHeader('[OVERDUE] Collections Past Scheduled Date', '#c62828') +
    '<p>' + overdueList.length + ' collection(s) have not been performed on schedule.</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
    '<thead><tr style="background:#eee">' +
    '<th style="padding:8px 10px;text-align:left">Sector</th>' +
    '<th style="padding:8px 10px;text-align:left">Point</th>' +
    '<th style="padding:8px 10px;text-align:left">Planned date</th>' +
    '<th style="padding:8px 10px;text-align:left">Delay</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    _emailFooter();

  _sendEmail(to, subject, body);
}


/**
 * Envia notificação de ações com prazo vencido.
 * Chamada pelo trigger diário.
 * @param  {Object[]} overdueList  Retorno de Actions.getOverdueActions()
 * @param  {string[]} levels       Níveis de destinatários
 * @returns {void}
 */
function sendOverdueActionsAlert(overdueList, levels) {
  if (!overdueList || overdueList.length === 0) return;

  var to      = _resolveEmails(levels);
  var subject = '[OVERDUE] ' + overdueList.length + ' overdue action(s) — Environmental Monitoring';

  var rows = overdueList.map(function(item) {
    return '<tr>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee">' + item.actionId + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee">' + item.actionType + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee">' + item.originResultId + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee">' + item.deadline + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee">' + item.responsible + '</td>' +
      '</tr>';
  }).join('');

  var body = _emailHeader('[OVERDUE] Actions Past Deadline', '#c62828') +
    '<p>' + overdueList.length + ' action(s) have not been completed by their deadline.</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
    '<thead><tr style="background:#eee">' +
    '<th style="padding:8px 10px;text-align:left">Action ID</th>' +
    '<th style="padding:8px 10px;text-align:left">Type</th>' +
    '<th style="padding:8px 10px;text-align:left">Origin result</th>' +
    '<th style="padding:8px 10px;text-align:left">Deadline</th>' +
    '<th style="padding:8px 10px;text-align:left">Responsible</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    _emailFooter();

  _sendEmail(to, subject, body);
}


/**
 * Envia alerta anual para atualização da aba HOLIDAYS.
 * Chamada pelo trigger diário entre 1 de janeiro e a data em que
 * a aba HOLIDAYS for preenchida com registros do ano corrente.
 * @param  {number}   year    Ano atual
 * @param  {string[]} levels  Níveis de destinatários
 * @returns {void}
 */
function sendHolidayUpdateReminder(year, levels) {
  var to      = _resolveEmails(levels);
  var subject = '[ACTION REQUIRED] Update HOLIDAYS tab for ' + year;

  var body = _emailHeader('[ACTION REQUIRED] Holiday Calendar Not Updated', '#e65100') +
    '<p>The <strong>HOLIDAYS</strong> tab in the Environmental Monitoring spreadsheet ' +
    'does not contain entries for <strong>' + year + '</strong>.</p>' +
    '<p>The system uses this tab to calculate resample and CAPA deadlines correctly, ' +
    'skipping non-working days.</p>' +
    '<p><strong>Action required:</strong> Open the HOLIDAYS tab and add all ' +
    'public holidays and company-observed non-working days for ' + year + '.</p>' +
    '<p>This reminder will stop automatically once the tab is updated.</p>' +
    _emailFooter();

  _sendEmail(to, subject, body);
}


/**
 * Envia relatório mensal em PDF por e-mail.
 * @param  {string}   month       Ex: 'April 2025'
 * @param  {string}   pdfFileUrl  URL do arquivo no Drive
 * @param  {string[]} levels      Níveis de destinatários
 * @returns {void}
 */
function sendMonthlyReport(month, pdfFileUrl, levels) {
  var to      = _resolveEmails(levels);
  var subject = '[MONTHLY REPORT] Environmental Monitoring — ' + month;

  var body = _emailHeader('Monthly Environmental Monitoring Report — ' + month, '#2e7d32') +
    '<p>The monthly environmental monitoring report for <strong>' + month + '</strong> ' +
    'has been generated and is available at the link below.</p>' +
    '<p><a href="' + pdfFileUrl + '" style="color:#2e7d32">Download report (PDF)</a></p>' +
    _emailFooter();

  _sendEmail(to, subject, body);
}