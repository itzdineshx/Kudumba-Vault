

# Blockchain-Based Family Document & Credential Vault

A secure, family-friendly web prototype for storing, sharing, and recovering personal documents and credentials with simulated blockchain integrity.

---

## Page 1: Login & Authentication
- Clean login page with email/password fields
- Simulated OTP/MFA step (enter any code to proceed)
- Toggle between "Family Owner" and "Family Member" roles
- Friendly branding with lock icon and tagline

## Page 2: Family Owner Dashboard
- Welcome header with family name
- Stats cards: Total Documents, Shared Documents, Family Members, Security Alerts
- Document categories displayed as cards: IDs, Banking, Insurance, Property, Passwords
- Each category shows document count and icons
- Prominent "Add New Document" button
- Recent activity feed showing uploads, shares, and access logs

## Page 3: Document Upload & Storage Flow
- Upload form: drag-and-drop or file picker (PDF/Image/Text)
- Category selector (IDs, Banking, Insurance, Property, Passwords)
- Privacy level toggle: Private or Family Shared
- "Encrypt & Store Securely" button triggers a visual animation
- Simulated steps shown: Encrypting → Generating Hash → Storing in Distributed Cloud → Recording on Blockchain
- Success screen showing document hash, timestamp, and blockchain verified badge

## Page 4: Document List & Detail View
- Filterable list of all stored documents by category
- Each document card shows: name, category, privacy status badge, blockchain integrity badge (✅)
- Document detail view shows:
  - Document preview/thumbnail
  - SHA-style hash string
  - Timestamp of storage
  - "🛡 Tamper-Proof Storage" badge with tooltip explanation
  - Distributed storage visualization (multi-node graphic)
  - Share and download actions

## Page 5: Family Sharing
- Select a document → "Share with Family" button
- Family member picker (list of added members)
- Permission options: View-only, Time-limited access (with duration picker)
- Access log table: Who accessed, When, Duration
- Owner can revoke access with one click

## Page 6: Family Members Management
- List of family members with their roles and access status
- "Add Family Member" form (name, email, relationship)
- Remove member option
- Per-member view: which documents they can access

## Page 7: Recovery & Backup Simulation
- "Simulate Device Loss" button triggers recovery demo
- Step-by-step visual flow:
  1. Identity verification (simulated)
  2. Retrieving encrypted documents from distributed cloud
  3. Validating ownership via blockchain hash
- Success message: "Documents successfully recovered with blockchain-backed proof"
- Shows recovered document list with integrity badges

## Page 8: Security Alerts
- Simulated unauthorized access attempt with alert notification
- Alert cards showing: type, timestamp, status (blocked), IP info
- "Trigger Security Alert Demo" button for presentation purposes
- Access log with all activity entries

## Design & UX
- Light, calming theme: blues, whites, soft greens
- Large readable fonts, friendly language throughout
- Tooltips explaining blockchain, encryption, and distributed storage concepts
- Consistent iconography: 🔒 Security, 👨‍👩‍👧‍👦 Family, ☁️ Cloud, 🔗 Blockchain
- Mobile-responsive layout
- Minimal clicks to complete any action

## Data & State
- All data stored in browser memory (no backend)
- Pre-seeded with sample documents and family members for demo purposes
- Simulated blockchain hashes generated using timestamps
- Role-based views: Owner sees everything, Family Member sees only shared items

