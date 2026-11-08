/** CSV export of the period's leads (admin only; no IP or user agent hashes). */
import type { NextRequest } from "next/server";

import { actorOf, currentAdmin } from "@/lib/admin/auth";
import { leadsCsv, reportDays } from "@/lib/admin/leads-report";
import { db } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  const admin = await currentAdmin();
  if (!admin) return new Response("Não autorizado.", { status: 401 });
  const days = reportDays(request.nextUrl.searchParams.get("dias"));
  const sql = db();
  const csv = await leadsCsv(sql, days);
  await sql`
    insert into public.audit_log (actor, action, entity, entity_id, changes)
    values (${actorOf(admin)}, 'leads.export', 'leads', null, ${sql.json({ days: { from: null, to: days } })})`;
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${days}d-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
