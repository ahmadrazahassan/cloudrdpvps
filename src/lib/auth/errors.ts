import { AppError } from "@/lib/errors";

interface AuthErrorLike {
  code?: string | null;
  status?: number | null;
  message?: string | null;
}

/**
 * Supabase Auth error -> our vocabulary.
 *
 * Deliberately coarse: a failed sign-in is always "incorrect email or password"
 * (never "no such user"), so the form can't be used to discover which emails
 * have accounts. Raw Auth messages are never shown to the visitor.
 */
export function fromAuthError(error: AuthErrorLike): AppError {
  switch (error.code) {
    case "invalid_credentials":
    case "user_not_found":
      return new AppError("INVALID_CREDENTIALS");
    case "email_not_confirmed":
      return new AppError("EMAIL_NOT_CONFIRMED");
    case "weak_password":
      return new AppError("VALIDATION", undefined, {
        fieldErrors: { password: ["Choose a stronger password — longer, with a mix of letters, numbers and symbols."] },
      });
    case "same_password":
      return new AppError("VALIDATION", undefined, {
        fieldErrors: { password: ["Choose a password you haven't used before."] },
      });
    case "email_address_invalid":
    case "validation_failed":
      return new AppError("VALIDATION", undefined, { fieldErrors: { email: ["Enter a valid email address."] } });
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit":
      return new AppError("RATE_LIMITED");
    case "signup_disabled":
    case "email_provider_disabled":
      return new AppError("UNAVAILABLE", "New accounts can't be created right now.");
    case "user_banned":
      return new AppError("ACCOUNT_SUSPENDED");
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier":
      return new AppError("LINK_INVALID");
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
    case "refresh_token_already_used":
    case "bad_jwt":
      return new AppError("UNAUTHENTICATED");
    default:
      return new AppError("INTERNAL", undefined, { cause: error });
  }
}
