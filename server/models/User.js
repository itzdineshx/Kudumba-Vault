import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  familyName: { type: String, required: true },
  role: { type: String, enum: ["owner", "member"], default: "owner" },
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

export default mongoose.model("User", userSchema);
