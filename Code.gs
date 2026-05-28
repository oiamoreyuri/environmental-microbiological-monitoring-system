/**
 * Trigger automático — chamado pelo Google Forms ao receber resposta.
 * Extrai dados do evento e delega para Results.processFormSubmission().
 * @param {Object} e  Evento do Forms
 */
function onFormSubmit(e) {}

/**
 * Trigger diário — verifica coletas atrasadas e ações vencidas.
 * Configurado via Apps Script Triggers (time-driven, daily).
 */
function dailyCheck() {}

/**
 * Trigger mensal — gera relatório PDF e envia por e-mail.
 * Configurado via Apps Script Triggers (time-driven, monthly).
 */
function monthlyReport() {}

/**
 * Trigger anual — gera o cronograma do novo ano.
 * Configurado via Apps Script Triggers (time-driven, 1st of January).
 */
function generateNewYearSchedule() {}

/**
 * Instala todos os triggers programaticamente.
 * Chamada uma única vez durante o setup inicial do sistema.
 */
function installTriggers() {}