// =============================================================================
// Report.gs
// Geração do relatório mensal em PDF e salvamento no Drive.
// Dependências: Config.gs, Results.gs, Actions.gs, Schedule.gs, Utils.gs
// Usada por: Code.gs (trigger mensal)
// =============================================================================


/**
 * Compila os dados do mês para o relatório.
 * @param  {number} month  1–12
 * @param  {number} year
 * @returns {Object}
 * {
 *   totalResults:      number,
 *   conforming:        number,
 *   alert:             number,
 *   nonConforming:     number,
 *   critical:          number,
 *   conformityRate:    number,
 *   scheduleAdherence: number,
 *   openActions:       number,
 *   overdueActions:    number,
 *   ncDetails:         Object[]
 * }
 */
function compileMonthlyData(month, year) {
  if (typeof month !== 'number' || month < 1 || month > 12) {
    throw new Error('compileMonthlyData: mês inválido — ' + month);
  }
  if (typeof year !== 'number' || year < 2020) {
    throw new Error('compileMonthlyData: ano inválido — ' + year);
  }

  try {
    // ---- Resultados do mês ----
    var resultsSheet = getSheet(SHEET_NAMES.RESULTS);
    var resultsData  = resultsSheet.getDataRange().getValues();

    var totals = { total: 0, conforming: 0, alert: 0, nonConforming: 0, critical: 0 };
    var ncDetails = [];

    for (var i = 1; i < resultsData.length; i++) {
      var row = resultsData[i];

      // Ignora retificações
      if (row[12] === true || String(row[12]).toUpperCase() === 'TRUE') continue;

      var colDate = row[4] instanceof Date ? row[4] : new Date(row[4]);
      if (colDate.getMonth() + 1 !== month || colDate.getFullYear() !== year) continue;

      totals.total++;
      var status = String(row[10]);

      if (status === 'Conforming')     totals.conforming++;
      else if (status === 'Alert')     totals.alert++;
      else if (status === 'Non-Conforming') {
        totals.nonConforming++;
        ncDetails.push(_buildNcDetail(row));
      }
      else if (status === 'Critical') {
        totals.critical++;
        ncDetails.push(_buildNcDetail(row));
      }
    }

    var conformityRate = totals.total > 0
      ? Math.round((totals.conforming / totals.total) * 100)
      : 100;

    // ---- Aderência ao cronograma ----
    var scheduleSheet = getSheet(SHEET_NAMES.SCHEDULE);
    var scheduleData  = scheduleSheet.getDataRange().getValues();
    var planned = 0, collected = 0;

    for (var j = 1; j < scheduleData.length; j++) {
      var plannedDate = scheduleData[j][4];
      if (!(plannedDate instanceof Date)) continue;
      if (plannedDate.getMonth() + 1 !== month || plannedDate.getFullYear() !== year) continue;

      planned++;
      if (String(scheduleData[j][7]) === 'Collected') collected++;
    }

    var scheduleAdherence = planned > 0
      ? Math.round((collected / planned) * 100)
      : 100;

    // ---- Ações abertas e vencidas ----
    var actionsSheet = getSheet(SHEET_NAMES.ACTIONS);
    var actionsData  = actionsSheet.getDataRange().getValues();
    var openActions = 0, overdueActions = 0;
    var today = new Date();

    for (var k = 1; k < actionsData.length; k++) {
      var actionStatus = String(actionsData[k][8]);
      if (actionStatus === 'Open' || actionStatus === 'In Progress') {
        openActions++;
        var deadline = actionsData[k][4];
        if (deadline instanceof Date && deadline < today) overdueActions++;
      }
    }

    return {
      month:             month,
      year:              year,
      totalResults:      totals.total,
      conforming:        totals.conforming,
      alert:             totals.alert,
      nonConforming:     totals.nonConforming,
      critical:          totals.critical,
      conformityRate:    conformityRate,
      scheduleAdherence: scheduleAdherence,
      openActions:       openActions,
      overdueActions:    overdueActions,
      ncDetails:         ncDetails
    };

  } catch (e) {
    logError('Report', 'compileMonthlyData', e);
    throw e;
  }
}


/**
 * Monta o objeto de detalhe de uma NC para o relatório.
 * @param  {Array} row  Linha da aba RESULTS
 * @returns {Object}
 */
