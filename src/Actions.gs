/**
 * Abre uma nova ação vinculada a um resultado.
 * @param {string} originResultId
 * @param {string} actionType      'Observation' | 'Resample' | 'CAPA'
 * @param {string} responsible
 * @param {string} description
 * @returns {string} ID da ação criada (ex: 'ACT-2025-0012')
 */
function openAction(originResultId, actionType, responsible, description) {}

/**
 * Fecha uma ação existente com resultado e flag de eficácia.
 * @param {string}  actionId
 * @param {string}  resampleResultId  ID do resultado da recoleta (se aplicável)
 * @param {boolean} effective
 * @param {string}  notes
 * @returns {void}
 */
function closeAction(actionId, resampleResultId, effective, notes) {}

/**
 * Retorna todas as ações abertas com prazo vencido.
 * @returns {Object[]} Array de { actionId, originResultId, actionType, deadline, responsible }
 */
function getOverdueActions() {}

/**
 * Retorna ações abertas vinculadas a um resultado específico.
 * @param {string} resultId
 * @returns {Object[]}
 */
function getActionsByResult(resultId) {}