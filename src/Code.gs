// =============================================================================
// Code.gs
// Entry point do sistema. Triggers e roteamento.
// Zero lógica de negócio — apenas orquestra chamadas aos módulos.
// Dependências: todos os módulos.
// =============================================================================


// =============================================================================
// TRIGGERS DE FORMULÁRIO
// =============================================================================

/**
 * Trigger automático — chamado pelo Google Forms ao receber resposta.
 * Extrai os dados do evento e delega para Results.processFormSubmission().
 * O mapeamento dos campos depende da ordem das perguntas no Forms.
 * Atualizar _extractFormData() se a ordem das perguntas mudar.
 * @param  {Object} e  Evento do Forms (e.values = array de respostas)
 * @returns {void}
 */
function onFormSubmit(e) {
  try {
    var formData = _extractFormData(e);
    processFormSubmission(formData);
  } catch (err) {
    logError('Code', 'onFormSubmit', err);
    writeErrorLog('Code', 'onFormSubmit', err.message);
  }
}


/**
 * Extrai e normaliza os dados do evento do Forms.
 * Ordem das colunas (e.values):
 *   0 — Timestamp (gerado automaticamente pelo Forms)
 *   1 — Setor (nome em português, ex: 'SD 1')
 *   2 — Ponto de Coleta (nome completo em português, ex: 'Câmara de Secagem')
 *   3 — Data da Coleta (DD/MM/YYYY)
 *   4 — Ensaio (MA / BL / SAL)
 *   5 — Resultado
 *   6 — Analista Responsável
 *   7 — Observações (opcional)
 * @param  {Object} e  Evento do Forms
 * @returns {Object}   formData normalizado
 */
function _extractFormData(e) {
  var values = e.values;

  if (!values || values.length < 7) {
    throw new Error('_extractFormData: evento do Forms com dados insuficientes.');
  }

  // Converte data do formato DD/MM/YYYY para objeto Date
  var rawDate   = String(values[3]).trim();
  var dateParts = rawDate.split('/');
  var collectionDate = (dateParts.length === 3)
    ? new Date(dateParts[2], dateParts[1] - 1, dateParts[0])
    : new Date(rawDate);

  // Resolve o POINT_ID a partir do setor e nome do ponto
  var sector    = String(values[1]).trim();
  var pointName = String(values[2]).trim();
  var pointId   = _resolvePointId(sector, pointName);

  if (!pointId) {
    throw new Error(
      '_extractFormData: ponto "' + pointName + '" não encontrado no setor "' + sector + '".'
    );
  }

  return {
    pointId:        pointId,
    collectionDate: collectionDate,
    assay:          String(values[4]).trim().toUpperCase(),
    result:         Number(values[5]),
    analyst:        String(values[6]).trim(),
    notes:          values[7] ? String(values[7]).trim() : ''
  };
}


/**
 * Resolve o POINT_ID a partir do setor e nome completo do ponto.
 * Busca na aba SAMPLING_POINTS por correspondência exata de setor e nome.
 * @param  {string} sector     Nome do setor em português (ex: 'SD 1')
 * @param  {string} pointName  Nome completo do ponto (ex: 'Câmara de Secagem')
 * @returns {string|null}      POINT_ID ou null se não encontrado
 */
function _resolvePointId(sector, pointName) {
  try {
    var points = getActivePoints();

    // Busca por correspondência exata de setor e nome
    var found = points.filter(function(p) {
      return p.sector.trim() === sector && p.fullName.trim() === pointName;
    });

    if (found.length > 0) return found[0].pointId;

    // Fallback: busca só pelo nome (caso setor venha ligeiramente diferente)
    found = points.filter(function(p) {
      return p.fullName.trim() === pointName;
    });

    return found.length > 0 ? found[0].pointId : null;

  } catch (e) {
    logError('Code', '_resolvePointId', e);
    return null;
  }
}

// =============================================================================
// TRIGGERS TEMPORAIS
// =============================================================================

/**
 * Trigger diário — executa verificações de rotina.
 * Configurado via installTriggers() para rodar todo dia às 08:00.
 * Verifica: coletas atrasadas, ações vencidas, lembrete de feriados.
 * @returns {void}
 */
function dailyCheck() {
  try {
    var params = getAllParams();

    // ---- Coletas atrasadas ----
    var overdueCollections = getOverdueCollections();
    if (overdueCollections.length > 0) {
      sendOverdueCollectionsAlert(overdueCollections, ['primary']);
    }

    // ---- Ações vencidas ----
    var overdueActions = getOverdueActions();
    if (overdueActions.length > 0) {
      sendOverdueActionsAlert(overdueActions, ['primary', 'production']);
    }

    // ---- Lembrete de feriados (1º jan até aba HOLIDAYS atualizada) ----
    _checkHolidayReminder(params);

    writeLog({
      event:           'Daily check completed',
      referenceId:     formatDate(new Date()),
      generatedStatus: overdueCollections.length + ' overdue collections, ' +
                       overdueActions.length + ' overdue actions',
      triggeredAction: 'Alerts sent if applicable',
      user:            'system'
    });

  } catch (e) {
    logError('Code', 'dailyCheck', e);
    writeErrorLog('Code', 'dailyCheck', e.message);
  }
}


