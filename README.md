# Japan Bank Code MCP

An MCP server for the Japanese bank codes an agent needs when paying or getting paid in Japan:

- **Bank lookup** — 4-digit bank code (金融機関コード) ⇄ name, by kanji, kana (full or half width) or romaji. 1,146 institutions: banks, shinkin, credit unions, JA, labor banks
- **Branch lookup** — 3-digit branch code (支店コード) ⇄ branch name and kana. 28,944 branches
- **Transfer pre-check** — verify a bank + branch pair and get the official kana used in zengin transfer files
- **Japan Post Bank conversion** — ゆうちょ 記号・番号 → branch code, 漢数字 branch name, account type and account number for transfers from other banks (official rule)

No API key, no sign-in, read-only. Nothing you send is stored.

## Connect

Streamable HTTP endpoint: `https://jp-bank-code-mcp.nichika2000823.workers.dev/mcp`

```bash
claude mcp add --transport http jp-bank-code https://jp-bank-code-mcp.nichika2000823.workers.dev/mcp
```

Any MCP client that supports remote (Streamable HTTP) servers works the same way: Cursor, VS Code, ChatGPT, Gemini CLI.

## Tools

| Tool | What it does |
|---|---|
| `lookup_bank` | `ﾐｽﾞﾎ` → 0001 みずほ |
| `lookup_branch` | bank 0001 + `東京` → matching branches with codes |
| `verify_bank_branch` | 0001 / 999 → not found (closed, merged or newer than the data) |
| `yucho_to_transfer` | 11940-12345671 → 198 一九八店 普通 1234567 |

## 日本語

金融機関コード・支店コードを名前やカナで引き、振込の前に銀行と支店の組み合わせを確かめ、ゆうちょ銀行の記号番号を他行からの振込用（店名・店番・口座番号）に変える MCP サーバーです。

## Data

Bank and branch data: [zengin-code/source-data](https://github.com/zengin-code/source-data) (MIT). Each result shows `data_updated_at`; branches opened, closed or merged after that date may be missing. Japan Post Bank rule: ゆうちょ銀行「記号・番号から振込用の店名・預金種目・口座番号への変換の公式」.

Usage is counted with a salted hash of the caller that rotates every two weeks; raw IP addresses are not stored.

MIT License.
