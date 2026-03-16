/**
 * Positions API Tests
 * Tests for the bulk positions API (current implementation)
 *
 * Note: Business logic (unit_cost_on_m3, kros_unit_czk) is covered
 * by shared/src/formulas.test.ts (55 tests).
 * Here we test API validation and HTTP contract.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// --- Mock all dependencies before importing the route ---

const mockDb = {
  prepare: jest.fn()
};

jest.unstable_mockModule('../../src/db/init.js', () => ({
  default: mockDb
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

jest.unstable_mockModule('../../src/utils/text.js', () => ({
  extractPartName: jest.fn((name) => name)
}));

jest.unstable_mockModule('../../src/services/calculator.js', () => ({
  calculatePositions: jest.fn((positions) => positions),
  calculateKPI: jest.fn(() => ({}))
}));

jest.unstable_mockModule('../../src/services/timeNormsService.js', () => ({
  suggestDays: jest.fn()
}));

jest.unstable_mockModule('../../src/services/portalWriteBack.js', () => ({
  writeBackBatch: jest.fn()
}));

// Dynamic import AFTER mocks are set up (required for ESM mocking)
const { default: positionsRoutes } = await import('../../src/routes/positions.js');

const app = express();
app.use(express.json());
app.use('/api/positions', positionsRoutes);

describe('Positions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/positions - Validation', () => {
    it('should reject request missing bridge_id', async () => {
      const response = await request(app)
        .post('/api/positions')
        .send({ positions: [{ part_name: 'Test', subtype: 'beton', qty: 10, days: 5 }] });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/bridge_id/);
    });

    it('should reject request missing positions array', async () => {
      const response = await request(app)
        .post('/api/positions')
        .send({ bridge_id: 'bridge-1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/positions/);
    });

    it('should reject request with non-array positions', async () => {
      const response = await request(app)
        .post('/api/positions')
        .send({ bridge_id: 'bridge-1', positions: 'not-array' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/positions/);
    });

    it('should reject position with missing part_name', async () => {
      const response = await request(app)
        .post('/api/positions')
        .send({
          bridge_id: 'bridge-1',
          positions: [{ subtype: 'beton', qty: 10, days: 5 }]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/part_name/);
    });

    it('should reject position with negative qty', async () => {
      const response = await request(app)
        .post('/api/positions')
        .send({
          bridge_id: 'bridge-1',
          positions: [{ part_name: 'Test', subtype: 'beton', qty: -5, days: 5 }]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/qty/);
    });

    it('should reject position with negative days', async () => {
      const response = await request(app)
        .post('/api/positions')
        .send({
          bridge_id: 'bridge-1',
          positions: [{ part_name: 'Test', subtype: 'beton', qty: 10, days: -1 }]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/days/);
    });
  });

  describe('DELETE /api/positions/:id', () => {
    it('should return 404 when position not found', async () => {
      mockDb.prepare.mockImplementation(() => ({
        run: jest.fn().mockReturnValue({ changes: 0 })
      }));

      const response = await request(app).delete('/api/positions/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toMatch(/not found/i);
    });

    it('should delete position successfully', async () => {
      mockDb.prepare.mockImplementation(() => ({
        run: jest.fn().mockReturnValue({ changes: 1 })
      }));

      const response = await request(app).delete('/api/positions/existing-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/positions - Validation', () => {
    it('should reject request missing bridge_id', async () => {
      const response = await request(app)
        .put('/api/positions')
        .send({ updates: [{ id: '1', field: 'days', value: 5 }] });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/bridge_id/);
    });

    it('should reject request missing updates array', async () => {
      const response = await request(app)
        .put('/api/positions')
        .send({ bridge_id: 'bridge-1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/updates/);
    });
  });
});
