# ast-v8-to-istanbul 1.0.6-project.1

The producer package this repository installs is the upstream `ast-v8-to-istanbul` 1.0.6 distribution with one reviewed patch. It is built and verified by `scripts/build-coverage-producer.mjs`; every value below is pinned in that tool's `DELIVERY` constant and checked by `npm run coverage:producer:build -- --verify`.

## Upstream

- Package: `ast-v8-to-istanbul` 1.0.6, author Ari Perkkiö, MIT license
- Repository: <https://github.com/AriPerkkio/ast-v8-to-istanbul>
- Tarball: <https://registry.npmjs.org/ast-v8-to-istanbul/-/ast-v8-to-istanbul-1.0.6.tgz>
- Registry integrity: `sha512-fvpl29helSO2w/z7utIbrkNXILdrLwDwAMH2I/zPKlGf5244+gf+B4cyS1sANcrPY2h+hWCGSgC8N61s/+AF9A==`
- Tarball SHA-256: `1be5784000618a0cf44f24d88aef3edd30ee8021414b3ed96a49c693c7aaa404`

Upstream entries (SHA-256):

- `package/LICENSE`: `7771f0b6f55e76efe99cb8e6fdbff583193c9bdfd74d41620d330cc3db6b913a`
- `package/README.md`: `9e51b017ef327dd6d004c2f0d7b031572a2f954562c37e3e4d6945b83360ddae`
- `package/dist/index.d.mts`: `7e4de81c67aaa01f9202bb56242f85355e6a78bd327260294e8e26ada36f4b02`
- `package/dist/index.mjs`: `0ce3ec436049c66fff8757450230369156ee2126f52d06b41f99780e497d0a79`
- `package/package.json`: `a9a1858c8b20842c0019b83fef8460cffb24e4b1264427362abc38ee4cb28eb9`

## Patch

`ast-v8-to-istanbul-1.0.6.patch`, SHA-256 `a2884779313619c7422227896e6f9541aec8de8e525b92c679eea5acf774a068`.

The unmodified walker marks every nested `LogicalExpression` of a chain as skipped so that only the outermost node registers the branch, and then treats that skip as an ignored subtree on entry. A callback inside the left operand of `a && b && c`, its body statements and its branches were never registered, and a consumer scored that body from the enclosing function alone. The patch keeps the branch deduplication and stops the skipped node from becoming an ignore boundary. It also sets the package version to `1.0.6-project.1`.

The patch applies with exact context only. Reverse-applied to the delivered entries, it must reproduce the upstream digests above.

## License

`LICENSE` is the upstream MIT license, byte for byte, SHA-256 `7771f0b6f55e76efe99cb8e6fdbff583193c9bdfd74d41620d330cc3db6b913a`.

## Delivered archive

`ast-v8-to-istanbul-1.0.6-project.1.tgz`, packed with `npm pack` from the patched entries in two separately created temporary directories that produced byte-identical archives.

- Integrity: `sha512-6KzTeECN1o+Xo9KtrN78sK5gWF37nL1vZYxrVTj/iBCE2qPGC/si5KnuDfDYV6KihNMwlMdjWciZMnsrI93fEg==`
- SHA-256: `ef911b69325c681e15dfc141a5872a356c2333fb8153953fbfe8519265da2e49`

Delivered entries (SHA-256):

- `package/LICENSE`: `7771f0b6f55e76efe99cb8e6fdbff583193c9bdfd74d41620d330cc3db6b913a`
- `package/README.md`: `9e51b017ef327dd6d004c2f0d7b031572a2f954562c37e3e4d6945b83360ddae`
- `package/dist/index.d.mts`: `7e4de81c67aaa01f9202bb56242f85355e6a78bd327260294e8e26ada36f4b02`
- `package/dist/index.mjs`: `29377dc2bb113e40525edb050434420b0d071122c9aa382174a8d622a35c8874`
- `package/package.json`: `e188df9ab9e07a4cc4e6012930ae719cf4bb4344d2e8bbbcb0b6539947022685`

## Reproduction

```sh
npm run coverage:producer:build -- --build
npm run coverage:producer:build -- --verify
```

`--build` downloads the upstream tarball, refuses it unless its integrity is the value above, applies the patch, packs twice and writes the archive and license here; `--verify` reads only the vendored files. The archive bytes depend on the `npm pack` implementation; a rebuild under another npm that changes them is drift to review, never something to accept silently.
