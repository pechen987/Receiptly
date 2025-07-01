# Receiptly - Mobile App Architecture

## Overview

Receiptly is a React Native mobile application with a Flask backend, designed to help users track their spending by scanning and analyzing receipts. The app leverages AI (OpenAI API) to extract meaningful purchase data from receipt images, enabling personalized analytics on user spending habits.

## Key Features

- 📸 **Receipt Scanning**: Users can upload or take photos of receipts with image preprocessing capabilities
- 🧠 **AI-Powered Parsing**: The app uses OpenAI's API to extract line items, totals, and store data from receipts
- 📊 **Analytics Dashboard**: Real-time insights into spending patterns, trends, and financial analytics
- 👤 **User Authentication**: Secure authentication system with JWT token management
- 🗃️ **Receipt History**: Comprehensive list of scanned receipts with search and filter capabilities
- 🙍‍♂️ **Profile Management**: User profile management with settings and preferences
- 💱 **Multi-Currency Support**: Built-in currency conversion and management system
- 📧 **Email Verification**: Secure email verification system for user registration

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

## Folder Structure

```plaintext
windsurf-project/
│
├── assets/                     # Static assets (images, fonts, etc.)
│   └── architecture.md         # This documentation
│
├── backend/                    # Flask backend application
│   ├── routes/                # API routes
│   ├── utils/                 # Utility functions
│   ├── app.py                # Main Flask application
│   ├── config.py             # Configuration management
│   ├── models.py             # Database models
│   ├── errors.py             # Error handling
│   ├── email_utils.py        # Email functionality
│   ├── logger.py             # Logging configuration
│   ├── requirements.txt      # Python dependencies
│   ├── __init__.py          # Package initialization
│   ├── cancel.html          # Cancel page template
│   └── thank_you.html       # Thank you page template
│
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── AnalyticsHeader.tsx
│   │   └── BasicPlanHeader.tsx
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
│   │   ├── ProOnboardingScreen.tsx # Pro user onboarding
│   │   └── ReceiptDetailScreen.tsx # Receipt details
│   │
│   ├── services/            # Business logic & API calls
│   │   ├── api.ts           # API service
│   │   ├── imagePreprocessing.ts # Image processing
│   │   ├── receiptService.ts    # Receipt parsing
│   │   └── storageService.ts    # Storage management
│   │
│   └── types/               # TypeScript type definitions
│
├── uploads/                  # Temporary file storage
│
├── .gitignore              # Git ignore file
├── App.tsx                # Main application component
├── app.json               # Expo configuration
├── babel.config.js        # Babel configuration
├── eslint.config.js       # ESLint configuration
├── index.js              # Application entry point
├── package.json          # Dependencies and scripts
└── tsconfig.json         # TypeScript configuration
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

## Analytics Components

### Chart Components

#### 1. Bill Statistics Chart (`BillStatsChart.tsx`)
- Displays average bill amount and total number of receipts
- Features:
  - Toggle between monthly (M) and all-time (All) views
  - Shows average bill amount with delta (increase/decrease)
  - Displays total number of receipts
  - Real-time updates with new receipt additions
  - Currency-aware formatting

#### 2. Expenses by Category Chart (`ExpensesByCategoryChart.tsx`)
- Interactive pie chart showing spending distribution by category
- Features:
  - Period selection (week/month/all)
  - Interactive legend with category details
  - Click-through to view products in each category
  - Color-coded categories
  - Total spending display in center
  - Modal view for detailed category items

#### 3. Most Expensive Products Chart (`MostExpensiveProductsChart.tsx`)
- Bar chart showing individual product prices
- Features:
  - Period selection (month/year/all)
  - Horizontal bar visualization
  - Product name and price display
  - Purchase frequency indicator
  - Pro plan feature (blurred for basic users)
  - Color-coded by category

#### 4. Shopping Days Chart (`ShoppingDaysChart.tsx`)
- Bar chart showing shopping frequency by day of week
- Features:
  - Period selection (month/all)
  - Day of week distribution
  - Interactive bars
  - Color gradient based on frequency
  - Pro plan feature (blurred for basic users)

#### 5. Top Products Chart (`TopProductsChart.tsx`)
- Bar chart showing most frequently purchased items
- Features:
  - Period selection (month/year/all)
  - Percentage and count display
  - Category-based coloring
  - Total receipts context
  - Pro plan feature (blurred for basic users)

### Supporting Components

#### 1. Draggable Widget (`DraggableWidget.tsx`)
- Reusable component for draggable chart containers
- Features:
  - Drag handle
  - Auto-scroll when near edges
  - Smooth animations
  - Touch gesture handling
  - Layout preservation

#### 2. Hint Components (`HintComponents.tsx`)
- Information tooltips for charts
- Features:
  - Info icon with modal
  - Customizable hint text
  - Animated transitions
  - Touch-friendly design

### Context Providers

#### 1. Currency Context (`CurrencyContext.tsx`)
- Manages currency state across analytics
- Features:
  - Currency selection
  - Global currency state
  - Currency formatting utilities

#### 2. Widget Order Context (`WidgetOrderContext.tsx`)
- Manages chart widget ordering
- Features:
  - Persistent widget order
  - Drag-and-drop reordering
  - Order state management

### Utility Functions

#### 1. API Utilities (`utils/api.ts`)
- API endpoints for analytics data
- Features:
  - Shopping days data fetching
  - Error handling
  - Authentication integration

#### 2. Currency Utilities (`utils/currency.ts`)
- Currency formatting and conversion
- Features:
  - Currency symbol mapping
  - Amount formatting
  - Decimal place handling

#### 3. Export Utilities (`utils/exportAnalytics.ts`)
- PDF export functionality
- Features:
  - Authentication handling
  - Data aggregation
  - PDF generation

#### 4. General Utilities (`utils/index.ts`)
- Common utility functions
- Features:
  - Color interpolation
  - Label formatting
  - Product color mapping
  - Total amount formatting

### Types and Interfaces

#### 1. Chart Types (`types/index.ts`)
- TypeScript interfaces for:
  - Receipt data
  - Product data
  - Category data
  - Chart props
  - Analytics data structures

### Styling

#### 1. Shared Styles (`styles.ts`)
- Common styling for analytics components
- Features:
  - Consistent color scheme
  - Responsive layouts
  - Theme integration
  - Component-specific styles

## Design System

### Color Palette

#### Primary Colors
- Primary Purple: `#7e5cff` - Used for icons, active states, and accents
- Background Dark: `#2a2d3a` - Main widget background
- Background Darker: `#1a1c25` - Secondary background, headers
- Background Light: `#e6e9f0` - Text on dark backgrounds
- Background Muted: `#8ca0c6` - Secondary text, inactive states

