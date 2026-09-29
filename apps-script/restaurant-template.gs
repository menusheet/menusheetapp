/**
 * ============================================================
 *  MenuSheet — Restaurant Sheet Apps Script (template)
 * ============================================================
 *  Deploy once per restaurant Google Sheet:
 *    1. Open the restaurant's Google Sheet → Extensions → Apps Script.
 *    2. Paste this entire file over Code.gs.
 *    3. Fill in the three REPLACE_ME values below:
 *         RESTAURANT_ID   your /r/{id} slug, from the MenuSheet admin portal
 *         RESTAURANT_NAME the display name shown on the page
 *         API_URL         the menusheet-api Worker URL
 *         SHARED_SECRET   the same secret the Worker holds
 *    4. Run initSheet() once from the editor to create the Menu tab.
 *    5. Deploy → New deployment → type "Web app".
 *         - Execute as:  Me (<sheet owner account>)
 *         - Who has access: Anyone
 *    6. Copy the /exec URL into the restaurant's page in the admin portal
 *       (Apps Script Web App URL field).
 *
 *  There is deliberately only ONE tab: "Menu".
 *
 *  The old Settings tab held restaurant_id, restaurant_name, menu_active,
 *  expiry_date and last_synced_at. None of it belongs here any more. Billing
 *  and the active flag live in the platform's own database, and duplicating
 *  them in an editable tab only created a second answer that could disagree
 *  with the first — so the identifier is hardcoded at the top of this file
 *  instead, and the sheet holds nothing but the menu.
 *
 *  This script is READ-ONLY. It never writes to the spreadsheet except when
 *  initSheet() is run once by hand.
 *
 *  Endpoints:
 *    GET ?action=getMenu     the only endpoint. Public. Full menu JSON.
 *    GET ?action=health      liveness check used by the onboarding checklist.
 *
 *  Plus a spreadsheet menu item:
 *    MenuSheet > Reload menu on website
 *    Saves nothing. Asks the platform to re-fetch this menu right now, so an
 *    edit shows up on the public page without waiting for the cache to lapse.
 *    You can keep editing afterwards and press it again whenever you like.
 *
 *  Expected sheet tabs: "Menu" only. Run initSheet() once to create it — it
 *    writes the headers and a couple of sample rows for the owner to overwrite.
 *
 *  The "price" column also carries price variations, so owners never have to
 *  add a column. Use a single price for most dishes:
 *
 *      320
 *
 *  or list the options an item comes in, comma separated, as Label-Amount:
 *
 *      Small-120, Medium-180, Large-240
 *
 *  Any labels work, and the lowest amount is what shows in the price column.
 *  Mirror of the parser in lib/price.ts — keep the two in lockstep.
 */

// ---- Fill these in, then deploy -------------------------------------

/** Your public menu URL is {API_URL-host}/r/{RESTAURANT_ID}. Shown in the admin portal. */
var RESTAURANT_ID = 'REPLACE_ME';

/** Display name. Optional: the platform already knows your name and will use
 *  that if this is left blank. Set it if you want the sheet to be self-contained. */
var RESTAURANT_NAME = '';

/** The menusheet-api Worker URL. */
var API_URL = 'REPLACE_ME';

/** Must match the SHARED_SECRET the Worker holds. */
var SHARED_SECRET = 'REPLACE_ME';

/** How long the built menu JSON is served from the script cache. The Worker
 *  only asks for the menu when an operator or this sheet's Reload button asks
 *  it to, so this is now a backstop against a burst of requests rather than the
 *  thing that makes the site feel live. Owner edits appear on the public menu
 *  when Reload is pressed. */
var MENU_CACHE_TTL_SECONDS = 3600;

var CONFIG_ERROR =
  'This script has not been told where the MenuSheet service lives.\n\n' +
  'Ask your MenuSheet provider to redeploy the script with the restaurant id, ' +
  'API URL and shared secret filled in.';

var ID_ERROR =
  'Your restaurant_id is not set yet.\n\n' +
  'Open Extensions → Apps Script and set RESTAURANT_ID at the top of the file ' +
  'to the id shown in the MenuSheet admin portal, then redeploy.\n\n' +
  'You can still edit your menu in the meantime — it just cannot be published yet.';


// ----------------------------------------------------------------
//  initSheet — run once from the editor to set up the spreadsheet
// ----------------------------------------------------------------

function initSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // One tab. "Menu" is the whole contract between this script and the platform.
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
      ['M005', 'Beverages',    'Masala Chai',        'House spice blend',                                  80, '', 'TRUE',  'TRUE',  5],
      ['M006', 'Desserts',     'Gulab Jamun',        'Warm, rose syrup, pistachio',                         120, '', 'TRUE',  'FALSE', 6],
      ['M007', 'Main Course',  'Margherita Pizza',   'San Marzano tomato, fior di latte, basil',  'Small-220, Medium-320, Large-420', '', 'TRUE', 'TRUE',  7]
    ];
    menuSh.getRange(2, 1, sampleMenu.length, menuHeaders.length).setValues(sampleMenu);
    menuSh.autoResizeColumns(1, menuHeaders.length);
    Logger.log('Menu tab created with ' + sampleMenu.length + ' sample items.');
  } else {
    Logger.log('Menu tab already has correct headers — left your data alone.');
  }

  // A Settings tab from an older deployment is not read by anything any more.
  // Removing it is safe and stops it drifting into looking authoritative.
  var staleSettings = ss.getSheetByName('Settings');
  if (staleSettings) {
    ss.deleteSheet(staleSettings);
    Logger.log('Removed the now-unused Settings tab.');
  }

  SpreadsheetApp.flush();
  Logger.log('initSheet complete. Delete the sample menu items and fill in real data.');
  if (RESTAURANT_ID === 'REPLACE_ME') {
    Logger.log('WARNING: RESTAURANT_ID is still REPLACE_ME — the Reload button will not work until you set it and redeploy.');
  }
}

// ----------------------------------------------------------------
//  Spreadsheet menu: MenuSheet > Reload menu on website
// ----------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('MenuSheet')
    .addItem('Reload menu on website', 'reloadMenuOnWebsite')
    .addSeparator()
    .addItem('How do I set this up?', 'showSetupHelp')
    .addToUi();
}

function showSetupHelp() {
  SpreadsheetApp.getUi().alert(
    'Using MenuSheet',
    '1. Your menu lives in the "Menu" tab. Edit it whenever you like.\n\n' +
    '2. Press "Reload menu on website" to publish your latest edits to your ' +
    'public menu page. Nothing else is needed.\n\n' +
    '3. Your menu is at ' + restaurantUrl_() + '\n\n' +
    'The Reload button is how your changes reach customers. Until it has been ' +
    'pressed once, your public page has no menu on it.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function restaurantUrl_() {
  var base = String(API_URL || '').replace(/\/+$/, '');
  if (base) return base.replace(/^https?:\/\/[^/]+/, '') + '/r/' + String(RESTAURANT_ID || 'your-id');
  return '/r/' + String(RESTAURANT_ID || 'your-id');
}

function isConfigured_() {
  return RESTAURANT_ID !== 'REPLACE_ME' && API_URL !== 'REPLACE_ME' && SHARED_SECRET !== 'REPLACE_ME';
}

function reloadMenuOnWebsite() {
  var ui = SpreadsheetApp.getUi();

  if (RESTAURANT_ID === 'REPLACE_ME') {
    ui.alert('Almost there', ID_ERROR, ui.ButtonSet.OK);
    return;
  }
  if (API_URL === 'REPLACE_ME' || SHARED_SECRET === 'REPLACE_ME') {
    ui.alert('Not configured yet', CONFIG_ERROR, ui.ButtonSet.OK);
    return;
  }

  var res;
  var result;
  try {
    res = UrlFetchApp.fetch(trim_(API_URL) + '/api/reload?key=' + encodeURIComponent(SHARED_SECRET), {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ restaurant_id: String(RESTAURANT_ID).trim() }),
      muteHttpExceptions: true
    });
    result = JSON.parse(res.getContentText());
  } catch (err) {
    ui.alert('Could not reach MenuSheet', 'The request failed before it got an answer:\n\n' + err, ui.ButtonSet.OK);
    return;
  }

  if (res.getResponseCode() !== 200 || result.error) {
    ui.alert(
      'Reload failed',
      (result && result.error ? result.error : 'The service returned HTTP ' + res.getResponseCode() + '.') +
      '\n\nYour menu is untouched and still live on the website. Try again in a moment.',
      ui.ButtonSet.OK
    );
    return;
  }

  var count = (typeof result.items === 'number') ? result.items : 0;
  ui.alert(
    'Menu published',
    'Your latest menu is now live — ' + count + ' item' + (count === 1 ? '' : 's') + ' published.\n\n' +
    'Keep editing and press this button again whenever you want to push another change.',
    ui.ButtonSet.OK
  );
}

