import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import TrackingLog from "@/models/TrackingLog";
import { serializeOpenEvent, subscribeOpenEvents } from "@/lib/openEvents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let changeStream = null;
  let heartbeat = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      const seen = new Set();
      const publish = (payload) => {
        const id = payload?.open?.id;
        if (id) {
          if (seen.has(id)) return;
          seen.add(id);
          if (seen.size > 500) {
            const first = seen.values().next().value;
            seen.delete(first);
          }
        }
        send({ type: "open", ...payload });
      };

      send({ type: "connected" });

      unsubscribe = subscribeOpenEvents(publish);

      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          closed = true;
        }
      }, 15000);

      dbConnect()
        .then(() =>
          TrackingLog.watch([{ $match: { operationType: "insert" } }], {
            fullDocument: "default",
          })
        )
        .then((watch) => {
          changeStream = watch;
          changeStream.on("change", (change) => {
            if (change.fullDocument) {
              publish(serializeOpenEvent(change.fullDocument));
            }
          });
          changeStream.on("error", () => {
            changeStream = null;
          });
        })
        .catch(() => {
          // Local Mongo without a replica set falls back to the in-process emitter.
        });
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
      if (changeStream) {
        changeStream.close().catch(() => {});
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
