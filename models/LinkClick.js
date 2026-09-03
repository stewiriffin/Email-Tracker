import mongoose from "mongoose";

const LinkClickSchema = new mongoose.Schema(
  {
    trackingId: {
      type: String,
      required: [true, "Tracking ID is required"],
      trim: true,
    },
    targetUrl: {
      type: String,
      required: [true, "Target URL is required"],
      trim: true,
      maxlength: [2048, "Target URL is too long"],
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
    clickedAt: {
      type: Date,
      default: Date.now,
      set: (value) => value || new Date(),
    },
  },
  {
    collection: "link_clicks",
  }
);

LinkClickSchema.index({ trackingId: 1, clickedAt: -1 });

export default mongoose.models.LinkClick ||
  mongoose.model("LinkClick", LinkClickSchema);
