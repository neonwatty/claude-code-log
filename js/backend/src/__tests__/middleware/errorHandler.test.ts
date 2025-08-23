import request from 'supertest';
import express from 'express';
import { 
  globalErrorHandler, 
  notFoundHandler, 
  asyncHandler,
  requestLogger,
  healthCheckHandler 
} from '../../middleware/errorHandler';
import { 
  ValidationError, 
  NotFoundError, 
  UnauthorizedError
} from '../../utils/errors';

describe('Error Handler Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('globalErrorHandler', () => {
    beforeEach(() => {
      app.use('/test', (req, res, next) => {
        const errorType = req.query.error as string;
        
        switch (errorType) {
          case 'validation':
            next(new ValidationError('Invalid input'));
            break;
          case 'notfound':
            next(new NotFoundError('Resource not found'));
            break;
          case 'unauthorized':
            next(new UnauthorizedError('Access denied'));
            break;
          case 'syntax': {
            const syntaxError = new SyntaxError('Invalid JSON') as SyntaxError & { body: object };
            syntaxError.body = {}; // Simulate body-parser JSON error
            next(syntaxError);
            break;
          }
          case 'cors':
            next(new Error('Not allowed by CORS'));
            break;
          case 'ratelimit':
            next(new Error('Too many requests'));
            break;
          case 'generic':
            next(new Error('Generic error'));
            break;
          default:
            res.json({ success: true });
        }
      });
      
      app.use(globalErrorHandler);
    });

    it('should handle ValidationError with 400 status', async () => {
      const response = await request(app)
        .get('/test?error=validation')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid input');
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should handle NotFoundError with 404 status', async () => {
      const response = await request(app)
        .get('/test?error=notfound')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Resource not found');
      expect(response.body.errorCode).toBe('NOT_FOUND');
    });

    it('should handle UnauthorizedError with 401 status', async () => {
      const response = await request(app)
        .get('/test?error=unauthorized')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access denied');
      expect(response.body.errorCode).toBe('UNAUTHORIZED');
    });

    it('should handle JSON syntax errors with 400 status', async () => {
      const response = await request(app)
        .get('/test?error=syntax')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid JSON in request body');
      expect(response.body.errorCode).toBe('INVALID_INPUT');
    });

    it('should handle CORS errors with 403 status', async () => {
      const response = await request(app)
        .get('/test?error=cors')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Origin not allowed by CORS policy');
      expect(response.body.errorCode).toBe('FORBIDDEN');
    });

    it('should handle rate limit errors with 429 status', async () => {
      const response = await request(app)
        .get('/test?error=ratelimit')
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Rate limit exceeded');
      expect(response.body.errorCode).toBe('RATE_LIMITED');
    });

    it('should handle generic errors with 500 status', async () => {
      const response = await request(app)
        .get('/test?error=generic')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Generic error'); // In non-production
      expect(response.body.errorCode).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should mask error details in production', async () => {
      process.env.NODE_ENV = 'production';
      
      const response = await request(app)
        .get('/test?error=generic')
        .expect(500);

      expect(response.body.error).toBe('An unexpected error occurred');
      
      process.env.NODE_ENV = 'test';
    });

    it('should include error details for AppErrors', async () => {
      app.use('/detailed', (req, res, next) => {
        next(new ValidationError('Validation failed', { field: 'email', code: 'INVALID_FORMAT' }));
      });
      app.use(globalErrorHandler);

      const response = await request(app)
        .get('/detailed')
        .expect(400);

      expect(response.body.details).toEqual({ field: 'email', code: 'INVALID_FORMAT' });
    });
  });

  describe('notFoundHandler', () => {
    beforeEach(() => {
      app.use(notFoundHandler);
    });

    it('should return 404 for undefined routes', async () => {
      const response = await request(app)
        .get('/nonexistent-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Route /nonexistent-route not found');
      expect(response.body.errorCode).toBe('NOT_FOUND');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should handle POST requests to undefined routes', async () => {
      const response = await request(app)
        .post('/api/undefined')
        .send({ data: 'test' })
        .expect(404);

      expect(response.body.error).toBe('Route /api/undefined not found');
    });
  });

  describe('asyncHandler', () => {
    it('should catch async errors and pass to error handler', async () => {
      const asyncRoute = asyncHandler(async (_req, _res, _next) => {
        throw new ValidationError('Async validation error');
      });

      app.get('/async-test', asyncRoute);
      app.use(globalErrorHandler);

      const response = await request(app)
        .get('/async-test')
        .expect(400);

      expect(response.body.error).toBe('Async validation error');
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should handle successful async operations', async () => {
      const asyncRoute = asyncHandler(async (req, res) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        res.json({ success: true, message: 'Async operation completed' });
      });

      app.get('/async-success', asyncRoute);

      const response = await request(app)
        .get('/async-success')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Async operation completed');
    });

    it('should handle rejected promises', async () => {
      const asyncRoute = asyncHandler(async (_req, _res) => {
        await Promise.reject(new Error('Promise rejection'));
      });

      app.get('/async-reject', asyncRoute);
      app.use(globalErrorHandler);

      const response = await request(app)
        .get('/async-reject')
        .expect(500);

      expect(response.body.error).toBe('Promise rejection');
    });
  });

  describe('requestLogger', () => {
    let consoleLogSpy: any;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should log request and response details', async () => {
      app.use(requestLogger);
      app.get('/logged-route', (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .get('/logged-route')
        .expect(200);

      // Should log request
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'GET /logged-route',
        expect.objectContaining({
          ip: expect.any(String),
          timestamp: expect.any(String)
        })
      );

      // Should log response
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'GET /logged-route - 200',
        expect.objectContaining({
          duration: expect.any(String),
          statusCode: 200,
          success: true,
          timestamp: expect.any(String)
        })
      );
    });

    it('should measure request duration', async () => {
      app.use(requestLogger);
      app.get('/slow-route', (req, res) => {
        setTimeout(() => res.json({ success: true }), 50);
      });

      await request(app)
        .get('/slow-route')
        .expect(200);

      const responseLogs = consoleLogSpy.mock.calls.filter(call => 
        call[0].includes('slow-route - 200')
      );

      expect(responseLogs.length).toBe(1);
      expect(responseLogs[0][1].duration).toMatch(/\d+ms/);
    });
  });

  describe('healthCheckHandler', () => {
    it('should return healthy status', async () => {
      app.get('/health', healthCheckHandler);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('environment');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('memory');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should include process information', async () => {
      app.get('/health', healthCheckHandler);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(typeof response.body.data.uptime).toBe('number');
      expect(response.body.data.memory).toHaveProperty('rss');
      expect(response.body.data.memory).toHaveProperty('heapTotal');
      expect(response.body.data.memory).toHaveProperty('heapUsed');
    });

    it('should handle health check errors gracefully', async () => {
      // Mock process.memoryUsage to throw error
      const originalMemoryUsage = process.memoryUsage;
      const mockMemoryUsage = vi.fn().mockImplementation(() => {
        throw new Error('Memory usage error');
      });
      Object.assign(mockMemoryUsage, { rss: vi.fn() });
      process.memoryUsage = mockMemoryUsage as any;

      app.get('/health', healthCheckHandler);

      const response = await request(app)
        .get('/health')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Health check failed');

      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('Error Response Format', () => {
    beforeEach(() => {
      app.use('/format-test', (req, res, next) => {
        next(new ValidationError('Format test error', { additionalInfo: 'test' }));
      });
      app.use(globalErrorHandler);
    });

    it('should include all required response fields', async () => {
      const response = await request(app)
        .get('/format-test')
        .expect(400);

      // Check IApiResponse structure
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Format test error');
      expect(response.body).toHaveProperty('errorCode', 'VALIDATION_ERROR');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('details', { additionalInfo: 'test' });

      // Validate timestamp format
      expect(() => new Date(response.body.timestamp)).not.toThrow();
    });

    it('should omit details when not provided', async () => {
      app.use('/no-details', (req, res, next) => {
        next(new NotFoundError('Simple error'));
      });
      app.use(globalErrorHandler);

      const response = await request(app)
        .get('/no-details')
        .expect(404);

      expect(response.body).not.toHaveProperty('details');
    });
  });
});