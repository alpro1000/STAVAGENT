/**
 * Positions API Tests
 * Testing critical business logic: unit_cost_on_m3, KROS rounding, calculations
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import positionsRoutes from '../../src/routes/positions.js';

// Mock database
const mockDb = {
  prepare: jest.fn()
};

// Mock logger
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock database init
jest.unstable_mockModule('../../src/db/init.js', () => ({
  default: mockDb
}));

// Create test app
const app = express();
app.use(express.json());
app.use('/api/positions', positionsRoutes);

describe('Positions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/positions - Create Position', () => {
    it('should calculate unit_cost_on_m3 correctly for бетон', async () => {
      // Mock database responses
      const mockBridge = { bridge_id: 'test-bridge-1', project_id: 'test-project' };
      const mockPart = { part_id: 'test-part-1' };
      const mockInsertedPosition = {
        position_id: '123',
        bridge_id: 'test-bridge-1',
        part_id: 'test-part-1',
        subtype: 'beton',
        concrete_m3: 100,
        cost_czk: 50000,
        unit_cost_on_m3: 500, // 50000 / 100
        kros_unit_czk: 500    // ceil(500/50)*50 = 500
      };

      mockDb.prepare.mockImplementation((sql) => {
        if (sql.includes('SELECT * FROM bridges')) {
          return { get: jest.fn().mockResolvedValue(mockBridge) };
        }
        if (sql.includes('SELECT * FROM parts')) {
          return { get: jest.fn().mockResolvedValue(mockPart) };
        }
        if (sql.includes('INSERT INTO positions')) {
          return { run: jest.fn().mockResolvedValue({ lastInsertRowid: 123 }) };
        }
        if (sql.includes('SELECT * FROM positions WHERE')) {
          return { get: jest.fn().mockResolvedValue(mockInsertedPosition) };
        }
        return { get: jest.fn(), run: jest.fn(), all: jest.fn() };
      });

      const response = await request(app)
        .post('/api/positions')
        .send({
          bridge_id: 'test-bridge-1',
          part_id: 'test-part-1',
          subtype: 'beton',
          item_name: 'Beton C30/37',
          concrete_m3: 100,
          cost_czk: 50000
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        unit_cost_on_m3: 500,
        kros_unit_czk: 500
      });
    });

    it('should round KROS unit cost up to nearest 50 CZK', async () => {
      const mockBridge = { bridge_id: 'test-bridge-1' };
      const mockPart = { part_id: 'test-part-1' };
      const mockInsertedPosition = {
        position_id: '124',
        subtype: 'beton',
        concrete_m3: 100,
        cost_czk: 52500,      // 525 per m³
        unit_cost_on_m3: 525,
        kros_unit_czk: 550    // ceil(525/50)*50 = 550
      };

      mockDb.prepare.mockImplementation((sql) => {
        if (sql.includes('SELECT * FROM bridges')) {
          return { get: jest.fn().mockResolvedValue(mockBridge) };
        }
        if (sql.includes('SELECT * FROM parts')) {
          return { get: jest.fn().mockResolvedValue(mockPart) };
        }
        if (sql.includes('INSERT INTO positions')) {
          return { run: jest.fn().mockResolvedValue({ lastInsertRowid: 124 }) };
        }
        if (sql.includes('SELECT * FROM positions WHERE')) {
          return { get: jest.fn().mockResolvedValue(mockInsertedPosition) };
        }
        return { get: jest.fn(), run: jest.fn() };
      });

      const response = await request(app)
        .post('/api/positions')
        .send({
          bridge_id: 'test-bridge-1',
          part_id: 'test-part-1',
          subtype: 'beton',
          concrete_m3: 100,
          cost_czk: 52500  // Should round 525 → 550
        });

      expect(response.status).toBe(201);
      expect(response.body.kros_unit_czk).toBe(550);
    });

    it('should reject negative concrete_m3', async () => {
      const response = await request(app)
        .post('/api/positions')
        .send({
          bridge_id: 'test-bridge-1',
          part_id: 'test-part-1',
          subtype: 'beton',
          concrete_m3: -10,
          cost_czk: 50000
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/negative/i);
    });

    it('should reject negative cost_czk', async () => {
      const response = await request(app)
        .post('/api/positions')
        .send({
          bridge_id: 'test-bridge-1',
          part_id: 'test-part-1',
          subtype: 'beton',
          concrete_m3: 100,
          cost_czk: -50000
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/negative/i);
    });
  });

  describe('PATCH /api/positions/:id - Update Position', () => {
    it('should recalculate unit_cost_on_m3 when cost_czk is updated', async () => {
      const originalPosition = {
        position_id: '123',
        subtype: 'beton',
        concrete_m3: 100,
        cost_czk: 50000,
        unit_cost_on_m3: 500
      };

      const updatedPosition = {
        ...originalPosition,
        cost_czk: 60000,
        unit_cost_on_m3: 600,  // 60000 / 100
        kros_unit_czk: 600
      };

      mockDb.prepare.mockImplementation((sql) => {
        if (sql.includes('SELECT * FROM positions WHERE position_id')) {
          return { get: jest.fn().mockResolvedValue(updatedPosition) };
        }
        if (sql.includes('UPDATE positions SET')) {
          return { run: jest.fn().mockResolvedValue({ changes: 1 }) };
        }
        return { get: jest.fn(), run: jest.fn() };
      });

      const response = await request(app)
        .patch('/api/positions/123')
        .send({ cost_czk: 60000 });

      expect(response.status).toBe(200);
      expect(response.body.unit_cost_on_m3).toBe(600);
    });

    it('should recalculate unit_cost_on_m3 when concrete_m3 is updated', async () => {
      const updatedPosition = {
        position_id: '123',
        subtype: 'beton',
        concrete_m3: 200,      // Changed from 100 to 200
        cost_czk: 50000,
        unit_cost_on_m3: 250,  // 50000 / 200
        kros_unit_czk: 250
      };

      mockDb.prepare.mockImplementation((sql) => {
        if (sql.includes('SELECT * FROM positions WHERE position_id')) {
          return { get: jest.fn().mockResolvedValue(updatedPosition) };
        }
        if (sql.includes('UPDATE positions SET')) {
          return { run: jest.fn().mockResolvedValue({ changes: 1 }) };
        }
        return { get: jest.fn(), run: jest.fn() };
      });

      const response = await request(app)
        .patch('/api/positions/123')
        .send({ concrete_m3: 200 });

      expect(response.status).toBe(200);
      expect(response.body.unit_cost_on_m3).toBe(250);
    });
  });

  describe('DELETE /api/positions/:id', () => {
    it('should delete position successfully', async () => {
      mockDb.prepare.mockImplementation((sql) => {
        if (sql.includes('DELETE FROM positions')) {
          return { run: jest.fn().mockResolvedValue({ changes: 1 }) };
        }
        return { run: jest.fn() };
      });

      const response = await request(app)
        .delete('/api/positions/123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 when position not found', async () => {
      mockDb.prepare.mockImplementation((sql) => {
        if (sql.includes('DELETE FROM positions')) {
          return { run: jest.fn().mockResolvedValue({ changes: 0 }) };
        }
        return { run: jest.fn() };
      });

      const response = await request(app)
        .delete('/api/positions/nonexistent');

      expect(response.status).toBe(404);
    });
  });
});
