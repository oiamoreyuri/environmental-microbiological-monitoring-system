// =============================================================================
// Utils.gs
// Funções utilitárias reutilizáveis.
// Sem dependências de outros módulos (exceto Config.gs para _getSpreadsheet e SHEET_NAMES).
// Usada por: todos os módulos.
// =============================================================================


/**
 * Verifica se um valor é nulo, undefined ou string vazia.
 * @param  {*}       value  Qualquer valor
 * @returns {boolean}
 */
function isEmpty(value) {
  return value === null || value === undefined || String(value).trim() === '';
}


/**
 * Formata uma data para string no padrão DD/MM/YYYY.
 * @param  {Date}   date
 * @returns {string}  Ex: '31/03/2025'
 */
function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    throw new Error('formatDate: argumento inválido — esperado objeto Date.');
  }
  var day   = String(date.getDate()).padStart(2, '0');
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var year  = date.getFullYear();
  return day + '/' + month + '/' + year;
}


/**
 * Converte uma Date para string no formato 'YYYY-MM-DD'.
 * Usado internamente para comparação com a lista de feriados.
 * @param  {Date}   date
 * @returns {string}  Ex: '2025-04-21'
 */
function _toDateKey(date) {
  var day   = String(date.getDate()).padStart(2, '0');
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var year  = date.getFullYear();
  return year + '-' + month + '-' + day;
}


// Cache interno — evita múltiplas leituras da aba HOLIDAYS na mesma execução.
var _holidaysCache = null;


/**
 * Lê a aba HOLIDAYS do Sheets e retorna um array de strings 'YYYY-MM-DD'.
 * A aba deve ter: coluna A = data (Date), coluna B = descrição (texto).
 * A primeira linha é ignorada (cabeçalho).
 * Usa cache em memória para evitar leituras repetidas do Sheets.
 * @returns {string[]}  Ex: ['2025-01-01', '2025-04-18', ...]
 */
function _getHolidaysFromSheet() {
  if (_holidaysCache !== null) return _holidaysCache;

  try {
    var sheet = getSheet(SHEET_NAMES.HOLIDAYS);

    var data     = sheet.getDataRange().getValues();
    var holidays = [];

    // Começa na linha 1 para pular o cabeçalho
    for (var i = 1; i < data.length; i++) {
      var cell = data[i][0];
      if (!cell) continue;

      // Aceita tanto objeto Date quanto string
      var date = (cell instanceof Date) ? cell : new Date(cell);
      if (!isNaN(date)) {
        holidays.push(_toDateKey(date));
      }
    }

    _holidaysCache = holidays;
    return _holidaysCache;

  } catch (e) {
    logError('Utils', '_getHolidaysFromSheet', e);
    return [];
  }
}


/**
 * Verifica se uma data é dia não útil: fim de semana ou feriado.
 * Os feriados são lidos da aba HOLIDAYS do Sheets.
 * @param  {Date}   date
 * @returns {boolean}
 */
function isNonWorkingDay(date) {
  var dow = date.getDay(); // 0 = domingo, 6 = sábado
  if (dow === 0 || dow === 6) return true;

  var holidays = _getHolidaysFromSheet();
  return holidays.indexOf(_toDateKey(date)) !== -1;
}


/**
 * Adiciona N dias úteis a uma data.
 * Pula fins de semana e feriados cadastrados na aba HOLIDAYS.
 * @param  {Date}   date          Data de referência
 * @param  {number} businessDays  Número de dias úteis a adicionar
 * @returns {Date}
 */
function addBusinessDays(date, businessDays) {
  if (!(date instanceof Date) || isNaN(date)) {
    throw new Error('addBusinessDays: argumento "date" inválido.');
  }
  if (typeof businessDays !== 'number' || businessDays < 0) {
    throw new Error('addBusinessDays: "businessDays" deve ser número positivo.');
  }

  var result = new Date(date);
  var added  = 0;

  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    if (!isNonWorkingDay(result)) {
      added++;
    }
  }

  return result;
}


/**
 * Gera um ID único no formato PREFIX-YYYY-NNNN.
 * @param  {string} prefix    Ex: 'RES', 'ACT', 'COL'
 * @param  {number} sequence  Número sequencial do registro
 * @returns {string}           Ex: 'RES-2025-0047'
 */
function generateId(prefix, sequence) {
  if (isEmpty(prefix)) {
    throw new Error('generateId: prefixo não pode ser vazio.');
  }
  if (typeof sequence !== 'number' || sequence < 0) {
    throw new Error('generateId: sequência deve ser número positivo.');
  }

  var year   = new Date().getFullYear();
  var padded = String(sequence).padStart(4, '0');
  return prefix.toUpperCase() + '-' + year + '-' + padded;
}


/**
 * Calcula o percentual de um resultado em relação ao seu limite.
 * @param  {number} result
 * @param  {number} limit
 * @returns {number}  Ex: 129.6
 */
function calculatePercentage(result, limit) {
  if (typeof result !== 'number' || typeof limit !== 'number') {
    throw new Error('calculatePercentage: ambos os argumentos devem ser números.');
  }
  if (limit <= 0) {
    throw new Error('calculatePercentage: limite deve ser maior que zero.');
  }
  return Math.round((result / limit) * 1000) / 10;
}


/**
 * Verifica se uma data está dentro de uma janela de N meses anteriores a hoje.
 * @param  {Date}   date
 * @param  {number} months
 * @returns {boolean}
 */
function isWithinMonths(date, months) {
  if (!(date instanceof Date) || isNaN(date)) {
    throw new Error('isWithinMonths: argumento "date" inválido.');
  }
  if (typeof months !== 'number' || months <= 0) {
    throw new Error('isWithinMonths: "months" deve ser número positivo.');
  }

  var cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return date >= cutoff;
}


/**
 * Registra erro no console com timestamp e contexto.
 * Não lança exceção — apenas loga para não interromper o fluxo principal.
 * @param  {string} moduleName
 * @param  {string} functionName
 * @param  {Error}  error
 * @returns {void}
 */
function logError(moduleName, functionName, error) {
  var timestamp = new Date().toISOString();
  var message   = error instanceof Error ? error.message : String(error);
  console.error('[' + timestamp + '] ERROR in ' + moduleName + '.' + functionName + '(): ' + message);
}