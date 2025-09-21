# Video Generation Platform - Frontend

React frontend application for the Dynamic Video Content Generation Platform built with TypeScript, Vite, and modern web technologies.

## 🚀 Features

- **Modern React 18** with TypeScript and strict type checking
- **Vite** for fast development and optimized builds
- **Tailwind CSS** with custom design system and responsive design
- **React Router** for client-side routing and navigation
- **Zustand** for lightweight state management
- **React Query** for server state management and caching
- **React Hook Form** with Zod validation for form handling
- **Framer Motion** for smooth animations and transitions
- **Error Boundaries** with graceful error handling
- **Loading States** with global loading context
- **Real-time Updates** with WebSocket support (planned)

## 🏗️ Architecture

### Component Structure
```
src/
├── components/
│   ├── ui/              # Reusable UI components
│   ├── common/          # Common components (ErrorBoundary, etc.)
│   └── layout/          # Layout components (Header, Sidebar, etc.)
├── pages/               # Route components
├── hooks/               # Custom React hooks
├── services/            # API services and HTTP client
├── stores/              # Zustand stores for state management
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
├── contexts/            # React contexts
└── styles/              # Global styles and CSS
```

### State Management
- **App Store**: Global app state (theme, user preferences, notifications)
- **Video Store**: Video creation, job tracking, and editor state
- **React Query**: Server state caching and synchronization

### API Integration
- **Axios-based HTTP client** with automatic retries and error handling
- **Request/response interceptors** for authentication and logging
- **Type-safe API calls** with full TypeScript support
- **Optimistic updates** for better user experience

## 🛠️ Development

### Prerequisites
- Node.js 18+ 
- npm 8+

### Installation
```bash
# Install dependencies
npm install

# Copy environment variables
cp env.example .env.local
```

### Environment Variables
Configure the following variables in `.env.local`:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3000
VITE_API_TIMEOUT=30000
VITE_API_RETRIES=3

# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_REALTIME=true
VITE_ENABLE_DEV_TOOLS=true

# Upload Limits
VITE_MAX_FILE_SIZE=104857600  # 100MB
VITE_MAX_ELEMENTS=10
VITE_MAX_VIDEO_DURATION=600   # 10 minutes

# UI Configuration
VITE_DEFAULT_THEME=system
VITE_ENABLE_ANIMATIONS=true
```

### Development Commands
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking
npm run type-check
```

### Docker Development
```bash
# Build Docker image
npm run docker:build

# Run Docker container
npm run docker:run
```

## 🎨 Design System

### Colors
- **Primary**: Blue tones for main actions and branding
- **Secondary**: Gray tones for text and backgrounds  
- **Success**: Green for completed states
- **Warning**: Yellow for processing states
- **Error**: Red for failed states

### Typography
- **Primary Font**: Inter (sans-serif)
- **Monospace Font**: JetBrains Mono

### Components
All components follow consistent patterns:
- TypeScript with strict typing
- Forwarded refs for better composition
- Consistent prop interfaces
- Accessible by default
- Responsive design

## 🧪 Testing

### Testing Stack
- **Vitest** for unit and integration testing
- **React Testing Library** for component testing
- **jsdom** for browser environment simulation
- **Coverage reports** with v8

### Testing Patterns
```tsx
// Example component test
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/Button'

test('renders button with text', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
})
```

## 📦 Build & Deployment

### Production Build
```bash
npm run build
```

### Build Output
- **dist/**: Production build files
- **Chunk splitting**: Vendor, UI, and utilities separated
- **Source maps**: Available for debugging
- **Asset optimization**: Images and fonts optimized

### Deployment
The application can be deployed to any static hosting service:
- Vercel (recommended)
- Netlify
- AWS S3 + CloudFront
- Docker containers

## 🔧 Configuration

### Vite Configuration
- **Path aliases** for clean imports (`@/components`, `@/utils`, etc.)
- **Proxy setup** for API calls during development
- **Build optimization** with chunk splitting
- **Development server** with HMR

### TypeScript Configuration
- **Strict mode** enabled
- **Path mapping** for imports
- **Advanced strict settings** for better type safety

### Tailwind Configuration
- **Custom color palette** matching design system
- **Custom animations** and transitions
- **Responsive breakpoints**
- **Plugin integration** (forms, typography, aspect-ratio)

## 🚀 Performance

### Optimization Features
- **Code splitting** by route and vendor
- **Lazy loading** for non-critical components
- **Image optimization** with proper sizing
- **Bundle analysis** for size monitoring
- **Caching strategies** for API calls

### Performance Monitoring
- **React Query Devtools** for cache inspection
- **Error boundaries** for graceful failures
- **Loading states** for better UX
- **Performance metrics** (when enabled)

## 🔒 Security

### Security Features
- **Input validation** with Zod schemas
- **XSS protection** with proper sanitization
- **CORS configuration** for API calls
- **Environment variable** protection
- **Content Security Policy** headers (production)

## 📚 Key Dependencies

### Core
- `react` `react-dom` - React framework
- `typescript` - Type safety
- `vite` - Build tool and dev server

### UI & Styling  
- `tailwindcss` - CSS framework
- `framer-motion` - Animations
- `lucide-react` - Icons
- `@headlessui/react` - Accessible components

### State Management
- `zustand` - Global state
- `@tanstack/react-query` - Server state
- `react-router-dom` - Routing

### Forms & Validation
- `react-hook-form` - Form handling
- `@hookform/resolvers` - Form validation
- `zod` - Schema validation

### HTTP & API
- `axios` - HTTP client
- `@supabase/supabase-js` - Database client

### Development
- `eslint` `prettier` - Code quality
- `vitest` - Testing framework
- `@testing-library/react` - Component testing

## 🤝 Contributing

1. Follow the existing code style and patterns
2. Write tests for new components and features
3. Update documentation for API changes
4. Use conventional commits for clear history
5. Ensure all linting and type checking passes

## 📄 License

MIT License - see LICENSE file for details
