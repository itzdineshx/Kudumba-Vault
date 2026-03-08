# 🏛️ Kudumba-Vault

![logo](public/kudumba-logo.png)

> **Secure Family Document Vault with Blockchain Verification**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0+-green.svg)](https://www.mongodb.com/)
[![Ethereum](https://img.shields.io/badge/Ethereum-Network-blue.svg)](https://ethereum.org/)

A cutting-edge family document management system that combines military-grade encryption, distributed cloud storage, and Ethereum blockchain verification to provide unparalleled security for your family's most important documents.

## ✨ Features

### 🔐 **Military-Grade Security**
- **AES-256-GCM Encryption**: End-to-end encryption for all stored documents
- **SHA-256 File Hashing**: Cryptographic integrity verification
- **Zero-Knowledge Architecture**: Server never sees unencrypted data
- **Distributed Cloud Storage**: Files split across multiple secure nodes

### ⛓️ **Blockchain Verification (Optional)**
- **Ethereum On-Chain Records**: Immutable document hashes stored on Ethereum
- **Smart Contract Integration**: Automated verification and timestamping
- **MetaMask Wallet Support**: Direct blockchain interaction
- **Gas-Optimized Transactions**: Cost-effective on-chain operations
- **Educational Onboarding**: Simple setup for non-technical users

### 👨‍👩‍👧‍👦 **Family Collaboration**
- **Role-Based Access Control**: Owner and member permissions
- **Granular Document Sharing**: Share specific documents with family members
- **Real-Time Notifications**: Instant alerts for security events
- **Multi-Device Synchronization**: Access from anywhere, anytime

### 📄 **Document Management**
- **Category Organization**: IDs, Banking, Insurance, Property, Passwords
- **Smart Upload Interface**: Category-specific forms and validation
- **Advanced Search & Filtering**: Find documents instantly
- **Version Control**: Track document changes over time

### 🎨 **Modern User Experience**
- **Responsive Design**: Perfect on desktop, tablet, and mobile
- **Dark/Light Mode**: Comfortable viewing in any environment
- **Smooth Animations**: Fluid transitions and micro-interactions
- **Accessibility First**: WCAG 2.1 AA compliant

## � Quick Start

### Prerequisites
- Node.js 18+ and npm
- MongoDB 7.0+
- MetaMask browser extension *(optional - for blockchain verification features)*
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/itzdineshx/Kudumba-Vault.git
   cd Kudumba-Vault
   ```

2. **Install dependencies**
   ```bash
   # Install server dependencies
   cd server && npm install

   # Install client dependencies
   cd ../ && npm install
   ```

3. **Environment Setup**
   ```bash
   # Copy environment files
   cp server/.env.example server/.env
   cp .env.example .env

   # Edit server/.env with your MongoDB URI and JWT secret
   # Edit .env with your configuration
   ```

4. **Start MongoDB**
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest

   # Or using local MongoDB installation
   mongod
   ```

5. **Start the application**
   ```bash
   # Terminal 1: Start the server
   cd server && npm run dev

   # Terminal 2: Start the client
   npm run dev
   ```

6. **Access the application**
   - Open [http://localhost:5173](http://localhost:5173) in your browser
   - Create your family vault account
   - **Blockchain features are optional** - family members can use all core features without MetaMask
   - Owners can enable blockchain verification for enhanced security

## 🛡️ User-Friendly Security

### For Non-Technical Family Members
Kudumba-Vault is designed so that **blockchain features are completely optional**. Family members can:

- **Upload and access documents** with full AES-256-GCM encryption
- **Share documents securely** within the family vault
- **Use all core features** without any blockchain knowledge
- **Receive notifications** about shared documents

### Blockchain Integration (Optional)
For users who want maximum security verification:

- **MetaMask Setup Guide**: In-app tutorials walk through MetaMask installation
- **One-Click Connection**: Simple "Connect Wallet" button with clear instructions
- **Educational Tooltips**: Explanations of what blockchain verification does
- **Owner-Only Option**: Family owners can enable blockchain features for the entire vault
- **Fallback Security**: All documents remain encrypted even without blockchain

### Security Without Compromise
- **Same Encryption**: AES-256-GCM encryption applies to all documents
- **Role-Based Access**: Family members see only shared documents
- **Audit Logging**: All access attempts are tracked
- **Zero-Knowledge**: Server never sees unencrypted data

## 📸 Screenshots & Animations

### 🏠 **Dashboard Overview**
![Dashboard](public/ss_img/dashboard.png)
*Main dashboard showing document categories and family vault overview*

### 📤 **Category-Aware Upload**
![Upload Interface](public/ss_img/upload.png)
*Dynamic form for uploading documents with category selection*

### 🔍 **Document Management**
![Documents View](public/ss_img/logs.png)
*Document listing with search and filtering capabilities*

### 🔐 **Security Pipeline**
![Encryption Process](public/ss_img/hashing_document.png)
*Document encryption and hashing process visualization*

### 👥 **Family Sharing**
![Sharing Interface](public/ss_img/sharing.png)
*Interface for sharing documents with family members*

### ⛓️ **Blockchain Verification**
![Blockchain Integration](public/ss_img/backup.png)
*Blockchain backup and verification features*

### 🔐 **Authentication**
![Login](public/ss_img/login.png)
*Secure login interface for family members*

### 🚨 **Alerts & Notifications**
![Alerts](public/ss_img/alerts.png)
*Real-time alerts and notifications system*

### 🔄 **Recovery Options**
![Recovery](public/ss_img/recovery.png)
*Document recovery and backup restoration*

### 🔑 **Authorization**
![Auth](public/ss_img/auth.png)
*User authorization and permission management*

## 🏗️ Architecture

![System Architecture](public/ss_img/architecture.png)
*High-level system architecture showing frontend, backend, database, and blockchain integration*

![Application Workflow](public/ss_img/workflow.png)
*Complete application workflow from user registration to document verification*

### Frontend Architecture
- **React 18** with TypeScript for type safety
- **Vite** for fast development and optimized builds
- **Tailwind CSS** for utility-first styling
- **Framer Motion** for smooth animations
- **Shadcn/UI** for consistent component library
- **React Router** for client-side routing

### Backend Architecture
- **Node.js + Express** for RESTful API
- **MongoDB + Mongoose** for data persistence
- **JWT Authentication** with role-based access
- **Multer** for secure file uploads
- **Web3.js/Ethers.js** for blockchain integration

### Security Architecture
- **AES-256-GCM** symmetric encryption
- **PBKDF2** key derivation
- **HMAC-SHA256** integrity verification
- **Zero-trust model** implementation
- **Rate limiting** and **CORS** protection

## 🔒 Security Features

### Encryption Pipeline
1. **File Reception**: Raw file uploaded via HTTPS
2. **Key Generation**: PBKDF2-derived AES-256 key
3. **Encryption**: AES-256-GCM with random IV
4. **Hashing**: SHA-256 hash of original file
5. **Storage**: Encrypted blob stored in MongoDB
6. **Blockchain**: Hash recorded on Ethereum (optional)

### Access Control
- **JWT Tokens**: Stateless authentication
- **Role-Based Permissions**: Owner vs Member access
- **Document-Level Sharing**: Granular permission control
- **Session Management**: Automatic token refresh
- **Audit Logging**: All access attempts logged

### Network Security
- **HTTPS Only**: All communications encrypted
- **CORS Protection**: Domain whitelisting
- **Rate Limiting**: DDoS protection
- **Input Validation**: XSS and injection prevention
- **Security Headers**: OWASP recommended headers

## 📊 API Reference

### Authentication Endpoints
```http
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### Document Endpoints
```http
GET    /api/documents     # List documents (role-filtered)
POST   /api/documents     # Upload document
GET    /api/documents/:id # Get document details
DELETE /api/documents/:id # Delete document
```

### Sharing Endpoints
```http
POST   /api/documents/:id/share    # Share with member
DELETE /api/documents/:id/revoke  # Revoke access
```

### Member Management
```http
GET    /api/members       # List family members
POST   /api/members       # Add family member
DELETE /api/members/:id   # Remove member
```

## 🎨 Animation Showcase

### Page Transitions
- **Fade In/Out**: Smooth opacity transitions between routes
- **Slide Animations**: Directional navigation with spring physics
- **Scale Effects**: Modal dialogs with bounce animations

### Interactive Elements
- **Hover States**: Card lift effects with shadow transitions
- **Button Animations**: Scale and color transitions on interaction
- **Loading States**: Skeleton screens with shimmer effects
- **Progress Bars**: Smooth width transitions during uploads

### Form Interactions
- **Field Focus**: Border color and label position animations
- **Validation**: Error state animations with shake effects
- **Success States**: Checkmark animations with confetti effects

### Data Visualizations
- **Chart Animations**: SVG path drawing with easing functions
- **List Transitions**: Staggered item animations on load
- **Filter Effects**: Smooth category filtering with layout shifts

## 🚀 Deployment

### Production Build
```bash
# Build the frontend
npm run build

# Build the backend
cd server && npm run build
```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build individual services
docker build -t kudumba-vault-frontend .
docker build -t kudumba-vault-backend .
```

### Environment Variables
```env
# Server (.env)
MONGODB_URI=mongodb://localhost:27017/kudumba-vault
JWT_SECRET=your-super-secure-jwt-secret-here
PORT=5000

# Client (.env)
VITE_API_URL=http://localhost:5000/api
VITE_BLOCKCHAIN_NETWORK=mainnet
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Fork and clone
git clone https://github.com/your-username/Kudumba-Vault.git
cd Kudumba-Vault

# Install dependencies
npm install
cd server && npm install && cd ..

# Start development servers
npm run dev        # Frontend on :5173
cd server && npm run dev  # Backend on :5000
```

### Code Style
- **ESLint** and **Prettier** for code formatting
- **Husky** pre-commit hooks for quality checks
- **Conventional Commits** for commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Ethereum Foundation** for blockchain infrastructure
- **MetaMask** for wallet integration
- **MongoDB** for reliable data storage
- **React Community** for amazing frontend tools
- **Open Source Contributors** for their valuable contributions

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/itzdineshx/Kudumba-Vault/issues)
- **Discussions**: [GitHub Discussions](https://github.com/itzdineshx/Kudumba-Vault/discussions)
- **Email**: support@kudumba-vault.com

---

<div align="center">
  <p><strong>Built with ❤️ for families worldwide</strong></p>
  <p>
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#contributing">Contributing</a>
  </p>
</div>
