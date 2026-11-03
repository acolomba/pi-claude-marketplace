import { appendFileSync } from "node:fs";
export default function count(pi: any): void {
  for (const ev of ["session_start", "session_shutdown", "resources_discover"]) {
    pi.on(ev, (e: any) => { appendFileSync(`${process.env.HOME}/pi-events.log`, `${ev} ${e?.reason ?? e?.source ?? ""}\n`); });
  }
}
