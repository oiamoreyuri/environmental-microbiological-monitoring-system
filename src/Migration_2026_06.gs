// =============================================================================
// Migration_2026_06.gs
// One-time migration: update SAMPLING_POINTS tab (June 2026).
// Run _devMigrateSamplingPoints_2026_06() from the Apps Script editor.
// DELETE THIS FILE after confirming the migration.
// =============================================================================

/**
 * DIAGNÓSTICO — Executa ANTES da migração para verificar estado atual.
 * NÃO altera nenhum dado.
 */
function _devCheckMigrationState() {
  var SSID = '11k1anTHUIVDoZ5JWNPFTHn_HxHph9Q32uyx4azHqqkI';
  var ss = SpreadsheetApp.openById(SSID);
  var sheet = ss.getSheetByName('SAMPLING_POINTS');
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });

  Logger.log('=== DIAGNÓSTICO SAMPLING_POINTS ===');
  Logger.log('Headers: ' + JSON.stringify(headers));
  Logger.log('Total rows (incl. header): ' + data.length);

  var pidCol = headers.indexOf('POINT_ID');
  var secCol = headers.indexOf('Sector');
  var actCol = headers.indexOf('Active');
  var freqCol = headers.indexOf('Frequency');
  Logger.log('Column indices — POINT_ID:' + pidCol + ' Sector:' + secCol + ' Active:' + actCol + ' Frequency:' + freqCol);

  // Check which of the 28 delete targets still exist
  var toDelete = [
    'PREP-01-PAR-PIS-01','PREP-02-PAR-PIS-01','PREP-03-PAR-PIS-01',
    'PREP-04-TQ-MIS-01','PREP-04-TQ-ARM-I-01','PREP-04-TQ-ARM-II-01',
    'PREP-04-TQ-EQU-01','PREP-04-PLA-DIS-01','PREP-04-TUB-EXT-01',
    'PREP-04-TQ-EXT-01','PREP-04-AR-AMB-01','PREP-04-PAR-PIS-01',
    'PREP-04-ESC-COR-01',
    'ENV-01-PAR-PIS-01','ENV-02-PAR-PIS-01','ENV-02-BAL-01',
    'ENV-03-PAR-PIS-01','ENV-04-PEN-VIB-01','ENV-04-UTE-01',
    'ENV-04-BAL-01','ENV-04-ESC-RAS-01','ENV-04-AR-AMB-01','ENV-04-PAR-PIS-01',
    'SD-01-PAR-PIS-01','SD-02-PAR-PIS-01','SD-03-PAR-PIS-01',
    'SD-04-PAR-PIS-01','SD-PIL-PAR-PIS-01'
  ];
  var deleteSet = {};
  toDelete.forEach(function(id) { deleteSet[id] = true; });

  var stillPresent = [];
  var oldSectors = {};
  var newRowsPresent = [];
  var newIds = _getNewPointIds();
  var newIdSet = {};
  newIds.forEach(function(id) { newIdSet[id] = true; });

  var activeCount = 0;
  var frequencies = {};

  for (var i = 1; i < data.length; i++) {
    var pid = String(data[i][pidCol]).trim();
    var sec = String(data[i][secCol]).trim();
    var act = data[i][actCol];

    if (deleteSet[pid]) stillPresent.push(pid);
    if (newIdSet[pid]) newRowsPresent.push(pid);
    if (sec === 'SD 1' || sec === 'SD 2' || sec === 'SD 3' || sec === 'SD 4' || sec === 'SD Piloto') {
      oldSectors[sec] = (oldSectors[sec] || 0) + 1;
    }
    if (act === true || String(act).toUpperCase() === 'TRUE') activeCount++;
    if (freqCol !== -1) {
      var f = String(data[i][freqCol]).trim();
      frequencies[f] = (frequencies[f] || 0) + 1;
    }
  }

  Logger.log('--- DELETE targets still present: ' + stillPresent.length + '/28 ---');
  if (stillPresent.length > 0) Logger.log('  IDs: ' + stillPresent.join(', '));

  Logger.log('--- OLD sector names still present ---');
  for (var s in oldSectors) Logger.log('  "' + s + '": ' + oldSectors[s] + ' rows');
  if (Object.keys(oldSectors).length === 0) Logger.log('  (none — already renamed)');

  Logger.log('--- NEW rows already inserted: ' + newRowsPresent.length + '/111 ---');

  Logger.log('--- Active points: ' + activeCount + ' ---');

  Logger.log('--- Frequency distribution ---');
  for (var f in frequencies) Logger.log('  "' + f + '": ' + frequencies[f]);

  Logger.log('=== FIM DIAGNÓSTICO ===');
}


