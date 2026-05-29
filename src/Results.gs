// =============================================================================
// Results.gs
// Recebimento, validação e gravação de resultados.
// Orquestra o fluxo completo: validar → calcular → gravar → agir → notificar.
// Dependências: Config.gs, SamplingPoints.gs, Calculations.gs,
//               Schedule.gs, Actions.gs, Notifications.gs, Log.gs, Utils.gs
// Usada por: Code.gs (trigger onFormSubmit)
// =============================================================================


/**
 * Retorna o próximo número sequencial para geração de ID de resultado.
 * @returns {number}
 */
function _nextResultSequence() {
  var sheet = getSheet(SHEET_NAMES.RESULTS);
  var count = sheet.getLastRow() - 1;
  return count < 0 ? 1 : count + 1;
}


/**
 * Valida os dados recebidos do formulário antes de qualquer processamento.
 * Lança erro descritivo se algum campo obrigatório estiver ausente ou inválido.
 * @param  {Object} formData
 * @returns {void}
 */
function _validateFormData(formData) {
  if (isEmpty(formData.pointId)) {
    throw new Error('Validation: pointId é obrigatório.');
  }
  if (isEmpty(formData.collectionDate)) {
    throw new Error('Validation: collectionDate é obrigatório.');
  }
  if (isEmpty(formData.assay)) {
    throw new Error('Validation: assay é obrigatório.');
  }
  if (formData.result === null || formData.result === undefined || isNaN(Number(formData.result))) {
    throw new Error('Validation: result deve ser um número válido.');
  }
  if (isEmpty(formData.analyst)) {
    throw new Error('Validation: analyst é obrigatório.');
  }

  var validAssays = ['MA', 'BL', 'SAL'];
  if (validAssays.indexOf(formData.assay.toUpperCase()) === -1) {
    throw new Error('Validation: assay inválido. Use: ' + validAssays.join(', '));
  }
}


/**
 * Busca o histórico de resultados de um ponto para um ensaio.
 * Retorna array de objetos com date, result e status em ordem cronológica.
 * Exclui linhas de retificação.
 * @param  {string} pointId
 * @param  {string} assay
 * @param  {number} limit   Máximo de registros a retornar (mais recentes)
 * @returns {Object[]}  [{ date: Date, result: number, status: string }]
 */
function getResultHistory(pointId, assay, limit) {
  if (isEmpty(pointId) || isEmpty(assay)) {
    throw new Error('getResultHistory: pointId e assay são obrigatórios.');
  }

  try {
    var sheet = getSheet(SHEET_NAMES.RESULTS);
    var data  = sheet.getDataRange().getValues();
    var found = [];

    for (var i = 1; i < data.length; i++) {
      // Ignora retificações
      if (data[i][12] === true || String(data[i][12]).toUpperCase() === 'TRUE') continue;

      if (String(data[i][2]) === pointId &&
          String(data[i][5]).toUpperCase() === assay.toUpperCase()) {
        found.push({
          date:   data[i][3] instanceof Date ? data[i][3] : new Date(data[i][3]),
          result: Number(data[i][6]),
          status: String(data[i][10])
        });
      }
    }

    // Ordena por data crescente
    found.sort(function(a, b) { return a.date - b.date; });

    // Retorna os últimos N registros
    return limit ? found.slice(-limit) : found;

  } catch (e) {
    logError('Results', 'getResultHistory', e);
    throw e;
  }
}


/**
 * Grava uma linha de resultado na aba RESULTS.
 * @param  {Object} record  Objeto com todos os campos da aba
 * @returns {string}         ID do resultado gerado
 */
function writeResult(record) {
  try {
    var sheet    = getSheet(SHEET_NAMES.RESULTS);
    var resultId = generateId('RES', _nextResultSequence());

    sheet.appendRow([
      resultId,               // RESULT_ID
      record.collectionId,    // COLLECTION_ID
      record.pointId,         // POINT_ID
      record.timestamp,       // Timestamp
      record.collectionDate,  // Collection_Date
      record.assay,           // Assay
      record.result,          // Result
      record.unit,            // Unit
      record.limit,           // Limit
      record.percentage,      // Limit_Percentage
      record.status,          // Status
      record.analyst,         // Analyst
      false,                  // Correction
      '',                     // Corrected_ID
      record.notes || ''      // Notes
    ]);

    return resultId;

  } catch (e) {
    logError('Results', 'writeResult', e);
    throw e;
  }
}


/**
 * Registra uma retificação de resultado existente.
 * Não edita a linha original — adiciona nova linha com Correction = TRUE.
 * @param  {string} originalResultId
 * @param  {Object} correctedData  { result, notes, analyst }
 * @returns {string}  ID do registro de retificação
 */
