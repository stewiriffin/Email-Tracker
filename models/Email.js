import mongoose from "mongoose";

const EmailSchema = new mongoose.Schema(
  {
    recipient: {
      type: String,
      required: [true, "Recipient email is required"],
      trim: true,
      lowercase: true,
      maxlength: [254, "Recipient email is too long"],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid recipient email address",
      ],
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      maxlength: [998, "Subject is too long"],
    },
    body: {
      type: String,
      default: "",
      trim: true,
      set: (value) => value ?? "",
    },
    trackingId: {
      type: String,
      required: [true, "Tracking ID is required"],
      unique: true,
      trim: true,
    },
    deliveryStatus: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },
    deliveryError: {
      type: String,
      default: "",
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    collection: "emails",
  }
);

EmailSchema.index({ createdAt: -1 });

export default mongoose.models.Email || mongoose.model("Email", EmailSchema);