/**
 * PATCH 2026-06-04 — Corrige nomes de setores e Full_Name.
 * Altera: Extração/Evaporação I→1, II→2; Tanque I→1, II→2;
 * Homogeneizador I→1, II→2; Balança I→1; Tanque de Armazenamento I→1, II→2.
 */
function _devPatchNames_2026_06_04() {
  var SSID = '11k1anTHUIVDoZ5JWNPFTHn_HxHph9Q32uyx4azHqqkI';
  var ss = SpreadsheetApp.openById(SSID);
  var sheet = ss.getSheetByName('SAMPLING_POINTS');
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });

  var pidCol = headers.indexOf('POINT_ID');
  var secCol = headers.indexOf('Sector');
  var nameCol = headers.indexOf('Full_Name');
  Logger.log('Columns — POINT_ID:' + pidCol + ' Sector:' + secCol + ' Full_Name:' + nameCol);

  // Map: POINT_ID → { sector: newValue, name: newValue }
  var patches = {
    // EXT-I: Sector → "Extração/Evaporação 1"
    'EXT-I-EVA-01':     { sector: 'Extração/Evaporação 1' },
    'EXT-I-DEC-01':     { sector: 'Extração/Evaporação 1' },
    'EXT-I-TQ-I-01':    { sector: 'Extração/Evaporação 1', name: 'Tanque 1' },
    'EXT-I-TQ-II-01':   { sector: 'Extração/Evaporação 1', name: 'Tanque 2' },
    'EXT-I-BOM-SUC-01': { sector: 'Extração/Evaporação 1' },
    'EXT-I-PAS-01':     { sector: 'Extração/Evaporação 1' },
    'EXT-I-TUB-EXT-01': { sector: 'Extração/Evaporação 1' },
    'EXT-I-TQ-EXT-01':  { sector: 'Extração/Evaporação 1' },
    'EXT-I-AR-AMB-01':  { sector: 'Extração/Evaporação 1' },
    'EXT-I-PAR-01':     { sector: 'Extração/Evaporação 1' },
    'EXT-I-PISO-01':    { sector: 'Extração/Evaporação 1' },
    'EXT-I-RALO-01':    { sector: 'Extração/Evaporação 1' },
    // EXT-II: Sector → "Extração/Evaporação 2"
    'EXT-II-EVA-01':     { sector: 'Extração/Evaporação 2' },
    'EXT-II-DEC-01':     { sector: 'Extração/Evaporação 2' },
    'EXT-II-TQ-I-01':    { sector: 'Extração/Evaporação 2', name: 'Tanque 1' },
    'EXT-II-TQ-II-01':   { sector: 'Extração/Evaporação 2', name: 'Tanque 2' },
    'EXT-II-BOM-SUC-01': { sector: 'Extração/Evaporação 2' },
    'EXT-II-PAS-01':     { sector: 'Extração/Evaporação 2' },
    'EXT-II-TUB-EXT-01': { sector: 'Extração/Evaporação 2' },
    'EXT-II-TQ-EXT-01':  { sector: 'Extração/Evaporação 2' },
    'EXT-II-AR-AMB-01':  { sector: 'Extração/Evaporação 2' },
    'EXT-II-PAR-01':     { sector: 'Extração/Evaporação 2' },
    'EXT-II-PISO-01':    { sector: 'Extração/Evaporação 2' },
    'EXT-II-RALO-01':    { sector: 'Extração/Evaporação 2' },
    // HOM: Full_Name
    'HOM-HOM-I-01':  { name: 'Homogeneizador 1' },
    'HOM-HOM-II-01': { name: 'Homogeneizador 2' },
    // PREP: Full_Name
    'PREP-01-TQ-ARM-I-01':  { name: 'Tanque de Armazenamento 1' },
    'PREP-01-TQ-ARM-II-01': { name: 'Tanque de Armazenamento 2' },
    'PREP-02-TQ-ARM-I-01':  { name: 'Tanque de Armazenamento 1' },
    'PREP-02-TQ-ARM-II-01': { name: 'Tanque de Armazenamento 2' },
    'PREP-03-TQ-ARM-I-01':  { name: 'Tanque de Armazenamento 1' },
    'PREP-03-TQ-ARM-II-01': { name: 'Tanque de Armazenamento 2' },
    // ENV-02: Full_Name
    'ENV-02-BAL-I-01': { name: 'Balança 1' }
  };

  var changedCells = 0;
  for (var i = 1; i < data.length; i++) {
    var pid = String(data[i][pidCol]).trim();
    var patch = patches[pid];
    if (!patch) continue;

    if (patch.sector) {
      var oldSec = String(data[i][secCol]).trim();
      if (oldSec !== patch.sector) {
        sheet.getRange(i + 1, secCol + 1).setValue(patch.sector);
        changedCells++;
        Logger.log('  ' + pid + ' Sector: "' + oldSec + '" → "' + patch.sector + '"');
      }
    }
    if (patch.name) {
      var oldName = String(data[i][nameCol]).trim();
      if (oldName !== patch.name) {
        sheet.getRange(i + 1, nameCol + 1).setValue(patch.name);
        changedCells++;
        Logger.log('  ' + pid + ' Full_Name: "' + oldName + '" → "' + patch.name + '"');
      }
    }
  }

  Logger.log('===================================');
  Logger.log('Patch complete. Cells changed: ' + changedCells);
  Logger.log('===================================');
}