function _buildNcDetail(row) {
  return {
    resultId:       String(row[0]),
    pointId:        String(row[2]),
    collectionDate: row[4] instanceof Date ? formatDate(row[4]) : String(row[4]),
    assay:          String(row[5]),
    result:         Number(row[6]),
    limit:          Number(row[8]),
    percentage:     Number(row[9]),
    status:         String(row[10]),
    analyst:        String(row[11])
  };
}


/**
 * Gera o HTML do relatório mensal.
 * @param  {Object} data  Retorno de compileMonthlyData()
 * @returns {string}       HTML completo do relatório
 */
function _buildReportHtml(data) {
  var monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  var monthLabel = monthNames[data.month - 1] + ' ' + data.year;

  var conformityColor  = data.conformityRate >= 95  ? '#2e7d32' : '#c62828';
  var adherenceColor   = data.scheduleAdherence >= 90 ? '#2e7d32' : '#c62828';
  var openActionsColor = data.openActions === 0 ? '#2e7d32' : '#e65100';
  var overdueColor     = data.overdueActions === 0 ? '#2e7d32' : '#c62828';

  // KPI cards
  var kpis =
    _kpiCard('Conformity Rate',    data.conformityRate + '%',    conformityColor) +
    _kpiCard('Schedule Adherence', data.scheduleAdherence + '%', adherenceColor) +
    _kpiCard('Open Actions',       data.openActions,             openActionsColor) +
    _kpiCard('Overdue Actions',    data.overdueActions,          overdueColor);

  // Tabela de resultados
  var resultsSummary =
    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px">' +
    '<thead><tr style="background:#e8f5e9">' +
    '<th style="padding:8px;text-align:left">Status</th>' +
    '<th style="padding:8px;text-align:center">Count</th>' +
    '<th style="padding:8px;text-align:center">% of total</th>' +
    '</tr></thead><tbody>' +
    _resultRow('Conforming',     data.conforming,    data.totalResults, '#2e7d32') +
    _resultRow('Alert',          data.alert,         data.totalResults, '#f9a825') +
    _resultRow('Non-Conforming', data.nonConforming, data.totalResults, '#e65100') +
    _resultRow('Critical',       data.critical,      data.totalResults, '#c62828') +
    '<tr style="font-weight:700;background:#f5f5f5">' +
    '<td style="padding:8px">Total</td>' +
    '<td style="padding:8px;text-align:center">' + data.totalResults + '</td>' +
    '<td style="padding:8px;text-align:center">100%</td>' +
    '</tr></tbody></table>';

  // Tabela de NCs
  var ncTable = '';
  if (data.ncDetails.length > 0) {
    var ncRows = data.ncDetails.map(function(nc) {
      var color = nc.status === 'Critical' ? '#c62828' : '#e65100';
      return '<tr>' +
        '<td style="padding:6px 8px;border-bottom:1px solid #eee">' + nc.collectionDate + '</td>' +
        '<td style="padding:6px 8px;border-bottom:1px solid #eee">' + nc.pointId + '</td>' +
        '<td style="padding:6px 8px;border-bottom:1px solid #eee">' + nc.assay + '</td>' +
        '<td style="padding:6px 8px;border-bottom:1px solid #eee">' + nc.result + '</td>' +
        '<td style="padding:6px 8px;border-bottom:1px solid #eee">' + nc.limit + '</td>' +
        '<td style="padding:6px 8px;border-bottom:1px solid #eee;color:' + color + ';font-weight:700">' + nc.percentage + '%</td>' +
        '<td style="padding:6px 8px;border-bottom:1px solid #eee;color:' + color + '">' + nc.status + '</td>' +
        '</tr>';
    }).join('');

    ncTable =
      '<h3 style="color:#c62828;font-size:14px">Non-Conforming and Critical Results</h3>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
      '<thead><tr style="background:#ffebee">' +
      '<th style="padding:6px 8px;text-align:left">Date</th>' +
      '<th style="padding:6px 8px;text-align:left">Point</th>' +
      '<th style="padding:6px 8px;text-align:left">Assay</th>' +
      '<th style="padding:6px 8px;text-align:left">Result</th>' +
      '<th style="padding:6px 8px;text-align:left">Limit</th>' +
      '<th style="padding:6px 8px;text-align:left">% Limit</th>' +
      '<th style="padding:6px 8px;text-align:left">Status</th>' +
      '</tr></thead><tbody>' + ncRows + '</tbody></table>';
  }

  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<style>body{font-family:Arial,sans-serif;color:#333;margin:0;padding:0}' +
    '.kpi-row{display:flex;gap:12px;margin-bottom:20px}' +
    '.kpi{flex:1;padding:14px;border-radius:6px;text-align:center;background:#f5f5f5}' +
    '.kpi .val{font-size:28px;font-weight:700;margin:4px 0}' +
    '.kpi .lbl{font-size:11px;text-transform:uppercase;color:#777}' +
    '</style></head><body>' +
    '<div style="padding:28px;max-width:800px;margin:0 auto">' +
    '<h1 style="font-size:18px;color:#2e7d32;border-bottom:2px solid #2e7d32;padding-bottom:8px">' +
    'Environmental Monitoring Report — ' + monthLabel + '</h1>' +
    '<div class="kpi-row">' + kpis + '</div>' +
    '<h3 style="font-size:14px;color:#37474f">Results Summary</h3>' +
    resultsSummary +
    ncTable +
    '<p style="font-size:11px;color:#aaa;margin-top:30px">' +
    'Generated automatically by the Environmental Monitoring System on ' +
    formatDate(new Date()) + '</p>' +
    '</div></body></html>';
}


/**
 * Retorna o HTML de um card KPI.
 */
function _kpiCard(label, value, color) {
  return '<div class="kpi" style="border-left:4px solid ' + color + '">' +
    '<div class="val" style="color:' + color + '">' + value + '</div>' +
    '<div class="lbl">' + label + '</div>' +
    '</div>';
}


/**
 * Retorna o HTML de uma linha da tabela de resumo de resultados.
 */
function _resultRow(label, count, total, color) {
  var pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return '<tr>' +
    '<td style="padding:8px;color:' + color + ';font-weight:600">' + label + '</td>' +
    '<td style="padding:8px;text-align:center">' + count + '</td>' +
    '<td style="padding:8px;text-align:center">' + pct + '%</td>' +
    '</tr>';
}


/**
 * Gera o relatório mensal em PDF e salva no Drive.
 * Cria a estrutura de pastas Year/Month automaticamente.
 * @param  {number} month  1–12
 * @param  {number} year
 * @returns {string}  URL do arquivo gerado no Drive
 */
function generateMonthlyReport(month, year) {
  try {
    var data     = compileMonthlyData(month, year);
    var html     = _buildReportHtml(data);
    var monthNames = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];
    var monthLabel = monthNames[month - 1] + '_' + year;
    var fileName   = 'EMR_' + monthLabel + '.pdf';

    // Converte HTML para blob PDF
    var blob = HtmlService
      .createHtmlOutput(html)
      .getBlob()
      .setName(fileName)
      .getAs('application/pdf');

    // Salva no Drive na pasta Reports/Year/
    var folder  = _getOrCreateFolder(String(year));
    var file    = folder.createFile(blob);
    var fileUrl = file.getUrl();

    writeLog({
      event:           'Monthly report generated',
      referenceId:     fileName,
      generatedStatus: data.conformityRate + '% conformity',
      triggeredAction: 'Saved to Drive: ' + fileUrl,
      user:            'system'
    });

    return fileUrl;

  } catch (e) {
    logError('Report', 'generateMonthlyReport', e);
    throw e;
  }
}


/**
 * Retorna a pasta do ano dentro de "Environmental Monitoring Reports" no Drive.
 * Cria as pastas se não existirem.
 * @param  {string} yearFolder  Ex: '2025'
 * @returns {GoogleAppsScript.Drive.Folder}
 */
function _getOrCreateFolder(yearFolder) {
  var root    = DriveApp.getRootFolder();
  var rootName = 'Environmental Monitoring Reports';

  // Pasta raiz
  var rootFolders = root.getFoldersByName(rootName);
  var parent = rootFolders.hasNext()
    ? rootFolders.next()
    : root.createFolder(rootName);

  // Subpasta do ano
  var yearFolders = parent.getFoldersByName(yearFolder);
  return yearFolders.hasNext()
    ? yearFolders.next()
    : parent.createFolder(yearFolder);
}