// Turns signing errors into JSON responses for the public signing API, without leaking internal details.

import "server-only";
import { NextResponse } from "next/server";
import { SigningError } from "./complete";

const STATUS: Record<SigningError["code"], number> = {
  INVALID: 404,
  EXPIRED: 410,
  USED: 409,
  REVOKED: 410,
  NOT_SIGNABLE: 409,
  CONSENT_REQUIRED: 400,
  SIGNATURE_INVALID: 400,
  ANSWERS_INVALID: 400,
  REQUEST_INVALID: 400,
};

export function signingErrorResponse(error: unknown) {
  if (error instanceof SigningError) {
    return NextResponse.json(
      { error: error.code, message: error.message, fieldErrors: error.details },
      { status: STATUS[error.code] },
    );
  }
  // Log only the error name and message; never the request body (it holds health data).
  console.error("Signing request failed:", error instanceof Error ? `${error.name}: ${error.message}` : "unknown error");
  return NextResponse.json({ error: "SERVER_ERROR", message: "Something went wrong. Please try again." }, { status: 500 });
}
