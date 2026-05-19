/**
 * Bootstrap wizard types — forward-only 5-step flow.
 * Each step creates irreversible durable state in OpenBao.
 */

export type WizardStep = 0 | 1 | 2 | 3 | 4;

export type HealthCheckStatus = "waiting" | "checking" | "success" | "failed";

export interface HealthCheckItem {
  readonly label: string;
  readonly critical: boolean;
  readonly status: HealthCheckStatus;
  readonly detail?: string;
}

export type TokenErrorKind =
  | "invalid"
  | "expired"
  | "locked"
  | "network"
  | "already-bootstrapped";

export type HealthErrorKind =
  | "critical-failure"
  | "partial-failure"
  | "network";

export type AccountErrorKind =
  | "username-taken"
  | "server"
  | "validation";

export type TOTPErrorKind =
  | "wrong-code"
  | "code-expired"
  | "qr-generation-failed"
  | "too-many-attempts";

/** Password strength levels for the strength meter */
export type PasswordStrength = "weak" | "fair" | "good" | "strong";

/** TOTP secret data returned from the API */
export interface TOTPSecretData {
  readonly uri: string;
  readonly secret: string;
  readonly issuer: string;
  readonly accountName: string;
}

/** Bootstrap state response from the backend (for resume logic) */
export type BootstrapStatus =
  | { mode: "bootstrap"; resumeStep: WizardStep }
  | { mode: "complete" }
  | { mode: "unavailable" };