function recordCorrection(originalResultId, correctedData) {
  if (isEmpty(originalResultId)) {
    throw new Error('recordCorrection: originalResultId é obrigatório.');
  }

  try {
    // Busca o registro original para copiar os campos base
    var sheet = getSheet(SHEET_NAMES.RESULTS);
    var data  = sheet.getDataRange().getValues();
    var original = null;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === originalResultId) {
        original = data[i];
        break;
      }
    }

    if (!original) {
      throw new Error('recordCorrection: resultado "' + originalResultId + '" não encontrado.');
    }

    // Recalcula status com o valor corrigido
    var params     = getAllParams();
    var newResult  = Number(correctedData.result);
    var limit      = Number(original[8]);
    var assay      = String(original[5]);
    var percentage = calculatePercentage(newResult, limit);
    var newStatus  = calculateStatus(
      assay, newResult, limit,
      params.Alert_Threshold,
      params.Critical_Threshold
    );

    var correctionId = generateId('RES', _nextResultSequence());

    sheet.appendRow([
      correctionId,           // RESULT_ID
      String(original[1]),    // COLLECTION_ID (mesmo da original)
      String(original[2]),    // POINT_ID
      new Date(),             // Timestamp (momento da retificação)
      original[4],            // Collection_Date (mesma da original)
      assay,                  // Assay
      newResult,              // Result (corrigido)
      String(original[7]),    // Unit
      limit,                  // Limit
      percentage,             // Limit_Percentage (recalculado)
      newStatus,              // Status (recalculado)
      correctedData.analyst,  // Analyst
      true,                   // Correction = TRUE
      originalResultId,       // Corrected_ID
      correctedData.notes || ''
    ]);

    writeLog({
      event:           'Result corrected',
      referenceId:     correctionId,
      generatedStatus: newStatus,
      triggeredAction: 'Corrects ' + originalResultId,
      user:            correctedData.analyst || 'system'
    });

    return correctionId;

  } catch (e) {
    logError('Results', 'recordCorrection', e);
    throw e;
  }
}


/**
 * Ponto de entrada principal para registro de resultado via Forms.
 * Orquestra a sequência completa:
 * validar → buscar ponto → calcular → gravar → atualizar cronograma
 * → verificar tendência → verificar reincidência → abrir ação → notificar → logar
 * @param  {Object} formData
 * {
 *   pointId:        string,
 *   collectionDate: string | Date,
 *   assay:          string,
 *   result:         number,
 *   analyst:        string,
 *   notes:          string
 * }
 * @returns {void}
 */
