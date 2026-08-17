import { checkPassword, createSessionToken, OPERATOR_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!checkPassword(password)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const token = createSessionToken();
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${OPERATOR_COOKIE_NAME}=${token}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
  return res;
}
