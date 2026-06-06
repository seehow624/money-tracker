// Parse TnG eWallet PDF txt and emit transactions.
// Input: path to a `pdftotext -layout` output (defaults to statements/tng_layout.txt).
// Output: statements/tng-parsed.json
import { readFileSync, writeFileSync } from 'node:fs';

const INPUT = process.argv[2] || 'statements/tng_layout.txt';
const OUTPUT = process.argv[3] || 'statements/tng-parsed.json';

const text = readFileSync(INPUT, 'utf-8');

// Each transaction line starts with: DD/M/YYYY  <Status>  Type ... RM<amount>  RM<balance>
// PDF can split a single transaction across multiple lines (e.g. when the description
// column wraps). We pre-merge continuation lines back onto the row that starts with a date.
const DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}/;
const AMT_RE = /RM[\d.,]+\s+RM[-\d.,]+\s*$/;
const ENTRY_RE = /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(Success|Reversed|Pending|Failed)\s+(.+?)\s+RM([\d.,]+)\s+RM([-\d.,]+)\s*$/;

function stripLeading(s) {
  // Strip leading whitespace, form-feed (\f) and vertical-tab (\v). Page breaks in
  // pdftotext output emit \f, which would otherwise prevent ^date matching.
  return s.replace(/^[\s\f\v]+/, '');
}

const rawLines = text.split('\n');
const merged = [];
for (let i = 0; i < rawLines.length; i++) {
  const line = stripLeading(rawLines[i]);
  if (!DATE_RE.test(line)) continue;
  if (AMT_RE.test(line)) {
    merged.push(line);
    continue;
  }
  // Date row but no amount yet — append continuation rows until we hit RM..RM,
  // a blank row, or the next date row.
  let combined = line;
  let j = i + 1;
  while (j < rawLines.length) {
    const next = stripLeading(rawLines[j]);
    if (!next) { j++; continue; }
    if (DATE_RE.test(next)) break;
    combined += ' ' + next;
    if (AMT_RE.test(combined)) break;
    j++;
  }
  if (AMT_RE.test(combined)) {
    merged.push(combined);
    i = j; // skip past consumed continuation rows
  }
  // Else: orphan date row with no amount — silently drop. Shouldn't happen for valid statements.
}

// Order matters: longer / more specific prefixes first so "Card Reload" payments
// don't false-match the bare "Reload" type, etc.
const types = [
  'Payment Cancelled',  // before 'Payment'
  'Receive from Wallet',
  'eWallet Cash Out',
  'DuitNow QR TNGD',    // before 'DuitNow QR'
  'DuitNow QR',
  'DUITNOW_RECEI',
  'Transfer to Wallet',
  'Money Packet',
  'PayDirect Payment TNGCF',
  'Refund',
  'GO+ Daily Earnings',
  'GO+ Cash In',
  'Balance Top Up',
  'RFID Payment',       // before 'Payment'
  'Reload',
  'Payment',
];

const txns = [];
let dropped = { nonSuccess: 0, paymentCancelled: 0, untypedRow: 0 };

for (const line of merged) {
  const m = line.match(ENTRY_RE);
  if (!m) continue;
  const [, dateStr, status, middle, amtStr, balStr] = m;

  // PDF rows with status != 'Success' represent failed/pending attempts that didn't
  // affect the balance net of their compensating entry. Drop them at parse time.
  if (status !== 'Success') { dropped.nonSuccess++; continue; }

  let type = null;
  for (const t of types) {
    if (middle.startsWith(t)) { type = t; break; }
  }
  if (!type) { dropped.untypedRow++; continue; }

  // 'Payment Cancelled' is the refund leg of a Reversed Payment pair (the deduction
  // is filtered above by status, so the matching refund must also be dropped to avoid
  // a phantom inflow).
  if (type === 'Payment Cancelled') { dropped.paymentCancelled++; continue; }

  const desc = middle.slice(type.length).trim();
  const [d, mo, y] = dateStr.split('/');
  const date = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const amount = parseFloat(amtStr.replace(/,/g, ''));
  const balance = parseFloat(balStr.replace(/,/g, ''));
  txns.push({ date, status, type, desc, amount, balance });
}

// Summary
const byType = {};
for (const t of txns) byType[t.type] = (byType[t.type] || 0) + 1;
console.log(`Merged transaction rows: ${merged.length}`);
console.log(`Parsed Success entries: ${txns.length}`);
console.log(`Dropped: ${dropped.nonSuccess} non-Success, ${dropped.paymentCancelled} Payment Cancelled, ${dropped.untypedRow} untyped`);
console.log('\nCounts by type:');
for (const [k, v] of Object.entries(byType).sort()) console.log(`  ${k}: ${v}`);

console.log('\nFirst 5:');
for (const t of txns.slice(0, 5)) console.log(`  ${t.date} ${t.type} ${t.amount} bal=${t.balance} | ${t.desc}`);
console.log('\nLast 5:');
for (const t of txns.slice(-5)) console.log(`  ${t.date} ${t.type} ${t.amount} bal=${t.balance} | ${t.desc}`);

writeFileSync(OUTPUT, JSON.stringify(txns, null, 2));
console.log(`\nSaved ${txns.length} entries to ${OUTPUT}`);
