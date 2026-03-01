import mongoose from "mongoose";

const accessLogEntrySchema = new mongoose.Schema({
  userId: String,
  userName: String,
  action: String,
  timestamp: { type: String, default: () => new Date().toISOString() },
  ip: String,
}, { _id: true });

const sharedAccessSchema = new mongoose.Schema({
  memberId: String,
  permission: { type: String, enum: ["view-only", "time-limited"], default: "view-only" },
  grantedAt: { type: String, default: () => new Date().toISOString() },
  expiresAt: String,
  revoked: { type: Boolean, default: false },
}, { _id: false });

const blockchainRecordSchema = new mongoose.Schema({
  txHash: String,
  blockNumber: Number,
  timestamp: Number,
  gasUsed: String,
  explorerUrl: String,
  verified: { type: Boolean, default: false },
  onChainOwner: String,
}, { _id: false });

const documentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true },
  category: { type: String, enum: ["ids", "banking", "insurance", "property", "passwords"], required: true },
  privacy: { type: String, enum: ["private", "shared"], default: "private" },
  hash: { type: String, required: true },
  timestamp: { type: String, default: () => new Date().toISOString() },
  fileType: String,
  size: String,
  sharedWith: [sharedAccessSchema],
  accessLog: [accessLogEntrySchema],
  blockchain: blockchainRecordSchema,
  encryptionKey: String,
  // Encrypted file data stored as binary
  fileData: { type: Buffer, default: null },
  originalName: String,
  mimeType: String,
});

// Virtual `id` that maps _id to string
documentSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.fileData; // Never send binary in list responses
    return ret;
  },
});

export default mongoose.model("Document", documentSchema);
