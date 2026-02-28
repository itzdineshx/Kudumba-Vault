import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  familyName: { type: String, required: true },
  role: { type: String, enum: ["owner", "member"], default: "owner" },
  walletAddress: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", userSchema);
