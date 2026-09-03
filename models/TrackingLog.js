import mongoose from "mongoose";

const TrackingLogSchema = new mongoose.Schema(
  {
    trackingId: {
      type: String,
      required: [true, "Tracking ID is required"],
      trim: true,
    },
    ipAddress: {
      type: String,
      default: "unknown",
      trim: true,
      maxlength: [45, "IP address is too long"],
      set: (value) => (value && String(value).trim() ? value : "unknown"),
    },
    userAgent: {
      type: String,
      default: "unknown",
      trim: true,
      maxlength: [512, "User agent is too long"],
      set: (value) => (value && String(value).trim() ? value : "unknown"),
    },
    clientType: {
      type: String,
      default: "Unknown",
      trim: true,
      maxlength: [80, "Client type is too long"],
    },
    device: {
      type: String,
      enum: ["Desktop", "Mobile", "Tablet"],
      default: "Desktop",
    },
    country: {
      type: String,
      default: "unknown",
      trim: true,
      maxlength: [8, "Country code is too long"],
    },
    city: {
      type: String,
      default: "unknown",
      trim: true,
      maxlength: [85, "City name is too long"],
    },
    openedAt: {
      type: Date,
      default: Date.now,
      set: (value) => value || new Date(),
    },
  },
  {
    collection: "tracking_logs",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

TrackingLogSchema.virtual("email", {
  ref: "Email",
  localField: "trackingId",
  foreignField: "trackingId",
  justOne: true,
});

TrackingLogSchema.index({ trackingId: 1, openedAt: -1 });

export default mongoose.models.TrackingLog ||
  mongoose.model("TrackingLog", TrackingLogSchema);
