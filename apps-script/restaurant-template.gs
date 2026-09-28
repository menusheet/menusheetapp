/**
 * ============================================================
 *  MenuSheet — Restaurant Sheet Apps Script (template)
 * ============================================================
 *  Deploy once per restaurant Google Sheet:
 *    1. Open the restaurant's Google Sheet → Extensions → Apps Script.
 *    2. Paste this entire file over Code.gs.
 *    3. Replace REPLACE_ME below with the current SHARED_SECRET
 *       (same secret as the Cloudflare Worker + Admin Dashboard).
 *    4. Deploy → New deployment → type "Web app".
 *         - Execute as:  Me (<sheet owner account>)
 *         - Who has access: Anyone
 *    5. Copy the /exec URL into the Admin Dashboard row for this
 *       restaurant (appscript_url column).
 *
 *  Endpoints:
 *    GET  ?action=getMenu                       public — full menu JSON
 *    GET  ?action=getSettings&key=SECRET        worker-only — raw Settings
 *    POST {key, action:"updateSettings",        worker-only — overwrite
 *          payload:{menu_active, expiry_date,     Settings tab
 *                   last_synced_at}}
 *
 *  Expected sheet tabs: "Menu" and "Settings" (see docs/sheet-templates/).
 *
 *  First time setup:
 *    Run initSheet() from the Apps Script editor to create the Menu
 *    and Settings tabs with headers and sample data.
 */

var SHARED_SECRET = 'REPLACE_ME';

// ----------------------------------------------------------------
//  initSheet — run once from the editor to set up the spreadsheet
// ----------------------------------------------------------------

function initSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ---- Menu tab ------------------------------------------------
  var menuSh = ss.getSheetByName('Menu');
  if (!menuSh) {
    menuSh = ss.insertSheet('Menu');
  }
  var menuHeaders = ['id', 'category', 'name', 'description', 'price', 'image_url', 'is_veg', 'is_available', 'sort_order'];
  var existingMenuHeaders = [];
  if (menuSh.getLastRow() > 0) {
    existingMenuHeaders = menuSh.getRange(1, 1, 1, menuHeaders.length).getValues()[0].map(function (v) { return String(v).trim().toLowerCase(); });
  }
  var menuHeaderMatch = true;
  for (var h = 0; h < menuHeaders.length; h++) {
    if (existingMenuHeaders[h] !== menuHeaders[h]) { menuHeaderMatch = false; break; }
  }
  if (!menuHeaderMatch) {
    menuSh.clear();
    menuSh.getRange(1, 1, 1, menuHeaders.length).setValues([menuHeaders]).setFontWeight('bold').setBackground('#f0f0f0');
    menuSh.setFrozenRows(1);
    var sampleMenu = [
      ['M001', 'Starters',     'Paneer Tikka',      'Charred cottage cheese, mint chutney',                320, '', 'TRUE',  'TRUE',  1],
      ['M002', 'Starters',     'Chicken 65',         'Crispy fried, curry leaf & chilli',                   340, '', 'FALSE', 'TRUE',  2],
      ['M003', 'Main Course',  'Dal Makhani',        'Slow-cooked black lentils, butter',                   280, '', 'TRUE',  'TRUE',  3],
      ['M004', 'Main Course',  'Butter Chicken',     'Tomato gravy, cream, tandoori chicken',               380, '', 'FALSE', 'TRUE',  4],
      ['M005', 'Beverages',    'Masala Chai',        'House spice blend',                                    80, '', 'TRUE',  'TRUE',  5],
      ['M006', 'Desserts',     'Gulab Jamun',        'Warm, rose syrup, pistachio',                         120, '', 'TRUE',  'FALSE', 6]
    ];
    menuSh.getRange(2, 1, sampleMenu.length, menuHeaders.length).setValues(sampleMenu);
    menuSh.autoResizeColumns(1, menuHeaders.length);
    Logger.log('Menu tab created with ' + sampleMenu.length + ' sample items.');
  } else {
    Logger.log('Menu tab already has correct headers — skipped.');
  }

  // ---- Settings tab -------------------------------------------
  var settingsSh = ss.getSheetByName('Settings');
  if (!settingsSh) {
    settingsSh = ss.insertSheet('Settings');
  }
  var existingSettingsRows = settingsSh.getLastRow();
  var settingsHasKey = false;
  if (existingSettingsRows > 0) {
    var firstCol = settingsSh.getRange(1, 1, existingSettingsRows, 1).getValues();
    for (var r = 0; r < firstCol.length; r++) {
      if (String(firstCol[r][0]).trim().toLowerCase() === 'key') { settingsHasKey = true; break; }
    }
  }
  if (!settingsHasKey) {
    settingsSh.clear();
    settingsSh.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]).setFontWeight('bold').setBackground('#f0f0f0');
    settingsSh.setFrozenRows(1);
    var defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 30);
    var expiryStr = defaultExpiry.toISOString().slice(0, 10);
    var settingsRows = [
      ['menu_active',     'TRUE'],
      ['expiry_date',     expiryStr],
      ['restaurant_name', 'My Restaurant'],
      ['last_synced_at',  '']
    ];
    settingsSh.getRange(2, 1, settingsRows.length, 2).setValues(settingsRows);
    settingsSh.autoResizeColumns(1, 2);
    Logger.log('Settings tab created with defaults (expiry ' + expiryStr + ').');
  } else {
    Logger.log('Settings tab already has a Key header — skipped.');
  }

  SpreadsheetApp.flush();
  Logger.log('initSheet complete. Delete the sample menu items and fill in real data.');
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'getMenu') {
    return json_(getMenuPayload());
  }
  if (action === 'getSettings' && e.parameter.key === SHARED_SECRET) {
    return json_(getSettingsRaw());
  }
  return json_({ error: 'invalid action' });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ error: 'invalid JSON body' });
  }
  if (!body || body.key !== SHARED_SECRET) {
    return json_({ error: 'unauthorized' });
  }
  if (body.action === 'updateSettings') {
    return json_(updateSettings(body.payload || {}));
  }
  return json_({ error: 'invalid action' });
}

