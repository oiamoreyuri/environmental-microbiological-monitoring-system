// =============================================================================
// Log.gs
// Registro de eventos do sistema na aba SYSTEM_LOG.
// Dependências: Config.gs, Utils.gs
// Usada por: todos os módulos que geram eventos rastreáveis.
// =============================================================================


/**
 * Registra um evento na aba SYSTEM_LOG.
 * Chamada após qualquer ação relevante do sistema.
 * @param  {Object} entry
 * {
 *   event:           string,  Ex: 'Result recorded'
 *   referenceId:     string,  Ex: 'RES-2025-0047'
 *   generatedStatus: string,  Ex: 'Non-Conforming'
 *   triggeredAction: string,  Ex: 'Resample opened — ACT-2025-0012'
 *   user:            string   Ex: 'analyst@company.com'
 * }
 * @returns {void}
 */
function writeLog(entry) {
  try {
    var sheet = getSheet(SHEET_NAMES.SYSTEM_LOG);

    sheet.appendRow([
      new Date(),                                        // Timestamp
      entry.event           || '',                       // Event
      entry.referenceId     || '',                       // Reference_ID
      entry.generatedStatus || '',                       // Generated_Status
      entry.triggeredAction || '',                       // Triggered_Action
      entry.user            || 'system'                  // User
    ]);

  } catch (e) {
    // Log de sistema não pode lançar exceção — apenas registra no console
    // para não interromper o fluxo principal em caso de falha de escrita
    logError('Log', 'writeLog', e);
  }
}


/**
 * Registra especificamente um erro do sistema no SYSTEM_LOG.
 * Usado quando um módulo captura uma exceção que precisa de rastreabilidade.
 * @param  {string} moduleName
 * @param  {string} functionName
 * @param  {string} errorMessage
 * @returns {void}
 */
function writeErrorLog(moduleName, functionName, errorMessage) {
  writeLog({
    event:           'ERROR',
    referenceId:     moduleName + '.' + functionName,
    generatedStatus: 'System error',
    triggeredAction: errorMessage,
    user:            'system'
  });
}