/**
 * Gera o relatório mensal em PDF e salva no Drive.
 * @param {number} month  1–12
 * @param {number} year
 * @returns {string} URL do arquivo gerado no Drive
 */
function generateMonthlyReport(month, year) {}

/**
 * Compila os dados do mês para o relatório.
 * @param {number} month
 * @param {number} year
 * @returns {Object}
 * {
 *   totalResults:     number,
 *   conforming:       number,
 *   alert:            number,
 *   nonConforming:    number,
 *   critical:         number,
 *   scheduleAdherence:number,
 *   openActions:      number,
 *   overdueActions:   number,
 *   ncDetails:        Object[]
 * }
 */
function compileMonthlyData(month, year) {}