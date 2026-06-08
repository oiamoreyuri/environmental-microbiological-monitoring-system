// =============================================================================
// Schedule.gs
// Geração e atualização do cronograma anual de coletas.
// Dependências: Config.gs, SamplingPoints.gs, Utils.gs, Log.gs
// Usada por: Results.gs, Code.gs
// =============================================================================


/**
 * Calcula a lista de datas previstas para um ponto no ano,
 * com base na sua frequência de coleta.
 * Datas que caem em fim de semana ou feriado são movidas
 * para o próximo dia útil.
 * @param  {number} year
 * @param  {string} frequency  'Monthly' | 'Bimonthly' | 'Quarterly' | 'Biannual' | 'Biweekly'
 * @returns {Date[]}
 */
function _calculatePlannedDates(year, frequency) {
  var months = [];

  // Biweekly: duas coletas por mês — dia 15 e último dia do mês
  if (frequency === 'Biweekly') {
    var dates = [];
    for (var m = 0; m < 12; m++) {
      // Primeira quinzena: dia 15
      var mid = new Date(year, m, 15);
      while (isNonWorkingDay(mid)) {
        mid.setDate(mid.getDate() + 1);
      }
      dates.push(mid);

      // Segunda quinzena: último dia do mês
      var end = new Date(year, m + 1, 0);
      while (isNonWorkingDay(end)) {
        end.setDate(end.getDate() + 1);
      }
      dates.push(end);
    }
    return dates;
  }

  switch (frequency) {
    case 'Monthly':
      months = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      break;
    case 'Bimonthly':
      months = [0, 2, 4, 6, 8, 10];
      break;
    case 'Quarterly':
      months = [0, 3, 6, 9];
      break;
    case 'Biannual':
      months = [0, 6];
      break;
    default:
      throw new Error('_calculatePlannedDates: frequência "' + frequency + '" não reconhecida.');
  }

  return months.map(function (month) {
    var lastDay = new Date(year, month + 1, 0);
    while (isNonWorkingDay(lastDay)) {
      lastDay.setDate(lastDay.getDate() + 1);
    }
    return lastDay;
  });
}

/**
 * Gera o ID de coleta no formato ANO-POINTID-SEQ.
 * @param  {number} year
 * @param  {string} pointId
 * @param  {number} sequence  Posição da coleta no ano (1-based)
 * @returns {string}  Ex: '2025-PROC-TANK-01-03'
 */
function _generateCollectionId(year, pointId, sequence) {
  var seq = String(sequence).padStart(2, '0');
  return year + '-' + pointId + '-' + seq;
}


/**
 * Gera o cronograma anual completo para todos os pontos ativos.
 * Apaga as linhas do ano informado antes de gerar as novas.
 * Chamada uma vez por ano pelo trigger de 1º de janeiro.
 * @param  {number} year
 * @returns {number} Quantidade de linhas geradas
 */
function generateAnnualSchedule(year) {
  if (typeof year !== 'number' || year < 2020) {
    throw new Error('generateAnnualSchedule: ano inválido — ' + year);
  }

  try {
    var sheet = getSheet(SHEET_NAMES.SCHEDULE);
    var points = getActivePoints();
    var rows = [];

    points.forEach(function (point) {
      var dates = _calculatePlannedDates(year, point.frequency);

      dates.forEach(function (date, index) {
        var collectionId = _generateCollectionId(year, point.pointId, index + 1);

        rows.push([
          collectionId,       // COLLECTION_ID
          point.pointId,      // POINT_ID
          point.sector,       // Sector
          point.fullName,     // Full_Name
          date,               // Planned_Date
          '',                 // Actual_Date
          '',                 // Delay_Days
          'Planned',          // Status
          '',                 // Delay_Justification
          ''                  // Collector
        ]);
      });
    });

    // Remove linhas do ano informado antes de inserir as novas
    _deleteYearRows(sheet, year);

    // Insere todas as linhas de uma vez (mais eficiente que appendRow em loop)
    if (rows.length > 0) {
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    writeLog({
      event: 'Annual schedule generated',
      referenceId: String(year),
      generatedStatus: rows.length + ' collection(s) planned',
      triggeredAction: points.length + ' active point(s)',
      user: 'system'
    });

    return rows.length;

  } catch (e) {
    logError('Schedule', 'generateAnnualSchedule', e);
    throw e;
  }
}


/**
 * Remove da aba SCHEDULE todas as linhas do ano informado.
 * Identifica o ano pela coluna COLLECTION_ID (começa com o ano).
 * @param  {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param  {number} year
 * @returns {void}
 */
function _deleteYearRows(sheet, year) {
  var data = sheet.getDataRange().getValues();
  var prefix = String(year) + '-';
  var toDelete = [];

  // Percorre de trás para frente para não deslocar índices ao deletar
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).indexOf(prefix) === 0) {
      toDelete.push(i + 1); // linha no Sheets é 1-based
    }
  }

  toDelete.forEach(function (rowIndex) {
    sheet.deleteRow(rowIndex);
  });
}


