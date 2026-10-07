"use client";

import { useState } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { Segmented } from "./segmented";

/**
 * Sign in or create an account without leaving the order page. Both forms send the visitor back to `nextUrl` — this exact
 * configuration, one step on — so whichever they use, they land where they were with everything still chosen.
 * (With two-step verification the code screen sits in between and returns here too.)
 */
export function AccountStep({ nextUrl, backendReady }: { nextUrl: string; backendReady: boolean }) {
  const [mode, setMode] = useState<"register" | "login">("register");

  if (!backendReady) {
    return <p className="form-note">Accounts aren&apos;t switched on in this environment yet, so ordering is paused. You can still compare plans and prices.</p>;
  }

  return (
    <div className="max-w-[440px]">
      <Segmented
        label="Account"
        value={mode}
        onChange={setMode}
        options={[
          { value: "register", label: "Create account" },
          { value: "login", label: "Sign in" },
        ]}
      />
      <p className="mt-4 text-[14px] leading-relaxed text-muted">
        {mode === "register" ? "One account to pay, track your order and get your server's login details." : "Welcome back — you'll continue right where you left off."}
      </p>
      <div className="mt-6">{mode === "register" ? <RegisterForm next={nextUrl} inline /> : <LoginForm next={nextUrl} inline />}</div>
    </div>
  );
}
