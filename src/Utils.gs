// =============================================================================
// Utils.gs
// Funções utilitárias reutilizáveis.
// Sem dependências de outros módulos.
// Usada por: todos os módulos.
// =============================================================================


/**
 * Verifica se um valor é nulo, undefined ou string vazia.
 * @param  {*}       value  Qualquer valor
 * @returns {boolean}
 */
function isEmpty(value) {
  return value === null || value === undefined || String(value).trim() === '';
}


/**
 * Formata uma data para string no padrão DD/MM/YYYY.
 * @param  {Date}   date
 * @returns {string}        Ex: '31/03/2025'
 */
function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    throw new Error('formatDate: argumento inválido — esperado objeto Date.');
  }
  var day   = String(date.getDate()).padStart(2, '0');
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var year  = date.getFullYear();
  return day + '/' + month + '/' + year;
}


/**
 * Calcula a data da Páscoa para um dado ano (algoritmo de Butcher).
 * Base para cálculo de feriados móveis (Carnaval, Sexta-feira Santa).
 * @param  {number} year
 * @returns {Date}
 */
function _getEasterDate(year) {
  var a = year % 19;
  var b = Math.floor(year / 100);
  var c = year % 100;
  var d = Math.floor(b / 4);
  var e = b % 4;
  var f = Math.floor((b + 8) / 25);
  var g = Math.floor((b - f + 1) / 3);
  var h = (19 * a + b - d - g + 15) % 30;
  var i = Math.floor(c / 4);
  var k = c % 4;
  var l = (32 + 2 * e + 2 * i - h - k) % 7;
  var m = Math.floor((a + 11 * h + 22 * l) / 451);
  var month = Math.floor((h + l - 7 * m + 114) / 31); // 1-based
  var day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}


/**
 * Aplica a regra de ponte: se um feriado cai em terça, quarta ou quinta,
 * é transferido para a segunda ou sexta-feira mais próxima.
 * Segunda e sexta permanecem como estão.
 * @param  {Date} date  Data original do feriado
 * @returns {Date}       Data efetiva após aplicação da regra
 */
function _applyBridgeRule(date) {
  var day = date.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
  var result = new Date(date);

  if (day === 2) {
    // Terça → transfere para segunda
    result.setDate(result.getDate() - 1);
  } else if (day === 3) {
    // Quarta → transfere para segunda (mais comum no Brasil)
    result.setDate(result.getDate() - 2);
  } else if (day === 4) {
    // Quinta → transfere para sexta
    result.setDate(result.getDate() + 1);
  }
  // Segunda (1) e sexta (5) permanecem; fim de semana não deve ocorrer para feriados fixos

  return result;
}


/**
 * Retorna a lista de feriados efetivos para um dado ano,
 * já com a regra de ponte aplicada onde cabível.
 * Inclui feriados nacionais fixos + Carnaval + Sexta-feira Santa.
 * @param  {number} year
 * @returns {string[]}  Array de strings no formato 'MM-DD' (ex: '04-21')
 */
function _getHolidays(year) {
  var easter    = _getEasterDate(year);

  // Carnaval = 47 dias antes da Páscoa (segunda-feira)
  var carnival  = new Date(easter);
  carnival.setDate(carnival.getDate() - 47);

  // Sexta-feira Santa = 2 dias antes da Páscoa
  var goodFriday = new Date(easter);
  goodFriday.setDate(goodFriday.getDate() - 2);

  // Feriados fixos com regra de ponte
  var fixed = [
    new Date(year, 0,  1),   // Confraternização Universal — 1/jan
    new Date(year, 3, 21),   // Tiradentes — 21/abr
    new Date(year, 4,  1),   // Dia do Trabalho — 1/mai
    new Date(year, 8,  7),   // Independência — 7/set
    new Date(year, 9, 12),   // Nossa Sra. Aparecida — 12/out
    new Date(year, 10,  2),  // Finados — 2/nov
    new Date(year, 10, 15),  // Proclamação da República — 15/nov
    new Date(year, 11, 25),  // Natal — 25/dez
  ];

  var holidays = [];

  // Aplica regra de ponte nos feriados fixos
  fixed.forEach(function(d) {
    var effective = _applyBridgeRule(d);
    holidays.push(_toMonthDay(effective));
  });

  // Carnaval e Sexta-feira Santa são móveis e não sofrem ponte
  // (já caem em dias fixos da semana por definição)
  holidays.push(_toMonthDay(carnival));
  holidays.push(_toMonthDay(goodFriday));

  return holidays;
}


