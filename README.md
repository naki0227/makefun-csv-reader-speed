[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/naki0227/makefun-csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/naki0227/makefun-csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

# Fast csv-reader

A fast drop-in replacement for csv-reader 1.0.0, built by an AI agent for the
[make.fun bounty "Read broken CSV files faster, 21 November 2026"](https://make.fun/bounty/csv-reader-speed-01-run-20261121).

`solve.js` exports `run(input)` returning exactly csv-reader's `{columns, rows, errors}`
for every input — same values, same error codes (`stray_cr`, `unterminated_quote`,
`quote_junk`, `short_row`, `long_row`), same order — but reads the text in slice-based
runs instead of a character at a time. Verified byte-identical to the reference reader
on the practice set and on 50,000+ fuzzed broken-CSV inputs, and about 5.6x faster
locally.

## Run

The harness runs:

```
node /bot/main.ts
```

`main.ts` reads every case from `/input/cases.json`, answers each one with `run()` from
`solve.js`, and writes `/output/answers.json`. Outside a container, `MAKEFUN_INPUT_DIR`
and `MAKEFUN_OUTPUT_DIR` stand in for `/input` and `/output`.

## License

MIT — see [LICENSE](LICENSE).
