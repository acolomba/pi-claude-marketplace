#!/usr/bin/env python3
"""Branch-coverage checker for the 260913-ttl quick task.

Reproduces SonarCloud's per-line branch model from lcov BRDA records:
per line, conditions = number of BRDA entries, covered = entries with taken>0;
across reports, take the max of each. A line is "uncovered" when covered < conditions.

Usage:
  # global report over merged reports (final verification):
  python3 check-branch-coverage.py coverage/unit.lcov coverage/integration.lcov coverage/e2e.lcov

  # targeted: does <lcov> now cover these lines of <src>?
  python3 check-branch-coverage.py /tmp/pair.lcov --file extensions/.../foo.ts --lines 42,108

Exit code 0 when nothing uncovered (global mode) or all --lines are fully
covered (targeted mode); 1 otherwise.
"""
import collections, os, sys

def parse(path):
    data = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0]))
    cur = None
    with open(path) as f:
        for raw in f:
            raw = raw.strip()
            if raw.startswith("SF:"):
                cur = raw[3:]
                if os.path.isabs(cur):
                    cur = os.path.relpath(cur)
            elif raw.startswith("BRDA:") and cur is not None:
                parts = raw[5:].split(",")
                if len(parts) != 4:
                    continue
                line, _block, _branch, taken = parts
                try:
                    ln = int(line)
                except ValueError:
                    continue
                t = 0 if taken in ("-", "undefined") else int(taken)
                cell = data[cur][ln]
                cell[0] += 1
                if t > 0:
                    cell[1] += 1
            elif raw == "end_of_record":
                cur = None
    return data

def main():
    args = sys.argv[1:]
    target_file = None
    target_lines = None
    lcovs = []
    i = 0
    while i < len(args):
        if args[i] == "--file":
            target_file = args[i + 1]; i += 2
        elif args[i] == "--lines":
            target_lines = [int(x) for x in args[i + 1].split(",") if x]; i += 2
        else:
            lcovs.append(args[i]); i += 1
    reports = [parse(p) for p in lcovs]
    allfiles = set()
    for r in reports:
        allfiles.update(r.keys())

    if target_file is not None:
        merged = {}
        for ln in set().union(*[set(r[target_file].keys()) for r in reports]) if reports else set():
            conds = max((r[target_file][ln][0] if ln in r[target_file] else 0) for r in reports)
            cov = max((r[target_file][ln][1] if ln in r[target_file] else 0) for r in reports)
            merged[ln] = (conds, cov)
        failed = []
        lines = target_lines if target_lines else [ln for ln, (c, v) in merged.items() if v < c]
        for ln in sorted(lines):
            conds, cov = merged.get(ln, (0, 0))
            status = "OK" if conds > 0 and cov >= conds else "UNCOVERED"
            if status != "OK":
                failed.append(ln)
            print(f"{target_file}:{ln} {cov}/{conds} {status}")
        sys.exit(1 if failed else 0)

    total_unc = 0
    for f in sorted(allfiles):
        if not f.startswith("extensions/"):
            continue
        lines = set()
        for r in reports:
            lines.update(r[f].keys())
        rows = []
        for ln in sorted(lines):
            conds = max((r[f][ln][0] if ln in r[f] else 0) for r in reports)
            cov = max((r[f][ln][1] if ln in r[f] else 0) for r in reports)
            if cov < conds:
                rows.append((ln, conds, cov))
        if rows:
            for ln, conds, cov in rows:
                total_unc += conds - cov
                print(f"{f}:{ln} {cov}/{conds}")
    print(f"TOTAL UNCOVERED CONDITIONS: {total_unc}")
    sys.exit(1 if total_unc else 0)

main()
