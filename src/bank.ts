// 日本の銀行・支店コードの照合と、ゆうちょ銀行の記号番号→振込用の変換。
// データ: zengin-code/source-data（MIT）。ゆうちょの規則: ゆうちょ銀行「記号・番号から振込用の店名・預金種目・口座番号への変換の公式」。
import zengin from '../data/zengin.json';

export class InputError extends Error {}

interface Bank { n: string; k: string; r: string; b: Record<string, [string, string]> }
const DATA = zengin as unknown as { updated_at: string; banks: Record<string, Bank> };
export const DATA_UPDATED_AT = `${DATA.updated_at.slice(0, 4)}-${DATA.updated_at.slice(4, 6)}-${DATA.updated_at.slice(6, 8)}`;

const SMALL: Record<string, string> = { ァ: 'ア', ィ: 'イ', ゥ: 'ウ', ェ: 'エ', ォ: 'オ', ャ: 'ヤ', ュ: 'ユ', ョ: 'ヨ', ッ: 'ツ', ヮ: 'ワ' };

/** 名前の照合用にそろえる: 全角英数・半角カナ・ひらがなをカタカナへ、小書きを大きく、空白と記号と長音を取る。 */
export function fold(s: string): string {
  let t = s.normalize('NFKC'); // 半角カナ＋濁点もここで全角に
  t = t.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
  t = [...t].map((c) => SMALL[c] ?? c).join('');
  return t.replace(/[\sー・()（）.,\-]/g, '').toUpperCase();
}

const BANK_SUFFIXES = ['銀行', '信用金庫', '信用組合', '労働金庫', '農業協同組合', 'ギンコウ', 'シンキン', 'シンクミ'];
function stripSuffix(s: string): string {
  let t = s;
  for (const suf of BANK_SUFFIXES) t = t.replace(new RegExp(suf + '$'), '');
  return t;
}

function requireString(value: unknown, field: string, max = 40): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) throw new InputError(`${field} must be a non-empty string (max ${max} chars)`);
  return value.trim();
}

function bankOut(code: string, b: Bank) {
  return { bank_code: code, name: b.n, kana: b.k, branches: Object.keys(b.b).length };
}

function digits(s: string): string {
  return s.normalize('NFKC').replace(/[\s\-]/g, '');
}

export function lookupBank(query: unknown) {
  const q = requireString(query, 'query');
  const d = digits(q);
  if (/^\d{1,4}$/.test(d)) {
    const code = d.padStart(4, '0');
    const b = DATA.banks[code];
    return { query: q, data_updated_at: DATA_UPDATED_AT, count: b ? 1 : 0, banks: b ? [bankOut(code, b)] : [] };
  }
  const f = stripSuffix(fold(q));
  const hits: Array<[number, string, Bank]> = [];
  for (const [code, b] of Object.entries(DATA.banks)) {
    const names = [fold(b.n), fold(b.k), fold(b.r)];
    if (names.some((x) => x === f)) hits.push([0, code, b]);
    else if (names.some((x) => x.startsWith(f))) hits.push([1, code, b]);
    else if (names.some((x) => x.includes(f))) hits.push([2, code, b]);
  }
  hits.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
  return { query: q, data_updated_at: DATA_UPDATED_AT, count: hits.length, banks: hits.slice(0, 20).map(([, c, b]) => bankOut(c, b)) };
}

function resolveBank(value: unknown): [string, Bank] {
  const q = requireString(value, 'bank');
  const d = digits(q);
  if (/^\d{1,4}$/.test(d)) {
    const code = d.padStart(4, '0');
    const b = DATA.banks[code];
    if (!b) throw new InputError(`no bank with code ${code} (data as of ${DATA_UPDATED_AT})`);
    return [code, b];
  }
  const r = lookupBank(q);
  if (r.count === 0) throw new InputError(`no bank matches "${q}"`);
  if (r.count > 1 && fold(r.banks[0].name) !== stripSuffix(fold(q)) && fold(r.banks[0].kana) !== stripSuffix(fold(q))) {
    throw new InputError(`"${q}" matches ${r.count} banks; pass the 4-digit bank code. Candidates: ${r.banks.slice(0, 8).map((b) => `${b.bank_code} ${b.name}`).join(', ')}`);
  }
  const code = r.banks[0].bank_code;
  return [code, DATA.banks[code]];
}

