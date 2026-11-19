import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
import db, { generateId } from '../db.js';
import {
  ensureImportedCustomerGroup,
  findCustomerGroupByName,
  getEstateCodeFromVoixNumber,
  getLineCodeFromVoixNumber,
  getOrCreateCustomerGroup,
  isMainNetworkLabel,
  linkTicketToScope
} from '../services/customerGroups.js';

const monthNames = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

const normalizeHeader = (value) => String(value ?? '')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const normalizeName = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const cleanText = (value) => String(value ?? '').replace(/\u00a0/g, ' ').trim();

function parseAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = cleanText(value);
  if (!raw || raw.startsWith('=') || /^(?:#|n\/a$|na$|-)$/i.test(raw)) return null;
  const negative = /^\(.*\)$/.test(raw);
  const numeric = raw.replace(/[₦$€£,\s()]/g, '').replace(/[^0-9.+-]/g, '');
  if (!numeric || !/\d/.test(numeric)) return null;
  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

function validIsoDate(year, month, day) {
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  const parsedDay = Number(day);
  if (!Number.isInteger(parsedYear) || parsedYear < 1
    || !Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12
    || !Number.isInteger(parsedDay) || parsedDay < 1) return null;

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(parsedYear, parsedMonth - 1, parsedDay);
  if (date.getUTCFullYear() !== parsedYear
    || date.getUTCMonth() + 1 !== parsedMonth
    || date.getUTCDate() !== parsedDay) return null;

  return `${String(parsedYear).padStart(4, '0')}-${String(parsedMonth).padStart(2, '0')}-${String(parsedDay).padStart(2, '0')}`;
}

function toIsoDate(value, { dayFirst = true } = {}) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = (XLSX.SSF || XLSX.default.SSF).parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return validIsoDate(parsed.y, parsed.m, parsed.d);
    }
  }

  const raw = cleanText(value);
  if (!raw || raw === '-') return null;
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return validIsoDate(iso[1], iso[2], iso[3]);

  // The client and enterprise lists use DD/MM/YYYY, while the legacy deployment
  // and day-book sheets use M/D/YYYY. The caller selects the relevant convention.
  const slash = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (slash) {
    let first = Number(slash[1]);
    let second = Number(slash[2]);
    let year = Number(slash[3]);
    if (year < 100) year += year < 50 ? 2000 : 1900;

    let month;
    let day;
    if (first > 12) {
      day = first;
      month = second;
    } else if (second > 12) {
      month = first;
      day = second;
    } else if (dayFirst) {
      day = first;
      month = second;
    } else {
      month = first;
      day = second;
    }
    return validIsoDate(year, month, day);
  }

  const embeddedIso = raw.match(/(\d{4}-\d{2}-\d{2})/);
  if (embeddedIso) {
    const [, year, month, day] = embeddedIso[1].match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
    return validIsoDate(year, month, day);
  }
  return null;
}

function parseMonthHeader(header) {
  const key = normalizeHeader(header);
  const yearMatch = key.match(/\b(20\d{2})\b/);
  if (!yearMatch) return null;
  const firstWord = key.split(' ').find(Boolean) || '';
  const monthIndex = monthNames.findIndex((month) => firstWord.startsWith(month.slice(0, 3)));
  if (monthIndex < 0) return null;
  return {
    year: Number(yearMatch[1]),
    month: monthIndex + 1,
    label: cleanText(header),
    period: `${yearMatch[1]}-${String(monthIndex + 1).padStart(2, '0')}`
  };
}

function detectKind(headers) {
  const keys = new Set(headers);
  const hasAny = (...candidates) => candidates.some((candidate) => keys.has(candidate));
  const hasCustomerName = hasAny('customer name', 'customer', 'enterprise name', 'client name', 'customer enterprise', 'name');
  const hasNamedCustomerField = hasAny('customer name', 'enterprise name', 'client name', 'customer enterprise');
  const hasProfileDetails = hasAny(
    'mac address', 'mac', 'service type', 'service plan', 'bandwidth', 'plan',
    'payment schedule', 'payment cycle', 'ip address', 'static ip', 'email', 'email address',
    'phone', 'phone number', 'amount payable', 'subscription amount', 'last payment date', 'next due date'
  );
  const hasCustomerIdentifier = hasAny(
    'customer id', 'customer id number', 'voix number', 'voix no', 'subscriber id', 'account id'
  );

  if ((hasAny('vnq', 'vnq no', 'vnq number', 'vnq reference', 'ticket no', 'ticket number') && keys.has('date received'))
    || (hasAny('issue', 'issue description', 'issue description customer s words or error message') && keys.has('status'))) {
    return 'queries';
  }
  if ((keys.has('customer name') && keys.has('exact address') && keys.has('priority'))
    || (hasAny('customer name', 'customer') && hasAny('exact address', 'location', 'address')
      && hasAny('priority', 'status') && hasAny('service type', 'plan', 'deployment id', 'vnd', 'vnd no', 'customer'))) {
    return 'deployments';
  }
  if (keys.has('particulars') && hasAny('total amount', 'amount') && keys.has('date')) return 'daybook';

  const hasGenericProfileMarker = hasAny('mac address', 'mac', 'service type', 'service plan', 'payment schedule', 'ip address', 'static ip');
  if (hasCustomerName && hasCustomerIdentifier && (keys.has('name') || hasNamedCustomerField)) return 'customers';
  if (keys.has('gross amount') && hasAny('customer name', 'customer enterprise', 'enterprise name')) return 'income';
  if (hasCustomerName && ((hasNamedCustomerField && hasProfileDetails)
    || (keys.has('name') && hasGenericProfileMarker))) return 'customers';
  return null;
}

function worksheetMatrix(worksheet) {
  const matrix = [];
  for (const [address, cell] of Object.entries(worksheet)) {
    if (address.startsWith('!') || !/^[A-Z]+\d+$/i.test(address) || !cell) continue;
    let cellValue = cell.v;
    if ((cellValue === undefined || cellValue === '') && cell.f) cellValue = `=${cell.f}`;
    if (cellValue === undefined || cellValue === null || cellValue === '') continue;
    const position = XLSX.utils.decode_cell(address);
    matrix[position.r] ||= [];
    matrix[position.r][position.c] = cellValue;
  }
  return matrix;
}

function matrixHasContent(values = []) {
  return values.some((entry) => entry !== undefined && entry !== null && cleanText(entry) !== '');
}

function archiveRowsFromMatrix(matrix, headers = null) {
  const archived = [];
  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    const cells = matrix[rowIndex] || [];
    if (!matrixHasContent(cells)) continue;
    archived.push({ rowNumber: rowIndex + 1, headers, cells });
  }
  return archived;
}

function sourceForSheet(source, sheetName) {
  return `${source}${sheetName && sheetName !== 'Sheet1' ? ` · ${sheetName}` : ''}`;
}

function hasCustomerIdentity(row) {
  return Boolean(
    value(row, 'name', 'customer name', 'customer', 'enterprise name', 'client name', 'customer enterprise')
    || value(row, 'customer id', 'customer id number', 'voix number', 'voix no', 'subscriber id', 'account id')
  );
}

function findSectionHeading(row) {
  const candidate = cleanText(value(row, 'column 1', 's n', 'serial no', 'serial number', 'column 2', 'estate name', 'estate'));
  if (!candidate || candidate.startsWith('=') || /^\d+(?:\.\d+)?$/.test(candidate)) return '';
  return candidate;
}

