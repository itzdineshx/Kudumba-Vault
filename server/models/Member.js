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
  // Reference to the User account created for this member
  memberUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  // Managed wallet — encrypted private key (encrypted client-side with member's password)
  encryptedWallet: {
    encryptedKey: String,  // Hex-encoded AES-256-GCM ciphertext (IV prepended)
    salt: String,          // Hex-encoded PBKDF2 salt
    version: { type: Number, default: 1 },
  },
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