// ----------------------------------------------------------------
//  Web endpoints
// ----------------------------------------------------------------

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'getMenu') {
    /* fresh=1 means somebody deliberately asked for the sheet to be re-read
       right now, so the script cache must not be allowed to answer. */
    var fresh = !!e.parameter.fresh && e.parameter.fresh === '1';
    return json_(getMenuPayload(fresh));
  }
  if (action === 'health') {
    return json_({ status: 'ok', item_count: readMenuTab().length });
  }
  return json_({ error: 'invalid action' });
}

/**
  * The whole job of this script.
  *
  * There is no menu_active / expiry check here any more. The platform decides
  * whether a subscriber's menu is allowed to be shown, from its own records, at
  * the moment a customer loads the page. Duplicating that decision here would
  * only create a second answer that can disagree with the first.
  *
  * @param {boolean} fresh Skip the script cache and re-read the sheet.
  * @return {Object} The menu payload.
  */
function getMenuPayload(fresh) {
  var cache = CacheService.getScriptCache();
  if (!fresh) {
    var cached = cache.get('menuPayload');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        /* corrupt entry — rebuild below */
      }
    }
  }

  var payload = {
    status: 'ok',
    restaurant: {
      id: String(RESTAURANT_ID || '').trim(),
      name: String(RESTAURANT_NAME || '').trim()
    },
    menu: readMenuTab()
  };

  try {
    // Script cache caps a single value near 100KB — bigger menus just skip
    // caching and stay as fast as the sheet allows.
    if (JSON.stringify(payload).length < 90000) {
      cache.put('menuPayload', JSON.stringify(payload), MENU_CACHE_TTL_SECONDS);
    }
  } catch (err) {
    /* caching is best-effort */
  }
  return payload;
}

// ---------------------------------------------------------------- helpers

