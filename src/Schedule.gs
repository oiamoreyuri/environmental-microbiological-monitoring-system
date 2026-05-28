/**
 * Gera o cronograma anual completo para todos os pontos ativos.
 * Chamada uma vez por ano, tipicamente em janeiro.
 * Apaga linhas do ano anterior e gera novas com Status = 'Planned'.
 * @param {number} year
 * @returns {number} Quantidade de linhas geradas
 */
function generateAnnualSchedule(year) {}

/**
 * Atualiza o status de uma coleta no cronograma após resultado registrado.
 * @param {string} collectionId
 * @param {Date}   actualDate
 * @param {string} collector
 * @returns {void}
 */
function markAsCollected(collectionId, actualDate, collector) {}

/**
 * Verifica coletas atrasadas e retorna lista para notificação.
 * Uma coleta é "atrasada" se Data_Prevista < hoje e Status ainda = 'Planned'.
 * @returns {Object[]} Array de { collectionId, pointId, fullName, plannedDate, delayDays }
 */
function getOverdueCollections() {}

/**
 * Busca o collectionId correspondente a um ponto e data de coleta.
 * Usado por Results.gs ao registrar um resultado.
 * @param {string} pointId
 * @param {Date}   collectionDate
 * @returns {string|null} collectionId ou null se não encontrado
 */
function findCollectionId(pointId, collectionDate) {}