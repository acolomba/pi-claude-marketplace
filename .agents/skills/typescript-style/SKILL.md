---
name: typescript-style
description: TypeScript style for this project -- the Google Style Guide rules the toolchain does not enforce, the comment and test-title policy, and how to review against them. Use when writing, changing, or reviewing any .ts file.
---

# TypeScript style

Points this project decides for itself, rather than taking from the guide, are marked *(project)*.

When reviewing, review the files in the change under review. New files follow the rules completely; in an existing file, new code follows the file's conventions where the rules are silent but never violates a rule. Do not demand cleanups of unchanged code. Flag style-only churn mixed into a functional change; style-only edits go in their own change.

## Read before you act

| When you                                                        | Read                                                        |
| --------------------------------------------------------------- | ----------------------------------------------------------- |
| change any `.ts` file: imports, exports, declarations, literals | `.agents/skills/typescript-style/rules/modules-and-data.md` |
| write or change a class                                         | `.agents/skills/typescript-style/rules/classes.md`          |
| write or change a function, its control flow, or its errors     | `.agents/skills/typescript-style/rules/functions.md`        |
| declare or change a type, an assertion, or a generic            | `.agents/skills/typescript-style/rules/types.md`            |
| name something or write JSDoc                                   | `.agents/skills/typescript-style/rules/naming-and-docs.md`  |
| write or change a comment or a test title                       | `.agents/skills/typescript-style/rules/comments.md`         |
| review a change, or check your own before finishing             | `.agents/skills/typescript-style/rules/review.md`           |

## Classifying findings

- **BLOCKER** when the violation can produce incorrect behavior or hide a defect: an assertion or `!` without a valid reason, an `eslint-disable` whose reason does not hold, spreading a possibly-nullish value, a non-empty `switch` group that falls through, an empty catch without a comment, throwing or rejecting a non-`Error`, `.bind(this)` on a handler that must be removed, modifying built-ins or globals.
- **WARNING** otherwise: naming, documentation, import form, visibility, and structure findings degrade maintainability, not behavior.
- Comment and test-title findings are **WARNING**: they mislead readers but do not change behavior.
