import mongoose from "mongoose";

const memberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  relationship: { type: String, required: true },
  role: { type: String, enum: ["owner", "member"], default: "member" },
  avatarInitials: String,
  addedAt: { type: String, default: () => new Date().toISOString() },
  walletAddress: String,
});

memberSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("Member", memberSchema);