/**
 * Executa a migração da aba SAMPLING_POINTS:
 * 0.5) Cleanup — remove linhas inseridas por execução anterior (idempotente)
 * 1) SKIP — deleções já executadas em run anterior
 * 2) SKIP — renomeações já executadas em run anterior
 * 2.5) Verifica/adiciona Biweekly à validação da coluna Frequency
 * 3) Adiciona 111 novas linhas (com booleans nativos)
 * 4) Loga total de pontos ativos
 */
function _devMigrateSamplingPoints_2026_06() {
  var SSID = '11k1anTHUIVDoZ5JWNPFTHn_HxHph9Q32uyx4azHqqkI';
  var ss = SpreadsheetApp.openById(SSID);
  var sheet = ss.getSheetByName('SAMPLING_POINTS');

  if (!sheet) {
    Logger.log('ERROR: aba SAMPLING_POINTS não encontrada.');
    return;
  }

  // --- Step 0: Read headers and build column map ---
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  Logger.log('Headers: ' + JSON.stringify(headers));
  Logger.log('Rows before migration (incl. header): ' + data.length);

  var colMap = {};
  for (var c = 0; c < headers.length; c++) {
    colMap[headers[c]] = c;
  }

  var pidCol = _findCol(colMap, ['POINT_ID']);
  var actCol = _findCol(colMap, ['Active']);
  var freqCol = _findCol(colMap, ['Frequency']);

  if (pidCol === -1) { Logger.log('ERROR: coluna POINT_ID não encontrada.'); return; }
  if (actCol === -1) { Logger.log('ERROR: coluna Active não encontrada.'); return; }
  Logger.log('Column Active at index: ' + actCol);
  Logger.log('Column Frequency at index: ' + freqCol);

  // --- Step 0.5: Cleanup — remove new rows from a previous partial run ---
  var newPointIds = _getNewPointIds();
  var cleanupSet = {};
  newPointIds.forEach(function(id) { cleanupSet[id] = true; });
  var cleanedCount = 0;
  for (var i = data.length - 1; i >= 1; i--) {
    var cpid = String(data[i][pidCol]).trim();
    if (cleanupSet[cpid]) {
      sheet.deleteRow(i + 1);
      cleanedCount++;
    }
  }
  Logger.log('Step 0.5 — Cleaned up ' + cleanedCount + ' rows from previous run.');

  // --- Steps 1 & 2: SKIP (already completed) ---
  Logger.log('Steps 1 & 2 — SKIPPED (deletions and renames already completed).');

  // --- Step 2.5: Ensure Biweekly is in Frequency column validation ---
  if (freqCol !== -1) {
    var freqRange = sheet.getRange(2, freqCol + 1);
    var freqRule = freqRange.getDataValidation();
    if (freqRule) {
      var criteriaType = freqRule.getCriteriaType();
      var criteriaValues = freqRule.getCriteriaValues();
      Logger.log('Frequency validation type: ' + criteriaType);
      Logger.log('Frequency validation values: ' + JSON.stringify(criteriaValues));

      if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
        var freqList = criteriaValues[0];
        if (freqList.indexOf('Biweekly') === -1) {
          freqList.push('Biweekly');
          var newFreqRule = SpreadsheetApp.newDataValidation()
            .requireValueInList(freqList, true)
            .setAllowInvalid(false)
            .build();
          var lastRow = sheet.getMaxRows();
          sheet.getRange(2, freqCol + 1, lastRow - 1).setDataValidation(newFreqRule);
          Logger.log('Step 2.5 — Added Biweekly to Frequency validation.');
        } else {
          Logger.log('Step 2.5 — Biweekly already in Frequency validation.');
        }
      } else {
        Logger.log('Step 2.5 — Frequency validation is not VALUE_IN_LIST, skipping.');
      }
    } else {
      Logger.log('Step 2.5 — No data validation on Frequency column.');
    }
  }

  // --- Step 2.6: Temporarily remove Active column validation for insert ---
  var activeValidation = null;
  if (actCol !== -1) {
    var actRange = sheet.getRange(2, actCol + 1);
    activeValidation = actRange.getDataValidation();
    if (activeValidation) {
      Logger.log('Step 2.6 — Active column has validation. Temporarily removing for insert.');
      var lastRow = sheet.getMaxRows();
      sheet.getRange(2, actCol + 1, lastRow - 1).clearDataValidations();
    }
  }

  // --- Step 3: Add new rows ---
  var newRows = _buildNewRows(colMap, headers.length);
  if (newRows.length === 0) {
    Logger.log('ERROR: nenhuma linha nova gerada.');
    return;
  }

  // Verify boolean types in first row before insert
  var sampleRow = newRows[0];
  Logger.log('Step 3 — Sample row[0] Active (col ' + actCol + '): value=' + sampleRow[actCol] + ' type=' + typeof sampleRow[actCol]);
  var lsalCol = _findCol(colMap, ['Limit_SAL']);
  if (lsalCol !== -1) {
    Logger.log('Step 3 — Sample row[0] Limit_SAL (col ' + lsalCol + '): value=' + sampleRow[lsalCol] + ' type=' + typeof sampleRow[lsalCol]);
  }

  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, newRows.length, headers.length).setValues(newRows);
  Logger.log('Step 3 — Added ' + newRows.length + ' new rows.');

  // --- Step 3.5: Restore Active column validation ---
  if (activeValidation) {
    var lastRow = sheet.getMaxRows();
    sheet.getRange(2, actCol + 1, lastRow - 1).setDataValidation(activeValidation);
    Logger.log('Step 3.5 — Restored Active column validation.');
  }

  // --- Step 4: Count active points ---
  data = sheet.getDataRange().getValues();
  var activeCount = 0;
  for (var i = 1; i < data.length; i++) {
    var val = data[i][actCol];
    if (val === true || String(val).toUpperCase() === 'TRUE') {
      activeCount++;
    }
  }
  Logger.log('===================================');
  Logger.log('Migration complete.');
  Logger.log('Total rows (excl. header): ' + (data.length - 1));
  Logger.log('Total ACTIVE points: ' + activeCount);
  Logger.log('===================================');
}


