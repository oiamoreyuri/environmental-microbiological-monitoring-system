/**
 * Verifica se um valor é nulo, undefined ou string vazia.
 * @param {*} value
 * @returns {boolean}
 */
function isEmpty(value) {}

/**
 * Formata uma data para string no padrão DD/MM/YYYY.
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {}

/**
 * Adiciona N dias úteis a uma data (pula sábado e domingo).
 * @param {Date} date
 * @param {number} businessDays
 * @returns {Date}
 */
function addBusinessDays(date, businessDays) {}

/**
 * Gera um ID único no formato PREFIX-YYYY-NNNN.
 * @param {string} prefix    Ex: 'RES', 'ACT', 'COL'
 * @param {number} sequence  Número sequencial do registro
 * @returns {string}         Ex: 'RES-2025-0047'
 */
function generateId(prefix, sequence) {}

/**
 * Calcula o percentual de um resultado em relação ao seu limite.
 * @param {number} result
 * @param {number} limit
 * @returns {number} Percentual arredondado (ex: 129.6)
 */
function calculatePercentage(result, limit) {}

/**
 * Verifica se uma data está dentro de uma janela de N meses a partir de hoje.
 * @param {Date}   date
 * @param {number} months
 * @returns {boolean}
 */
function isWithinMonths(date, months) {}

/**
 * Registra erro no console com timestamp e contexto.
 * @param {string} moduleName   Nome do módulo onde ocorreu o erro
 * @param {string} functionName Nome da função
 * @param {Error}  error
 * @returns {void}
 */
function logError(moduleName, functionName, error) {}