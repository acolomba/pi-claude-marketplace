# Third-party notices

This repository vendors two Agent Skills that other people wrote. They live in `.claude/skills/` and `.agents/skills/`. Claude Code reads the first directory. Codex and Pi read the second. The two copies are identical.

The published npm package `pi-claude-marketplace` does not include these skills. The `files` list in `package.json` limits the package to the extension and its top-level documents.

Each skill keeps its own license. Each skill directory contains a `LICENSE` file, and this document reproduces the text below. The `skills-lock.json` file at the repository root records the upstream source of each skill.

When you update a skill, check that its `LICENSE` file is still in place. The skill installer copies the skill directory only, and some upstream repositories keep the license at the repository root.

## humanizer

- Version: 2.11.2
- Source: <https://github.com/blader/humanizer>. The skill is the repository root.
- License: MIT
- Copyright (c) 2025 Siqi Chen
- License file: `.claude/skills/humanizer/LICENSE` and `.agents/skills/humanizer/LICENSE`

```text
MIT License

Copyright (c) 2025 Siqi Chen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## simple-english

- Version: 1.3.0
- Source: <https://github.com/AminBlg/SimpleEnglish>, path `skills/simple-english`, commit `8e8a008a13e4b478f9ccc20ca16e79aef66c0739`
- License: MIT
- Copyright (c) 2026 AminBlg
- License file: `.claude/skills/simple-english/LICENSE` and `.agents/skills/simple-english/LICENSE`

```text
MIT License

Copyright (c) 2026 AminBlg

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
