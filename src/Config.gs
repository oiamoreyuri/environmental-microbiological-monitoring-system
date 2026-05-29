// =============================================================================
// Config.gs
// Centraliza nomes de abas, acesso à planilha e leitura de parâmetros.
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
  SYSTEM_LOG:      'SYSTEM_LOG',
  HOLIDAYS:        'HOLIDAYS'
};


// -----------------------------------------------------------------------------
// Cache interno — evita múltiplas leituras na mesma execução.
// -----------------------------------------------------------------------------
var _configCache      = null;
var _spreadsheetId    = null;


// -----------------------------------------------------------------------------
// VÍNCULO COM A PLANILHA
// -----------------------------------------------------------------------------

/**
 * Define o ID da planilha via PropertiesService.
 * Executar manualmente UMA ÚNICA VEZ após criar a planilha.
 * @param  {string} id  ID da planilha (da URL do Sheets)
 * @returns {void}
 */
function setSpreadsheetId(id) {
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', id);
  _spreadsheetId = id;
  Logger.log('Spreadsheet ID saved: ' + id);
}


/**
 * Retorna a instância do Spreadsheet pelo ID armazenado no PropertiesService.
 * Lança erro se o ID não estiver configurado.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function _getSpreadsheet() {
  if (_spreadsheetId) return SpreadsheetApp.openById(_spreadsheetId);

  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error(
      'Spreadsheet ID not configured. ' +
      'Run setSpreadsheetId("YOUR_SPREADSHEET_ID") once to set it up.'
    );
  }

  _spreadsheetId = id;
  return SpreadsheetApp.openById(_spreadsheetId);
}


/**
 * Retorna a aba do Sheets pelo nome definido em SHEET_NAMES.
 * Lança erro descritivo se a aba não for encontrada.
 * Uso interno dos módulos — não chame SpreadsheetApp diretamente fora daqui.
 * @param  {string} sheetName  Uma das chaves de SHEET_NAMES
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet(sheetName) {
  var ss    = _getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('getSheet: aba "' + sheetName + '" não encontrada no Sheets.');
  }
  return sheet;
}


// -----------------------------------------------------------------------------
// PARÂMETROS DO SISTEMA
// -----------------------------------------------------------------------------

/**
 * Retorna todos os parâmetros da aba CONFIG como objeto chave-valor.
 * Usa cache interno para evitar leituras repetidas do Sheets.
 * @returns {Object}  Ex: { Alert_Threshold: 70, Active_Year: 2025, ... }
 */
function getAllParams() {
  if (_configCache !== null) return _configCache;

  try {
    var sheet  = getSheet(SHEET_NAMES.CONFIG);
    var data   = sheet.getDataRange().getValues();
    var params = {};

    var startRow = (String(data[0][0]).toLowerCase() === 'parameter') ? 1 : 0;

    for (var i = startRow; i < data.length; i++) {
      var key   = String(data[i][0]).trim();
      var value = data[i][1];

      if (isEmpty(key)) continue;

      if (String(value).toUpperCase() === 'TRUE')  value = true;
      if (String(value).toUpperCase() === 'FALSE') value = false;
      if (!isNaN(value) && value !== '')           value = Number(value);

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
 * @param  {string} paramName
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
 * Retorna os endereços de e-mail agrupados por nível de notificação.
 * @returns {Object}
 * {
 *   primary:    string,
 *   production: string,
 *   manager1:   string,
 *   manager2:   string
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
 * Chamar quando a aba CONFIG for alterada durante a execução.
 * @returns {void}
 */
function clearConfigCache() {
  _configCache = null;
}