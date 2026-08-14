import { CRM_LOGIN_EMAIL } from "@/lib/auth-public";

/** Hardcoded workspace login — change here if you need new credentials. */
export { CRM_LOGIN_EMAIL };
export const CRM_LOGIN_PASSWORD = "InkamotoCRM2026!";

/** Used to sign session cookies when CRM_SESSION_SECRET env is empty. */
export const CRM_LOGIN_SESSION_SECRET =
  "inkamoto-crm-session-v1-change-in-prod-if-needed";
