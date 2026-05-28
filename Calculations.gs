/**
 * Calcula o status de um resultado individual.
 * @param {string} assay              'MA', 'BL' ou 'SAL'
 * @param {number} result             Valor numérico do resultado
 * @param {number} limit              Limite do ponto para o ensaio
 * @param {number} alertThreshold     % do limite para Atenção (ex: 70)
 * @param {number} criticalThreshold  % do limite para Crítico (ex: 300)
 * @returns {string} 'Conforming' | 'Alert' | 'Non-Conforming' | 'Critical'
 */
function calculateStatus(assay, result, limit, alertThreshold, criticalThreshold) {}

/**
 * Detecta tendência crescente em uma série de resultados do mesmo ponto.
 * @param {number[]} resultHistory  Array de resultados em ordem cronológica
 * @param {number}   n              Número de resultados consecutivos a verificar
 * @returns {boolean} true se os últimos N resultados são estritamente crescentes
 */
function detectUpwardTrend(resultHistory, n) {}

/**
 * Detecta reincidência de NCs em um ponto.
 * @param {Object[]} ncHistory  Array de objetos { date: Date, status: string }
 * @param {number}   windowMonths  Janela de tempo em meses
 * @returns {boolean} true se houver 2 ou mais NCs dentro da janela
 */
function detectRecurrence(ncHistory, windowMonths) {}

/**
 * Determina qual tipo de ação deve ser aberta para um dado status e flags.
 * @param {string}  status        Status calculado do resultado
 * @param {boolean} hasTrend      Flag de tendência crescente
 * @param {boolean} hasRecurrence Flag de reincidência
 * @returns {string|null} 'Observation' | 'Resample' | 'CAPA' | null
 */
function determineActionType(status, hasTrend, hasRecurrence) {}

/**
 * Determina quais níveis de destinatários devem ser notificados.
 * @param {string}  status
 * @param {boolean} hasRecurrence
 * @returns {string[]} Ex: ['primary', 'production'] ou ['primary', 'production', 'manager1', 'manager2']
 */
function determineRecipientLevels(status, hasRecurrence) {}