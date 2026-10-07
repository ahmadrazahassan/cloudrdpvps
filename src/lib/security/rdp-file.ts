/**
 * Builds the text of a Windows `.rdp` connection file.
 *
 * It intentionally carries NO password: `.rdp` files can only hold one as a
 * machine-bound DPAPI blob, and a plaintext one would sit in Downloads. The
 * client prompts for credentials on connect.
 */

const HOST_RE = /^(?:(?:\d{1,3}\.){3}\d{1,3}|[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?)$/;
const CONTROL = /[\u0000-\u001f\u007f]/;

export interface RdpInput {
  host: string;
  port?: number;
  username: string;
}

export function buildRdpFile({ host, port = 3389, username }: RdpInput): string {
  if (!HOST_RE.test(host)) throw new RangeError("Invalid host for .rdp file");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError("Invalid port for .rdp file");
  // Newlines would let a value smuggle in extra settings lines.
  if (!username || username.length > 104 || CONTROL.test(username)) throw new RangeError("Invalid username for .rdp file");

  const address = port === 3389 ? host : `${host}:${port}`;
  return (
    [
      `full address:s:${address}`,
      `username:s:${username}`,
      "prompt for credentials:i:1",
      "authentication level:i:2",
      "enablecredsspsupport:i:1",
      "screen mode id:i:2",
      "use multimon:i:0",
      "desktopwidth:i:1920",
      "desktopheight:i:1080",
      "session bpp:i:32",
      "compression:i:1",
      "redirectclipboard:i:1",
      "redirectprinters:i:0",
      "audiomode:i:0",
      "autoreconnection enabled:i:1",
      "connection type:i:7",
      "networkautodetect:i:1",
    ].join("\r\n") + "\r\n"
  );
}

/** A filename that is safe on every OS and in a Content-Disposition header. */
export function rdpFilename(label: string): string {
  const base = label
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._ -]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, 60);
  return `${base || "server"}.rdp`;
}
