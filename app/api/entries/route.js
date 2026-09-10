import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { emptySlots } from "@/lib/slots";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId");
  const date = searchParams.get("date");
  if (!memberId || !date) {
    return NextResponse.json({ error: "memberId and date required" }, { status: 400 });
  }
  const db = await getDb();
  const entry = await db.collection("entries").findOne({ memberId, date });
  if (!entry) {
    return NextResponse.json({ memberId, date, slots: emptySlots(), extraHours: "", extraWork: "", saved: false });
  }
  return NextResponse.json({ ...entry, _id: String(entry._id), saved: true });
}

export async function POST(req) {
  const body = await req.json();
  const { memberId, memberName, date, slots, extraHours, extraWork } = body;
  if (!memberId || !date) {
    return NextResponse.json({ error: "memberId and date required" }, { status: 400 });
  }
  const db = await getDb();
  await db.collection("entries").updateOne(
    { memberId, date },
    {
      $set: {
        memberId,
        memberName: memberName || "",
        date,
        slots: slots || emptySlots(),
        extraHours: extraHours || "",
        extraWork: extraWork || "",
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
  return NextResponse.json({ ok: true });
}
