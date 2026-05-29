// =============================================================================
// Actions.gs
// Abertura e gestão de ações corretivas na aba ACTIONS.
// Dependências: Config.gs, Utils.gs, Log.gs
// Usada por: Results.gs
// =============================================================================


/**
 * Retorna o próximo número sequencial para geração de ID de ação.
 * Conta as linhas existentes na aba ACTIONS (excluindo cabeçalho).
 * @returns {number}
 */
function _nextActionSequence() {
  var sheet = getSheet(SHEET_NAMES.ACTIONS);
  var count = sheet.getLastRow() - 1; // desconta cabeçalho
  return count < 0 ? 1 : count + 1;
}


/**
 * Abre uma nova ação vinculada a um resultado de origem.
 * @param  {string} originResultId  ID do resultado que gerou a ação
 * @param  {string} actionType      'Observation' | 'Resample' | 'CAPA'
 * @param  {string} responsible     Nome ou e-mail do responsável
 * @param  {string} description     Descrição da ação a ser tomada
 * @returns {string} ID da ação criada. Ex: 'ACT-2025-0012'
 */
function openAction(originResultId, actionType, responsible, description) {
  if (isEmpty(originResultId)) {
    throw new Error('openAction: originResultId não pode ser vazio.');
  }

  var validTypes = ['Observation', 'Resample', 'CAPA'];
  if (validTypes.indexOf(actionType) === -1) {
    throw new Error('openAction: actionType inválido. Use: ' + validTypes.join(', '));
  }

  try {
    var actionId    = generateId('ACT', _nextActionSequence());
    var openedDate  = new Date();
    var deadlineDays = Number(getParam('Resample_Deadline_Days'));

    // Resample: prazo em dias úteis (Resample_Deadline_Days)
    // CAPA: prazo em dias corridos (CAPA_Deadline_Days)
    // Observation: sem prazo automático
    var deadline = '';
    if (actionType === 'Resample') {
      var resampleDays = Number(getParam('Resample_Deadline_Days'));
      deadline = addBusinessDays(openedDate, resampleDays);
    } else if (actionType === 'CAPA') {
      var capaDays = Number(getParam('CAPA_Deadline_Days'));
      var capaDeadline = new Date(openedDate);
      capaDeadline.setDate(capaDeadline.getDate() + capaDays);
      deadline = capaDeadline;
    }
    var sheet = getSheet(SHEET_NAMES.ACTIONS);

    sheet.appendRow([
      actionId,           // ACTION_ID
      originResultId,     // Origin_Result_ID
      actionType,         // Action_Type
      openedDate,         // Opened_Date
      deadline,           // Deadline
      responsible || '',  // Responsible
      description || '',  // Description
      '',                 // Resample_Result_ID (preenchido ao concluir)
      'Open',             // Action_Status
      '',                 // Closed_Date
      '',                 // Effective
      ''                  // Notes
    ]);

    writeLog({
      event:           'Action opened',
      referenceId:     actionId,
      generatedStatus: actionType,
      triggeredAction: 'Linked to result ' + originResultId,
      user:            responsible || 'system'
    });

    return actionId;

  } catch (e) {
    logError('Actions', 'openAction', e);
    throw e;
  }
}


/**
 * Fecha uma ação existente registrando resultado e eficácia.
 * @param  {string}  actionId           ID da ação a fechar
 * @param  {string}  resampleResultId   ID do resultado da recoleta (se aplicável, senão '')
 * @param  {boolean} effective          A ação foi eficaz?
 * @param  {string}  notes              Observações finais
 * @returns {void}
 */
function closeAction(actionId, resampleResultId, effective, notes) {
  if (isEmpty(actionId)) {
    throw new Error('closeAction: actionId não pode ser vazio.');
  }

  try {
    var sheet  = getSheet(SHEET_NAMES.ACTIONS);
    var data   = sheet.getDataRange().getValues();

    // Encontra a linha da ação pelo ID (coluna 0)
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === actionId) {
        var row = i + 1; // linha no Sheets é 1-based

        sheet.getRange(row, 8).setValue(resampleResultId || ''); // Resample_Result_ID
        sheet.getRange(row, 9).setValue('Closed');               // Action_Status
        sheet.getRange(row, 10).setValue(new Date());            // Closed_Date
        sheet.getRange(row, 11).setValue(effective ? true : false); // Effective
        sheet.getRange(row, 12).setValue(notes || '');           // Notes

        writeLog({
          event:           'Action closed',
          referenceId:     actionId,
          generatedStatus: effective ? 'Effective' : 'Not effective',
          triggeredAction: resampleResultId ? 'Resample result: ' + resampleResultId : 'No resample',
          user:            'system'
        });

        return;
      }
    }

    throw new Error('closeAction: ação "' + actionId + '" não encontrada na aba ACTIONS.');

  } catch (e) {
    logError('Actions', 'closeAction', e);
    throw e;
  }
}


/**
 * Retorna todas as ações com prazo vencido e status ainda aberto.
 * Usado pelo trigger diário para envio de alertas de atraso.
 * @returns {Object[]}
 * [{ actionId, originResultId, actionType, deadline, responsible }]
 */
function getOverdueActions() {
  try {
    var sheet = getSheet(SHEET_NAMES.ACTIONS);
    var data  = sheet.getDataRange().getValues();
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var overdue = [];

    for (var i = 1; i < data.length; i++) {
      var status   = String(data[i][8]);
      var deadline = data[i][4];

      // Só avalia ações abertas com prazo definido
      if (status !== 'Open' && status !== 'In Progress') continue;
      if (!(deadline instanceof Date) || isNaN(deadline))  continue;

      var deadlineDay = new Date(deadline);
      deadlineDay.setHours(0, 0, 0, 0);

      if (deadlineDay < today) {
        overdue.push({
          actionId:       String(data[i][0]),
          originResultId: String(data[i][1]),
          actionType:     String(data[i][2]),
          deadline:       formatDate(deadline),
          responsible:    String(data[i][5])
        });
      }
    }

    return overdue;

  } catch (e) {
    logError('Actions', 'getOverdueActions', e);
    throw e;
  }
}


/**
 * Retorna ações abertas vinculadas a um resultado específico.
 * Usado por Results.gs para verificar se já existe ação aberta
 * antes de abrir uma nova.
 * @param  {string} resultId
 * @returns {Object[]}
 */
function getActionsByResult(resultId) {
  if (isEmpty(resultId)) {
    throw new Error('getActionsByResult: resultId não pode ser vazio.');
  }

  try {
    var sheet = getSheet(SHEET_NAMES.ACTIONS);
    var data  = sheet.getDataRange().getValues();
    var found = [];

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]) === resultId) {
        found.push({
          actionId:       String(data[i][0]),
          originResultId: String(data[i][1]),
          actionType:     String(data[i][2]),
          openedDate:     data[i][3],
          deadline:       data[i][4],
          responsible:    String(data[i][5]),
          status:         String(data[i][8])
        });
      }
    }

    return found;

  } catch (e) {
    logError('Actions', 'getActionsByResult', e);
    throw e;
  }
}