/**
 * Converte uma Date para string 'MM-DD' para comparação simples.
 * @param  {Date}   date
 * @returns {string}  Ex: '04-21'
 */
function _toMonthDay(date) {
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var day   = String(date.getDate()).padStart(2, '0');
  return month + '-' + day;
}


/**
 * Verifica se uma data é dia não útil:
 * fim de semana (sáb/dom) ou feriado nacional brasileiro.
 * @param  {Date}   date
 * @returns {boolean}
 */
function isNonWorkingDay(date) {
  var dow = date.getDay();
  if (dow === 0 || dow === 6) return true;  // domingo ou sábado

  var holidays = _getHolidays(date.getFullYear());
  var key      = _toMonthDay(date);
  return holidays.indexOf(key) !== -1;
}


/**
 * Adiciona N dias úteis a uma data.
 * Pula fins de semana e feriados nacionais brasileiros (com regra de ponte).
 * @param  {Date}   date          Data de referência
 * @param  {number} businessDays  Número de dias úteis a adicionar
 * @returns {Date}
 */
function addBusinessDays(date, businessDays) {
  if (!(date instanceof Date) || isNaN(date)) {
    throw new Error('addBusinessDays: argumento "date" inválido.');
  }
  if (typeof businessDays !== 'number' || businessDays < 0) {
    throw new Error('addBusinessDays: argumento "businessDays" deve ser número positivo.');
  }

  var result = new Date(date);
  var added  = 0;

  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    if (!isNonWorkingDay(result)) {
      added++;
    }
  }

  return result;
}


/**
 * Gera um ID único no formato PREFIX-YYYY-NNNN.
 * @param  {string} prefix    Prefixo do ID. Ex: 'RES', 'ACT', 'COL'
 * @param  {number} sequence  Número sequencial do registro
 * @returns {string}           Ex: 'RES-2025-0047'
 */
function generateId(prefix, sequence) {
  if (isEmpty(prefix)) {
    throw new Error('generateId: prefixo não pode ser vazio.');
  }
  if (typeof sequence !== 'number' || sequence < 0) {
    throw new Error('generateId: sequência deve ser número positivo.');
  }

  var year   = new Date().getFullYear();
  var padded = String(sequence).padStart(4, '0');
  return prefix.toUpperCase() + '-' + year + '-' + padded;
}


/**
 * Calcula o percentual de um resultado em relação ao seu limite.
 * @param  {number} result  Valor numérico do resultado
 * @param  {number} limit   Limite de referência
 * @returns {number}         Percentual com uma casa decimal. Ex: 129.6
 */
function calculatePercentage(result, limit) {
  if (typeof result !== 'number' || typeof limit !== 'number') {
    throw new Error('calculatePercentage: ambos os argumentos devem ser números.');
  }
  if (limit <= 0) {
    throw new Error('calculatePercentage: limite deve ser maior que zero.');
  }
  return Math.round((result / limit) * 1000) / 10;
}


/**
 * Verifica se uma data está dentro de uma janela de N meses anteriores a hoje.
 * @param  {Date}   date    Data a verificar
 * @param  {number} months  Tamanho da janela em meses
 * @returns {boolean}
 */
function isWithinMonths(date, months) {
  if (!(date instanceof Date) || isNaN(date)) {
    throw new Error('isWithinMonths: argumento "date" inválido.');
  }
  if (typeof months !== 'number' || months <= 0) {
    throw new Error('isWithinMonths: argumento "months" deve ser número positivo.');
  }

  var cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return date >= cutoff;
}


/**
 * Registra erro no console com timestamp e contexto.
 * Não lança exceção — apenas loga para não interromper o fluxo principal.
 * @param  {string} moduleName    Nome do módulo onde ocorreu o erro
 * @param  {string} functionName  Nome da função
 * @param  {Error}  error         Objeto de erro capturado
 * @returns {void}
 */
function logError(moduleName, functionName, error) {
  var timestamp = new Date().toISOString();
  var message   = error instanceof Error ? error.message : String(error);
  console.error('[' + timestamp + '] ERROR in ' + moduleName + '.' + functionName + '(): ' + message);
}