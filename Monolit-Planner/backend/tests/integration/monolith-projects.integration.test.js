/**
 * Monolith Projects Integration Tests
 * Tests actual database operations for project CRUD
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearTestData,
  createTestUser,
  createTestProject,
  createTestPart,
  createTestDbAdapter
} from '../helpers/test-db.js';

// Create test app
const app = express();
app.use(express.json());

// Mock logger before importing routes
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock database module to use test database
let testDbAdapter;
jest.unstable_mockModule('../../src/db/init.js', () => ({
  default: testDbAdapter
}));

// Import routes after mocks are set up
const { default: monolithProjectsRoutes } = await import('../../src/routes/monolith-projects.js');
app.use('/api/monolith-projects', monolithProjectsRoutes);

describe('Monolith Projects Integration Tests', () => {
  let testUser;

  beforeAll(async () => {
    await setupTestDatabase();
    testDbAdapter = createTestDbAdapter();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(() => {
    clearTestData();
    testUser = createTestUser();
  });

  describe('POST /api/monolith-projects - Create Project', () => {
    it('should create a new project successfully', async () => {
      const projectData = {
        project_id: 'TEST-PROJ-001',
        project_name: 'Test Bridge Project',
        object_name: 'Test Bridge',
        description: 'A test project for integration testing'
      };

      const response = await request(app)
        .post('/api/monolith-projects')
        .send(projectData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        project_id: 'TEST-PROJ-001',
        project_name: 'Test Bridge Project',
        object_name: 'Test Bridge',
        description: 'A test project for integration testing',
        status: 'active'
      });
      expect(response.body.bridge_id).toBe('TEST-PROJ-001'); // Backward compatibility
    });

    it('should create project with minimal data (only project_id)', async () => {
      const response = await request(app)
        .post('/api/monolith-projects')
        .send({ project_id: 'MIN-PROJ-001' });

      expect(response.status).toBe(201);
      expect(response.body.project_id).toBe('MIN-PROJ-001');
      expect(response.body.project_name).toBe('');
      expect(response.body.object_name).toBe('');
      expect(response.body.status).toBe('active');
    });

    it('should reject project creation without project_id', async () => {
      const response = await request(app)
        .post('/api/monolith-projects')
        .send({
          project_name: 'Test Project',
          object_name: 'Test Bridge'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/project_id is required/i);
    });

    it('should reject duplicate project_id', async () => {
      // Create first project
      await request(app)
        .post('/api/monolith-projects')
        .send({ project_id: 'DUP-PROJ-001' });

      // Try to create duplicate
      const response = await request(app)
        .post('/api/monolith-projects')
        .send({ project_id: 'DUP-PROJ-001' });

      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/already exists/i);
    });

    it('should create corresponding bridge entry for FK compatibility', async () => {
      const response = await request(app)
        .post('/api/monolith-projects')
        .send({
          project_id: 'BRIDGE-TEST-001',
          project_name: 'Bridge Test',
          object_name: 'Test Bridge Object'
        });

      expect(response.status).toBe(201);

      // Verify bridge entry was created
      const db = testDbAdapter;
      const bridge = db.prepare('SELECT * FROM bridges WHERE bridge_id = ?')
        .get('BRIDGE-TEST-001');

      expect(bridge).toBeDefined();
      expect(bridge.bridge_id).toBe('BRIDGE-TEST-001');
      expect(bridge.object_name).toBe('Test Bridge Object');
      expect(bridge.status).toBe('active');
    });
  });

  describe('GET /api/monolith-projects - List Projects', () => {
    it('should return all projects', async () => {
      // Create multiple projects
      createTestProject(testUser.id, {
        project_id: 'PROJ-001',
        project_name: 'Project 1',
        status: 'active'
      });
      createTestProject(testUser.id, {
        project_id: 'PROJ-002',
        project_name: 'Project 2',
        status: 'active'
      });
      createTestProject(testUser.id, {
        project_id: 'PROJ-003',
        project_name: 'Project 3',
        status: 'archived'
      });

      const response = await request(app)
        .get('/api/monolith-projects');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);
    });

    it('should filter by status', async () => {
      createTestProject(testUser.id, {
        project_id: 'ACTIVE-001',
        status: 'active'
      });
      createTestProject(testUser.id, {
        project_id: 'ACTIVE-002',
        status: 'active'
      });
      createTestProject(testUser.id, {
        project_id: 'ARCHIVED-001',
        status: 'archived'
      });

      const response = await request(app)
        .get('/api/monolith-projects?status=active');

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
      expect(response.body.every(p => p.status === 'active')).toBe(true);
    });

    it('should include parts count', async () => {
      const project = createTestProject(testUser.id, {
        project_id: 'PARTS-TEST-001'
      });

      // Create parts for the project
      createTestPart(project.project_id, { part_name: 'ZÁKLADY' });
      createTestPart(project.project_id, { part_name: 'OPĚRY' });
      createTestPart(project.project_id, { part_name: 'PILÍŘE' });

      const response = await request(app)
        .get('/api/monolith-projects');

      expect(response.status).toBe(200);
      const foundProject = response.body.find(p => p.project_id === 'PARTS-TEST-001');
      expect(foundProject).toBeDefined();
      expect(foundProject.parts_count).toBe(3);
    });

    it('should return empty array when no projects exist', async () => {
      const response = await request(app)
        .get('/api/monolith-projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should sort by status and created_at DESC', async () => {
      // Create in specific order to test sorting
      createTestProject(testUser.id, {
        project_id: 'OLD-ACTIVE',
        status: 'active'
      });

      // Wait 1ms to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));

      createTestProject(testUser.id, {
        project_id: 'NEW-ACTIVE',
        status: 'active'
      });

      await new Promise(resolve => setTimeout(resolve, 1));

      createTestProject(testUser.id, {
        project_id: 'ARCHIVED',
        status: 'archived'
      });

      const response = await request(app)
        .get('/api/monolith-projects');

      expect(response.status).toBe(200);

      // Active projects should come first (status DESC), newest first (created_at DESC)
      expect(response.body[0].project_id).toBe('NEW-ACTIVE');
      expect(response.body[1].project_id).toBe('OLD-ACTIVE');
      expect(response.body[2].project_id).toBe('ARCHIVED');
    });
  });

  describe('GET /api/monolith-projects/:id - Get Project Details', () => {
    it('should return project with parts', async () => {
      const project = createTestProject(testUser.id, {
        project_id: 'DETAIL-001',
        project_name: 'Detail Test Project',
        object_name: 'Test Bridge'
      });

      // Create parts
      createTestPart(project.project_id, {
        part_id: 'PART-001',
        part_name: 'ZÁKLADY'
      });
      createTestPart(project.project_id, {
        part_id: 'PART-002',
        part_name: 'OPĚRY'
      });

      const response = await request(app)
        .get('/api/monolith-projects/DETAIL-001');

      expect(response.status).toBe(200);
      expect(response.body.project_id).toBe('DETAIL-001');
      expect(response.body.project_name).toBe('Detail Test Project');
      expect(response.body.object_name).toBe('Test Bridge');
      expect(response.body.bridge_id).toBe('DETAIL-001'); // Backward compatibility
      expect(Array.isArray(response.body.parts)).toBe(true);
      expect(response.body.parts.length).toBe(2);
      expect(response.body.parts[0].part_name).toBe('OPĚRY'); // Sorted alphabetically
      expect(response.body.parts[1].part_name).toBe('ZÁKLADY');
    });

    it('should return project with empty parts array', async () => {
      createTestProject(testUser.id, {
        project_id: 'NO-PARTS-001',
        project_name: 'Project Without Parts'
      });

      const response = await request(app)
        .get('/api/monolith-projects/NO-PARTS-001');

      expect(response.status).toBe(200);
      expect(response.body.project_id).toBe('NO-PARTS-001');
      expect(response.body.parts).toEqual([]);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/api/monolith-projects/NON-EXISTENT');

      expect(response.status).toBe(404);
      expect(response.body.error).toMatch(/not found/i);
    });
  });

  describe('PUT /api/monolith-projects/:id - Update Project', () => {
    it('should update project name and object name', async () => {
      const project = createTestProject(testUser.id, {
        project_id: 'UPDATE-001',
        project_name: 'Original Name',
        object_name: 'Original Object'
      });

      const response = await request(app)
        .put('/api/monolith-projects/UPDATE-001')
        .send({
          project_name: 'Updated Name',
          object_name: 'Updated Object'
        });

      expect(response.status).toBe(200);
      expect(response.body.project_name).toBe('Updated Name');
      expect(response.body.object_name).toBe('Updated Object');
    });

    it('should update project status', async () => {
      createTestProject(testUser.id, {
        project_id: 'STATUS-001',
        status: 'active'
      });

      const response = await request(app)
        .put('/api/monolith-projects/STATUS-001')
        .send({ status: 'archived' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('archived');
    });

    it('should update description', async () => {
      createTestProject(testUser.id, {
        project_id: 'DESC-001',
        description: 'Old description'
      });

      const response = await request(app)
        .put('/api/monolith-projects/DESC-001')
        .send({ description: 'New updated description' });

      expect(response.status).toBe(200);
      expect(response.body.description).toBe('New updated description');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .put('/api/monolith-projects/NON-EXISTENT')
        .send({ project_name: 'Test' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/monolith-projects/:id - Delete Project', () => {
    it('should delete project successfully', async () => {
      createTestProject(testUser.id, {
        project_id: 'DELETE-001',
        project_name: 'To Be Deleted'
      });

      const response = await request(app)
        .delete('/api/monolith-projects/DELETE-001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify project is deleted
      const checkResponse = await request(app)
        .get('/api/monolith-projects/DELETE-001');

      expect(checkResponse.status).toBe(404);
    });

    it('should cascade delete parts when project is deleted', async () => {
      const project = createTestProject(testUser.id, {
        project_id: 'CASCADE-001'
      });

      createTestPart(project.project_id, {
        part_id: 'PART-CASCADE-001',
        part_name: 'ZÁKLADY'
      });
      createTestPart(project.project_id, {
        part_id: 'PART-CASCADE-002',
        part_name: 'OPĚRY'
      });

      // Delete project
      await request(app)
        .delete('/api/monolith-projects/CASCADE-001');

      // Verify parts are also deleted
      const db = testDbAdapter;
      const parts = db.prepare('SELECT * FROM parts WHERE project_id = ?')
        .all('CASCADE-001');

      expect(parts.length).toBe(0);
    });

    it('should return 404 when deleting non-existent project', async () => {
      const response = await request(app)
        .delete('/api/monolith-projects/NON-EXISTENT');

      expect(response.status).toBe(404);
    });
  });

  describe('VARIANT 1 Architecture Validation', () => {
    it('should create universal project without type restrictions', async () => {
      // User can describe any project type in object_name
      const bridgeResponse = await request(app)
        .post('/api/monolith-projects')
        .send({
          project_id: 'BRIDGE-001',
          object_name: 'Most přes řeku Labe'
        });

      const buildingResponse = await request(app)
        .post('/api/monolith-projects')
        .send({
          project_id: 'BUILDING-001',
          object_name: 'Bytový dům 5 pater'
        });

      const customResponse = await request(app)
        .post('/api/monolith-projects')
        .send({
          project_id: 'CUSTOM-001',
          object_name: 'Tunel pod železnicí'
        });

      expect(bridgeResponse.status).toBe(201);
      expect(buildingResponse.status).toBe(201);
      expect(customResponse.status).toBe(201);

      // All projects should be created equally
      const listResponse = await request(app)
        .get('/api/monolith-projects');

      expect(listResponse.body.length).toBe(3);
    });

    it('should not auto-load templates on manual creation', async () => {
      const response = await request(app)
        .post('/api/monolith-projects')
        .send({
          project_id: 'EMPTY-001',
          project_name: 'Empty Project'
        });

      expect(response.status).toBe(201);

      // Verify no parts were auto-created
      const detailResponse = await request(app)
        .get('/api/monolith-projects/EMPTY-001');

      expect(detailResponse.body.parts).toEqual([]);
    });
  });
});
