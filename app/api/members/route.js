import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const members = await db.collection("members").find({}).sort({ createdAt: 1 }).toArray();
  return NextResponse.json(members.map((m) => ({ ...m, _id: String(m._id) })));
}

export async function POST(req) {
  const { name, role } = await req.json();
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const db = await getDb();
  const doc = { name: name.trim(), role: (role || "").trim(), createdAt: new Date() };
  const res = await db.collection("members").insertOne(doc);
  return NextResponse.json({ ...doc, _id: String(res.insertedId) }, { status: 201 });
}
