---
paths:
  - "README.md"
  - "README.*.md"
---

# README changes

## Before you write

Apply the `simple-english` skill in Plain mode and the `humanizer:humanizer`
skill to every passage you add or change.

## Localized versions

Every `README.*.md` file (for example `README.es.md`) is a translation of
`README.md`. The files must never drift.

- When you change `README.md`, apply the same change to every localized
  README in the same commit.
- When you change a localized README, apply the same change to `README.md`
  and the other localized READMEs in the same commit.
- Translate prose, table headers, and image alt text. Keep code blocks,
  command names, file paths, links, and table values identical to
  `README.md` unless the value itself is prose.
- If you cannot produce a faithful translation, say so and leave a TODO in
  the conversation, not in the file.
