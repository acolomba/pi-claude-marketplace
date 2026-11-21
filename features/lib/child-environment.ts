/**
 * @fileoverview The one place the cucumber harness copies a variable from the
 * worker's environment into a child it starts. The owner of each child builds
 * every other variable of that child, so a variable of the shell that runs the
 * suite never changes how a child behaves (DRV-03).
 */

// A Windows child needs these whatever it runs. SystemRoot names the system
// folder that Node and the Windows APIs read. ComSpec and PATHEXT name the
// command shell and the extensions of a command lookup. TEMP and TMP name the
// temporary folder, and USERPROFILE names the home folder that os.homedir()
// reads.
const WINDOWS_BASE_VARIABLES: readonly string[] = [
  "SystemRoot",
  "ComSpec",
  "PATHEXT",
  "TEMP",
  "TMP",
  "USERPROFILE",
];

function comparableName(name: string, windows: boolean): string {
  return windows ? name.toUpperCase() : name;
}

/**
 * Returns the variables of this process's environment that `names` names. On
 * Windows it also returns the variables of the OS base list, and it compares
 * names in upper case, as Windows does. A name that is not set is left out,
 * and each key keeps this process's spelling.
 */
export function hostVariables(names: readonly string[]): NodeJS.ProcessEnv {
  // Read at each call, because a test replaces the platform for one case.
  const windows = process.platform === "win32";
  const wanted = new Set(
    (windows ? [...names, ...WINDOWS_BASE_VARIABLES] : names).map((name) =>
      comparableName(name, windows),
    ),
  );
  const variables: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && wanted.has(comparableName(name, windows))) {
      variables[name] = value;
    }
  }

  return variables;
}