#### Semantic Colors
- Success: `#4CAF50` - Positive trends, increases
- Error: `#FF5252` - Negative trends, decreases
- Warning: `#FFBF00` - Pro features, CTAs
- Overlay: `rgba(0, 0, 0, 0.5)` - Modal backgrounds

### Typography

#### Font Sizes
- Title: 22px (700 weight)
- Subtitle: 18px (600 weight)
- Body: 16px (500 weight)
- Small: 14px (500 weight)
- Micro: 12px (400 weight)

#### Font Weights
- Bold: 700
- Semi-bold: 600
- Medium: 500
- Regular: 400

### UI Components

#### Cards & Widgets
- Border Radius: 12px
- Shadow: 
  - Color: `#000`
  - Offset: `{ width: 0, height: 2 }`
  - Opacity: 0.25
  - Radius: 3.84
  - Elevation: 5

#### Buttons
- Primary (Pro CTA):
  - Background: `#FFBF00`
  - Text: `#000`
  - Font Weight: 700
  - Border Radius: 8px
  - Padding: 12px 36px

- Secondary (Period Selector):
  - Background: `#2a2d47`
  - Active Background: `#7e5cff`
  - Text: `#8ca0c6`
  - Active Text: `#fff`
  - Border Radius: 4px
  - Padding: 8px 10px

#### Charts
- Bar Charts:
  - Bar Height: 32px
  - Bar Spacing: 12px
  - Border Radius: 4px
  - Background: `#2a2d47`

