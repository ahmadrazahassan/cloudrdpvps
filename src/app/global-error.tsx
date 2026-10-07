"use client";

import "./globals.css";

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the
 * layout, so it brings its own <html>/<body>; the web fonts are not available
 * here, so the system stack from the theme is used.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="container-site flex min-h-screen max-w-[640px] flex-col items-center justify-center text-center">
          <p className="label-caps">/ERROR 500</p>
          <h1 className="display-h2 mt-6 text-balance">Something went wrong.</h1>
          <p className="mt-5 max-w-[44ch] text-[17px] leading-[1.65] text-ink-2">
            The site hit an unexpected problem. Please try again in a moment.
          </p>
          {error.digest && <p className="mt-4 text-[13px] text-muted">Reference: {error.digest}</p>}
          <button type="button" className="btn btn-primary btn-lg mt-9" onClick={() => retry()}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
