import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to required" }, { status: 400 });
  const db = await getDb();
  const entries = await db
    .collection("entries")
    .find({ date: { $gte: from, $lte: to } })
    .sort({ date: 1, memberName: 1 })
    .toArray();
  return NextResponse.json(entries.map((e) => ({ ...e, _id: String(e._id) })));
}

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to required" }, { status: 400 });
  const db = await getDb();
  const res = await db.collection("entries").deleteMany({ date: { $gte: from, $lte: to } });
  return NextResponse.json({ deleted: res.deletedCount });
}