function getMenuSheet_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Menu');
  if (!sh) throw new Error('Missing "Menu" tab');
  return sh;
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
    var price = parsePriceCell_(cPrice >= 0 ? row[cPrice] : 0);
    items.push({
      id: str_(cId >= 0 ? row[cId] : '') || ('row' + (r + 1)),
      category: str_(cCat >= 0 ? row[cCat] : '') || 'Menu',
      name: name,
      description: str_(cDesc >= 0 ? row[cDesc] : ''),
      price: price.base,
      priceVariants: price.variants,
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

function trim_(v) {
  return String(v === null || v === undefined ? '' : v).replace(/\/+$/, '');
}

// ---------------------------------------------------------------- price grammar
// Mirror of lib/price.ts. Keep the two implementations in lockstep: a change
// to the syntax in one must land in the other, or menus will render one way in
// the JSON and another in the UI.

var PRICE_MAX_VARIANTS = 8;
var PRICE_MAX_LABEL = 24;

function priceStripCurrency_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/[\u20b9$\u20AC\u00A3\u00A5]/g, ' ')
    .replace(/\brs\.?/gi, ' ')
    .replace(/\binr\b/gi, ' ')
    .replace(/\/\s*[-\u2010-\u2015]\s*$/, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function priceToAmount_(raw) {
  var n = Number(String(raw).replace(/,/g, ''));
  return (isFinite(n) && n >= 0) ? n : null;
}

function priceCleanLabel_(raw) {
  return String(raw)
    .replace(/^[\s\-:\u2013\u2014_|]+|[\s\-:\u2013\u2014_|]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PRICE_MAX_LABEL);
}

function priceParseSegment_(segment) {
  var cleaned = priceStripCurrency_(segment);
  if (!cleaned) return null;
  var runs = cleaned.match(/\d[\d,]*(?:\.\d+)?/g);
  if (!runs || !runs.length) return null;
  // The last digit run is the amount, so digits inside a label such as
  // "Regular 500ml" are not mistaken for the price.
  var last = runs[runs.length - 1];
  var amount = priceToAmount_(last);
  if (amount === null) return null;
  return { label: priceCleanLabel_(cleaned.slice(0, cleaned.lastIndexOf(last))), price: amount };
}

function priceDedupe_(variants) {
  var seen = {};
  var out = [];
  for (var i = 0; i < variants.length; i++) {
    var key = variants[i].label.toLowerCase();
    if (!key) { out.push(variants[i]); continue; }
    if (Object.prototype.hasOwnProperty.call(seen, key)) {
      out[seen[key]] = variants[i];
    } else {
      seen[key] = out.length;
      out.push(variants[i]);
    }
  }
  return out;
}

// Split the cell on option separators, keeping comma-grouped amounts intact
// so "Large-1,200" reads as Rs 1,200 and not as two options.
function splitPriceCell_(text) {
  var parts = text.split(/[,|]/);
  if (parts.length < 2) return parts;
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (out.length) {
      var prev = out[out.length - 1];
      if (priceHasLabel_(prev) && priceLeftIsGroupable_(prev) && priceIsBareAmount_(part)) {
        out[out.length - 1] = prev + ',' + part;
        continue;
      }
    }
    out.push(part);
  }
  return out;
}

// A bare 2-3 digit amount (the right half of a grouped "Label-1,200").
function priceIsBareAmount_(value) {
  return /^\s*(?:\u20b9|rs\.?|inr)?\s*\d{2,3}(?:\.\d{1,2})?\s*(?:\/-)?$/i.test(value);
}

// Whether the text before its last amount holds a label.
function priceHasLabel_(value) {
  var text = String(value);
  var runs = text.match(/\d[\d,]*(?:\.\d+)?/g);
  if (!runs || !runs.length) return false;
  var last = runs[runs.length - 1];
  return priceCleanLabel_(text.slice(0, text.lastIndexOf(last))) !== '';
}

// Whether the last amount of the text could be the start of a grouped number,
// i.e. it is 1-2 digits only - the shape real grouped amounts take.
function priceLeftIsGroupable_(value) {
  var text = String(value);
  var runs = text.match(/\d[\d,]*(?:\.\d+)?/g);
  if (!runs || !runs.length) return false;
  var last = runs[runs.length - 1];
  var integerPart = last.split('.')[0].replace(/,/g, '');
  return /^\d{1,2}$/.test(integerPart);
}

function parsePriceCell_(raw) {
  if (raw === null || raw === undefined || raw instanceof Date) return { base: 0, variants: [] };
  if (typeof raw === 'number') {
    return (isFinite(raw) && raw > 0) ? { base: raw, variants: [] } : { base: 0, variants: [] };
  }

  var text = priceStripCurrency_(raw);
  if (!text) return { base: 0, variants: [] };

  // A bare grouped number wins over the comma split, so "1,200" stays 1200
  // instead of becoming two options worth 1 and 200.
  if (/^\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?$/.test(text)) {
    var grouped = priceToAmount_(text);
    return grouped ? { base: grouped, variants: [] } : { base: 0, variants: [] };
  }

  var segments = splitPriceCell_(text);
  var parsed = [];
  for (var s = 0; s < segments.length && parsed.length < PRICE_MAX_VARIANTS; s++) {
    var variant = priceParseSegment_(segments[s]);
    if (variant) parsed.push(variant);
  }

  if (!parsed.length) return { base: 0, variants: [] };
  if (parsed.length === 1) return { base: parsed[0].price, variants: [] };

  var allUnlabelled = true;
  var min = parsed[0].price;
  var max = parsed[0].price;
  for (var i = 0; i < parsed.length; i++) {
    if (parsed[i].label) allUnlabelled = false;
    if (parsed[i].price < min) min = parsed[i].price;
    if (parsed[i].price > max) max = parsed[i].price;
  }

  // Unnamed amounts are a span, not a set of choices — show only the ends.
  if (allUnlabelled) {
    return {
      base: min,
      variants: min === max
        ? [{ label: '', price: min }]
        : [{ label: '', price: min }, { label: '', price: max }]
    };
  }

  var variants = priceDedupe_(parsed);
  var base = variants[0].price;
  for (var j = 0; j < variants.length; j++) {
    if (variants[j].price < base) base = variants[j].price;
  }
  return { base: base, variants: variants };
}

function bool_(v) {
  if (v === true) return true;
  if (v === false || v === '' || v === null || v === undefined) return false;
  return String(v).trim().toUpperCase() === 'TRUE';
}
