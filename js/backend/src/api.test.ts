import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from './index';
import { Server } from 'http';

describe('API Tests', () => {
  let server: Server;

  beforeAll(() => {
    server = app.listen(0);
  });

  afterAll(() => {
    server.close();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/health').expect('Content-Type', /json/).expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('status', 'healthy');
      expect(res.body.data).toHaveProperty('timestamp');
      expect(res.body.data).toHaveProperty('uptime');
      expect(res.body.data).toHaveProperty('environment');
    });
  });

  describe('User API', () => {
    let userId: string;

    describe('POST /api/users', () => {
      it('should create a new user', async () => {
        const res = await request(app)
          .post('/api/users')
          .send({
            name: 'John Doe',
            email: 'john@example.com',
          })
          .expect('Content-Type', /json/)
          .expect(201);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('message', 'User created successfully');
        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data).toHaveProperty('name', 'John Doe');
        expect(res.body.data).toHaveProperty('email', 'john@example.com');

        userId = res.body.data.id;
      });

      it('should fail with missing data', async () => {
        const res = await request(app)
          .post('/api/users')
          .send({ name: 'Test' })
          .expect('Content-Type', /json/)
          .expect(400);

        expect(res.body).toHaveProperty('success', false);
        expect(res.body).toHaveProperty('error', 'Email and name are required');
      });
    });

    describe('GET /api/users', () => {
      it('should return all users', async () => {
        const res = await request(app).get('/api/users').expect('Content-Type', /json/).expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);
      });
    });

    describe('GET /api/users/:id', () => {
      it('should return user by id', async () => {
        const res = await request(app)
          .get(`/api/users/${userId}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body.data).toHaveProperty('id', userId);
      });

      it('should return 404 for non-existent user', async () => {
        const res = await request(app)
          .get('/api/users/999999')
          .expect('Content-Type', /json/)
          .expect(404);

        expect(res.body).toHaveProperty('success', false);
        expect(res.body).toHaveProperty('error', 'User not found');
      });
    });

    describe('PUT /api/users/:id', () => {
      it('should update user', async () => {
        const res = await request(app)
          .put(`/api/users/${userId}`)
          .send({ name: 'Jane Doe' })
          .expect('Content-Type', /json/)
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('message', 'User updated successfully');
        expect(res.body.data).toHaveProperty('name', 'Jane Doe');
      });
    });

    describe('DELETE /api/users/:id', () => {
      it('should delete user', async () => {
        const res = await request(app)
          .delete(`/api/users/${userId}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('message', 'User deleted successfully');
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/unknown').expect('Content-Type', /json/).expect(404);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toContain('not found');
    });

    it('should validate content type for POST requests', async () => {
      const res = await request(app)
        .post('/api/users')
        .send('invalid data')
        .set('Content-Type', 'text/plain')
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error', 'Content-Type must be application/json');
    });
  });
});
