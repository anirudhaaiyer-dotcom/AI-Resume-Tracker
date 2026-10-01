// Signed login cookie for the dashboard. The cookie is `<expiry>.<hmac>`, signed with
// APP_PASSWORD, so changing the password logs everyone out. Uses Web Crypto so it runs
// in both the proxy and server actions.

export const SESSION_COOKIE = "kargo_session";
export const SESSION_DAYS = 7;

export const loginUsername = () => process.env.APP_USERNAME || "Anirude";

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(password: string): Promise<{ value: string; expires: Date }> {
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const exp = String(expires.getTime());
  return { value: `${exp}.${await hmac(password, `${loginUsername()}|${exp}`)}`, expires };
}

export async function isValidSession(value: string | undefined, password: string): Promise<boolean> {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return sig === (await hmac(password, `${loginUsername()}|${exp}`));
}
