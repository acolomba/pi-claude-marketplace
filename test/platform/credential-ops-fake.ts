import type { CredentialOps } from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import type { GitCredentials } from "../../extensions/pi-claude-marketplace/platform/git.ts";

export interface CredentialOpsFakeOptions {
  readonly boundary: "memory";
  readonly credentials?: ReadonlyArray<readonly [host: string, credential: GitCredentials]>;
  readonly fillError?: Error;
  readonly approveError?: Error;
  readonly rejectError?: Error;
}

export interface CredentialOpsFakeCalls {
  readonly fill: Array<{ readonly host: string }>;
  readonly approve: Array<{ readonly host: string; readonly credential: GitCredentials }>;
  readonly reject: Array<{ readonly host: string; readonly credential: GitCredentials }>;
}

export interface CredentialOpsFake {
  readonly credentialOps: CredentialOps;
  readonly calls: CredentialOpsFakeCalls;
  storedCredential(host: string): GitCredentials | null;
}

function validateAttribute(value: string, field: string): void {
  if (/[\r\n\0]/.test(value)) {
    throw new Error(`git-credential attribute '${field}' contains a control character`);
  }
}

function validateCredential(host: string, credential?: GitCredentials): void {
  validateAttribute(host, "host");
  if (credential?.username !== undefined) {
    validateAttribute(credential.username, "username");
  }

  if (credential?.password !== undefined) {
    validateAttribute(credential.password, "password");
  }
}

function sameCredential(left: GitCredentials, right: GitCredentials): boolean {
  return left.username === right.username && left.password === right.password;
}

export function createCredentialOpsFake(options: CredentialOpsFakeOptions): CredentialOpsFake {
  if (options.boundary !== "memory") {
    throw new Error("createCredentialOpsFake requires the explicit memory boundary");
  }

  const credentials = new Map(
    (options.credentials ?? []).map(([host, credential]) => [host, structuredClone(credential)]),
  );
  const calls: CredentialOpsFakeCalls = {
    fill: [],
    approve: [],
    reject: [],
  };

  const credentialOps: CredentialOps = {
    async fill(host) {
      validateCredential(host);
      calls.fill.push({ host });
      if (options.fillError !== undefined) {
        throw options.fillError;
      }

      await Promise.resolve();
      const credential = credentials.get(host);
      return credential === undefined ? null : structuredClone(credential);
    },
    async approve(host, credential) {
      validateCredential(host, credential);
      calls.approve.push({ host, credential: structuredClone(credential) });
      if (options.approveError !== undefined) {
        throw options.approveError;
      }

      await Promise.resolve();
      credentials.set(host, structuredClone(credential));
    },
    async reject(host, credential) {
      validateCredential(host, credential);
      calls.reject.push({ host, credential: structuredClone(credential) });
      if (options.rejectError !== undefined) {
        throw options.rejectError;
      }

      await Promise.resolve();
      const stored = credentials.get(host);
      if (stored !== undefined && sameCredential(stored, credential)) {
        credentials.delete(host);
      }
    },
  };

  return {
    credentialOps,
    calls,
    storedCredential: (host) => {
      const credential = credentials.get(host);
      return credential === undefined ? null : structuredClone(credential);
    },
  };
}
