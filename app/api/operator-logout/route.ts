import { OPERATOR_COOKIE_NAME } from "@/lib/auth";

export async function POST(): Promise<Response> {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${OPERATOR_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
