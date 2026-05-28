/**
 * Ponto de entrada principal para registro de resultado via Forms.
 * Orquestra toda a sequência: validar → calcular → gravar → notificar → logar.
 * Chamada pelo trigger onFormSubmit em Code.gs.
 * @param {Object} formData  Dados brutos do formulário
 * {
 *   pointId:      string,
 *   collectionDate: string,
 *   assay:        string,
 *   result:       number,
 *   analyst:      string,
 *   notes:        string
 * }
 * @returns {void}
 */
function processFormSubmission(formData) {}

/**
 * Grava uma linha de resultado na aba RESULTS.
 * @param {Object} resultRecord  Objeto com todos os campos da aba
 * @returns {string} ID do resultado gerado (ex: 'RES-2025-0047')
 */
function writeResult(resultRecord) {}

/**
 * Busca o histórico de resultados de um ponto para um ensaio.
 * Usado por Calculations.gs para detecção de tendência e reincidência.
 * @param {string} pointId
 * @param {string} assay
 * @param {number} limit      Máximo de registros a retornar (mais recentes)
 * @returns {Object[]} Array de { date, result, status } em ordem cronológica
 */
function getResultHistory(pointId, assay, limit) {}

/**
 * Registra uma retificação de resultado existente.
 * Não edita a linha original — adiciona nova linha com Correction = TRUE.
 * @param {string} originalResultId  ID do resultado a ser retificado
 * @param {Object} correctedData     Novos valores { result, notes, analyst }
 * @returns {string} ID do novo registro de retificação
 */
function recordCorrection(originalResultId, correctedData) {}