/**
 * Atualiza o status de uma coleta no cronograma após resultado registrado.
 * @param  {string} collectionId
 * @param  {Date}   actualDate
 * @param  {string} collector
 * @returns {void}
 */
function markAsCollected(collectionId, actualDate, collector) {
  if (isEmpty(collectionId)) {
    throw new Error('markAsCollected: collectionId não pode ser vazio.');
  }

  try {
    var sheet = getSheet(SHEET_NAMES.SCHEDULE);
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === collectionId) {
        var row = i + 1;
        var plannedDate = data[i][4];
        var delayDays = 0;

        if (plannedDate instanceof Date && actualDate instanceof Date) {
          var diff = actualDate.getTime() - plannedDate.getTime();
          delayDays = Math.round(diff / (1000 * 60 * 60 * 24));
        }

        sheet.getRange(row, 6).setValue(actualDate);           // Actual_Date
        sheet.getRange(row, 7).setValue(delayDays);            // Delay_Days
        sheet.getRange(row, 8).setValue('Collected');          // Status
        sheet.getRange(row, 10).setValue(collector || '');     // Collector

        return;
      }
    }

    throw new Error('markAsCollected: collectionId "' + collectionId + '" não encontrado.');

  } catch (e) {
    logError('Schedule', 'markAsCollected', e);
    throw e;
  }
}


/**
 * Verifica coletas atrasadas e retorna lista para notificação.
 * Uma coleta é atrasada se Planned_Date < hoje e Status = 'Planned'.
 * @returns {Object[]}
 * [{ collectionId, pointId, sector, fullName, plannedDate, delayDays }]
 */
function getOverdueCollections() {
  try {
    var sheet = getSheet(SHEET_NAMES.SCHEDULE);
    var data = sheet.getDataRange().getValues();
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    // Grace period: número de dias de tolerância após a data prevista
    // antes de considerar a coleta como atrasada. Lido do CONFIG.
    var graceDays = 7;
    try {
      var configSheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName('CONFIG');
      if (configSheet) {
        var configData = configSheet.getDataRange().getValues();
        for (var c = 0; c < configData.length; c++) {
          if (String(configData[c][0]) === 'Collection_Grace_Days') {
            var parsed = parseInt(configData[c][1], 10);
            if (!isNaN(parsed) && parsed >= 0) graceDays = parsed;
            break;
          }
        }
      }
    } catch (e) {
      // Se CONFIG inacessível, mantém o valor padrão de 7 dias
    }

    var graceDeadline = new Date(today);
    graceDeadline.setDate(graceDeadline.getDate() - graceDays);

    var overdue = [];

    for (var i = 1; i < data.length; i++) {
      var status = String(data[i][7]);
      var plannedDate = data[i][4];

      if (status !== 'Planned') continue;
      if (!(plannedDate instanceof Date) || isNaN(plannedDate)) continue;

      var planned = new Date(plannedDate);
      planned.setHours(0, 0, 0, 0);

      if (planned < graceDeadline) {
        var delayDays = Math.round((today - planned) / (1000 * 60 * 60 * 24));

        overdue.push({
          collectionId: String(data[i][0]),
          pointId: String(data[i][1]),
          sector: String(data[i][2]),
          fullName: String(data[i][3]),
          plannedDate: formatDate(plannedDate),
          delayDays: delayDays
        });
      }
    }

    return overdue;

  } catch (e) {
    logError('Schedule', 'getOverdueCollections', e);
    throw e;
  }
}


/**
 * Busca o collectionId correspondente a um ponto e mês/ano de coleta.
 * Usado por Results.gs ao registrar um resultado para vincular ao cronograma.
 * @param  {string} pointId
 * @param  {Date}   collectionDate
 * @returns {string|null}  collectionId ou null se não encontrado
 */
function findCollectionId(pointId, collectionDate) {
  if (isEmpty(pointId) || !(collectionDate instanceof Date)) {
    throw new Error('findCollectionId: argumentos inválidos.');
  }

  try {
    var sheet = getSheet(SHEET_NAMES.SCHEDULE);
    var data = sheet.getDataRange().getValues();
    var colMonth = collectionDate.getMonth();
    var colYear = collectionDate.getFullYear();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]) !== pointId) continue;

      var plannedDate = data[i][4];
      if (!(plannedDate instanceof Date)) continue;

      // Compara por mês e ano — o analista pode coletar em qualquer dia do mês
      if (plannedDate.getMonth() === colMonth &&
        plannedDate.getFullYear() === colYear) {
        return String(data[i][0]);
      }
    }

    return null;

  } catch (e) {
    logError('Schedule', 'findCollectionId', e);
    throw e;
  }
}