- Pie Charts:
  - Donut Hole: 50% of radius
  - Slice Gap: 3 degrees
  - Center Text: 24px (700 weight)
  - Subtitle: 12px (500 weight)

#### Modals
- Background: `#2a2d47`
- Border Radius: 10px
- Padding: 20px
- Shadow:
  - Color: `#000`
  - Offset: `{ width: 0, height: 2 }`
  - Opacity: 0.25
  - Radius: 4
  - Elevation: 5

### Layout

#### Spacing
- Widget Padding: 16px
- Component Margin: 16px
- Icon Spacing: 8px
- Text Spacing: 4px

#### Grid System
- Flexible layout with percentage-based widths
- Responsive design for different screen sizes
- Minimum widget height: 180px
- Chart container height: 300px

### Interactive Elements

#### Drag & Drop
- Drag Handle:
  - Height: 40px
  - Background: `#1a1c25`
  - Border Bottom: 1px `#3a3d4a`
  - Icon: `reorder-three` (24px)

#### Scrollable Areas
- Horizontal Scroll:
  - For charts with many data points
  - Hidden scroll indicators
  - Smooth scrolling

- Vertical Scroll:
  - For lists and detailed views
  - Hidden scroll indicators
  - Pull-to-refresh support

### Pro Features

#### Blur Overlay
- Intensity: 40
- Tint: "dark"
- Border Radius: 16px
- Content:
  - Icon: 32px
  - Title: 22px (700 weight)
  - Subtitle: 18px (600 weight)
  - CTA Button: Primary style

### Animations

#### Transitions
- Modal: Fade animation
- Charts: Spring animation
- Widgets: Smooth position updates
- Buttons: Scale on press

#### Loading States
- Activity Indicator: `#7e5cff`
- Loading Text: Centered, 16px
- Error States: Red text, centered
- Empty States: Muted text, centered

### Accessibility

#### Touch Targets
- Minimum size: 44x44 points
- Adequate spacing between interactive elements
- Clear visual feedback on touch

#### Text Contrast
- Primary text: White on dark backgrounds
- Secondary text: Muted colors
- Error text: Red for visibility
- Success text: Green for positive feedback

## Core Features

### Authentication System (`AuthScreen.tsx`)
- Complete authentication flow with email verification
- Features:
  - Login and Registration modes
  - Email validation with real-time feedback
  - Password strength requirements
  - Password confirmation for registration
  - Email verification flow with deep linking
  - Password reset functionality
  - Persistent session management
  - Loading states and error handling
  - Keyboard-aware scrolling
  - Secure token storage

### User Profile (`ProfileScreen.tsx`)
- User account management and settings
- Features:
  - Email display and verification status
  - Subscription plan display (Basic/Pro)
  - Currency preference management
  - Pro plan upgrade button
  - Subscription billing information
  - Sign out functionality
  - Profile picture placeholder
  - Settings persistence
  - Loading states for async operations

### Pro Subscription (`ProOnboardingScreen.tsx`)
- Stripe-powered subscription management
- Features:
  - Pro plan benefits showcase:
    - Unlimited receipt scanning
    - Premium analytics
    - Priority processing
  - Secure payment processing
  - FAQ section with expandable items
  - Loading states for payment processing
  - Error handling and recovery
  - Deep linking for payment completion
  - Subscription status tracking

### Payment Integration
- Stripe-based payment system
- Features:
  - Secure payment processing
  - Subscription plan management
  - Automatic billing
  - Payment method storage
  - Invoice generation
  - Receipt delivery
  - Webhook integration for:
    - Payment success/failure
    - Subscription status updates
    - Invoice generation
    - Receipt delivery

### Security Implementation
- JWT-based authentication
- Features:
  - Secure token generation and validation
  - Token refresh mechanism
  - AsyncStorage for token persistence
  - Protected route management
  - Email verification requirement
  - Password hashing
  - Rate limiting
  - Session management

### Navigation Structure
- Stack-based navigation
- Routes:
  - MainTabs: Primary app navigation
  - ReceiptDetail: Individual receipt view
  - Auth: Authentication screens
  - ProOnboarding: Subscription management
- Features:
  - Protected routes
  - Deep linking support
  - Navigation state persistence
  - Screen transitions
  - Modal presentations