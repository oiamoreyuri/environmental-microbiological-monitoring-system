// =============================================================================
// Config.gs
// Centraliza nomes de abas e leitura de parâmetros da aba CONFIG.
// Sem dependências de outros módulos.
// Usada por: todos os módulos que acessam o Sheets.
// =============================================================================


// -----------------------------------------------------------------------------
// Nomes das abas — único lugar no sistema onde esses nomes aparecem.
// Se uma aba for renomeada, basta atualizar aqui.
// -----------------------------------------------------------------------------
var SHEET_NAMES = {
  SAMPLING_POINTS: 'SAMPLING_POINTS',
  SCHEDULE:        'SCHEDULE',
  RESULTS:         'RESULTS',
  ACTIONS:         'ACTIONS',
  CONFIG:          'CONFIG',
  SYSTEM_LOG:      'SYSTEM_LOG'
};


// -----------------------------------------------------------------------------
// Cache interno — evita múltiplas leituras do Sheets na mesma execução.
// -----------------------------------------------------------------------------
var _configCache = null;


/**
 * Retorna a aba do Sheets pelo nome definido em SHEET_NAMES.
 * Lança erro descritivo se a aba não for encontrada.
 * Uso interno dos módulos — não chame SpreadsheetApp diretamente fora daqui.
 * @param  {string} sheetName  Uma das chaves de SHEET_NAMES
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet(sheetName) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('getSheet: aba "' + sheetName + '" não encontrada no Sheets.');
  }
  return sheet;
}


/**
 * Retorna todos os parâmetros da aba CONFIG como objeto chave-valor.
 * Usa cache interno para evitar leituras repetidas do Sheets.
 * A aba CONFIG deve ter: coluna A = nome do parâmetro, coluna B = valor.
 * @returns {Object}  Ex: { Alert_Threshold: 70, Active_Year: 2025, ... }
 */
function getAllParams() {
  if (_configCache !== null) return _configCache;

  try {
    var sheet  = getSheet(SHEET_NAMES.CONFIG);
    var data   = sheet.getDataRange().getValues();
    var params = {};

    // Ignora a primeira linha se for cabeçalho (coluna A = 'Parameter' ou similar)
    var startRow = (String(data[0][0]).toLowerCase() === 'parameter') ? 1 : 0;

    for (var i = startRow; i < data.length; i++) {
      var key   = String(data[i][0]).trim();
      var value = data[i][1];

      if (isEmpty(key)) continue;

      // Converte strings 'TRUE'/'FALSE' para boolean
      if (String(value).toUpperCase() === 'TRUE')  value = true;
      if (String(value).toUpperCase() === 'FALSE') value = false;

      // Converte strings numéricas para number
      if (!isNaN(value) && value !== '') value = Number(value);

      params[key] = value;
    }

    _configCache = params;
    return _configCache;

  } catch (e) {
    logError('Config', 'getAllParams', e);
    throw e;
  }
}


/**
 * Retorna o valor de um parâmetro da aba CONFIG pelo nome.
 * Lança erro se o parâmetro não for encontrado.
 * @param  {string} paramName  Nome exato do parâmetro (coluna A da aba CONFIG)
 * @returns {string|number|boolean}
 */
function getParam(paramName) {
  var params = getAllParams();

  if (!(paramName in params)) {
    throw new Error('getParam: parâmetro "' + paramName + '" não encontrado na aba CONFIG.');
  }

  return params[paramName];
}


/**
 * Retorna os endereços de e-mail de notificação agrupados por nível.
 * Os níveis determinam quem recebe cada tipo de alerta.
 * @returns {Object}
 * {
 *   primary:    string,   — quality supervisor (recebe tudo)
 *   production: string,   — production supervisor (NC e acima)
 *   manager1:   string,   — quality manager (NC Recorrente e Crítico)
 *   manager2:   string    — director (Crítico e Salmonella)
 * }
 */
function getEmailRecipients() {
  try {
    return {
      primary:    getParam('Email_Primary'),
      production: getParam('Email_Production'),
      manager1:   getParam('Email_Manager_1'),
      manager2:   getParam('Email_Manager_2')
    };
  } catch (e) {
    logError('Config', 'getEmailRecipients', e);
    throw e;
  }
}


/**
 * Invalida o cache de parâmetros.
 * Chamar quando a aba CONFIG for alterada durante a execução
 * (ex: em testes ou atualizações manuais de parâmetro).
 * @returns {void}
 */
function clearConfigCache() {
  _configCache = null;
}
