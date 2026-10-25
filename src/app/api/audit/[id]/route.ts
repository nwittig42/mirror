import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { auditProgress, isUuid } from "@/services/audit-progress";

/**
 * Where a lead's audit stands, polled by the /audit page while it is prepared.
 * Public by design: the lead id is an unguessable UUID and the answer holds
 * only a progress figure, the business name and the address they typed.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const progress = isUuid(id) ? await auditProgress(getDb(), id) : null;
  if (!progress) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(progress, { headers: { "cache-control": "no-store" } });
}
