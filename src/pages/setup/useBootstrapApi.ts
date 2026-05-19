/**
 * Bootstrap API hooks — mock implementations.
 * Backend-engineer will replace with real OpenBao/zebraservice endpoints.
 *
 * Each function simulates the expected API contract:
 * - Token validation: POST /api/bootstrap/validate-token
 * - Health check: GET /api/bootstrap/health
 * - Create admin: POST /api/bootstrap/create-admin
 * - Generate TOTP: POST /api/bootstrap/totp/generate
 * - Verify TOTP: POST /api/bootstrap/totp/verify
 * - Complete bootstrap: POST /api/bootstrap/complete
 * - Check status: GET /api/bootstrap/status
 */

import type {
  TokenErrorKind,
  HealthCheckItem,
  TOTPSecretData,
  BootstrapStatus,
  AccountErrorKind,
  TOTPErrorKind,
} from "./types";

type Result<T, E> =
  | { ok: true; data: T }
  | { ok: false; error: E };

/** Simulates network delay */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Validate the bootstrap token against the backend */
export async function ioValidateToken(
  token: string
): Promise<Result<void, TokenErrorKind>> {
  await delay(1200);

  if (token.length === 0) {
    return { ok: false, error: "invalid" };
  }

  // Mock: any 32+ char hex string is valid
  if (/^[a-f0-9]{32,}$/i.test(token)) {
    return { ok: true, data: undefined };
  }

  return { ok: false, error: "invalid" };
}

/** Run platform health checks */
export async function ioRunHealthChecks(
  onProgress: (items: ReadonlyArray<HealthCheckItem>) => void
): Promise<ReadonlyArray<HealthCheckItem>> {
  const items: HealthCheckItem[] = [
    { label: "TwinfoxDB database", critical: true, status: "waiting" },
    { label: "Authentication service", critical: true, status: "waiting" },
    { label: "Persistent storage", critical: false, status: "waiting" },
    { label: "Backup configuration", critical: false, status: "waiting" },
  ];

  onProgress([...items]);

  for (let i = 0; i < items.length; i++) {
    items[i] = { ...items[i], status: "checking" };
    onProgress([...items]);
    await delay(600 + Math.random() * 400);
    items[i] = { ...items[i], status: "success" };
    onProgress([...items]);
  }

  return items;
}

/** Create the admin account */
export async function ioCreateAdmin(params: {
  readonly username: string;
  readonly password: string;
  readonly email?: string;
}): Promise<Result<void, AccountErrorKind>> {
  await delay(1500);

  if (params.username.length < 2) {
    return { ok: false, error: "validation" };
  }

  // Mock success
  return { ok: true, data: undefined };
}

/** Generate a TOTP secret for enrolment */
export async function ioGenerateTOTP(): Promise<Result<TOTPSecretData, "server">> {
  await delay(800);

  // Mock TOTP data
  return {
    ok: true,
    data: {
      uri: "otpauth://totp/DFRNT:admin@dfrnt-platform?secret=DQQLRXBG6NGDF5JDKZXLMN4R7PQWYT2S&issuer=DFRNT&algorithm=SHA1&digits=6&period=30",
      secret: "DQQL RXBG 6NGD F5JD KZXL MN4R 7PQW YT2S",
      issuer: "DFRNT",
      accountName: "admin@dfrnt-platform",
    },
  };
}

/** Verify a TOTP code */
export async function ioVerifyTOTP(
  code: string
): Promise<Result<void, TOTPErrorKind>> {
  await delay(1000);

  // Mock: accept any 6-digit code for now
  if (code.length === 6 && /^\d{6}$/.test(code)) {
    return { ok: true, data: undefined };
  }

  return { ok: false, error: "wrong-code" };
}

/** Finalise the bootstrap (locks setup mode) */
export async function ioCompleteBootstrap(): Promise<Result<void, "server">> {
  await delay(500);
  return { ok: true, data: undefined };
}

/** Check system bootstrap status (for resume logic) */
export async function ioCheckBootstrapStatus(): Promise<BootstrapStatus> {
  await delay(300);

  // Mock: always in bootstrap mode, start at step 0
  return { mode: "bootstrap", resumeStep: 0 };
}
