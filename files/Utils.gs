// =============================================================================
// Utils.gs
// Funções utilitárias reutilizáveis.
// Sem dependências de outros módulos.
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
 * @returns {string}        Ex: '31/03/2025'
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
 * Adiciona N dias úteis a uma data (pula sábado e domingo).
 * @param  {Date}   date          Data de referência
 * @param  {number} businessDays  Número de dias úteis a adicionar
 * @returns {Date}
 */
function addBusinessDays(date, businessDays) {
  if (!(date instanceof Date) || isNaN(date)) {
    throw new Error('addBusinessDays: argumento "date" inválido.');
  }
  if (typeof businessDays !== 'number' || businessDays < 0) {
    throw new Error('addBusinessDays: argumento "businessDays" deve ser número positivo.');
  }

  var result  = new Date(date);
  var added   = 0;

  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    var dayOfWeek = result.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }

  return result;
}


/**
 * Gera um ID único no formato PREFIX-YYYY-NNNN.
 * @param  {string} prefix    Prefixo do ID. Ex: 'RES', 'ACT', 'COL'
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

  var year    = new Date().getFullYear();
  var padded  = String(sequence).padStart(4, '0');
  return prefix.toUpperCase() + '-' + year + '-' + padded;
}


/**
 * Calcula o percentual de um resultado em relação ao seu limite.
 * @param  {number} result  Valor numérico do resultado
 * @param  {number} limit   Limite de referência
 * @returns {number}         Percentual com uma casa decimal. Ex: 129.6
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
 * @param  {Date}   date    Data a verificar
 * @param  {number} months  Tamanho da janela em meses
 * @returns {boolean}
 */
function isWithinMonths(date, months) {
  if (!(date instanceof Date) || isNaN(date)) {
    throw new Error('isWithinMonths: argumento "date" inválido.');
  }
  if (typeof months !== 'number' || months <= 0) {
    throw new Error('isWithinMonths: argumento "months" deve ser número positivo.');
  }

  var cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return date >= cutoff;
}


/**
 * Registra erro no console com timestamp e contexto.
 * Não lança exceção — apenas loga para não interromper o fluxo principal.
 * @param  {string} moduleName    Nome do módulo onde ocorreu o erro
 * @param  {string} functionName  Nome da função
 * @param  {Error}  error         Objeto de erro capturado
 * @returns {void}
 */
function logError(moduleName, functionName, error) {
  var timestamp = new Date().toISOString();
  var message   = error instanceof Error ? error.message : String(error);
  console.error('[' + timestamp + '] ERROR in ' + moduleName + '.' + functionName + '(): ' + message);
}