/** Helper: find column index by name variants. Returns -1 if not found. */
function _findCol(colMap, names) {
  for (var i = 0; i < names.length; i++) {
    if (colMap[names[i]] !== undefined) return colMap[names[i]];
  }
  return -1;
}


/** Helper: build a sheet row array from a data object, using colMap. */
function _makeRow(obj, colMap, numCols) {
  var row = [];
  for (var i = 0; i < numCols; i++) row.push('');
  for (var key in obj) {
    if (colMap[key] !== undefined) {
      row[colMap[key]] = obj[key];
    }
  }
  return row;
}


/** Builds all 111 new rows mapped to the actual sheet columns. */
function _buildNewRows(colMap, numCols) {
  var rows = [];

  function add(pid, sector, zone, area, lma, lbl, lsal, active, name, freq) {
    rows.push(_makeRow({
      'POINT_ID': pid, 'Sector': sector, 'Zone': zone, 'Area': area,
      'Limit_MA': lma, 'Limit_BL': lbl, 'Limit_SAL': lsal,
      'Active': active, 'Full_Name': name, 'Frequency': freq
    }, colMap, numCols));
  }

  // --- Sala de Preparo 1 ---
  add('PREP-01-PAR-01','Sala de Preparo 1','A',3,250,100,true,true,'Parede','Quarterly');
  add('PREP-01-PISO-01','Sala de Preparo 1','A',3,250,100,true,true,'Piso','Quarterly');
  add('PREP-01-RALO-01','Sala de Preparo 1','A',3,250,100,true,true,'Ralo','Quarterly');

  // --- Sala de Preparo 2 ---
  add('PREP-02-PAR-01','Sala de Preparo 2','A',3,250,100,true,true,'Parede','Quarterly');
  add('PREP-02-PISO-01','Sala de Preparo 2','A',3,250,100,true,true,'Piso','Quarterly');
  add('PREP-02-RALO-01','Sala de Preparo 2','A',3,250,100,true,true,'Ralo','Quarterly');

  // --- Sala de Preparo 3 ---
  add('PREP-03-PAR-01','Sala de Preparo 3','A',3,250,100,true,true,'Parede','Quarterly');
  add('PREP-03-PISO-01','Sala de Preparo 3','A',3,250,100,true,true,'Piso','Quarterly');
  add('PREP-03-RALO-01','Sala de Preparo 3','A',3,250,100,true,true,'Ralo','Quarterly');

  // --- Sala de Envase 1 ---
  add('ENV-01-PAR-01','Sala de Envase 1','A',3,250,100,true,true,'Parede','Quarterly');
  add('ENV-01-PISO-01','Sala de Envase 1','A',3,250,100,true,true,'Piso','Quarterly');
  add('ENV-01-RALO-01','Sala de Envase 1','A',3,250,100,true,true,'Ralo','Quarterly');
  add('ENV-01-ESC-COR-01','Sala de Envase 1','A',3,250,100,false,true,'Escada/Corrimão','Quarterly');

  // --- Sala de Envase 2 ---
  add('ENV-02-BAL-I-01','Sala de Envase 2','A',2,250,100,false,true,'Balança 1','Monthly');
  add('ENV-02-BAL-02','Sala de Envase 2','A',2,250,100,false,true,'Balança II','Monthly');
  add('ENV-02-PAR-01','Sala de Envase 2','A',3,250,100,true,true,'Parede','Quarterly');
  add('ENV-02-PISO-01','Sala de Envase 2','A',3,250,100,true,true,'Piso','Quarterly');
  add('ENV-02-RALO-01','Sala de Envase 2','A',3,250,100,true,true,'Ralo','Quarterly');
  add('ENV-02-ESC-COR-01','Sala de Envase 2','A',3,250,100,false,true,'Escada/Corrimão','Quarterly');

  // --- Sala de Envase 3 ---
  add('ENV-03-PAR-01','Sala de Envase 3','A',3,250,100,true,true,'Parede','Quarterly');
  add('ENV-03-PISO-01','Sala de Envase 3','A',3,250,100,true,true,'Piso','Quarterly');
  add('ENV-03-RALO-01','Sala de Envase 3','A',3,250,100,true,true,'Ralo','Quarterly');
  add('ENV-03-ESC-COR-01','Sala de Envase 3','A',3,250,100,false,true,'Escada/Corrimão','Quarterly');

  // --- Spray Dryer 1 ---
  add('SD-01-CUR-EXT-01','Spray Dryer 1','A',2,250,100,false,true,'Curva Externa','Quarterly');
  add('SD-01-PAR-01','Spray Dryer 1','A',3,250,100,true,true,'Parede','Biannual');
  add('SD-01-PISO-01','Spray Dryer 1','A',3,250,100,true,true,'Piso','Biannual');
  add('SD-01-RALO-01','Spray Dryer 1','A',3,250,100,true,true,'Ralo','Biannual');

  // --- Spray Dryer 2 ---
  add('SD-02-TUB-EXT-01','Spray Dryer 2','A',2,250,100,false,true,'Tubulação Externa','Quarterly');
  add('SD-02-PAR-01','Spray Dryer 2','A',3,250,100,true,true,'Parede','Biannual');
  add('SD-02-PISO-01','Spray Dryer 2','A',3,250,100,true,true,'Piso','Biannual');
  add('SD-02-RALO-01','Spray Dryer 2','A',3,250,100,true,true,'Ralo','Biannual');

  // --- Spray Dryer 3 ---
  add('SD-03-TUB-EXT-01','Spray Dryer 3','A',2,250,100,false,true,'Tubulação Externa','Quarterly');
  add('SD-03-PAR-01','Spray Dryer 3','A',3,250,100,true,true,'Parede','Biannual');
  add('SD-03-PISO-01','Spray Dryer 3','A',3,250,100,true,true,'Piso','Biannual');
  add('SD-03-RALO-01','Spray Dryer 3','A',3,250,100,true,true,'Ralo','Biannual');

  // --- Spray Dryer 4 ---
  add('SD-04-PEN-VIB-01','Spray Dryer 4','A',1,50,30,false,true,'Peneira Vibratória','Monthly');
  add('SD-04-UTE-01','Spray Dryer 4','A',1,50,30,false,true,'Utensílio','Monthly');
  add('SD-04-TQ-MIS-01','Spray Dryer 4','A',1,50,30,false,true,'Tanque de Mistura','Monthly');
  add('SD-04-TQ-EQU-01','Spray Dryer 4','A',1,50,30,false,true,'Tanque de Equilíbrio','Monthly');
  add('SD-04-PLA-DIS-01','Spray Dryer 4','A',1,50,30,false,true,'Placa de Distribuição','Monthly');
  add('SD-04-BAL-01','Spray Dryer 4','A',2,250,100,false,true,'Balança','Monthly');
  add('SD-04-TUB-EXT-01','Spray Dryer 4','A',2,250,100,false,true,'Tubulação Externa','Quarterly');
  add('SD-04-TQ-EXT-01','Spray Dryer 4','A',2,250,100,false,true,'Tanque Externo','Quarterly');
  add('SD-04-ESC-COR-01','Spray Dryer 4','A',3,250,100,false,true,'Escada/Corrimão','Quarterly');
  add('SD-04-PAR-01','Spray Dryer 4','A',3,250,100,true,true,'Parede','Quarterly');
  add('SD-04-PISO-01','Spray Dryer 4','A',3,250,100,true,true,'Piso','Quarterly');
  add('SD-04-RALO-01','Spray Dryer 4','A',3,250,100,true,true,'Ralo','Quarterly');

  // --- Spray Dryer Piloto ---
  add('SD-PIL-PEN-VIB-01','Spray Dryer Piloto','B',1,100,70,false,true,'Peneira Vibratória','Monthly');
  add('SD-PIL-UTE-01','Spray Dryer Piloto','B',1,100,70,false,true,'Utensílio','Monthly');
  add('SD-PIL-TQ-01','Spray Dryer Piloto','B',1,100,70,false,true,'Tanque','Monthly');
  add('SD-PIL-TQ-EQU-01','Spray Dryer Piloto','B',1,100,70,false,true,'Tanque de Equilíbrio','Monthly');
  add('SD-PIL-PLA-DIS-01','Spray Dryer Piloto','B',1,100,70,false,true,'Placa de Distribuição','Monthly');
  add('SD-PIL-BAL-01','Spray Dryer Piloto','B',2,300,100,false,true,'Balança','Monthly');
  add('SD-PIL-TUB-EXT-01','Spray Dryer Piloto','B',2,300,100,false,true,'Tubulação Externa','Quarterly');
  add('SD-PIL-TQ-EXT-01','Spray Dryer Piloto','B',2,300,100,false,true,'Tanque Externo','Quarterly');
  add('SD-PIL-ESC-COR-01','Spray Dryer Piloto','B',3,300,150,false,true,'Escada/Corrimão','Quarterly');
  add('SD-PIL-PAR-01','Spray Dryer Piloto','B',3,300,150,true,true,'Parede','Quarterly');
  add('SD-PIL-PISO-01','Spray Dryer Piloto','B',3,300,150,true,true,'Piso','Quarterly');
  add('SD-PIL-RALO-01','Spray Dryer Piloto','B',3,300,150,true,true,'Ralo','Quarterly');

  // --- Homogeneização ---
  add('HOM-HOM-I-01','Homogeneização','A',1,50,30,false,true,'Homogeneizador 1','Monthly');
  add('HOM-HOM-II-01','Homogeneização','A',1,50,30,false,true,'Homogeneizador 2','Monthly');
  add('HOM-UTE-01','Homogeneização','A',1,50,30,false,true,'Utensílio','Monthly');
  add('HOM-PEN-01','Homogeneização','A',1,50,30,false,true,'Peneira','Monthly');
  add('HOM-MIS-01','Homogeneização','A',1,50,30,false,true,'Misturador','Monthly');
  add('HOM-MOE-01','Homogeneização','A',1,50,30,false,true,'Moedor','Monthly');
  add('HOM-BAL-01','Homogeneização','A',2,250,100,false,true,'Balança','Monthly');
  add('HOM-AR-AMB-01','Homogeneização','A',2,250,100,false,true,'Ar Ambiente','Monthly');
  add('HOM-PAR-01','Homogeneização','A',3,250,100,true,true,'Parede','Quarterly');
  add('HOM-PISO-01','Homogeneização','A',3,250,100,true,true,'Piso','Quarterly');
  add('HOM-RALO-01','Homogeneização','A',3,250,100,true,true,'Ralo','Quarterly');

  // --- Extração/Evaporação 1 ---
  add('EXT-I-EVA-01','Extração/Evaporação 1','B',1,100,70,false,true,'Evaporador','Monthly');
  add('EXT-I-DEC-01','Extração/Evaporação 1','B',1,100,70,false,true,'Decantador','Monthly');
  add('EXT-I-TQ-I-01','Extração/Evaporação 1','B',1,100,70,false,true,'Tanque 1','Bimonthly');
  add('EXT-I-TQ-II-01','Extração/Evaporação 1','B',1,100,70,false,true,'Tanque 2','Bimonthly');
  add('EXT-I-BOM-SUC-01','Extração/Evaporação 1','B',1,100,70,false,true,'Bomba de Sucção','Biweekly');
  add('EXT-I-PAS-01','Extração/Evaporação 1','B',1,100,70,false,true,'Pasteurizador','Biweekly');
  add('EXT-I-TUB-EXT-01','Extração/Evaporação 1','B',2,300,100,false,true,'Tubulação Externa','Quarterly');
  add('EXT-I-TQ-EXT-01','Extração/Evaporação 1','B',2,300,100,false,true,'Tanque Externo','Quarterly');
  add('EXT-I-AR-AMB-01','Extração/Evaporação 1','B',2,300,100,false,true,'Ar Ambiente','Quarterly');
  add('EXT-I-PAR-01','Extração/Evaporação 1','B',3,300,150,true,true,'Parede','Quarterly');
  add('EXT-I-PISO-01','Extração/Evaporação 1','B',3,300,150,true,true,'Piso','Quarterly');
  add('EXT-I-RALO-01','Extração/Evaporação 1','B',3,300,150,true,true,'Ralo','Quarterly');

  // --- Extração/Evaporação 2 ---
  add('EXT-II-EVA-01','Extração/Evaporação 2','B',1,100,70,false,true,'Evaporador','Monthly');
  add('EXT-II-DEC-01','Extração/Evaporação 2','B',1,100,70,false,true,'Decantador','Monthly');
  add('EXT-II-TQ-I-01','Extração/Evaporação 2','B',1,100,70,false,true,'Tanque 1','Bimonthly');
  add('EXT-II-TQ-II-01','Extração/Evaporação 2','B',1,100,70,false,true,'Tanque 2','Bimonthly');
  add('EXT-II-BOM-SUC-01','Extração/Evaporação 2','B',1,100,70,false,true,'Bomba de Sucção','Biweekly');
  add('EXT-II-PAS-01','Extração/Evaporação 2','B',1,100,70,false,true,'Pasteurizador','Biweekly');
  add('EXT-II-TUB-EXT-01','Extração/Evaporação 2','B',2,300,100,false,true,'Tubulação Externa','Quarterly');
  add('EXT-II-TQ-EXT-01','Extração/Evaporação 2','B',2,300,100,false,true,'Tanque Externo','Quarterly');
  add('EXT-II-AR-AMB-01','Extração/Evaporação 2','B',2,300,100,false,true,'Ar Ambiente','Quarterly');
  add('EXT-II-PAR-01','Extração/Evaporação 2','B',3,300,150,true,true,'Parede','Quarterly');
  add('EXT-II-PISO-01','Extração/Evaporação 2','B',3,300,150,true,true,'Piso','Quarterly');
  add('EXT-II-RALO-01','Extração/Evaporação 2','B',3,300,150,true,true,'Ralo','Quarterly');

  // --- Flash Dryer ---
  add('FD-TQ-ABS-01','Flash Dryer','A',1,50,30,false,true,'Tanque de Abastecimento','Monthly');
  add('FD-ROS-ALI-01','Flash Dryer','A',1,50,30,false,true,'Rosca de Alimentação','Monthly');
  add('FD-SEC-FD-01','Flash Dryer','A',1,50,30,false,true,'Secador Flash Dryer','Monthly');
  add('FD-UTE-01','Flash Dryer','A',1,50,30,false,true,'Utensílios','Monthly');
  add('FD-BAL-01','Flash Dryer','A',2,250,100,false,true,'Balança','Monthly');
  add('FD-AR-AMB-01','Flash Dryer','A',2,250,100,false,true,'Ar Ambiente','Monthly');

  // --- P&D ---
  add('PD-BAN-01','P&D','A',1,50,30,false,true,'Bancada','Monthly');
  add('PD-UTE-01','P&D','A',1,50,30,false,true,'Utensílios','Monthly');
  add('PD-BAL-01','P&D','A',2,250,100,false,true,'Balança','Monthly');
  add('PD-AR-AMB-01','P&D','A',2,250,100,false,true,'Ar Ambiente','Monthly');
  add('PD-PAR-01','P&D','A',3,250,100,true,true,'Parede','Quarterly');
  add('PD-PISO-01','P&D','A',3,250,100,true,true,'Piso','Quarterly');

  // --- Sala Alergênicos ---
  add('ALE-UTE-01','Sala Alergênicos','C',1,100,'',false,true,'Utensílios','Monthly');
  add('ALE-BAL-01','Sala Alergênicos','C',2,350,150,false,true,'Balança','Monthly');
  add('ALE-AR-AMB-01','Sala Alergênicos','C',2,350,150,false,true,'Ar Ambiente','Monthly');
  add('ALE-PAR-01','Sala Alergênicos','C',3,400,200,true,true,'Parede','Quarterly');
  add('ALE-PISO-01','Sala Alergênicos','C',3,400,200,true,true,'Piso','Quarterly');

  Logger.log('_buildNewRows generated ' + rows.length + ' rows.');
  return rows;
}


