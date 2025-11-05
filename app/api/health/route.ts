export async function GET() {
  return new Response(JSON.stringify({ ok: true, env: process.env.VERCEL_ENV ?? "local" }), {
    headers: { "content-type": "application/json" }
  });
}
