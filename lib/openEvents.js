import { EventEmitter } from "events";
import { parseUserAgent } from "@/lib/deviceParser";
import { inferIsBotOrProxy } from "@/lib/openFilter";

function getEmitter() {
  if (!globalThis.__emailTrackerOpenEvents) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(200);
    globalThis.__emailTrackerOpenEvents = emitter;
  }
  return globalThis.__emailTrackerOpenEvents;
}

export function serializeOpenEvent(log) {
  const parsed = parseUserAgent(log.userAgent);
  const openedAt = log.openedAt instanceof Date ? log.openedAt : new Date(log.openedAt);

  return {
    trackingId: log.trackingId,
    open: {
      id: String(log._id),
      openedAt: openedAt.toISOString(),
      ipAddress: log.ipAddress || "unknown",
      userAgent: log.userAgent || "unknown",
      device: log.device || parsed.device,
      clientType: log.clientType || parsed.clientType,
      country: log.country || "unknown",
      city: log.city || "unknown",
      isBotOrProxy: inferIsBotOrProxy(log),
    },
  };
}

export function emitOpenEvent(log) {
  getEmitter().emit("open", serializeOpenEvent(log));
}

export function subscribeOpenEvents(listener) {
  const emitter = getEmitter();
  emitter.on("open", listener);
  return () => emitter.off("open", listener);
}