/** Returns all POINT_IDs that the migration adds (for cleanup). */
function _getNewPointIds() {
  return [
    'PREP-01-PAR-01','PREP-01-PISO-01','PREP-01-RALO-01',
    'PREP-02-PAR-01','PREP-02-PISO-01','PREP-02-RALO-01',
    'PREP-03-PAR-01','PREP-03-PISO-01','PREP-03-RALO-01',
    'ENV-01-PAR-01','ENV-01-PISO-01','ENV-01-RALO-01','ENV-01-ESC-COR-01',
    'ENV-02-BAL-I-01','ENV-02-BAL-02','ENV-02-PAR-01','ENV-02-PISO-01','ENV-02-RALO-01','ENV-02-ESC-COR-01',
    'ENV-03-PAR-01','ENV-03-PISO-01','ENV-03-RALO-01','ENV-03-ESC-COR-01',
    'SD-01-CUR-EXT-01','SD-01-PAR-01','SD-01-PISO-01','SD-01-RALO-01',
    'SD-02-TUB-EXT-01','SD-02-PAR-01','SD-02-PISO-01','SD-02-RALO-01',
    'SD-03-TUB-EXT-01','SD-03-PAR-01','SD-03-PISO-01','SD-03-RALO-01',
    'SD-04-PEN-VIB-01','SD-04-UTE-01','SD-04-TQ-MIS-01','SD-04-TQ-EQU-01','SD-04-PLA-DIS-01',
    'SD-04-BAL-01','SD-04-TUB-EXT-01','SD-04-TQ-EXT-01','SD-04-ESC-COR-01',
    'SD-04-PAR-01','SD-04-PISO-01','SD-04-RALO-01',
    'SD-PIL-PEN-VIB-01','SD-PIL-UTE-01','SD-PIL-TQ-01','SD-PIL-TQ-EQU-01','SD-PIL-PLA-DIS-01',
    'SD-PIL-BAL-01','SD-PIL-TUB-EXT-01','SD-PIL-TQ-EXT-01','SD-PIL-ESC-COR-01',
    'SD-PIL-PAR-01','SD-PIL-PISO-01','SD-PIL-RALO-01',
    'HOM-HOM-I-01','HOM-HOM-II-01','HOM-UTE-01','HOM-PEN-01','HOM-MIS-01','HOM-MOE-01',
    'HOM-BAL-01','HOM-AR-AMB-01','HOM-PAR-01','HOM-PISO-01','HOM-RALO-01',
    'EXT-I-EVA-01','EXT-I-DEC-01','EXT-I-TQ-I-01','EXT-I-TQ-II-01','EXT-I-BOM-SUC-01','EXT-I-PAS-01',
    'EXT-I-TUB-EXT-01','EXT-I-TQ-EXT-01','EXT-I-AR-AMB-01','EXT-I-PAR-01','EXT-I-PISO-01','EXT-I-RALO-01',
    'EXT-II-EVA-01','EXT-II-DEC-01','EXT-II-TQ-I-01','EXT-II-TQ-II-01','EXT-II-BOM-SUC-01','EXT-II-PAS-01',
    'EXT-II-TUB-EXT-01','EXT-II-TQ-EXT-01','EXT-II-AR-AMB-01','EXT-II-PAR-01','EXT-II-PISO-01','EXT-II-RALO-01',
    'FD-TQ-ABS-01','FD-ROS-ALI-01','FD-SEC-FD-01','FD-UTE-01','FD-BAL-01','FD-AR-AMB-01',
    'PD-BAN-01','PD-UTE-01','PD-BAL-01','PD-AR-AMB-01','PD-PAR-01','PD-PISO-01',
    'ALE-UTE-01','ALE-BAL-01','ALE-AR-AMB-01','ALE-PAR-01','ALE-PISO-01'
  ];
}
