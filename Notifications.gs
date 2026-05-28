/**
 * Envia notificação de resultado não conforme com instrução de recoleta.
 * @param {Object} payload
 * {
 *   pointFullName:  string,
 *   sector:         string,
 *   assay:          string,
 *   result:         number,
 *   limit:          number,
 *   percentage:     number,
 *   collectionDate: string,
 *   actionId:       string,
 *   deadline:       string,
 *   recipients:     string[]
 * }
 * @returns {void}
 */
function sendNonConformingAlert(payload) {}

/**
 * Envia notificação de tendência crescente detectada.
 * @param {Object} payload
 * {
 *   pointFullName:  string,
 *   sector:         string,
 *   assay:          string,
 *   resultHistory:  number[],
 *   recipients:     string[]
 * }
 * @returns {void}
 */
function sendTrendAlert(payload) {}

/**
 * Envia notificação de reincidência com abertura de CAPA.
 * @param {Object} payload
 * {
 *   pointFullName:  string,
 *   sector:         string,
 *   assay:          string,
 *   ncHistory:      Object[],
 *   actionId:       string,
 *   recipients:     string[]
 * }
 * @returns {void}
 */
function sendRecurrenceAlert(payload) {}

/**
 * Envia notificação de coletas atrasadas (chamada por trigger diário).
 * @param {Object[]} overdueList  Retorno de Schedule.getOverdueCollections()
 * @param {string[]} recipients
 * @returns {void}
 */
function sendOverdueCollectionsAlert(overdueList, recipients) {}

/**
 * Envia relatório mensal em PDF por e-mail.
 * @param {string}   month       Ex: 'April 2025'
 * @param {string}   pdfFileUrl  URL do arquivo no Drive
 * @param {string[]} recipients
 * @returns {void}
 */
function sendMonthlyReport(month, pdfFileUrl, recipients) {}