function buildSheetRows(matrix, source, sheetName) {
  let detected = null;
  const searchLimit = Math.min(matrix.length, 30);
  for (let rowIndex = 0; rowIndex < searchLimit; rowIndex += 1) {
    const rawHeaders = (matrix[rowIndex] || []).map((header, index) => {
      const normalized = normalizeHeader(header);
      return normalized || `column ${index + 1}`;
    });
    const kind = detectKind(rawHeaders);
    if (kind) {
      detected = { headerIndex: rowIndex, headers: rawHeaders, kind };
      break;
    }
  }

  const rawHeaders = detected?.headers || null;
  const archiveRows = archiveRowsFromMatrix(matrix, rawHeaders);
  const sheet = {
    source: sourceForSheet(source, sheetName),
    sheetName: sheetName || 'Sheet1',
    kind: detected?.kind || 'raw',
    rows: [],
    archiveRows
  };
  if (!detected) return sheet;

  let sectionName = '';
  for (let index = detected.headerIndex + 1; index < matrix.length; index += 1) {
    const values = matrix[index] || [];
    if (!matrixHasContent(values)) continue;
    const row = {};
    detected.headers.forEach((header, columnIndex) => {
      row[header] = values[columnIndex] ?? '';
    });
    row.__sourceRowNumber = index + 1;
    row.__rawCells = values;
    row.__rawHeaders = detected.headers;

    if (detected.kind === 'customers' && !hasCustomerIdentity(row)) {
      sectionName = findSectionHeading(row) || sectionName;
      continue;
    }
    if (detected.kind === 'queries'
      && !value(row, 'vnq', 'vnq no', 'vnq number', 'ticket no', 'ticket number', 'ticket id', 'query id')
      && !value(row, 'date received', 'issue', 'issue description', 'issue description customer s words or error message', 'customer name', 'customer name optional')) continue;
    if (detected.kind === 'deployments' && !value(row, 'customer name', 'customer', 'name')) continue;
    if (detected.kind === 'income'
      && !value(row, 'customer name', 'customer enterprise', 'enterprise name')) continue;
    if (detected.kind === 'daybook'
      && !value(row, 'date', 'particulars', 'description', 'total amount', 'amount')) continue;

    if (detected.kind === 'customers') row.__estateName = sectionName;
    sheet.rows.push(row);
  }
  return sheet;
}

function parseCustomerLogSheet(worksheet, source, sheetName) {
  const matrix = worksheetMatrix(worksheet);
  const sheet = {
    source: sourceForSheet(source, sheetName),
    sheetName,
    kind: 'customers',
    rows: [],
    archiveRows: archiveRowsFromMatrix(matrix)
  };
  let estateName = '';
  for (let index = 0; index < matrix.length; index += 1) {
    const cells = matrix[index] || [];
    if (!matrixHasContent(cells)) continue;
    const voixNo = cleanText(cells[2]);
    if (!/^VN-/i.test(voixNo)) {
      const heading = cleanText(cells[0]);
      const isColumnHeaderRow = index === 0 && cells.slice(1).some((cell) => /^column\s+\d+$/i.test(cleanText(cell)));
      if (heading && (isColumnHeaderRow || !matrixHasContent(cells.slice(1)))) estateName = heading;
      continue;
    }
    sheet.rows.push({
      'house name': cells[0] ?? '',
      'service type': cells[1] ?? '',
      'customer id': voixNo,
      'mac address': cells[3] ?? '',
      name: cells[4] ?? '',
      'phone number': cells[5] ?? '',
      'email address': cells[6] ?? '',
      'estate name': estateName,
      __estateName: estateName,
      __sourceRowNumber: index + 1,
      __rawCells: cells,
      __rawHeaders: ['house name', 'service type', 'customer id', 'mac address', 'name', 'phone number', 'email address']
    });
  }
  return sheet;
}

function parseProfileHistorySheet(worksheet, source, sheetName) {
  const matrix = worksheetMatrix(worksheet);
  const metadata = {};
  for (let rowIndex = 2; rowIndex < Math.min(matrix.length, 30); rowIndex += 1) {
    const cells = matrix[rowIndex] || [];
    const label = normalizeHeader(cells[0]);
    if (label) metadata[label] = cells[1] ?? '';
  }
  const fields = {
    name: metadata['customer name'] || '',
    phone: metadata['phone number'] || '',
    address: metadata['physical address'] || '',
    email: metadata['email address'] || '',
    voixNo: metadata['voix number'] || metadata['voix no'] || '',
    macAddress: metadata['mac address'] || '',
    status: metadata['account status'] || ''
  };
  const payments = [];
  const support = [];
  for (let rowIndex = 2; rowIndex < matrix.length; rowIndex += 1) {
    const cells = matrix[rowIndex] || [];
    const paymentCells = cells.slice(4, 9);
    if (matrixHasContent(paymentCells)) {
      payments.push({
        sourceRowNumber: rowIndex + 1,
        datePaidRaw: paymentCells[0] ?? '',
        amountRaw: paymentCells[1] ?? '',
        paymentMethod: paymentCells[2] ?? '',
        referenceNo: paymentCells[3] ?? '',
        expiryDateRaw: paymentCells[4] ?? '',
        rawCells: paymentCells
      });
    }
    const supportCells = cells.slice(11, 18);
    if (matrixHasContent(supportCells)) {
      support.push({
        sourceRowNumber: rowIndex + 1,
        eventDateRaw: supportCells[0] ?? '',
        eventTime: supportCells[1] ?? '',
        loggedBy: supportCells[2] ?? '',
        issueCategory: supportCells[3] ?? '',
        details: supportCells[4] ?? '',
        actionTaken: supportCells[5] ?? '',
        status: supportCells[6] ?? '',
        rawCells: supportCells
      });
    }
  }
  return {
    source: sourceForSheet(source, sheetName),
    sheetName,
    kind: 'profile_history',
    rows: [{
      sourceSheet: sheetName,
      metadata: fields,
      sourceRowNumber: 1,
      payments,
      support
    }],
    archiveRows: archiveRowsFromMatrix(matrix)
  };
}

function parseEmbeddedIncomeRecords(buffer, source) {
  const html = buffer.toString('utf8');
  const arrayStart = html.match(/const\s+INITIAL_INCOME_RECORDS\s*=\s*\[/);
  if (!arrayStart) return null;
  const afterStart = html.slice(arrayStart.index + arrayStart[0].length);
  const arrayEnd = afterStart.indexOf('];');
  if (arrayEnd < 0) return null;
  const arrayText = afterStart.slice(0, arrayEnd);
  const objectBlocks = arrayText.match(/\{[\s\S]*?\}/g) || [];
  const fields = [
    'date', 'invNo', 'customerName', 'customerType', 'category', 'description',
    'grossAmount', 'isVatExempt', 'vatRate', 'vatAmount', 'netAmount',
    'paymentMode', 'durationMonths', 'nextDueDate', 'receivedBy'
  ];

  const rows = objectBlocks.map((block, index) => {
    const record = { __sourceRowNumber: index + 1 };
    for (const field of fields) {
      const property = new RegExp(`\\b${field}\\s*:\\s*(?:"((?:\\\\.|[^"\\\\])*)"|(-?\\d+(?:\\.\\d+)?)|(true|false|null))`, 'm');
      const match = block.match(property);
      if (!match) continue;
      if (match[1] !== undefined) {
        try { record[normalizeHeader(field)] = JSON.parse(`"${match[1]}"`); }
        catch { record[normalizeHeader(field)] = match[1]; }
      } else if (match[2] !== undefined) {
        record[normalizeHeader(field)] = Number(match[2]);
      } else {
        record[normalizeHeader(field)] = match[3] === 'null' ? '' : match[3] === 'true';
      }
    }
    return record;
  }).filter((record) => record['customer name'] && record['gross amount'] !== undefined);

  if (!rows.length) return null;
  return {
    source,
    sheetName: 'INITIAL_INCOME_RECORDS',
    kind: 'income',
    rows,
    archiveRows: rows.map((row) => ({ rowNumber: row.__sourceRowNumber, headers: Object.keys(row), cells: row }))
  };
}

export function readMigrationFile(file) {
  const originalName = String(file.originalname || 'Uploaded spreadsheet');
  const extension = originalName.split('.').pop().toLowerCase();
  if (extension === 'html' || extension === 'htm') {
    const embeddedIncome = parseEmbeddedIncomeRecords(file.buffer, originalName);
    if (embeddedIncome) return [embeddedIncome];
  }

  const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true, raw: true });
  const profileWorkbook = /voix customer profile sheet/i.test(originalName);
  const sheets = [];
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (profileWorkbook && sheetName === 'Customer Log') {
      sheets.push(parseCustomerLogSheet(worksheet, originalName, sheetName));
    } else if (profileWorkbook && /^\d{3}$/.test(sheetName)) {
      sheets.push(parseProfileHistorySheet(worksheet, originalName, sheetName));
    } else {
      sheets.push(buildSheetRows(worksheetMatrix(worksheet), originalName, sheetName));
    }
  }
  return sheets;
}

