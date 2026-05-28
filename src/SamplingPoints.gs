/**
 * Retorna os dados completos de um ponto de coleta pelo ID.
 * Retorna null se o ponto não for encontrado ou estiver inativo.
 * @param {string} pointId  Ex: 'PROC-TANK-01'
 * @returns {Object|null}
 * {
 *   pointId:         string,
 *   sector:          string,
 *   zone:            string,   — 'A', 'B' ou 'C'
 *   collectionArea:  number,   — 1, 2 ou 3
 *   fullName:        string,
 *   sampleType:      string,
 *   assays:          string,   — 'MA+BL', 'MA+BL+SAL', etc.
 *   limitMA:         number,
 *   limitBL:         number,
 *   limitSAL:        string,
 *   frequency:       string,
 *   collectionMethod:string,
 *   active:          boolean
 * }
 */
function getPoint(pointId) {}

/**
 * Retorna todos os pontos ativos.
 * @returns {Object[]}  Array de objetos no mesmo formato de getPoint()
 */
function getActivePoints() {}

/**
 * Retorna o limite aplicável a um ponto para um ensaio específico.
 * @param {string} pointId
 * @param {string} assay    'MA', 'BL' ou 'SAL'
 * @returns {number|string} Valor numérico ou 'Absent/10mL' para SAL
 */
function getLimit(pointId, assay) {}

/**
 * Verifica se um pointId existe e está ativo.
 * @param {string} pointId
 * @returns {boolean}
 */
function isValidPoint(pointId) {}