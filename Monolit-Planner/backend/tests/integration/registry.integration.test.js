import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestData } from '../helpers/test-db.js';
import { createTestServer } from '../helpers/test-server.js';

describe('Registry API Integration Tests', () => {
  let app;
  let projectId;
  let objectId;

  beforeAll(async () => {
    await setupTestDB();
    app = await createTestServer();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestData();
  });

  describe('POST /api/v1/registry/projects', () => {
    it('should create new project', async () => {
      const res = await request(app)
        .post('/api/v1/registry/projects')
        .send({
          project_name: 'Test Project',
          display_name: 'Test Project Display'
        });

      expect(res.status).toBe(200);
      expect(res.body.project_name).toBe('Test Project');
      expect(res.body.id).toBeDefined();
      projectId = res.body.id;
    });

    it('should reject duplicate project', async () => {
      await request(app)
        .post('/api/v1/registry/projects')
        .send({ project_name: 'Duplicate' });

      const res = await request(app)
        .post('/api/v1/registry/projects')
        .send({ project_name: 'Duplicate' });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/v1/registry/projects', () => {
    it('should list all projects', async () => {
      await request(app)
        .post('/api/v1/registry/projects')
        .send({ project_name: 'Project 1' });

      await request(app)
        .post('/api/v1/registry/projects')
        .send({ project_name: 'Project 2' });

      const res = await request(app).get('/api/v1/registry/projects');

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('POST /api/v1/registry/objects', () => {
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/registry/projects')
        .send({ project_name: 'Test Project' });
      projectId = res.body.id;
    });

    it('should create object in project', async () => {
      const res = await request(app)
        .post('/api/v1/registry/objects')
        .send({
          project_id: projectId,
          object_name: 'Bridge 1',
          object_type: 'bridge'
        });

      expect(res.status).toBe(200);
      expect(res.body.object_name).toBe('Bridge 1');
      expect(res.body.object_type).toBe('bridge');
    });
  });

  describe('POST /api/v1/registry/positions', () => {
    beforeEach(async () => {
      const projectRes = await request(app)
        .post('/api/v1/registry/projects')
        .send({ project_name: 'Test Project' });
      projectId = projectRes.body.id;

      const objectRes = await request(app)
        .post('/api/v1/registry/objects')
        .send({
          project_id: projectId,
          object_name: 'Bridge 1',
          object_type: 'bridge'
        });
      objectId = objectRes.body.id;
    });

    it('should create position instance', async () => {
      const res = await request(app)
        .post('/api/v1/registry/positions')
        .send({
          object_id: objectId,
          position_code: '1.2.3',
          position_name: 'Concrete C30/37',
          unit: 'm3',
          quantity: 100.5,
          kiosk_type: 'monolit',
          kiosk_data: { concrete_class: 'C30/37' }
        });

      expect(res.status).toBe(200);
      expect(res.body.position_code).toBe('1.2.3');
      expect(res.body.quantity).toBe('100.5');
    });

    it('should list positions for object', async () => {
      await request(app)
        .post('/api/v1/registry/positions')
        .send({
          object_id: objectId,
          position_code: '1.1',
          position_name: 'Position 1',
          unit: 'm3',
          quantity: 10,
          kiosk_type: 'monolit'
        });

      const res = await request(app)
        .get(`/api/v1/registry/objects/${objectId}/positions`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });
});