function value(row, ...aliases) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    const found = row[key];
    if (found !== undefined && found !== null && cleanText(found) !== '') return found;
  }
  return '';
}

function inferCustomerType(rawType, voixNo = '') {
  const searchable = `${cleanText(rawType)} ${cleanText(voixNo)}`.toLowerCase();
  return /enterprise|business|\bent\b|(?:^|\s)vn-c-/.test(searchable) ? 'Enterprise' : 'FTTH';
}

function normalizeStatus(rawStatus, fallback = 'Active') {
  const status = cleanText(rawStatus);
  if (!status) return fallback;
  const lower = status.toLowerCase();
  if (lower === 'active') return 'Active';
  if (lower === 'inactive' || lower === 'deactivated') return 'Inactive';
  if (lower === 'suspended') return 'Suspended';
  return status;
}

function customerMap() {
  const byName = new Map();
  const byVoice = new Map();
  const byIp = new Map();
  for (const customer of db.prepare('SELECT id, voix_no, name, ip_address, customer_type FROM customers').all()) {
    if (customer.voix_no) byVoice.set(String(customer.voix_no).trim().toLowerCase(), customer);
    if (customer.name) byName.set(normalizeName(customer.name), customer);
    if (customer.ip_address && customer.ip_address !== 'Unassigned') byIp.set(String(customer.ip_address).trim().toLowerCase(), customer);
  }
  return { byName, byVoice, byIp };
}

function resolveCustomerId(name, ipAddress = '') {
  const { byName, byIp } = customerMap();
  if (ipAddress) {
    const match = byIp.get(String(ipAddress).trim().toLowerCase());
    if (match) return match.id;
  }
  const exactName = normalizeName(name);
  return exactName ? byName.get(exactName)?.id || null : null;
}