function getMenuPayload() {
  var settings = readSettingsTab();
  if (settings.menu_active !== true) {
    return { status: 'inactive' };
  }
  if (isExpired_(settings.expiry_date)) {
    return { status: 'expired' };
  }
  return {
    status: 'ok',
    restaurant: {
      name: settings.restaurant_name || ''
    },
    menu: readMenuTab()
  };
}

function getSettingsRaw() {
  return { status: 'ok', settings: readSettingsTab() };
}

function updateSettings(payload) {
  var allowed = ['menu_active', 'expiry_date', 'last_synced_at', 'restaurant_name'];
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getOrCreateSettingsSheet_();
    var values = sh.getDataRange().getValues();
    var rowIndex = {};
    for (var i = 1; i < values.length; i++) {
      rowIndex[str_(values[i][0])] = i + 1;
    }
    for (var k = 0; k < allowed.length; k++) {
      var key = allowed[k];
      if (!(key in payload)) continue;
      var value = payload[key];
      if (key === 'menu_active') value = boolText_(value);
      var row = rowIndex[key];
      if (row) {
        sh.getRange(row, 2).setValue(value);
      } else {
        sh.appendRow([key, value]);
      }
    }
    SpreadsheetApp.flush();
    return { status: 'ok', updated: Object.keys(payload) };
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------- helpers

function getMenuSheet_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Menu');
  if (!sh) throw new Error('Missing "Menu" tab');
  return sh;
}

function getOrCreateSettingsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Settings');
  if (!sh) {
    sh = ss.insertSheet('Settings');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]).setFontWeight('bold');
  }
  return sh;
}

function readSettingsTab() {
  var sh = getOrCreateSettingsSheet_();
  var values = sh.getDataRange().getValues();
  var settings = {};
  for (var i = 1; i < values.length; i++) {
    settings[str_(values[i][0])] = str_(values[i][1]);
  }
  return {
    menu_active: bool_(settings.menu_active),
    expiry_date: settings.expiry_date || '',
    restaurant_name: settings.restaurant_name || '',
    last_synced_at: settings.last_synced_at || '',
    raw: settings
  };
}

function readMenuTab() {
  var sh = getMenuSheet_();

  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(str_);
  var idx = {};
  for (var h = 0; h < headers.length; h++) idx[headers[h].toLowerCase()] = h;

  function col(name) {
    return idx.hasOwnProperty(name) ? idx[name] : -1;
  }

  var cId = col('id');
  var cCat = col('category');
  var cName = col('name');
  var cDesc = col('description');
  var cPrice = col('price');
  var cImg = col('image_url');
  var cVeg = col('is_veg');
  var cAvail = col('is_available');
  var cSort = col('sort_order');

  var items = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var name = str_(cName >= 0 ? row[cName] : '');
    if (!name) continue;
    items.push({
      id: str_(cId >= 0 ? row[cId] : '') || ('row' + (r + 1)),
      category: str_(cCat >= 0 ? row[cCat] : '') || 'Menu',
      name: name,
      description: str_(cDesc >= 0 ? row[cDesc] : ''),
      price: num_(cPrice >= 0 ? row[cPrice] : 0),
      imageUrl: str_(cImg >= 0 ? row[cImg] : ''),
      isVeg: bool_(cVeg >= 0 ? row[cVeg] : true),
      isAvailable: bool_(cAvail >= 0 ? row[cAvail] : true),
      sortOrder: num_(cSort >= 0 ? row[cSort] : r)
    });
  }
  items.sort(function (a, b) {
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  });
  return items;
}

function isExpired_(expiryStr) {
  if (!expiryStr) return false;
  var t = new Date(expiryStr + 'T23:59:59');
  if (isNaN(t.getTime())) return false;
  return t.getTime() < Date.now();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function str_(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function num_(v) {
  var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function bool_(v) {
  if (v === true) return true;
  if (v === false || v === '' || v === null || v === undefined) return false;
  return String(v).trim().toUpperCase() === 'TRUE';
}

function boolText_(v) {
  return bool_(v) ? 'TRUE' : 'FALSE';
}
