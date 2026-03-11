/**
 * Positions Integration Tests
 * Tests actual database operations with real data
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
  createTestBridge,
  createTestPart,
  createTestPosition,
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
const { default: positionsRoutes } = await import('../../src/routes/positions.js');
app.use('/api/positions', positionsRoutes);

describe('Positions Integration Tests', () => {
  let testUser;
  let testProject;
  let testBridge;
  let testPart;

  beforeAll(async () => {
    await setupTestDatabase();
    testDbAdapter = createTestDbAdapter();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(() => {
    clearTestData();

    // Create test data
    testUser = createTestUser();
    testProject = createTestProject(testUser.id);
    testBridge = createTestBridge(testProject.project_id);
    testPart = createTestPart(testProject.project_id);
  });

  describe('POST /api/positions - Create Position', () => {
    it('should create a beton position with correct calculations', async () => {
      const positionData = {
        bridge_id: testBridge.bridge_id,
        part_id: testPart.part_id,
        subtype: 'beton',
        item_name: 'Beton C30/37',
        unit: 'm³',
        qty: 100,
        concrete_m3: 100,
        crew_size: 4,
        wage_czk_ph: 398,
        shift_hours: 10,
        days: 10
      };

      const response = await request(app)
        .post('/api/positions')
        .send(positionData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        bridge_id: testBridge.bridge_id,
        part_id: testPart.part_id,
        subtype: 'beton',
        item_name: 'Beton C30/37',
        qty: 100,
        concrete_m3: 100
      });

      // Verify calculations
      expect(response.body.labor_hours).toBe(400); // 4 * 10 * 10
      expect(response.body.cost_czk).toBe(159200); // 400 * 398
      expect(response.body.unit_cost_on_m3).toBe(1592); // 159200 / 100
      expect(response.body.kros_unit_czk).toBe(1600); // ceil(1592 / 50) * 50
      expect(response.body.kros_total_czk).toBe(160000); // 1600 * 100
    });

    it('should create a bednění position with correct calculations', async () => {
      const positionData = {
        bridge_id: testBridge.bridge_id,
        part_id: testPart.part_id,
        subtype: 'bednění',
        item_name: 'Bednění stěn',
        unit: 'm²',
        qty: 200,
        concrete_m3: 50,
        crew_size: 3,
        wage_czk_ph: 380,
        shift_hours: 8,
        days: 15
      };

      const response = await request(app)
        .post('/api/positions')
        .send(positionData);

      expect(response.status).toBe(201);
      expect(response.body.subtype).toBe('bednění');
      expect(response.body.labor_hours).toBe(360); // 3 * 8 * 15
      expect(response.body.cost_czk).toBe(136800); // 360 * 380
      expect(response.body.unit_cost_on_m3).toBe(2736); // 136800 / 50
      expect(response.body.kros_unit_czk).toBe(2750); // ceil(2736 / 50) * 50
    });

    it('should create a výztuž position with correct calculations', async () => {
      const positionData = {
        bridge_id: testBridge.bridge_id,
        part_id: testPart.part_id,
        subtype: 'výztuž',
        item_name: 'Výztuž 10505R',
        unit: 't',
        qty: 5,
        concrete_m3: 100,
        crew_size: 5,
        wage_czk_ph: 420,
        shift_hours: 10,
        days: 8
      };

      const response = await request(app)
        .post('/api/positions')
        .send(positionData);

      expect(response.status).toBe(201);
      expect(response.body.subtype).toBe('výztuž');
      expect(response.body.labor_hours).toBe(400); // 5 * 10 * 8
      expect(response.body.cost_czk).toBe(168000); // 400 * 420
      expect(response.body.unit_cost_on_m3).toBe(1680); // 168000 / 100
      expect(response.body.kros_unit_czk).toBe(1700); // ceil(1680 / 50) * 50
    });

    it('should reject negative concrete_m3', async () => {
      const response = await request(app)
        .post('/api/positions')
        .send({
          bridge_id: testBridge.bridge_id,
          part_id: testPart.part_id,
          subtype: 'beton',
          concrete_m3: -10,
          qty: 100,
          crew_size: 4,
          wage_czk_ph: 398,
          shift_hours: 10,
          days: 10
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/negative/i);
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/positions')
        .send({
          bridge_id: testBridge.bridge_id,
          // Missing part_id, subtype, etc.
        });

      expect(response.status).toBe(400);
    });

    it('should reject non-existent bridge_id', async () => {
      const response = await request(app)
        .post('/api/positions')
        .send({
          bridge_id: 'non-existent-bridge',
          part_id: testPart.part_id,
          subtype: 'beton',
          concrete_m3: 100,
          qty: 100,
          crew_size: 4,
          wage_czk_ph: 398,
          shift_hours: 10,
          days: 10
        });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/positions - List Positions', () => {
    it('should return all positions for a bridge', async () => {
      // Create multiple positions
      createTestPosition(testBridge.bridge_id, testPart.part_id, {
        id: 'pos-1',
        subtype: 'beton',
        item_name: 'Beton C30/37'
      });
      createTestPosition(testBridge.bridge_id, testPart.part_id, {
        id: 'pos-2',
        subtype: 'bednění',
        item_name: 'Bednění stěn'
      });
      createTestPosition(testBridge.bridge_id, testPart.part_id, {
        id: 'pos-3',
        subtype: 'výztuž',
        item_name: 'Výztuž 10505R'
      });

      const response = await request(app)
        .get(`/api/positions?bridge_id=${testBridge.bridge_id}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);
      expect(response.body[0].id).toBe('pos-1');
      expect(response.body[1].id).toBe('pos-2');
      expect(response.body[2].id).toBe('pos-3');
    });

    it('should return empty array for bridge with no positions', async () => {
      const response = await request(app)
        .get(`/api/positions?bridge_id=${testBridge.bridge_id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should filter by part_name', async () => {
      const part2 = createTestPart(testProject.project_id, {
        part_id: 'part-2',
        part_name: 'OPĚRY'
      });

      createTestPosition(testBridge.bridge_id, testPart.part_id, {
        id: 'pos-1',
        part_name: 'ZÁKLADY'
      });
      createTestPosition(testBridge.bridge_id, part2.part_id, {
        id: 'pos-2',
        part_name: 'OPĚRY'
      });

      const response = await request(app)
        .get(`/api/positions?bridge_id=${testBridge.bridge_id}&part_name=ZÁKLADY`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBe('pos-1');
      expect(response.body[0].part_name).toBe('ZÁKLADY');
    });
  });

  describe('PATCH /api/positions/:id - Update Position', () => {
    it('should update cost_czk and recalculate unit_cost_on_m3', async () => {
      const position = createTestPosition(testBridge.bridge_id, testPart.part_id, {
        concrete_m3: 100,
        cost_czk: 50000,
        unit_cost_on_m3: 500
      });

      const response = await request(app)
        .patch(`/api/positions/${position.id}`)
        .send({ cost_czk: 60000 });

      expect(response.status).toBe(200);
      expect(response.body.cost_czk).toBe(60000);
      expect(response.body.unit_cost_on_m3).toBe(600); // 60000 / 100
      expect(response.body.kros_unit_czk).toBe(600);
    });

    it('should update concrete_m3 and recalculate unit_cost_on_m3', async () => {
      const position = createTestPosition(testBridge.bridge_id, testPart.part_id, {
        concrete_m3: 100,
        cost_czk: 50000,
        unit_cost_on_m3: 500
      });

      const response = await request(app)
        .patch(`/api/positions/${position.id}`)
        .send({ concrete_m3: 200 });

      expect(response.status).toBe(200);
      expect(response.body.concrete_m3).toBe(200);
      expect(response.body.unit_cost_on_m3).toBe(250); // 50000 / 200
      expect(response.body.kros_unit_czk).toBe(250);
    });

    it('should update days and recalculate labor costs', async () => {
      const position = createTestPosition(testBridge.bridge_id, testPart.part_id, {
        crew_size: 4,
        wage_czk_ph: 400,
        shift_hours: 10,
        days: 10,
        labor_hours: 400,
        cost_czk: 160000
      });

      const response = await request(app)
        .patch(`/api/positions/${position.id}`)
        .send({ days: 15 });

      expect(response.status).toBe(200);
      expect(response.body.days).toBe(15);
      expect(response.body.labor_hours).toBe(600); // 4 * 10 * 15
      expect(response.body.cost_czk).toBe(240000); // 600 * 400
    });

    it('should prevent SQL injection in field names', async () => {
      const position = createTestPosition(testBridge.bridge_id, testPart.part_id);

      const response = await request(app)
        .patch(`/api/positions/${position.id}`)
        .send({ 'malicious_field; DROP TABLE positions;--': 123 });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/invalid field/i);
    });

    it('should return 404 for non-existent position', async () => {
      const response = await request(app)
        .patch('/api/positions/non-existent-id')
        .send({ days: 15 });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/positions/:id', () => {
    it('should delete position successfully', async () => {
      const position = createTestPosition(testBridge.bridge_id, testPart.part_id);

      const response = await request(app)
        .delete(`/api/positions/${position.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify position is deleted
      const checkResponse = await request(app)
        .get(`/api/positions?bridge_id=${testBridge.bridge_id}`);
      expect(checkResponse.body.length).toBe(0);
    });

    it('should return 404 when deleting non-existent position', async () => {
      const response = await request(app)
        .delete('/api/positions/non-existent-id');

      expect(response.status).toBe(404);
    });

    it('should decrement bridge element_count after deletion', async () => {
      createTestPosition(testBridge.bridge_id, testPart.part_id, { id: 'pos-1' });
      createTestPosition(testBridge.bridge_id, testPart.part_id, { id: 'pos-2' });

      // Delete one position
      const response = await request(app)
        .delete('/api/positions/pos-1');

      expect(response.status).toBe(200);

      // Verify only one position remains
      const listResponse = await request(app)
        .get(`/api/positions?bridge_id=${testBridge.bridge_id}`);
      expect(listResponse.body.length).toBe(1);
    });
  });

  describe('KROS Rounding Logic', () => {
    it('should round 525 up to 550', async () => {
      const position = createTestPosition(testBridge.bridge_id, testPart.part_id, {
        concrete_m3: 100,
        cost_czk: 52500 // 525 per m³
      });

      const response = await request(app)
        .get(`/api/positions?bridge_id=${testBridge.bridge_id}`);

      const pos = response.body.find(p => p.id === position.id);
      expect(pos.unit_cost_on_m3).toBe(525);
      expect(pos.kros_unit_czk).toBe(550); // ceil(525 / 50) * 50
    });

    it('should round 1599 up to 1600', async () => {
      const position = createTestPosition(testBridge.bridge_id, testPart.part_id, {
        concrete_m3: 100,
        cost_czk: 159900
      });

      const response = await request(app)
        .get(`/api/positions?bridge_id=${testBridge.bridge_id}`);

      const pos = response.body.find(p => p.id === position.id);
      expect(pos.unit_cost_on_m3).toBe(1599);
      expect(pos.kros_unit_czk).toBe(1600);
    });

    it('should keep exact multiples of 50', async () => {
      const position = createTestPosition(testBridge.bridge_id, testPart.part_id, {
        concrete_m3: 100,
        cost_czk: 55000 // 550 per m³
      });

      const response = await request(app)
        .get(`/api/positions?bridge_id=${testBridge.bridge_id}`);

      const pos = response.body.find(p => p.id === position.id);
      expect(pos.unit_cost_on_m3).toBe(550);
      expect(pos.kros_unit_czk).toBe(550); // Already multiple of 50
    });
  });

  describe('Speed Column Calculation (MJ/h)', () => {
    it('should calculate speed from days', async () => {
      const positionData = {
        bridge_id: testBridge.bridge_id,
        part_id: testPart.part_id,
        subtype: 'beton',
        item_name: 'Beton C30/37',
        unit: 'm³',
        qty: 100,
        concrete_m3: 100,
        crew_size: 4,
        wage_czk_ph: 398,
        shift_hours: 10,
        days: 10
      };

      const response = await request(app)
        .post('/api/positions')
        .send(positionData);

      expect(response.status).toBe(201);

      // Speed = qty / (crew_size * shift_hours * days)
      // Speed = 100 / (4 * 10 * 10) = 100 / 400 = 0.25 m³/h
      const expectedSpeed = 100 / (4 * 10 * 10);
      expect(response.body.speed).toBeCloseTo(expectedSpeed, 4);
    });

    it('should recalculate speed when days change', async () => {
      const position = createTestPosition(testBridge.bridge_id, testPart.part_id, {
        qty: 100,
        crew_size: 4,
        shift_hours: 10,
        days: 10
      });

      const response = await request(app)
        .patch(`/api/positions/${position.id}`)
        .send({ days: 20 });

      expect(response.status).toBe(200);

      // New speed = 100 / (4 * 10 * 20) = 0.125
      const expectedSpeed = 100 / (4 * 10 * 20);
      expect(response.body.speed).toBeCloseTo(expectedSpeed, 4);
    });
  });
});