/**
 * Verifica se a aba HOLIDAYS está atualizada para o ano corrente.
 * Envia lembrete diário se não estiver.
 * Para quando encontrar pelo menos um feriado do ano atual.
 * @param  {Object} params  Retorno de getAllParams()
 * @returns {void}
 */
function _checkHolidayReminder(params) {
  try {
    var year  = new Date().getFullYear();
    var sheet = getSheet(SHEET_NAMES.HOLIDAYS);
    var data  = sheet.getDataRange().getValues();
    var hasCurrentYear = false;

    for (var i = 1; i < data.length; i++) {
      var cell = data[i][0];
      if (cell instanceof Date && cell.getFullYear() === year) {
        hasCurrentYear = true;
        break;
      }
    }

    if (!hasCurrentYear) {
      sendHolidayUpdateReminder(year, ['primary']);
    }

  } catch (e) {
    // Lembrete de feriado não pode derrubar o dailyCheck
    logError('Code', '_checkHolidayReminder', e);
  }
}


/**
 * Trigger mensal — gera o relatório PDF do mês anterior e envia por e-mail.
 * Configurado via installTriggers() para rodar no 1º dia de cada mês às 07:00.
 * @returns {void}
 */
function monthlyReport() {
  try {
    // Relatório do mês anterior
    var now       = new Date();
    var lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var month     = lastMonth.getMonth() + 1;
    var year      = lastMonth.getFullYear();

    var pdfUrl = generateMonthlyReport(month, year);

    var monthNames = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];
    var monthLabel = monthNames[month - 1] + ' ' + year;

    sendMonthlyReport(monthLabel, pdfUrl, ['primary', 'manager1']);

    writeLog({
      event:           'Monthly report sent',
      referenceId:     monthLabel,
      generatedStatus: 'PDF generated and emailed',
      triggeredAction: pdfUrl,
      user:            'system'
    });

  } catch (e) {
    logError('Code', 'monthlyReport', e);
    writeErrorLog('Code', 'monthlyReport', e.message);
  }
}


/**
 * Trigger anual — gera o cronograma do novo ano.
 * Configurado via installTriggers() para rodar em 1º de janeiro às 06:00.
 * @returns {void}
 */
function generateNewYearSchedule() {
  try {
    var year  = new Date().getFullYear();
    var count = generateAnnualSchedule(year);

    writeLog({
      event:           'Annual schedule generated',
      referenceId:     String(year),
      generatedStatus: count + ' collections planned',
      triggeredAction: 'Schedule ready for ' + year,
      user:            'system'
    });

  } catch (e) {
    logError('Code', 'generateNewYearSchedule', e);
    writeErrorLog('Code', 'generateNewYearSchedule', e.message);
  }
}


// =============================================================================
// SETUP — executar uma única vez durante a instalação do sistema
// =============================================================================

/**
 * Instala todos os triggers programaticamente.
 * Executar manualmente UMA ÚNICA VEZ após o primeiro deploy.
 * Verificar triggers instalados em: Apps Script > Triggers (ícone de relógio).
 * @returns {void}
 */
function installTriggers() {
  // Remove triggers existentes para evitar duplicatas
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });

  // Trigger do Forms — dispara a cada submissão
  // ATENÇÃO: substituir pelo ID real do seu Google Forms
  // ScriptApp.newTrigger('onFormSubmit')
  //   .forForm('SEU_FORM_ID_AQUI')
  //   .onFormSubmit()
  //   .create();

  // Trigger diário — 08:00
  ScriptApp.newTrigger('dailyCheck')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  // Trigger mensal — 1º dia do mês às 07:00
  ScriptApp.newTrigger('monthlyReport')
    .timeBased()
    .onMonthDay(1)
    .atHour(7)
    .create();

  // Trigger anual — 1º de janeiro às 06:00
  ScriptApp.newTrigger('generateNewYearSchedule')
    .timeBased()
    .onMonthDay(1)
    .inMonth(ScriptApp.Month.JANUARY)
    .atHour(6)
    .create();

  writeLog({
    event:           'Triggers installed',
    referenceId:     'installTriggers',
    generatedStatus: 'dailyCheck + monthlyReport + generateNewYearSchedule',
    triggeredAction: 'Forms trigger requires manual setup with Form ID',
    user:            'system'
  });
}