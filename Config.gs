// Nomes das abas — único lugar onde aparecem no sistema
var SHEET_NAMES = {
  SAMPLING_POINTS: 'SAMPLING_POINTS',
  SCHEDULE:        'SCHEDULE',
  RESULTS:         'RESULTS',
  ACTIONS:         'ACTIONS',
  CONFIG:          'CONFIG',
  SYSTEM_LOG:      'SYSTEM_LOG'
};

/**
 * Retorna o valor de um parâmetro da aba CONFIG pelo nome.
 * Lança erro se o parâmetro não for encontrado.
 * @param {string} paramName  Nome exato do parâmetro (coluna A)
 * @returns {string|number|boolean}
 */
function getParam(paramName) {}

/**
 * Retorna todos os parâmetros da aba CONFIG como objeto chave-valor.
 * Usado na inicialização para evitar múltiplas leituras do Sheets.
 * @returns {Object}  Ex: { Alert_Threshold: 70, Active_Year: 2025, ... }
 */
function getAllParams() {}

/**
 * Retorna os endereços de e-mail de notificação agrupados por nível.
 * @returns {Object}
 * {
 *   primary:    string,   — quality supervisor
 *   production: string,   — production supervisor
 *   manager1:   string,   — quality manager
 *   manager2:   string    — director
 * }
 */
function getEmailRecipients() {}