function processFormSubmission(formData) {
  try {

    // ------------------------------------------------------------------
    // 1. Validar campos obrigatórios
    // ------------------------------------------------------------------
    _validateFormData(formData);

    // ------------------------------------------------------------------
    // 2. Normalizar tipos
    // ------------------------------------------------------------------
    var assay          = formData.assay.toUpperCase();
    var result         = Number(formData.result);
    var collectionDate = (formData.collectionDate instanceof Date)
      ? formData.collectionDate
      : new Date(formData.collectionDate);

    // ------------------------------------------------------------------
    // 3. Buscar ponto e limite
    // ------------------------------------------------------------------
    var point = getPoint(formData.pointId);
    if (!point) {
      throw new Error('processFormSubmission: ponto "' + formData.pointId + '" não encontrado ou inativo.');
    }

    var limit = getLimit(formData.pointId, assay);

    // ------------------------------------------------------------------
    // 4. Calcular status e percentual
    // ------------------------------------------------------------------
    var params     = getAllParams();
    var percentage = calculatePercentage(result, limit);
    var status     = calculateStatus(
      assay, result, limit,
      params.Alert_Threshold,
      params.Critical_Threshold
    );

    // ------------------------------------------------------------------
    // 5. Vincular ao cronograma
    // ------------------------------------------------------------------
    var collectionId = findCollectionId(formData.pointId, collectionDate);
    if (!collectionId) {
      // Coleta fora do cronograma — registra com ID provisório e loga aviso
      collectionId = 'UNSCHEDULED-' + formatDate(collectionDate);
      writeLog({
        event:           'Unscheduled collection',
        referenceId:     formData.pointId,
        generatedStatus: 'Warning',
        triggeredAction: 'No schedule entry found for ' + formatDate(collectionDate),
        user:            formData.analyst
      });
    }

    // ------------------------------------------------------------------
    // 6. Gravar resultado
    // ------------------------------------------------------------------
    var resultId = writeResult({
      collectionId:   collectionId,
      pointId:        formData.pointId,
      timestamp:      new Date(),
      collectionDate: collectionDate,
      assay:          assay,
      result:         result,
      unit:           'CFU/mL',
      limit:          limit,
      percentage:     percentage,
      status:         status,
      analyst:        formData.analyst,
      notes:          formData.notes || ''
    });

    // ------------------------------------------------------------------
    // 7. Atualizar cronograma
    // ------------------------------------------------------------------
    if (collectionId.indexOf('UNSCHEDULED') === -1) {
      markAsCollected(collectionId, collectionDate, formData.analyst);
    }

    // ------------------------------------------------------------------
    // 8. Verificar tendência crescente
    // ------------------------------------------------------------------
    var history      = getResultHistory(formData.pointId, assay, params.Trend_Consecutive_N);
    var resultValues = history.map(function(h) { return h.result; });
    var hasTrend     = detectUpwardTrend(resultValues, params.Trend_Consecutive_N);

    // ------------------------------------------------------------------
    // 9. Verificar reincidência
    // ------------------------------------------------------------------
    var ncHistory      = getResultHistory(formData.pointId, assay, 0);
    var recentNcCount  = detectRecurrence(ncHistory, params.Recurrence_Window_Months);

    // ------------------------------------------------------------------
    // 10. Determinar ação e destinatários
    // ------------------------------------------------------------------
    var actionType      = determineActionType(status, hasTrend, recentNcCount);
    var recipientLevels = determineRecipientLevels(status, recentNcCount);

    // ------------------------------------------------------------------
    // 11. Abrir ação se necessário
    // ------------------------------------------------------------------
    var actionId = null;
    if (actionType) {
      var description = _buildActionDescription(status, hasTrend, recentNcCount, point.fullName, assay);
      actionId = openAction(resultId, actionType, formData.analyst, description);
    }

    // ------------------------------------------------------------------
    // 12. Enviar notificações
    // ------------------------------------------------------------------
    if (status === 'Non-Conforming' || status === 'Critical') {
      var deadline = actionId ? _getActionDeadline(actionId) : '';
      sendNonConformingAlert({
        pointFullName:   point.fullName,
        sector:          point.sector,
        assay:           assay,
        result:          result,
        limit:           limit,
        percentage:      percentage,
        collectionDate:  formatDate(collectionDate),
        actionId:        actionId || '',
        deadline:        deadline,
        recentNcCount:   recentNcCount,
        recipientLevels: recipientLevels
      });
    }

    if (hasTrend && status === 'Conforming') {
      sendTrendAlert({
        pointFullName:   point.fullName,
        sector:          point.sector,
        assay:           assay,
        resultHistory:   resultValues,
        recipientLevels: ['primary']
      });
    }

    // ------------------------------------------------------------------
    // 13. Logar evento principal
    // ------------------------------------------------------------------
    writeLog({
      event:           'Result recorded',
      referenceId:     resultId,
      generatedStatus: status,
      triggeredAction: actionType
        ? actionType + ' opened — ' + actionId
        : 'No action required',
      user:            formData.analyst
    });

  } catch (e) {
    logError('Results', 'processFormSubmission', e);
    writeErrorLog('Results', 'processFormSubmission', e.message);
    throw e;
  }
}


/**
 * Monta a descrição automática da ação com base no contexto do resultado.
 * @param  {string}  status
 * @param  {boolean} hasTrend
 * @param  {number}  recentNcCount
 * @param  {string}  pointName
 * @param  {string}  assay
 * @returns {string}
 */
function _buildActionDescription(status, hasTrend, recentNcCount, pointName, assay) {
  if (recentNcCount >= 3) {
    return 'CAPA — ' + recentNcCount + ' NCs in last 6 months at ' + pointName + ' (' + assay + '). ' +
           'Investigate root cause and implement corrective and preventive actions.';
  }
  if (status === 'Critical') {
    return 'CAPA — Critical result at ' + pointName + ' (' + assay + '). ' +
           'Immediate root cause investigation required.';
  }
  if (status === 'Non-Conforming') {
    return 'Resample required at ' + pointName + ' (' + assay + '). ' +
           'Collect new sample to confirm or rule out contamination.';
  }
  if (status === 'Alert' || hasTrend) {
    return 'Observation — ' + (hasTrend ? 'Upward trend detected' : 'Alert threshold reached') +
           ' at ' + pointName + ' (' + assay + '). Review sanitation protocol.';
  }
  return '';
}


/**
 * Busca o prazo formatado de uma ação recém-aberta para incluir no e-mail.
 * @param  {string} actionId
 * @returns {string}  Data formatada ou string vazia se não encontrada
 */
function _getActionDeadline(actionId) {
  try {
    var sheet = getSheet(SHEET_NAMES.ACTIONS);
    var data  = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === actionId) {
        var deadline = data[i][4];
        return (deadline instanceof Date) ? formatDate(deadline) : '';
      }
    }
    return '';
  } catch (e) {
    return '';
  }
}