// =============================================================================
// Calculations.gs
// Lógica de negócio: classificação de status, tendência e reincidência.
// Módulo puro — sem I/O de Sheets ou serviços externos.
// Dependências: Utils.gs
// Usada por: Results.gs
// =============================================================================


/**
 * Calcula o status de um resultado individual.
 * @param  {string} assay              'MA', 'BL' ou 'SAL'
 * @param  {number} result             Valor numérico (SAL: 0=Ausente, 1=Presente)
 * @param  {number} limit              Limite do ponto para o ensaio
 * @param  {number} alertThreshold     % do limite para Atenção (ex: 70)
 * @param  {number} criticalThreshold  % do limite para Crítico (ex: 300)
 * @returns {string} 'Conforming' | 'Alert' | 'Non-Conforming' | 'Critical'
 */
function calculateStatus(assay, result, limit, alertThreshold, criticalThreshold) {
  if (isEmpty(assay)) {
    throw new Error('calculateStatus: ensaio não pode ser vazio.');
  }
  if (typeof result !== 'number') {
    throw new Error('calculateStatus: resultado deve ser número.');
  }
  if (typeof limit !== 'number' || limit <= 0) {
    throw new Error('calculateStatus: limite deve ser número maior que zero.');
  }

  // Salmonella é binária — qualquer detecção é Crítico
  if (assay.toUpperCase() === 'SAL') {
    return result > 0 ? 'Critical' : 'Conforming';
  }

  var pct = calculatePercentage(result, limit);

  if (pct < alertThreshold)    return 'Conforming';
  if (pct < 100)               return 'Alert';
  if (pct < criticalThreshold) return 'Non-Conforming';
  return 'Critical';
}


/**
 * Detecta tendência crescente em uma série de resultados do mesmo ponto.
 * Retorna true se os últimos N valores são estritamente crescentes.
 * @param  {number[]} resultHistory  Resultados em ordem cronológica (mais antigo primeiro)
 * @param  {number}   n              Número de resultados consecutivos a verificar
 * @returns {boolean}
 */
function detectUpwardTrend(resultHistory, n) {
  if (!Array.isArray(resultHistory)) {
    throw new Error('detectUpwardTrend: resultHistory deve ser um array.');
  }
  if (typeof n !== 'number' || n < 2) {
    throw new Error('detectUpwardTrend: n deve ser número maior ou igual a 2.');
  }

  // Histórico insuficiente para detectar tendência
  if (resultHistory.length < n) return false;

  // Pega os últimos N resultados
  var recent = resultHistory.slice(-n);

  for (var i = 1; i < recent.length; i++) {
    if (recent[i] <= recent[i - 1]) return false;
  }

  return true;
}


/**
 * Detecta reincidência de NCs em um ponto dentro de uma janela de tempo.
 * Retorna true se houver 2 ou mais NCs dentro da janela definida.
 * @param  {Object[]} ncHistory     Array de { date: Date, status: string }
 * @param  {number}   windowMonths  Janela de tempo em meses
 * @returns {boolean}
 */
function detectRecurrence(ncHistory, windowMonths) {
  if (!Array.isArray(ncHistory)) {
    throw new Error('detectRecurrence: ncHistory deve ser um array.');
  }
  if (typeof windowMonths !== 'number' || windowMonths <= 0) {
    throw new Error('detectRecurrence: windowMonths deve ser número positivo.');
  }

  // Filtra apenas NCs dentro da janela de tempo
  var recentNCs = ncHistory.filter(function(entry) {
    var isNC = entry.status === 'Non-Conforming' || entry.status === 'Critical';
    return isNC && isWithinMonths(entry.date, windowMonths);
  });

  return recentNCs.length >= 2;
}


/**
 * Determina qual tipo de ação deve ser aberta para um dado status e flags.
 * CAPA tem prioridade sobre Resample quando há reincidência.
 * @param  {string}  status        Status calculado do resultado
 * @param  {boolean} hasTrend      Flag de tendência crescente
 * @param  {boolean} hasRecurrence Flag de reincidência
 * @returns {string|null} 'Observation' | 'Resample' | 'CAPA' | null
 */
function determineActionType(status, hasTrend, hasRecurrence) {
  // Reincidência sempre abre CAPA, independente do status atual
  if (hasRecurrence) return 'CAPA';

  if (status === 'Critical')        return 'CAPA';
  if (status === 'Non-Conforming')  return 'Resample';
  if (status === 'Alert')           return 'Observation';
  if (hasTrend)                     return 'Observation';

  return null;
}


/**
 * Determina quais níveis de destinatários devem ser notificados.
 * @param  {string}  status
 * @param  {boolean} hasRecurrence
 * @returns {string[]}  Subconjunto de ['primary', 'production', 'manager1', 'manager2']
 */
function determineRecipientLevels(status, hasRecurrence) {
  // Salmonella ou Crítico: cadeia completa
  if (status === 'Critical') {
    return ['primary', 'production', 'manager1', 'manager2'];
  }

  // NC com reincidência: sobe para manager1
  if (status === 'Non-Conforming' && hasRecurrence) {
    return ['primary', 'production', 'manager1'];
  }

  // NC simples: qualidade + produção
  if (status === 'Non-Conforming') {
    return ['primary', 'production'];
  }

  // Atenção ou tendência: só qualidade
  if (status === 'Alert') {
    return ['primary'];
  }

  return [];
}