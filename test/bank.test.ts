import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fold, lookupBank, lookupBranch, verifyBankBranch, yuchoToTransfer } from '../src/bank.ts';

test('銀行の検索', () => {
  assert.equal(lookupBank('0001').banks[0].name, 'みずほ');
  assert.equal(lookupBank('みずほ銀行').banks[0].bank_code, '0001');
  assert.equal(lookupBank('ﾐｽﾞﾎ').banks[0].bank_code, '0001');
  assert.ok(lookupBank('三菱UFJ').banks.some((b) => b.bank_code === '0005'));
});
test('支店の検索と照合', () => {
  const r = lookupBranch('0001', '001');
  assert.equal(r.count, 1);
  const v = verifyBankBranch('0001', r.branches[0].branch_code);
  assert.equal(v.valid, true);
  assert.equal(verifyBankBranch('0001', '999').valid, false);
  assert.ok(lookupBranch('みずほ', '東京').count >= 1);
});
test('ゆうちょの変換（公式の例）', () => {
  const a = yuchoToTransfer('11940', '12345671');
  assert.equal(a.branch_code, '198');
  assert.equal(a.branch_name, '一九八店');
  assert.equal(a.branch_kana, 'イチキユウハチ');
  assert.equal(a.account_number, '1234567');
  const b = yuchoToTransfer('11940', '1234561');
  assert.equal(b.account_number_7digits, '0123456');
  const c = yuchoToTransfer('01940', '123456');
  assert.equal(c.branch_code, '199');
  assert.equal(c.branch_name, '一九九店');
  assert.equal(c.account_number_7digits, '0123456');
  assert.equal(yuchoToTransfer('01940', '12345').account_number_7digits, '0012345');
  assert.throws(() => yuchoToTransfer('11940', '12345670'));
});
test('名前の照合のそろえ', () => {
  assert.equal(fold('ｶﾞｲｺｸ'), fold('がいこく'));
});
