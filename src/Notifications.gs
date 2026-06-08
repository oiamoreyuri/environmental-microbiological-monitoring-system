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


// ─── LEMBRETES DE COLETA ─────────────────────────────────────────────────────

/**
 * Despachante principal chamado pelo trigger diário às 7h.
 * Segunda-feira: envia resumo semanal.
 * Demais dias: envia resumo do dia (se houver coletas).
 */
function dispatchCollectionReminders() {
  var today = new Date();
  var dayOfWeek = today.getDay(); // 0=Dom, 1=Seg, 2=Ter... 6=Sab

  if (dayOfWeek === 1) {
    // Segunda-feira: envia semanal
    sendWeeklyCollectionReminder();
  } else {
    // Demais dias: envia diário
    sendDailyCollectionReminder();
  }
}

/**
 * Envia e-mail toda segunda-feira com todos os pontos a coletar na semana.
 * Agrupa os pontos por dia da semana.
 */
function sendWeeklyCollectionReminder() {
  var collections = _getPlannedCollectionsForWeek();
  if (collections.length === 0) return;

  var recipients = _getReminderRecipients();
  if (!recipients) return;

  // Agrupar por data
  var byDate = {};
  collections.forEach(function(c) {
    if (!byDate[c.plannedDate]) byDate[c.plannedDate] = [];
    byDate[c.plannedDate].push(c);
  });

  // Montar tabela HTML agrupada por dia
  var rows = '';
  Object.keys(byDate).sort().forEach(function(date) {
    var points = byDate[date];
    rows += '<tr style="background:#e8f5e9">' +
            '<td colspan="3" style="padding:8px 12px;font-weight:bold;color:#2d6a2f">' +
            date + ' (' + points.length + ' coleta(s))</td></tr>';
    points.forEach(function(p) {
      rows += '<tr>' +
              '<td style="padding:6px 12px">' + p.pointId + '</td>' +
              '<td style="padding:6px 12px">' + p.sector + '</td>' +
              '<td style="padding:6px 12px">' + p.assay + '</td>' +
              '</tr>';
    });
  });

  var html =
    '<div style="font-family:Calibri,sans-serif;font-size:14px">' +
    '<p>Olá,</p>' +
    '<p>Seguem as coletas programadas para esta semana:</p>' +
    '<table border="1" cellspacing="0" cellpadding="0" ' +
    'style="border-collapse:collapse;width:100%;font-size:13px">' +
    '<thead><tr style="background:#2d6a2f;color:#fff">' +
    '<th style="padding:8px 12px">Ponto</th>' +
    '<th style="padding:8px 12px">Setor</th>' +
    '<th style="padding:8px 12px">Ensaio</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '<p style="color:#555;font-size:12px">Monitoramento Ambiental Microbiológico — Docefruta</p>' +
    '</div>';

  MailApp.sendEmail({
    to: recipients,
    subject: '[COLETA] Programação semanal — ' + collections.length + ' coleta(s)',
    htmlBody: html
  });
}

/**
 * Envia e-mail no dia da coleta com os pontos programados para hoje.
 * Não executa às segundas-feiras (coberto pelo semanal).
 */
function sendDailyCollectionReminder() {
  var collections = _getPlannedCollectionsForToday();
  if (collections.length === 0) return;

  var recipients = _getReminderRecipients();
  if (!recipients) return;

  var rows = collections.map(function(p) {
    return '<tr>' +
           '<td style="padding:6px 12px">' + p.pointId + '</td>' +
           '<td style="padding:6px 12px">' + p.sector + '</td>' +
           '<td style="padding:6px 12px">' + p.assay + '</td>' +
           '</tr>';
  }).join('');

  var html =
    '<div style="font-family:Calibri,sans-serif;font-size:14px">' +
    '<p>Olá,</p>' +
    '<p>Hoje há <strong>' + collections.length + ' coleta(s)</strong> programada(s):</p>' +
    '<table border="1" cellspacing="0" cellpadding="0" ' +
    'style="border-collapse:collapse;width:100%;font-size:13px">' +
    '<thead><tr style="background:#2d6a2f;color:#fff">' +
    '<th style="padding:8px 12px">Ponto</th>' +
    '<th style="padding:8px 12px">Setor</th>' +
    '<th style="padding:8px 12px">Ensaio</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '<p style="color:#555;font-size:12px">Monitoramento Ambiental Microbiológico — Docefruta</p>' +
    '</div>';

  MailApp.sendEmail({
    to: recipients,
    subject: '[COLETA] Pontos para hoje — ' + collections.length + ' coleta(s)',
    htmlBody: html
  });
}

// ─── FUNÇÕES AUXILIARES DE LEMBRETES ─────────────────────────────────────────

/**
 * Retorna coletas com status Planned para a semana corrente (seg a dom).
 */
function _getPlannedCollectionsForWeek() {
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calcular segunda e domingo da semana corrente
  var dayOfWeek = today.getDay();
  var monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  var sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return _getPlannedCollectionsInRange(monday, sunday);
}

/**
 * Retorna coletas com status Planned para hoje.
 */
function _getPlannedCollectionsForToday() {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  return _getPlannedCollectionsInRange(today, today);
}

/**
 * Busca no SCHEDULE coletas com status Planned dentro de um intervalo de datas.
 */
function _getPlannedCollectionsInRange(startDate, endDate) {
  var sheet = getSheet(SHEET_NAMES.SCHEDULE);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var status = String(data[i][7]); // coluna Status
    var plannedDate = data[i][4];    // coluna Planned_Date

    if (status !== 'Planned') continue;
    if (!(plannedDate instanceof Date) || isNaN(plannedDate)) continue;

    var planned = new Date(plannedDate);
    planned.setHours(0, 0, 0, 0);

    if (planned >= startDate && planned <= endDate) {
      results.push({
        pointId:     String(data[i][1]), // POINT_ID
        sector:      String(data[i][2]), // Sector
        fullName:    String(data[i][3]), // Full_Name
        assay:       String(data[i][5]), // Assay
        plannedDate: formatDate(planned)
      });
    }
  }
  return results;
}

/**
 * Lê destinatários do CONFIG (chave Reminder_Emails).
 * Retorna string separada por vírgula ou null se não configurado.
 */
function _getReminderRecipients() {
  try {
    var configSheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName('CONFIG');
    if (!configSheet) return null;
    var data = configSheet.getDataRange().getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]) === 'Reminder_Emails') {
        var val = String(data[i][1]).trim();
        return val.length > 0 ? val : null;
      }
    }
  } catch (e) {
    Logger.log('Erro ao ler Reminder_Emails do CONFIG: ' + e.message);
  }
  return null;
}