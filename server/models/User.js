import mongoose from "mongoose";
import crypto from "crypto";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  familyName: { type: String, required: true },
  // Unique family code — generated for owners, used by members to join
  familyId: { type: String, index: true },
  role: { type: String, enum: ["owner", "member"], default: "owner" },
  // Member approval status: owners are always "approved"
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "approved" },
  // Relationship to the family head (for member join requests)
  relationship: { type: String, default: null },
  walletAddress: { type: String, default: null },
  // Managed wallet for member-role users (encrypted client-side)
  encryptedWallet: {
    encryptedKey: String,
    salt: String,
    version: { type: Number, default: 1 },
  },
  // PIN verification (SHA-256 hashed client-side, then bcrypt-hashed server-side)
  pinHash: { type: String, default: null },
  // WebAuthn biometric credentials
  biometricCredentials: [{
    credentialId: String,
    publicKey: String,
    deviceName: { type: String, default: "Biometric Device" },
    registeredAt: { type: Date, default: Date.now },
  }],
  createdAt: { type: Date, default: Date.now },
});

/**
 * Generate a unique 8-char family ID (uppercase alphanumeric)
 */
userSchema.statics.generateFamilyId = function () {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
};

export default mongoose.model("User", userSchema);
