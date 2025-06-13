# Receiptly - Mobile App Architecture

## Overview

Receiptly is a React Native mobile application with a Flask backend, designed to help users track their spending by scanning and analyzing receipts. The app leverages AI (OpenAI API) to extract meaningful purchase data from receipt images, enabling personalized analytics on user spending habits.

---

## Key Features

- 📸 **Receipt Scanning**: Users can upload or take photos of receipts with image preprocessing capabilities
- 🧠 **AI-Powered Parsing**: The app uses OpenAI's API to extract line items, totals, and store data from receipts
- 📊 **Analytics Dashboard**: Real-time insights into spending patterns, trends, and financial analytics
- 👤 **User Authentication**: Secure authentication system with JWT token management
- 🗃️ **Receipt History**: Comprehensive list of scanned receipts with search and filter capabilities
- 🙍‍♂️ **Profile Management**: User profile management with settings and preferences
- 💱 **Multi-Currency Support**: Built-in currency conversion and management system
- 📧 **Email Verification**: Secure email verification system for user registration
  
---

## Technical Stack

### Frontend
- **Framework**: React Native with Expo
- **State Management**: React Context API
- **Navigation**: React Navigation v7
- **Storage**: AsyncStorage for local data persistence
- **Image Processing**: Expo Image Manipulator
- **API Integration**: Axios for HTTP requests
- **Charts**: React Native Chart Kit & SVG Charts
- **Type Safety**: TypeScript

### Backend
- **Framework**: Flask 3.0
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: JWT with PyJWT
- **Email**: Flask-Mail
- **Caching**: Redis
- **API Security**: Flask-Limiter for rate limiting
- **Testing**: Pytest with coverage
- **Production**: Gunicorn WSGI server
- **Logging**: Structured JSON logging

---

## Folder Structure

```plaintext
windsurf-project/
│
├── assets/                     # Static assets (images, fonts, etc.)
│   └── architecture.md         # This documentation
│
├── backend/                    # Flask backend application
│   ├── instance/              # Instance-specific files
│   ├── logs/                  # Application logs
│   ├── uploads/               # Temporary file storage
│   ├── app.py                # Main Flask application
│   ├── config.py             # Configuration management
│   ├── models.py             # Database models
│   ├── errors.py             # Error handling
│   ├── email_utils.py        # Email functionality
│   ├── logger.py             # Logging configuration
│   └── requirements.txt      # Python dependencies
│
├── src/
│   ├── components/            # Reusable UI components
│   │
│   ├── config/               # Configuration files
│   │   └── api.ts           # API configuration
│   │
│   ├── contexts/            # React Context providers
│   │   ├── AuthContext.tsx  # Authentication state
│   │   ├── CurrencyContext.tsx # Currency management
│   │   ├── ReceiptContext.tsx # Receipt state
│   │   ├── ThemeContext.tsx # Theme management
│   │   └── UserContext.tsx  # User state
│   │
│   ├── screens/             # App screens
│   │   ├── analytics/       # Analytics related screens
│   │   ├── AuthScreen.tsx   # Authentication UI
│   │   ├── HistoryScreen.tsx # Receipt history
│   │   ├── ProfileScreen.tsx # User profile
│   │   └── ReceiptDetailScreen.tsx # Receipt details
│   │
│   ├── services/            # Business logic & API calls
│   │   ├── imagePreprocessing.ts # Image processing
│   │   ├── receiptService.ts    # Receipt parsing
│   │   └── storageService.ts    # Storage management
│   │
│   └── types/               # TypeScript type definitions
│
├── App.tsx                  # Main application component
├── app.json                 # Expo configuration
├── babel.config.js          # Babel configuration
├── index.js                 # Application entry point
├── package.json            # Dependencies and scripts
└── tsconfig.json           # TypeScript configuration

```

## Key Components

### Frontend Components

#### Authentication Flow
- JWT-based authentication system
- Secure token storage using AsyncStorage
- Automatic token refresh mechanism
- Protected route handling

#### Receipt Management
- Image capture and preprocessing
- AI-powered receipt parsing
- Local storage for offline access
- Receipt categorization and tagging

#### Analytics System
- Real-time spending analytics
- Multi-currency support
- Customizable date ranges
- Export capabilities

#### State Management
- Context-based state management
- Optimized re-rendering
- Type-safe state updates
- Persistent state storage

### Backend Components

#### API Layer
- RESTful API endpoints
- Rate limiting and request validation
- CORS configuration
- Error handling middleware

#### Authentication System
- JWT token generation and validation
- Password hashing with bcrypt
- Email verification system
- Session management

#### Database Layer
- PostgreSQL database
- SQLAlchemy ORM
- Database migrations with Alembic
- Connection pooling

#### File Management
- Secure file upload handling
- Temporary file storage
- File cleanup routines
- Image processing pipeline

## Security Considerations

### Frontend
- Secure token storage
- API key management
- Input validation
- Error handling
- Network security

### Backend
- Rate limiting
- Input sanitization
- SQL injection prevention
- XSS protection
- CORS configuration
- Secure password hashing
- JWT token security

## Performance Optimizations

### Frontend
- Image compression
- Lazy loading
- Caching strategies
- Memory management
- Network request optimization

### Backend
- Database query optimization
- Connection pooling
- Redis caching
- Asynchronous processing
- Load balancing readiness

## Future Considerations

- Offline-first architecture
- Push notifications
- Receipt sharing
- Budget tracking
- Export functionality
- Multi-language support
- Microservices architecture
- Containerization with Docker
- CI/CD pipeline implementation
- Automated testing expansion
