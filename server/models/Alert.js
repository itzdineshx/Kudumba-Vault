import mongoose from "mongoose";

const alertSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, required: true },
  description: { type: String, required: true },
  timestamp: { type: String, default: () => new Date().toISOString() },
  status: { type: String, enum: ["blocked", "resolved", "warning"], default: "warning" },
  ip: String,
  details: String,
});

alertSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("Alert", alertSchema);
