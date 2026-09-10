import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const db = await getDb();
  const m = await db.collection("members").findOne({ _id: new ObjectId(id) });
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...m, _id: String(m._id) });
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const db = await getDb();
  await db.collection("members").deleteOne({ _id: new ObjectId(id) });
  await db.collection("entries").deleteMany({ memberId: id });
  return NextResponse.json({ ok: true });
}
