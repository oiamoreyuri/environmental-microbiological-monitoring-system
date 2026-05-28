/**
 * Registra um evento na aba SYSTEM_LOG.
 * @param {Object} entry
 * {
 *   event:           string,  Ex: 'Result recorded'
 *   referenceId:     string,  Ex: 'RES-2025-0047'
 *   generatedStatus: string,  Ex: 'Non-Conforming'
 *   triggeredAction: string,  Ex: 'Email sent to primary, production'
 *   user:            string
 * }
 * @returns {void}
 */
function writeLog(entry) {}

/**
 * Registra especificamente um erro do sistema no log.
 * @param {string} moduleName
 * @param {string} functionName
 * @param {string} errorMessage
 * @returns {void}
 */
function writeErrorLog(moduleName, functionName, errorMessage) {}