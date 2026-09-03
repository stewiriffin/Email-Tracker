import mongoose from "mongoose";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Email from "@/models/Email";
import TrackingLog from "@/models/TrackingLog";
import LinkClick from "@/models/LinkClick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function DELETE(_request, { params }) {
  const { id } = await params;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "A valid email id is required." }, { status: 400 });
  }

  try {
    await dbConnect();

    const email = await Email.findById(id);
    if (!email) {
      return NextResponse.json({ error: "Email not found." }, { status: 404 });
    }

    await TrackingLog.deleteMany({ trackingId: email.trackingId });
    await LinkClick.deleteMany({ trackingId: email.trackingId });
    await Email.deleteOne({ _id: email._id });

    return NextResponse.json({
      ok: true,
      id: String(email._id),
      trackingId: email.trackingId,
    });
  } catch (error) {
    console.error("Failed to delete tracked email:", error);
    return NextResponse.json(
      { error: "Could not delete the tracked email." },
      { status: 500 }
    );
  }
}
