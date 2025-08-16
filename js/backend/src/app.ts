import express from 'express';
import compression from 'compression';
import dotenv from 'dotenv';
import apiRoutes from './routes/index';

// Enhanced middleware
import { corsConfig } from './middleware/cors';
import { 
  securityHeaders, 
  apiRateLimit, 
  apiSecurityHeaders, 
  sanitizeRequest, 
  requestSizeLimit 
} from './middleware/security';
import { jsonContentTypeValidation } from './middleware/validation';
import { 
  globalErrorHandler, 
  notFoundHandler, 
  requestLogger,
  healthCheckHandler
} from './middleware/errorHandler';

// Load environment variables
dotenv.config();

const app = express();

// Trust proxy for rate limiting and security headers
app.set('trust proxy', 1);

// Security headers
app.use(securityHeaders);
app.use(apiSecurityHeaders);

// CORS configuration
app.use(corsConfig);

// Rate limiting
if (process.env.NODE_ENV !== 'development') {
  app.use(apiRateLimit);
}

// Request size limiting
app.use(requestSizeLimit);

// Compression middleware
app.use(compression());

// Content type validation for POST/PUT/PATCH requests
app.use(jsonContentTypeValidation);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request sanitization
app.use(sanitizeRequest);

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(requestLogger);
}

// Mount API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', healthCheckHandler);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handling middleware (must be last)
app.use(globalErrorHandler);

export default app;