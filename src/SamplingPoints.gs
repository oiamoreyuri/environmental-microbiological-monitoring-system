// =============================================================================
// SamplingPoints.gs
// Leitura e validação da aba SAMPLING_POINTS.
// Dependências: Config.gs
// Usada por: Results.gs, Schedule.gs, Calculations.gs
// =============================================================================


// Cache interno — evita múltiplas leituras na mesma execução.
var _samplingPointsCache = null;


/**
 * Lê a aba SAMPLING_POINTS e retorna todos os pontos como array de objetos.
 * Usa cache interno para evitar leituras repetidas do Sheets.
 * @returns {Object[]}
 */
function _loadSamplingPoints() {
  if (_samplingPointsCache !== null) return _samplingPointsCache;

  try {
    var sheet  = getSheet(SHEET_NAMES.SAMPLING_POINTS);
    var data   = sheet.getDataRange().getValues();
    var points = [];

    // Linha 0 é cabeçalho — começa na linha 1
    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // Ignora linhas completamente vazias
      if (isEmpty(row[0])) continue;

      points.push({
        pointId:          String(row[0]).trim(),
        sector:           String(row[1]).trim(),
        zone:             String(row[2]).trim(),
        collectionArea:   Number(row[3]),
        fullName:         String(row[4]).trim(),
        sampleType:       String(row[5]).trim(),
        assays:           String(row[6]).trim(),
        limitMA:          row[7] !== '' ? Number(row[7]) : null,
        limitBL:          row[8] !== '' ? Number(row[8]) : null,
        limitSAL:         row[9] !== '' ? String(row[9]).trim() : null,
        frequency:        String(row[10]).trim(),
        collectionMethod: String(row[11]).trim(),
        active:           row[12] === true || String(row[12]).toUpperCase() === 'TRUE',
        inactiveDate:     row[13] instanceof Date ? row[13] : null,
        inactiveReason:   row[14] !== '' ? String(row[14]).trim() : null      });
    }

    _samplingPointsCache = points;
    return _samplingPointsCache;

  } catch (e) {
    logError('SamplingPoints', '_loadSamplingPoints', e);
    throw e;
  }
}


/**
 * Retorna os dados completos de um ponto de coleta pelo ID.
 * Retorna null se o ponto não for encontrado ou estiver inativo.
 * @param  {string} pointId  Ex: 'PROC-TANK-01'
 * @returns {Object|null}
 */
function getPoint(pointId) {
  if (isEmpty(pointId)) {
    throw new Error('getPoint: pointId não pode ser vazio.');
  }

  var points = _loadSamplingPoints();

  // Busca o ponto independente do status ativo/inativo
  var found = points.filter(function(p) {
    return p.pointId === pointId;
  });

  if (found.length === 0) return null;

  var point = found[0];

  // Ponto inativo sem justificativa — rejeita e força correção
  if (!point.active) {
    if (isEmpty(point.inactiveDate) || isEmpty(point.inactiveReason)) {
      throw new Error(
        'getPoint: ponto "' + pointId + '" está inativo mas sem data ou justificativa de inativação. ' +
        'Preencha os campos Inactive_Date e Inactive_Reason na aba SAMPLING_POINTS.'
      );
    }
    // Inativo com justificativa — retorna null normalmente (arquivado)
    return null;
  }

  return point;
}

/**
 * Retorna todos os pontos ativos.
 * @returns {Object[]}
 */
function getActivePoints() {
  return _loadSamplingPoints().filter(function(p) {
    return p.active;
  });
}


/**
 * Retorna o limite numérico de um ponto para um ensaio específico.
 * Lança erro se o ensaio não for reconhecido ou o limite não estiver definido.
 * @param  {string} pointId
 * @param  {string} assay    'MA', 'BL' ou 'SAL'
 * @returns {number|string}  Número para MA/BL, string 'Absent/10mL' para SAL
 */
function getLimit(pointId, assay) {
  var point = getPoint(pointId);

  if (!point) {
    throw new Error('getLimit: ponto "' + pointId + '" não encontrado ou inativo.');
  }

  var assayUpper = assay.toUpperCase();

  if (assayUpper === 'MA') {
    if (point.limitMA === null) {
      throw new Error('getLimit: limite MA não definido para o ponto "' + pointId + '".');
    }
    return point.limitMA;
  }

  if (assayUpper === 'BL') {
    if (point.limitBL === null) {
      throw new Error('getLimit: limite BL não definido para o ponto "' + pointId + '".');
    }
    return point.limitBL;
  }

  if (assayUpper === 'SAL') {
    if (point.limitSAL === null) {
      throw new Error('getLimit: limite SAL não definido para o ponto "' + pointId + '".');
    }
    return point.limitSAL;
  }

  throw new Error('getLimit: ensaio "' + assay + '" não reconhecido. Use MA, BL ou SAL.');
}


/**
 * Verifica se um pointId existe e está ativo.
 * @param  {string} pointId
 * @returns {boolean}
 */
function isValidPoint(pointId) {
  return getPoint(pointId) !== null;
}


/**
 * Invalida o cache de pontos de coleta.
 * Chamar quando a aba SAMPLING_POINTS for alterada durante a execução.
 * @returns {void}
 */
function clearSamplingPointsCache() {
  _samplingPointsCache = null;
}