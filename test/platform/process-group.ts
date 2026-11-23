import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Returns the pids of the members of the process group `pgid` that are not
 * zombies, from one `ps` run. A zombie runs nothing, but it stays in its
 * group until its parent reaps it: after a group kill, a `git` that nothing
 * has reaped yet stays a zombie for about 2 s (E9). So a check for leftover
 * processes leaves zombies out. POSIX only: Windows has no `ps` and no
 * process groups.
 */
export async function livingGroupMembers(pgid: number): Promise<readonly number[]> {
  const { stdout } = await execFileAsync("ps", ["-e", "-o", "pid=,pgid=,stat="]);
  return stdout
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter(([, group, state]) => Number(group) === pgid && state?.startsWith("Z") === false)
    .map(([pid]) => Number(pid));
}