export function lookupBranch(bank: unknown, query: unknown) {
  const [bankCode, b] = resolveBank(bank);
  const q = requireString(query, 'query');
  const d = digits(q);
  let hits: Array<[string, [string, string]]>;
  if (/^\d{1,3}$/.test(d)) {
    const code = d.padStart(3, '0');
    hits = b.b[code] ? [[code, b.b[code]]] : [];
  } else {
    const f = fold(q).replace(/(支店|出張所|営業部|シテン)$/, '');
    const scored: Array<[number, string, [string, string]]> = [];
    for (const [code, br] of Object.entries(b.b)) {
      const names = [fold(br[0]), fold(br[1])];
      if (names.some((x) => x === f)) scored.push([0, code, br]);
      else if (names.some((x) => x.startsWith(f))) scored.push([1, code, br]);
      else if (names.some((x) => x.includes(f))) scored.push([2, code, br]);
    }
    scored.sort((x, y) => x[0] - y[0] || x[1].localeCompare(y[1]));
    hits = scored.map(([, c, br]) => [c, br]);
  }
  return {
    bank_code: bankCode,
    bank_name: b.n,
    query: q,
    data_updated_at: DATA_UPDATED_AT,
    count: hits.length,
    branches: hits.slice(0, 30).map(([code, [name, kana]]) => ({ branch_code: code, name, kana })),
  };
}

export function verifyBankBranch(bankCode: unknown, branchCode: unknown) {
  const bc = digits(requireString(bankCode, 'bank_code', 8));
  const brc = digits(requireString(branchCode, 'branch_code', 8));
  if (!/^\d{4}$/.test(bc)) throw new InputError('bank_code must be 4 digits');
  if (!/^\d{3}$/.test(brc)) throw new InputError('branch_code must be 3 digits');
  const b = DATA.banks[bc];
  if (!b) return { valid: false, reason: `no bank with code ${bc}`, data_updated_at: DATA_UPDATED_AT };
  const br = b.b[brc];
  if (!br) {
    return { valid: false, bank_code: bc, bank_name: b.n, reason: `bank ${bc} (${b.n}) has no branch ${brc}. It may be closed or merged, or newer than this data`, data_updated_at: DATA_UPDATED_AT };
  }
  return { valid: true, bank_code: bc, bank_name: b.n, bank_kana: b.k, branch_code: brc, branch_name: br[0], branch_kana: br[1], data_updated_at: DATA_UPDATED_AT };
}

const KANJI = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const KANA_READ = ['ゼロ', 'イチ', 'ニ', 'サン', 'ヨン', 'ゴ', 'ロク', 'ナナ', 'ハチ', 'キユウ'];

export function yuchoToTransfer(symbolValue: unknown, numberValue: unknown) {
  const symbol = digits(requireString(symbolValue, 'symbol', 12));
  const number = digits(requireString(numberValue, 'number', 16));
  if (!/^[01]\d{4}$/.test(symbol)) throw new InputError('symbol (記号) must be 5 digits starting with 1 (通常貯金) or 0 (振替口座)');
  if (!/^\d{1,8}$/.test(number)) throw new InputError('number (番号) must be up to 8 digits');
  const passbook = symbol[0] === '1';
  const branchCode = symbol.slice(1, 3) + (passbook ? '8' : '9');
  let account: string;
  if (passbook) {
    if (!number.endsWith('1')) throw new InputError('for a 記号 starting with 1, the 番号 ends with 1 (that last 1 is dropped). Check the number');
    account = number.slice(0, -1);
  } else {
    account = number;
  }
  if (account.length === 0 || account.length > 7) throw new InputError('the resulting account number must be 1-7 digits');
  const branchName = [...branchCode].map((c) => KANJI[Number(c)]).join('') + '店';
  const branchKana = [...branchCode].map((c) => KANA_READ[Number(c)]).join('');
  const listed = DATA.banks['9900']?.b[branchCode];
  return {
    bank_code: '9900',
    bank_name: 'ゆうちょ銀行',
    branch_code: branchCode,
    branch_name: branchName,
    branch_kana: branchKana,
    account_type: passbook ? '普通預金 (savings; 通常貯蓄貯金 is 貯蓄預金)' : '当座預金 (checking)',
    account_number: account,
    account_number_7digits: account.padStart(7, '0'),
    branch_in_bank_data: Boolean(listed),
    warning: listed ? null : `branch ${branchCode} is not in the Japan Post Bank branch list (as of ${DATA_UPDATED_AT}); the 記号 may be mistyped`,
    note: 'Converted with Japan Post Bank\'s official rule. Some banks want the 7-digit form with leading zeros. Nothing you send is stored.',
  };
}