function upsertCustomerFromRow(row, options = {}) {
  const dateFormat = options.dateFormat || 'day-first';
  const voixNoRaw = value(row, 'customer id', 'voix number', 'voix no', 'customer id number');
  const voixNo = cleanText(voixNoRaw) || null;
  const name = cleanText(value(row, 'name', 'customer name', 'enterprise name', 'client name')) || (voixNo ? `Subscriber ${voixNo}` : '');
  if (!name) return null;

  const serviceTypeRaw = cleanText(value(row, 'customer type', 'service type', 'service plan', 'bandwidth', 'type', 'category'));
  const emailRaw = cleanText(value(row, 'email address', 'email', 'email address 1')).replace(/^mailto:/i, '');
  const phone = cleanText(value(row, 'phone number', 'customer number', 'phone'));
  const address = cleanText(value(row, 'column 1', 'physical address', 'house name', 'house', 'unit', 'flat', 'exact address', 'address', 'location'));
  const paymentSchedule = cleanText(value(row, 'payment schedule', 'payment schedle', 'payment cycle'));
  const bankReceived = cleanText(value(row, 'bank received', 'bank', 'payment bank'));
  const ipAddress = cleanText(value(row, 'ip address', 'static ip'));
  const macAddress = cleanText(value(row, 'mac address', 'mac'));
  const customerType = serviceTypeRaw
    ? inferCustomerType(serviceTypeRaw, voixNo || '')
    : /(?:^|\s)vn-c-/.test(String(voixNo || '').toLowerCase()) ? 'Enterprise' : null;
  const plan = cleanText(value(row, 'bandwidth', 'plan', 'service plan', 'service type'));
  const incomingStatus = normalizeStatus(value(row, 'subscription status', 'subcription status', 'account status', 'status'), '');
  const lastPaymentDate = toIsoDate(value(row, 'last payment date'), { dayFirst: dateFormat === 'day-first' });
  const nextDueDate = toIsoDate(value(row, 'next due date'), { dayFirst: dateFormat === 'day-first' });
  const amountPayable = parseAmount(value(row, 'amount payable', 'subscription amount', 'monthly fee'));
  const amountPaid = parseAmount(value(row, 'amount paid', 'subscription paid'));
  const outstanding = parseAmount(value(row, 'outstanding balance', 'outsanding balance', 'outstanding', 'balance due'));
  const lineName = cleanText(options.lineName || value(row, 'network line', 'line name', 'line', 'olt'))
    || getLineCodeFromVoixNumber(voixNo);
  const estateName = cleanText(options.estateName || row.__estateName || value(row, 'estate name', 'estate', 'subgroup'));
  const estateCode = cleanText(options.estateCode) || getEstateCodeFromVoixNumber(voixNo);
  const explicitHouse = cleanText(options.houseName || value(row, 'house name', 'house', 'unit', 'flat'));
  const houseName = explicitHouse || (estateName ? address : '');
  const groupId = ensureImportedCustomerGroup({ lineName, estateName, estateCode, houseName });

  const existing = (voixNo && db.prepare('SELECT * FROM customers WHERE lower(trim(voix_no)) = lower(trim(?))').get(voixNo))
    || db.prepare('SELECT * FROM customers WHERE lower(trim(name)) = lower(trim(?)) ORDER BY created_at ASC LIMIT 1').get(name);

  if (existing) {
    const patch = {
      voix_no: voixNo || existing.voix_no,
      name,
      customer_type: customerType || existing.customer_type || 'FTTH',
      email: emailRaw || existing.email,
      phone: phone || existing.phone,
      address: address || existing.address,
      mac_address: macAddress || existing.mac_address,
      service_plan: plan || existing.service_plan,
      ip_address: ipAddress || existing.ip_address || 'Unassigned',
      status: incomingStatus || existing.status || 'Active',
      payment_schedule: paymentSchedule || existing.payment_schedule,
      group_id: groupId || existing.group_id || null,
      amount_payable: amountPayable === null ? existing.amount_payable : amountPayable,
      amount_paid: amountPaid === null ? existing.amount_paid : amountPaid,
      bank_received: bankReceived || existing.bank_received,
      last_payment_date: lastPaymentDate || existing.last_payment_date,
      next_due_date: nextDueDate || existing.next_due_date,
      outstanding_balance: outstanding === null ? existing.outstanding_balance : outstanding
    };
    db.prepare(`
      UPDATE customers SET
        voix_no = @voix_no, name = @name, customer_type = @customer_type,
        email = @email, phone = @phone, address = @address, mac_address = @mac_address,
        service_plan = @service_plan, ip_address = @ip_address, status = @status,
        payment_schedule = @payment_schedule, group_id = @group_id, amount_payable = @amount_payable,
        amount_paid = @amount_paid, bank_received = @bank_received,
        last_payment_date = @last_payment_date, next_due_date = @next_due_date,
        outstanding_balance = @outstanding_balance
      WHERE id = @id
    `).run({ ...patch, id: existing.id });
    return { id: existing.id, name, voixNo: patch.voix_no, customerType: patch.customer_type, groupId: patch.group_id, created: false };
  }

  const id = generateId('customer', 'CUST');
  db.prepare(`
    INSERT INTO customers (
      id, voix_no, name, customer_type, email, phone, address, mac_address,
      service_plan, ip_address, status, payment_schedule, group_id, amount_payable,
      amount_paid, bank_received, last_payment_date, next_due_date, outstanding_balance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, voixNo, name, customerType || 'FTTH', emailRaw, phone, address, macAddress,
    plan, ipAddress || 'Unassigned', incomingStatus || 'Active', paymentSchedule,
    groupId, amountPayable ?? 0, amountPaid ?? 0, bankReceived, lastPaymentDate, nextDueDate,
    outstanding ?? 0
  );
  return { id, name, voixNo, customerType: customerType || 'FTTH', groupId, created: true };
}

function safeInvoicePart(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 54) || 'UNKNOWN';
}

function legacyRowReference(kind, sheet, row) {
  const digest = createHash('sha256')
    .update(`${sheet.source}\u0000${row.__sourceRowNumber ?? ''}`)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
  return `MIG-${kind}-${digest}`;
}

function importMonthlyPaymentHistory(row, headers, customer) {
  if (!customer) return 0;
  const insertPayment = db.prepare(`
    INSERT INTO accounting_ledger (
      customer_id, entry_date, inv_no, customer_name, customer_type, type, category,
      description, gross_amount, is_vat_exempt, vat_rate, vat_amount, net_amount,
      payment_mode, duration_months, next_due_date, received_by, reference_id
    ) VALUES (?, ?, ?, ?, ?, 'Income', ?, ?, ?, 1, 0, 0, ?, ?, 0, NULL, ?, ?)
    ON CONFLICT(inv_no) DO UPDATE SET
      customer_id = excluded.customer_id,
      entry_date = excluded.entry_date,
      customer_name = excluded.customer_name,
      customer_type = excluded.customer_type,
      category = excluded.category,
      description = excluded.description,
      gross_amount = excluded.gross_amount,
      is_vat_exempt = excluded.is_vat_exempt,
      vat_rate = excluded.vat_rate,
      vat_amount = excluded.vat_amount,
      net_amount = excluded.net_amount,
      payment_mode = excluded.payment_mode,
      duration_months = excluded.duration_months,
      next_due_date = excluded.next_due_date,
      received_by = excluded.received_by,
      reference_id = excluded.reference_id
    WHERE accounting_ledger.customer_id IS NOT excluded.customer_id
      OR accounting_ledger.entry_date IS NOT excluded.entry_date
      OR accounting_ledger.customer_name IS NOT excluded.customer_name
      OR accounting_ledger.customer_type IS NOT excluded.customer_type
      OR accounting_ledger.category IS NOT excluded.category
      OR accounting_ledger.description IS NOT excluded.description
      OR accounting_ledger.gross_amount IS NOT excluded.gross_amount
      OR accounting_ledger.is_vat_exempt IS NOT excluded.is_vat_exempt
      OR accounting_ledger.vat_rate IS NOT excluded.vat_rate
      OR accounting_ledger.vat_amount IS NOT excluded.vat_amount
      OR accounting_ledger.net_amount IS NOT excluded.net_amount
      OR accounting_ledger.payment_mode IS NOT excluded.payment_mode
      OR accounting_ledger.duration_months IS NOT excluded.duration_months
      OR accounting_ledger.next_due_date IS NOT excluded.next_due_date
      OR accounting_ledger.received_by IS NOT excluded.received_by
      OR accounting_ledger.reference_id IS NOT excluded.reference_id
  `);
  let imported = 0;
  for (const header of headers) {
    const period = parseMonthHeader(header);
    if (!period) continue;
    const amount = parseAmount(row[header]);
    if (amount === null || amount <= 0) continue;
    const invoiceNo = `MIG-${safeInvoicePart(customer.voixNo || customer.id)}-${period.year}${String(period.month).padStart(2, '0')}`;
    const result = insertPayment.run(
      customer.id,
      `${period.year}-${String(period.month).padStart(2, '0')}-01`,
      invoiceNo,
      customer.name,
      customer.customerType,
      'Imported Subscription History',
      `Legacy payment total for ${period.label}; exact payment date was not recorded in the source sheet.`,
      amount,
      amount,
      'Imported client list',
      'Legacy spreadsheet import',
      customer.id
    );
    imported += result.changes;
  }
  return imported;
}

function importCustomers(sheet) {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let paymentsImported = 0;
  let groupedCustomers = 0;
  const headers = Object.keys(sheet.rows[0] || {}).filter((header) => !header.startsWith('__'));
  const sheetName = String(sheet.sheetName || '').trim();
  const sheetEstate = /^(?:sheet\d*|customer log|blank|sales sheet|daily schedule)$/i.test(sheetName) ? '' : sheetName;

  const run = db.transaction(() => {
    for (const row of sheet.rows) {
      const estateName = cleanText(row.__estateName || value(row, 'estate name', 'estate', 'subgroup') || sheetEstate);
      const customer = upsertCustomerFromRow(row, { dateFormat: 'day-first', estateName });
      if (!customer) {
        skipped += 1;
        continue;
      }
      if (customer.created) created += 1;
      else updated += 1;
      if (customer.groupId) groupedCustomers += 1;
      paymentsImported += importMonthlyPaymentHistory(row, headers, customer);
    }
  });
  run();
  return {
    source: sheet.source,
    type: 'Customer accounts',
    customersCreated: created,
    customersUpdated: updated,
    customersGrouped: groupedCustomers,
    paymentEntriesImported: paymentsImported,
    rowsSkipped: skipped
  };
}

function findOrCreateProfileCustomer(metadata) {
  const voixNo = cleanText(metadata?.voixNo);
  if (voixNo) {
    const existing = db.prepare('SELECT id FROM customers WHERE lower(trim(voix_no)) = lower(trim(?))').get(voixNo);
    if (existing) return existing.id;
  }
  const name = cleanText(metadata?.name);
  if (name) {
    const existing = db.prepare('SELECT id FROM customers WHERE lower(trim(name)) = lower(trim(?)) ORDER BY created_at ASC LIMIT 1').get(name);
    if (existing) return existing.id;
  }
  if (!name && !voixNo) return null;

  const row = {
    name,
    'voix number': voixNo,
    'phone number': metadata?.phone || '',
    'physical address': metadata?.address || '',
    'email address': metadata?.email || '',
    'mac address': metadata?.macAddress || '',
    'account status': metadata?.status || ''
  };
  const created = upsertCustomerFromRow(row, { dateFormat: 'day-first', houseName: cleanText(metadata?.address) });
  return created?.id || null;
}

function importProfileHistory(sheet) {
  let paymentRowsImported = 0;
  let supportRowsImported = 0;
  let unlinkedProfiles = 0;
  let profileTabsImported = 0;
  const errors = [];
  const records = sheet.rows || [];
  for (const row of records) {
    try {
      const tabResult = db.transaction(() => {
        let tabPaymentRowsImported = 0;
        let tabSupportRowsImported = 0;
        let tabUnlinkedProfiles = 0;
        const metadata = row.metadata || {};
        const customerId = findOrCreateProfileCustomer(metadata);
        if (!customerId) tabUnlinkedProfiles += 1;
        const voixNo = cleanText(metadata.voixNo) || null;
        const sourceSheet = row.sourceSheet || sheet.sheetName;

      for (const payment of row.payments || []) {
        const rawData = {
          datePaid: payment.datePaidRaw,
          amount: payment.amountRaw,
          method: payment.paymentMethod,
          reference: payment.referenceNo,
          expiry: payment.expiryDateRaw,
          cells: payment.rawCells
        };
        const result = db.prepare(`
          INSERT INTO legacy_customer_payments (
            archive_id, source_name, source_sheet, source_row_number, customer_id, voix_no,
            date_paid, date_paid_raw, amount, amount_raw, payment_method, reference_no,
            expiry_date, expiry_date_raw, raw_data_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(source_name, source_sheet, source_row_number) DO UPDATE SET
            archive_id = excluded.archive_id, customer_id = excluded.customer_id,
            voix_no = excluded.voix_no, date_paid = excluded.date_paid,
            date_paid_raw = excluded.date_paid_raw, amount = excluded.amount,
            amount_raw = excluded.amount_raw, payment_method = excluded.payment_method,
            reference_no = excluded.reference_no, expiry_date = excluded.expiry_date,
            expiry_date_raw = excluded.expiry_date_raw, raw_data_json = excluded.raw_data_json
        `).run(
          sheet.archiveId,
          sheet.originalName || sheet.source.split(' · ')[0],
          sourceSheet,
          payment.sourceRowNumber,
          customerId,
          voixNo,
          toIsoDate(payment.datePaidRaw, { dayFirst: false }),
          cleanText(payment.datePaidRaw),
          parseAmount(payment.amountRaw),
          cleanText(payment.amountRaw),
          cleanText(payment.paymentMethod),
          cleanText(payment.referenceNo),
          toIsoDate(payment.expiryDateRaw, { dayFirst: false }),
          cleanText(payment.expiryDateRaw),
          JSON.stringify(rawData)
        );
        tabPaymentRowsImported += result.changes;
      }

      for (const event of row.support || []) {
        const rawData = {
          date: event.eventDateRaw,
          time: event.eventTime,
          loggedBy: event.loggedBy,
          issueCategory: event.issueCategory,
          details: event.details,
          actionTaken: event.actionTaken,
          status: event.status,
          cells: event.rawCells
        };
        const result = db.prepare(`
          INSERT INTO legacy_customer_support_history (
            archive_id, source_name, source_sheet, source_row_number, customer_id, voix_no,
            event_date, event_date_raw, event_time, logged_by, issue_category, details,
            action_taken, status, raw_data_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(source_name, source_sheet, source_row_number) DO UPDATE SET
            archive_id = excluded.archive_id, customer_id = excluded.customer_id,
            voix_no = excluded.voix_no, event_date = excluded.event_date,
            event_date_raw = excluded.event_date_raw, event_time = excluded.event_time,
            logged_by = excluded.logged_by, issue_category = excluded.issue_category,
            details = excluded.details, action_taken = excluded.action_taken,
            status = excluded.status, raw_data_json = excluded.raw_data_json
        `).run(
          sheet.archiveId,
          sheet.originalName || sheet.source.split(' · ')[0],
          sourceSheet,
          event.sourceRowNumber,
          customerId,
          voixNo,
          toIsoDate(event.eventDateRaw, { dayFirst: false }),
          cleanText(event.eventDateRaw),
          cleanText(event.eventTime),
          cleanText(event.loggedBy),
          cleanText(event.issueCategory),
          cleanText(event.details),
          cleanText(event.actionTaken),
          cleanText(event.status),
          JSON.stringify(rawData)
        );
        tabSupportRowsImported += result.changes;
      }
      return { tabPaymentRowsImported, tabSupportRowsImported, tabUnlinkedProfiles };
    })();
    paymentRowsImported += tabResult.tabPaymentRowsImported;
    supportRowsImported += tabResult.tabSupportRowsImported;
    unlinkedProfiles += tabResult.tabUnlinkedProfiles;
    profileTabsImported += 1;
    } catch (error) {
      errors.push({ sourceSheet: row.sourceSheet || '', message: error.message });
    }
  }
  return {
    source: sheet.source,
    type: 'Customer profile history',
    profileTabsImported,
    profileTabsFailed: errors.length,
    paymentRowsImported,
    supportRowsImported,
    unlinkedProfiles,
    ...(errors.length ? { message: `${errors.length} profile tab(s) could not be mapped: ${errors.map((item) => `${item.sourceSheet || 'unknown sheet'} — ${item.message}`).join('; ')}` } : {})
  };
}

function normalizeTicketStatus(value) {
  const rawStatus = cleanText(value);
  const status = rawStatus.toLowerCase();
  if (!status || /open|pending|new/.test(status)) return 'Open';
  if (/hold/.test(status)) return 'On Hold';
  if (/\bclosed\b|\bclose\b/.test(status)) return 'Closed';
  if (/complete|resolved|fixed|done/.test(status)) return 'Resolved';
  if (/escalat/.test(status)) return 'Escalated';
  return rawStatus;
}

function importQueries(sheet) {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const lookup = new Map();
  const upsert = db.transaction(() => {
    for (const row of sheet.rows) {
      const externalRef = cleanText(value(
        row,
        'vnq', 'vnq no', 'vnq number', 'vnq reference', 'ticket no', 'ticket number', 'ticket id', 'query id'
      )) || legacyRowReference('QUERY', sheet, row);

      const customerNameRaw = cleanText(value(row, 'customer name optional', 'customer name', 'customer'));
      const customerIp = cleanText(value(row, 'customer ip number', 'customer ip', 'ip address'));
      const cacheKey = `${normalizeName(customerNameRaw)}|${customerIp.toLowerCase()}`;
      let customerId = lookup.get(cacheKey);
      if (customerId === undefined) {
        customerId = resolveCustomerId(customerNameRaw, customerIp);
        lookup.set(cacheKey, customerId || null);
      }
      const matchedCustomer = customerId ? db.prepare('SELECT name FROM customers WHERE id = ?').get(customerId) : null;
      const queryType = cleanText(value(row, 'query type', 'category')) || 'General inquiry';
      const issue = cleanText(value(
        row,
        'issue description customer s words or error message', 'issue description', 'issue', 'description'
      ));
      const rawLocation = cleanText(value(row, 'location', 'estate', 'estate name', 'house', 'house name', 'address'));
      const namedScopeGroup = isMainNetworkLabel(customerNameRaw)
        ? getOrCreateCustomerGroup('Main 1', 'network')
        : findCustomerGroupByName(customerNameRaw);
      const locationScopeGroup = isMainNetworkLabel(rawLocation)
        ? getOrCreateCustomerGroup('Main 1', 'network')
        : findCustomerGroupByName(rawLocation);
      const scopeGroupIds = [...new Set([namedScopeGroup?.id, locationScopeGroup?.id].filter(Boolean))];
      const scopeGroupId = scopeGroupIds[0] || null;
      const dateReceived = toIsoDate(value(row, 'date received'), { dayFirst: false });
      const resolutionRaw = cleanText(value(row, 'resolution date time'));
      const resolutionDate = toIsoDate(resolutionRaw, { dayFirst: false });
      const resolutionTime = resolutionRaw.match(/\b(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\b/i)?.[1];
      const resolutionValue = resolutionDate
        ? `${resolutionDate}${resolutionTime ? ` ${resolutionTime.replace(/\s+/g, ' ').trim()}` : ''}`
        : resolutionRaw || null;
      const record = {
        external_ref: externalRef,
        customer_id: customerId || null,
        scope_group_id: scopeGroupId,
        customer_name: customerNameRaw || matchedCustomer?.name || (scopeGroupId ? rawLocation : 'Unlinked legacy query'),
        title: queryType,
        description: issue || queryType,
        category: queryType,
        priority: /critical|urgent|fiber cut|link down/i.test(`${queryType} ${issue}`) ? 'High' : 'Medium',
        status: normalizeTicketStatus(value(row, 'query status', 'status')),
        date_received: dateReceived,
        time_received: cleanText(value(row, 'time received')),
        customer_ip: customerIp,
        query_type: queryType,
        location: rawLocation,
        service_type: cleanText(value(row, 'service type')),
        opened_by: cleanText(value(row, 'ticket opened by', 'opened by')),
        whatsapp_sos_sent: /^(y|yes|true|1)$/i.test(cleanText(value(row, 'whatsapp sos sent y n', 'whatsapp sos sent'))) ? 1 : 0,
        assigned_to: cleanText(value(row, 'assigned to internal team', 'assigned to')),
        resolution_datetime: resolutionValue,
        mttr: cleanText(value(row, 'mttr')),
        resolution_by: cleanText(value(row, 'resolution by')),
        customer_feedback: cleanText(value(row, 'customer feedback post resolution', 'customer feedback')),
        closure_notes: cleanText(value(row, 'closure notes')),
        ticket_closed_by: cleanText(value(row, 'ticket closed by'))
      };

      const existing = db.prepare('SELECT id FROM tickets WHERE external_ref = ?').get(externalRef);
      let ticketId = existing?.id || null;
      if (existing) {
        db.prepare(`
          UPDATE tickets SET customer_id = @customer_id, scope_group_id = @scope_group_id,
            customer_name = @customer_name, title = @title, description = @description,
            category = @category, priority = @priority, status = @status,
            date_received = @date_received, time_received = @time_received,
            customer_ip = @customer_ip, query_type = @query_type, location = @location,
            service_type = @service_type, opened_by = @opened_by,
            whatsapp_sos_sent = @whatsapp_sos_sent, assigned_to = @assigned_to,
            resolution_datetime = @resolution_datetime, mttr = @mttr,
            resolution_by = @resolution_by, customer_feedback = @customer_feedback,
            closure_notes = @closure_notes, ticket_closed_by = @ticket_closed_by
          WHERE id = @id
        `).run({ ...record, id: ticketId });
        updated += 1;
      } else {
        ticketId = generateId('ticket', 'TKT');
        db.prepare(`
          INSERT INTO tickets (
            id, external_ref, customer_id, scope_group_id, customer_name, title,
            description, category, priority, status, date_received, time_received,
            customer_ip, query_type, location, service_type, opened_by,
            whatsapp_sos_sent, assigned_to, resolution_datetime, mttr, resolution_by,
            customer_feedback, closure_notes, ticket_closed_by
          ) VALUES (
            @id, @external_ref, @customer_id, @scope_group_id, @customer_name, @title,
            @description, @category, @priority, @status, @date_received, @time_received,
            @customer_ip, @query_type, @location, @service_type, @opened_by,
            @whatsapp_sos_sent, @assigned_to, @resolution_datetime, @mttr,
            @resolution_by, @customer_feedback, @closure_notes, @ticket_closed_by
          )
        `).run({ ...record, id: ticketId });
        created += 1;
      }
      db.prepare('DELETE FROM ticket_customer_links WHERE ticket_id = ?').run(ticketId);
      db.prepare('DELETE FROM ticket_scope_groups WHERE ticket_id = ?').run(ticketId);
      linkTicketToScope(ticketId, { customerId: customerId || null, groupIds: scopeGroupIds });
    }
  });
  upsert();
  return { source: sheet.source, type: 'Customer queries / tickets', queriesCreated: created, queriesUpdated: updated, rowsSkipped: skipped };
}

function normalizeDeploymentStatus(raw) {
  const status = cleanText(raw).toLowerCase();
  if (!status) return 'Awaiting Splicing';
  if (status === 'completed' || status === 'complete') return 'Completed';
  if (status.includes('progress')) return 'In Progress';
  if (status.includes('hold')) return 'On Hold';
  return cleanText(raw);
}

function importDeploymentPayment(deployment, paymentMode) {
  if (!deployment.customer_id || !deployment.date_of_payment || Number(deployment.amount) <= 0) return 0;

  const invoiceNumber = `INV-DEP-${deployment.id}`;
  let existing = db.prepare(`
    SELECT * FROM accounting_ledger
    WHERE type = 'Income' AND category = 'Installation & Setup Fee'
      AND (reference_id = ? OR inv_no = ?)
    ORDER BY id ASC LIMIT 1
  `).get(deployment.id, invoiceNumber);

  if (!existing) {
    existing = db.prepare(`
      SELECT * FROM accounting_ledger
      WHERE type = 'Income'
        AND lower(coalesce(category, '')) LIKE '%install%'
        AND entry_date = ? AND gross_amount = ?
        AND (customer_id = ? OR lower(trim(coalesce(customer_name, ''))) = lower(trim(?)))
      ORDER BY id ASC LIMIT 1
    `).get(deployment.date_of_payment, deployment.amount, deployment.customer_id, deployment.customer_name);
  }

  let changes = 0;
  const grossAmount = Number(deployment.amount);
  const netAmount = grossAmount / 1.075;
  const vatAmount = grossAmount - netAmount;
  const description = `Deployment payment for ${deployment.location}`;
  const effectivePaymentMode = paymentMode || existing?.payment_mode || 'Legacy import (method unknown)';
  if (existing) {
    changes = db.prepare(`
      UPDATE accounting_ledger
      SET customer_id = ?, entry_date = ?, customer_name = ?, customer_type = ?,
          category = 'Installation & Setup Fee', description = ?, gross_amount = ?,
          is_vat_exempt = 0, vat_rate = 7.5, vat_amount = ?, net_amount = ?,
          payment_mode = ?, duration_months = 0, next_due_date = NULL,
          received_by = coalesce(nullif(received_by, ''), 'Legacy deployment import'),
          reference_id = ?
      WHERE id = ? AND (
        customer_id IS NOT ? OR entry_date IS NOT ? OR customer_name IS NOT ?
        OR customer_type IS NOT ? OR category IS NOT 'Installation & Setup Fee'
        OR description IS NOT ? OR gross_amount IS NOT ? OR is_vat_exempt IS NOT 0
        OR vat_rate IS NOT 7.5 OR vat_amount IS NOT ? OR net_amount IS NOT ?
        OR payment_mode IS NOT ? OR duration_months IS NOT 0 OR next_due_date IS NOT NULL
        OR reference_id IS NOT ?
      )
    `).run(
      deployment.customer_id,
      deployment.date_of_payment,
      deployment.customer_name,
      deployment.customer_type || 'FTTH',
      description,
      grossAmount,
      vatAmount,
      netAmount,
      effectivePaymentMode,
      deployment.id,
      existing.id,
      deployment.customer_id,
      deployment.date_of_payment,
      deployment.customer_name,
      deployment.customer_type || 'FTTH',
      description,
      grossAmount,
      vatAmount,
      netAmount,
      effectivePaymentMode,
      deployment.id
    ).changes;
  } else {
    changes = db.prepare(`
      INSERT INTO accounting_ledger (
        customer_id, entry_date, inv_no, customer_name, customer_type, type, category,
        description, gross_amount, is_vat_exempt, vat_rate, vat_amount, net_amount,
        payment_mode, duration_months, next_due_date, received_by, reference_id
      ) VALUES (?, ?, ?, ?, ?, 'Income', 'Installation & Setup Fee', ?, ?, 0, 7.5, ?, ?, ?, 0, NULL, 'Legacy deployment import', ?)
    `).run(
      deployment.customer_id,
      deployment.date_of_payment,
      invoiceNumber,
      deployment.customer_name,
      deployment.customer_type || 'FTTH',
      description,
      grossAmount,
      vatAmount,
      netAmount,
      effectivePaymentMode,
      deployment.id
    ).changes;
  }

  const customer = db.prepare('SELECT last_payment_date FROM customers WHERE id = ?').get(deployment.customer_id);
  if (!customer?.last_payment_date || deployment.date_of_payment >= String(customer.last_payment_date).slice(0, 10)) {
    db.prepare(`
      UPDATE customers SET amount_paid = ?, last_payment_date = ?
      WHERE id = ?
    `).run(deployment.amount, deployment.date_of_payment, deployment.customer_id);
  }
  return changes;
}

function importDeployments(sheet) {
  let created = 0;
  let updated = 0;
  let paymentEntriesImported = 0;
  let skipped = 0;
  const upsert = db.transaction(() => {
    for (const row of sheet.rows) {
      const externalRef = cleanText(value(
        row,
        'column 1', 'deployment id', 'vnd', 'vnd no', 'vnd number', 'id'
      )) || legacyRowReference('DEPLOYMENT', sheet, row);
      const customerName = cleanText(value(row, 'customer name', 'customer', 'name'));
      if (!customerName) {
        skipped += 1;
        continue;
      }
      const customerId = resolveCustomerId(customerName);
      const linkedCustomer = customerId
        ? db.prepare('SELECT customer_type FROM customers WHERE id = ?').get(customerId)
        : null;
      const record = {
        external_ref: externalRef,
        customer_id: customerId,
        customer_name: customerName,
        customer_type: inferCustomerType(value(row, 'customer type', 'service type'), linkedCustomer?.customer_type || ''),
        email: cleanText(value(row, 'email address', 'email', 'contact email')),
        phone: cleanText(value(row, 'phone number', 'phone')),
        location: cleanText(value(row, 'exact address', 'location', 'address')) || 'Location not provided',
        plan: cleanText(value(row, 'service type', 'plan')) || 'FTTH',
        amount: parseAmount(value(row, 'amount paid', 'amount')) ?? 0,
        payment_mode: cleanText(value(row, 'payment mode', 'payment method', 'mode of payment')),
        status: normalizeDeploymentStatus(value(row, 'status')),
        date_of_payment: toIsoDate(value(row, 'date of payment'), { dayFirst: false }),
        priority: cleanText(value(row, 'priority')) || 'Medium',
        start_date: toIsoDate(value(row, 'start date'), { dayFirst: false }),
        end_date: toIsoDate(value(row, 'end date'), { dayFirst: false }),
        sales_made_by: cleanText(value(row, 'sales made by', 'sales made by ')),
        notes: cleanText(value(row, 'notes'))
      };
      const existing = db.prepare('SELECT id FROM deployments WHERE external_ref = ?').get(externalRef);
      if (existing) {
        db.prepare(`
          UPDATE deployments SET customer_id = @customer_id, customer_name = @customer_name,
            customer_type = @customer_type, email = coalesce(nullif(@email, ''), email),
            phone = @phone, location = @location, plan = @plan,
            amount = @amount, payment_mode = coalesce(nullif(@payment_mode, ''), payment_mode),
            status = @status, date_of_payment = @date_of_payment,
            priority = @priority, start_date = @start_date, end_date = @end_date,
            sales_made_by = @sales_made_by, notes = @notes
          WHERE id = @id
        `).run({ ...record, id: existing.id });
        updated += 1;
      } else {
        db.prepare(`
          INSERT INTO deployments (
            id, external_ref, customer_id, customer_name, customer_type, email, phone, location,
            plan, amount, payment_mode, status, date_of_payment, priority, start_date, end_date,
            sales_made_by, notes
          ) VALUES (
            @id, @external_ref, @customer_id, @customer_name, @customer_type, @email, @phone,
            @location, @plan, @amount, @payment_mode, @status, @date_of_payment, @priority,
            @start_date, @end_date, @sales_made_by, @notes
          )
        `).run({ ...record, id: generateId('deployment', 'DEP') });
        created += 1;
      }

      const deployment = db.prepare('SELECT * FROM deployments WHERE external_ref = ?').get(externalRef);
      if (deployment?.customer_id && deployment.email) {
        db.prepare("UPDATE customers SET email = ? WHERE id = ? AND (email IS NULL OR trim(email) = '')")
          .run(deployment.email, deployment.customer_id);
      }
      if (deployment) paymentEntriesImported += importDeploymentPayment(deployment, record.payment_mode);
    }
  });
  upsert();
  return {
    source: sheet.source,
    type: 'Deployments',
    deploymentsCreated: created,
    deploymentsUpdated: updated,
    paymentEntriesImported,
    rowsSkipped: skipped
  };
}

function importDaybook(sheet) {
  let imported = 0;
  let skipped = 0;
  const insert = db.prepare(`
    INSERT INTO accounting_ledger (
      entry_date, inv_no, customer_name, customer_type, type, category, description,
      gross_amount, is_vat_exempt, vat_rate, vat_amount, net_amount, payment_mode,
      duration_months, next_due_date, received_by, approved_by
    ) VALUES (?, ?, '', 'FTTH', 'Expense', ?, ?, ?, 1, 0, 0, ?, 'Legacy day book import', 0, NULL, ?, ?)
    ON CONFLICT(inv_no) DO UPDATE SET
      entry_date = excluded.entry_date,
      category = excluded.category,
      description = excluded.description,
      gross_amount = excluded.gross_amount,
      net_amount = excluded.net_amount,
      received_by = excluded.received_by,
      approved_by = excluded.approved_by
    WHERE accounting_ledger.entry_date IS NOT excluded.entry_date
      OR accounting_ledger.category IS NOT excluded.category
      OR accounting_ledger.description IS NOT excluded.description
      OR accounting_ledger.gross_amount IS NOT excluded.gross_amount
      OR accounting_ledger.net_amount IS NOT excluded.net_amount
      OR accounting_ledger.received_by IS NOT excluded.received_by
      OR accounting_ledger.approved_by IS NOT excluded.approved_by
  `);
  const run = db.transaction(() => {
    for (const row of sheet.rows) {
      const date = toIsoDate(value(row, 'date'), { dayFirst: false });
      const amount = parseAmount(value(row, 'total amount', 'amount'));
      const particulars = cleanText(value(row, 'particulars', 'description'));
      if (!date || amount === null || amount <= 0 || !particulars) {
        skipped += 1;
        continue;
      }
      const category = cleanText(value(
        row,
        'field maintanance', 'field maintenance', 'installations',
        'other expenses', 'other expenses 2', 'other expenses 3', 'category'
      )) || 'General Expense';
      const voucher = cleanText(value(row, 'voucher no', 'voucher number'));
      const invoiceNo = voucher
        ? `MIG-DAYBOOK-${safeInvoicePart(voucher)}`
        : legacyRowReference('DAYBOOK', sheet, row);
      const approvedBy = cleanText(value(row, 'approved by'));
      imported += insert.run(
        date,
        invoiceNo,
        category,
        particulars,
        amount,
        amount,
        approvedBy || 'Legacy day book',
        approvedBy || 'Legacy day book'
      ).changes;
    }
  });
  run();
  return { source: sheet.source, type: 'Day book expenses', ledgerEntriesImported: imported, rowsSkipped: skipped };
}

function ensureCustomerForIncome(name, customerType) {
  const found = customerMap().byName.get(normalizeName(name));
  if (found) return found;
  const customer = upsertCustomerFromRow({
    name,
    'customer type': customerType,
    'service type': customerType
  });
  return customer ? db.prepare('SELECT id, voix_no, name, customer_type FROM customers WHERE id = ?').get(customer.id) : null;
}

function importIncome(sheet) {
  let imported = 0;
  let skipped = 0;
  const insert = db.prepare(`
    INSERT INTO accounting_ledger (
      customer_id, entry_date, inv_no, customer_name, customer_type, type, category,
      description, gross_amount, is_vat_exempt, vat_rate, vat_amount, net_amount,
      payment_mode, duration_months, next_due_date, received_by, reference_id
    ) VALUES (?, ?, ?, ?, ?, 'Income', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(inv_no) DO UPDATE SET
      customer_id = excluded.customer_id,
      entry_date = excluded.entry_date,
      customer_name = excluded.customer_name,
      customer_type = excluded.customer_type,
      category = excluded.category,
      description = excluded.description,
      gross_amount = excluded.gross_amount,
      is_vat_exempt = excluded.is_vat_exempt,
      vat_rate = excluded.vat_rate,
      vat_amount = excluded.vat_amount,
      net_amount = excluded.net_amount,
      payment_mode = excluded.payment_mode,
      duration_months = excluded.duration_months,
      next_due_date = excluded.next_due_date,
      received_by = excluded.received_by,
      reference_id = excluded.reference_id
    WHERE accounting_ledger.customer_id IS NOT excluded.customer_id
      OR accounting_ledger.entry_date IS NOT excluded.entry_date
      OR accounting_ledger.customer_name IS NOT excluded.customer_name
      OR accounting_ledger.customer_type IS NOT excluded.customer_type
      OR accounting_ledger.category IS NOT excluded.category
      OR accounting_ledger.description IS NOT excluded.description
      OR accounting_ledger.gross_amount IS NOT excluded.gross_amount
      OR accounting_ledger.is_vat_exempt IS NOT excluded.is_vat_exempt
      OR accounting_ledger.vat_rate IS NOT excluded.vat_rate
      OR accounting_ledger.vat_amount IS NOT excluded.vat_amount
      OR accounting_ledger.net_amount IS NOT excluded.net_amount
      OR accounting_ledger.payment_mode IS NOT excluded.payment_mode
      OR accounting_ledger.duration_months IS NOT excluded.duration_months
      OR accounting_ledger.next_due_date IS NOT excluded.next_due_date
      OR accounting_ledger.received_by IS NOT excluded.received_by
      OR accounting_ledger.reference_id IS NOT excluded.reference_id
  `);
  const run = db.transaction(() => {
    for (const row of sheet.rows) {
      const customerName = cleanText(value(row, 'customer name', 'customer enterprise'));
      const date = toIsoDate(value(row, 'date', 'entry date'), { dayFirst: false });
      const gross = parseAmount(value(row, 'gross amount', 'amount'));
      if (!customerName || !date || gross === null || gross <= 0) {
        skipped += 1;
        continue;
      }
      const inferredCustomerType = inferCustomerType(value(row, 'customer type', 'type'), '');
      const customer = ensureCustomerForIncome(customerName, inferredCustomerType);
      const customerType = customer?.customer_type || inferredCustomerType;
      const invoiceNo = cleanText(value(row, 'invoice number', 'invoice no', 'invoice', 'inv no'))
        || legacyRowReference('INCOME', sheet, row);
      const exemptRaw = value(row, 'vat exempt', 'is vat exempt');
      const isVatExempt = exemptRaw === true || /^(yes|true|1|exempt)$/i.test(cleanText(exemptRaw)) ? 1 : 0;
      const vatRate = parseAmount(value(row, 'vat rate')) ?? (isVatExempt ? 0 : 7.5);
      const vatAmount = parseAmount(value(row, 'vat amount')) ?? 0;
      const netAmount = parseAmount(value(row, 'net amount')) ?? Math.max(0, gross - vatAmount);
      const durationMonths = parseAmount(value(row, 'duration months')) ?? 0;
      const nextDueDate = toIsoDate(value(row, 'next due date'), { dayFirst: false });
      const result = insert.run(
        customer?.id || null,
        date,
        invoiceNo,
        customerName,
        customerType,
        cleanText(value(row, 'category')) || 'Imported Income',
        cleanText(value(row, 'description')) || 'Imported legacy income record',
        gross,
        isVatExempt,
        vatRate,
        vatAmount,
        netAmount,
        cleanText(value(row, 'payment mode', 'payment method')) || 'Imported day book',
        durationMonths,
        nextDueDate,
        cleanText(value(row, 'received by')) || 'Legacy spreadsheet import',
        customer?.id || null
      );
      imported += result.changes;
    }
  });
  run();
  return { source: sheet.source, type: 'Income day book', ledgerEntriesImported: imported, rowsSkipped: skipped };
}

const importOrder = { customers: 0, income: 1, deployments: 2, queries: 3, daybook: 4, profile_history: 5, raw: 6 };

function archiveUploadedFile(file) {
  const buffer = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer || '');
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  db.prepare(`
    INSERT INTO import_archives (original_name, sha256, mime_type, file_data)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(sha256) DO UPDATE SET
      original_name = excluded.original_name,
      mime_type = excluded.mime_type,
      last_imported_at = CURRENT_TIMESTAMP
  `).run(
    String(file.originalname || 'Uploaded spreadsheet'),
    sha256,
    file.mimetype || null,
    buffer
  );
  const archive = db.prepare('SELECT id FROM import_archives WHERE sha256 = ?').get(sha256);
  return { id: archive.id, sha256, bytes: buffer.length };
}

function persistRawSourceRows(archiveId, sheets) {
  const insert = db.prepare(`
    INSERT INTO legacy_import_rows (
      archive_id, sheet_name, source_row_number, record_kind, row_data_json
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(archive_id, sheet_name, source_row_number) DO UPDATE SET
      record_kind = excluded.record_kind,
      row_data_json = excluded.row_data_json
    WHERE legacy_import_rows.record_kind IS NOT excluded.record_kind
      OR legacy_import_rows.row_data_json IS NOT excluded.row_data_json
  `);
  let sourceRowsPreserved = 0;
  let rowsChanged = 0;
  const saveRows = db.transaction(() => {
    for (const sheet of sheets) {
      sheet.archiveId = archiveId;
      for (const row of sheet.archiveRows || []) {
        sourceRowsPreserved += 1;
        const rowData = JSON.stringify({
          headers: row.headers || null,
          cells: row.cells
        });
        rowsChanged += insert.run(
          archiveId,
          String(sheet.sheetName || 'Sheet1'),
          Number(row.rowNumber) || 0,
          sheet.kind || 'raw',
          rowData
        ).changes;
      }
    }
  });
  saveRows();
  return { sourceRowsPreserved, rowsChanged };
}

export function importLegacyFiles(files) {
  const parsedSheets = [];
  const summaries = [];

  for (const file of files) {
    const originalName = String(file.originalname || 'Uploaded spreadsheet');
    let archive;
    try {
      archive = archiveUploadedFile(file);
    } catch (error) {
      summaries.push({ source: originalName, type: 'Import error', message: `The original file could not be archived: ${error.message}` });
      continue;
    }

    let sheets = [];
    let parseError = null;
    try {
      sheets = readMigrationFile(file);
      for (const sheet of sheets) sheet.originalName = originalName;
    } catch (error) {
      parseError = error;
    }

    let rawSummary = { sourceRowsPreserved: 0, rowsChanged: 0 };
    try {
      rawSummary = persistRawSourceRows(archive.id, sheets);
    } catch (error) {
      summaries.push({
        source: originalName,
        type: 'Import error',
        archiveId: archive.id,
        fileSha256: archive.sha256,
        message: `The source file was archived, but its rows could not be indexed: ${error.message}`
      });
    }
    summaries.push({
      source: `Archived original · ${originalName}`,
      originalName,
      type: 'Original file archived',
      archiveId: archive.id,
      fileSha256: archive.sha256,
      fileBytes: archive.bytes,
      sheetsArchived: sheets.length,
      sourceRowsPreserved: rawSummary.sourceRowsPreserved,
      sourceRowsAddedOrUpdated: rawSummary.rowsChanged
    });

    if (parseError) {
      summaries.push({ source: originalName, type: 'Import error', message: parseError.message });
      continue;
    }
    if (sheets.length === 0) {
      summaries.push({ source: originalName, type: 'Not recognized', rowsSkipped: 0, message: 'The file is retained unchanged, but no readable spreadsheet tables were found.' });
      continue;
    }
    if (!sheets.some((sheet) => sheet.kind !== 'raw')) {
      summaries.push({ source: originalName, type: 'Not recognized', rowsSkipped: 0, message: 'The file is retained unchanged; none of its sheets matched a mapped ERP record type.' });
    }
    parsedSheets.push(...sheets);
  }

  const sheetsToImport = [];
  const profileBatches = new Map();
  for (const sheet of parsedSheets) {
    if (sheet.kind !== 'profile_history') {
      sheetsToImport.push(sheet);
      continue;
    }
    const batchKey = `${sheet.archiveId || ''}:${sheet.originalName || sheet.source}`;
    if (!profileBatches.has(batchKey)) {
      profileBatches.set(batchKey, {
        ...sheet,
        source: sheet.originalName || sheet.source.split(' · ')[0],
        sheetName: 'profile tabs',
        rows: []
      });
    }
    profileBatches.get(batchKey).rows.push(...sheet.rows);
  }
  sheetsToImport.push(...profileBatches.values());
  sheetsToImport.sort((a, b) => (importOrder[a.kind] ?? 99) - (importOrder[b.kind] ?? 99));
  for (const sheet of sheetsToImport) {
    try {
      if (sheet.kind === 'customers') summaries.push(importCustomers(sheet));
      else if (sheet.kind === 'income') summaries.push(importIncome(sheet));
      else if (sheet.kind === 'deployments') summaries.push(importDeployments(sheet));
      else if (sheet.kind === 'queries') summaries.push(importQueries(sheet));
      else if (sheet.kind === 'daybook') summaries.push(importDaybook(sheet));
      else if (sheet.kind === 'profile_history') summaries.push(importProfileHistory(sheet));
    } catch (error) {
      summaries.push({ source: sheet.source, type: 'Import error', message: error.message });
    }
  }

  const totals = summaries.reduce((result, summary) => {
    for (const [key, amount] of Object.entries(summary)) {
      if (key.endsWith('Imported') || key.endsWith('Created') || key.endsWith('Updated') || key === 'rowsSkipped' || key === 'sourceRowsPreserved') {
        result[key] = (result[key] || 0) + (Number(amount) || 0);
      }
    }
    return result;
  }, {});

  return { summaries, totals };
}
