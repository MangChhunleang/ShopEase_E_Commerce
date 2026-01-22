# Post-Cleanup Quick Start Guide

## 🚀 Getting Started After Cleanup

### 1. Restore Dependencies

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
cd frontend
npm install
```

#### Mobile
```bash
cd mobile_shopease
flutter pub get
```

### 2. Verify Everything Works

#### Backend API
```bash
cd backend
npm start
# Server should start on http://localhost:4000
```

#### Admin Dashboard
```bash
cd frontend
npm run dev
# Dashboard should open on http://localhost:5173
```

#### Mobile App
```bash
cd mobile_shopease
flutter run
# Select your target device
```

### 3. Optional Updates

#### Update Backend Dependencies
```bash
cd backend
npm update mysql2 twilio
```

#### Update Frontend Dependencies
```bash
cd frontend
npm update
```

#### Update Flutter Dependencies (test carefully)
```bash
cd mobile_shopease
flutter pub upgrade --major-versions
# Or for safer minor updates only:
flutter pub upgrade
```

### 4. Tasks Available

You can use VS Code tasks to start all services:
- **Start Backend** - Runs backend API
- **Start Frontend** - Runs admin dashboard  
- **Start Mobile** - Launches Android emulator
- **Start All** - Runs all three simultaneously

Press `Ctrl+Shift+P` → "Tasks: Run Task" to see available tasks.

### 5. Common Commands

#### Backend Scripts
```bash
npm run init-db      # Initialize database with seed data
npm run reset-db     # Reset database (WARNING: destructive)
npm run list-users   # List all users
npm run dev          # Run with nodemon (auto-restart)
```

#### Frontend Scripts
```bash
npm run dev          # Development server
npm run build        # Production build
npm run lint         # Check for linting errors
npm run preview      # Preview production build
```

#### Flutter Commands
```bash
flutter analyze      # Check for code issues
flutter test         # Run tests
flutter build apk    # Build Android APK
flutter clean        # Clean build artifacts (if needed)
```

### 6. Environment Setup

Make sure you have:
- `.env` file in `backend/` directory
- `serviceAccountKey.json` in `backend/` directory
- MySQL database running and accessible
- Android SDK for mobile development (if building mobile)

### 7. Helpful Tips

- **Lint before committing:** Run `npm run lint` in frontend
- **Test endpoints:** Use the scripts in `backend/scripts/`
- **Debug login:** Run `node scripts/debug-login.js`
- **Check order status:** Edit and run `scripts/check_status.js`

---

**Ready to build! Your codebase is clean and organized.** 🎉
