// =============================================================================
// Dev.gs
// Utilitários de desenvolvimento e teste.
// NÃO executar em produção — remover ou manter desabilitado após go-live.
// =============================================================================


/**
 * Testa o vínculo com a planilha.
 * Esperado: erro de ponto não encontrado (não erro de Spreadsheet ID).
 * @returns {void}
 */
function _devTestConnection() {
  try {
    var sheet = getSheet(SHEET_NAMES.SAMPLING_POINTS);
    Logger.log('Connection OK — SAMPLING_POINTS found. Rows: ' + sheet.getLastRow());
  } catch (e) {
    Logger.log('ERROR: ' + e.message);
  }
}


function _devTestSubmission() {
  var testData = {
    pointId: 'DESP-CIL-LAV-01',
    collectionDate: new Date('2026-05-30'),
    assay: 'MA',
    result: 55,
    analyst: 'test@yourcompany.com',
    notes: 'Dev test — not a real result'
  };

  processFormSubmission(testData);
  Logger.log('Dev test completed. Check RESULTS, ACTIONS and SYSTEM_LOG tabs.');
}

/**
 * Lista todos os parâmetros da aba CONFIG no log.
 * Útil para verificar se o CONFIG está correto após setup.
 * @returns {void}
 */
function _devCheckConfig() {
  var params = getAllParams();
  Logger.log(JSON.stringify(params, null, 2));
}


/**
 * Lista todos os pontos ativos cadastrados em SAMPLING_POINTS.
 * @returns {void}
 */
function _devListActivePoints() {
  var points = getActivePoints();
  Logger.log('Active points: ' + points.length);
  points.forEach(function (p) {
    Logger.log(p.pointId + ' — ' + p.fullName + ' (' + p.sector + ')');
  });
}


/**
 * Testa a geração do cronograma para o ano atual sem gravar na planilha.
 * @returns {void}
 */
function _devPreviewSchedule() {
  var year = new Date().getFullYear();
  var points = getActivePoints();

  points.forEach(function (p) {
    Logger.log(p.pointId + ' (' + p.frequency + '):');
  });

  Logger.log('Run generateAnnualSchedule(' + year + ') to write to SCHEDULE tab.');
}

function _devGenerateSchedule2026() {
  generateAnnualSchedule(2026);
}