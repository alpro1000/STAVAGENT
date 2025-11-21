# 🔗 Monolit-Planner TypeScript Client Integration

> Step-by-step guide for integrating Concrete-Agent in Monolit-Planner (Node.js)

**Version:** 1.0.0
**Created:** 2025-11-16
**Target Stack:** Node.js 18+, Express, TypeScript 5

---

## 📦 INSTALLATION

### Step 1: Install Dependencies

```bash
cd Monolit-Planner
npm install axios dotenv
# Or use fetch API (built-in for Node 18+)
```

### Step 2: Create `.env` Configuration

```env
# Concrete-Agent Configuration
CONCRETE_AGENT_URL=http://localhost:8000
CONCRETE_AGENT_TOKEN=your-service-token-here
CONCRETE_AGENT_TIMEOUT=30000  # 30 seconds
CONCRETE_AGENT_CACHE_TTL=3600  # 1 hour
```

### Step 3: Create TypeScript Client

Create `src/services/concreteAgentClient.ts`:

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';

// ============================================================================
// TYPES (from Concrete-Agent)
// ============================================================================

interface MonolitPosition {
  position_id: string;
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price?: number;
  notes?: string;
}

interface MonolitEnrichmentResult {
  position_id: string;
  code: string;
  description: string;
  enrichment_status: 'matched' | 'partial' | 'not_found';
  matched_code?: string;
  matched_description?: string;
  confidence_score: number; // 0.0 - 1.0
  price_recommendation?: number;
  price_deviation?: number;
  notes?: string;
  enrichment_metadata: Record<string, any>;
}

interface MonolitAuditResult {
  position_id: string;
  code: string;
  classification: 'GREEN' | 'AMBER' | 'RED';
  confidence: number;
  audit_notes: Record<string, string>;
  requires_review: boolean;
  review_reason?: string;
}

interface MonolitEnrichmentResponse {
  request_id: string;
  status: 'success' | 'error';
  timestamp: string;
  enrichments: MonolitEnrichmentResult[];
  audits: MonolitAuditResult[];
  statistics: {
    total: number;
    matched: number;
    partial: number;
    not_found: number;
    processing_time_ms: number;
    avg_time_per_position_ms: number;
  };
  errors: Array<{
    position_id?: string;
    error: string;
    type: string;
  }>;
}

interface EnrichmentRequest {
  positions: MonolitPosition[];
  include_audit?: boolean;
  audit_roles?: string[];
}

// ============================================================================
// CLIENT CLASS
// ============================================================================

class ConcreteAgentClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string = process.env.CONCRETE_AGENT_URL || 'http://localhost:8000',
              apiKey: string = process.env.CONCRETE_AGENT_TOKEN || '') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;

    // Initialize Axios instance with defaults
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: parseInt(process.env.CONCRETE_AGENT_TIMEOUT || '30000'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => this.handleError(error)
    );
  }

  /**
   * Enrich positions with KROS matching and optional audit
   *
   * @param positions - Array of positions to enrich
   * @param options - Enrichment options
   * @returns Enrichment response with matched codes and confidence scores
   *
   * @example
   * const response = await client.enrichPositions([
   *   {
   *     position_id: 'pos_1',
   *     code: '121151113',
   *     description: 'Beton C30/37',
   *     quantity: 850,
   *     unit: 'm3'
   *   }
   * ], {
   *   include_audit: true,
   *   audit_roles: ['SME', 'ARCH', 'ENG']
   * });
   *
   * console.log(response.enrichments[0].confidence_score); // 0.99
   */
  async enrichPositions(
    positions: MonolitPosition[],
    options: Partial<EnrichmentRequest> = {}
  ): Promise<MonolitEnrichmentResponse> {
    try {
      if (!positions || positions.length === 0) {
        throw new Error('At least one position is required');
      }

      if (positions.length > 100) {
        console.warn('Batch size exceeds 100 positions, splitting...');
        return await this.enrichBatch(positions, options);
      }

      const request: EnrichmentRequest = {
        positions,
        include_audit: options.include_audit ?? false,
        audit_roles: options.audit_roles ?? ['SME', 'ARCH', 'ENG'],
      };

      const response = await this.client.post<MonolitEnrichmentResponse>(
        '/api/monolit/enrich',
        request
      );

      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Enrich large batches (>100 positions) by splitting into chunks
   *
   * @param positions - Array of positions
   * @param options - Enrichment options
   * @returns Combined enrichment response
   */
  private async enrichBatch(
    positions: MonolitPosition[],
    options: Partial<EnrichmentRequest> = {}
  ): Promise<MonolitEnrichmentResponse> {
    const BATCH_SIZE = 50; // Process 50 at a time
    const batches = [];

    for (let i = 0; i < positions.length; i += BATCH_SIZE) {
      batches.push(positions.slice(i, i + BATCH_SIZE));
    }

    console.log(`Processing ${positions.length} positions in ${batches.length} batches...`);

    const responses = await Promise.all(
      batches.map((batch) => this.enrichPositions(batch, options))
    );

    // Combine results
    return {
      request_id: responses[0].request_id,
      status: responses.every((r) => r.status === 'success') ? 'success' : 'error',
      timestamp: new Date().toISOString(),
      enrichments: responses.flatMap((r) => r.enrichments),
      audits: responses.flatMap((r) => r.audits),
      statistics: {
        total: positions.length,
        matched: responses.reduce((sum, r) => sum + r.statistics.matched, 0),
        partial: responses.reduce((sum, r) => sum + r.statistics.partial, 0),
        not_found: responses.reduce((sum, r) => sum + r.statistics.not_found, 0),
        processing_time_ms: responses.reduce((sum, r) => sum + r.statistics.processing_time_ms, 0),
        avg_time_per_position_ms: Math.round(
          responses.reduce((sum, r) => sum + r.statistics.processing_time_ms, 0) / positions.length
        ),
      },
      errors: responses.flatMap((r) => r.errors),
    };
  }

  /**
   * Check if Concrete-Agent is healthy
   *
   * @returns true if service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/monolit/health');
      return response.data.status === 'healthy';
    } catch {
      return false;
    }
  }

  /**
   * Get adapter statistics (admin only)
   *
   * @returns Service statistics
   */
  async getStatistics(): Promise<Record<string, any>> {
    try {
      const response = await this.client.get('/api/monolit/stats');
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Handle and log API errors
   */
  private handleError(error: AxiosError): never {
    if (error.response) {
      const { status, data } = error.response;
      const errorMsg = typeof data === 'object' && 'detail' in data
        ? (data as any).detail
        : error.message;

      switch (status) {
        case 401:
          throw new Error(`Authentication failed: ${errorMsg}`);
        case 429:
          throw new Error(`Rate limit exceeded. Please try again later.`);
        case 500:
          throw new Error(`Server error: ${errorMsg}`);
        default:
          throw new Error(`API error (${status}): ${errorMsg}`);
      }
    } else if (error.request) {
      throw new Error(`Network error: ${error.message}`);
    } else {
      throw new Error(`Error: ${error.message}`);
    }
  }
}

export { ConcreteAgentClient, MonolitPosition, MonolitEnrichmentResponse, MonolitEnrichmentResult };
export default ConcreteAgentClient;
```

---

## 🚀 USAGE EXAMPLES

### Example 1: Basic Position Enrichment

```typescript
import ConcreteAgentClient from './services/concreteAgentClient';

const client = new ConcreteAgentClient();

async function enrichEstimate(positions) {
  try {
    const response = await client.enrichPositions(positions);

    // Process enriched positions
    response.enrichments.forEach((result) => {
      if (result.enrichment_status === 'matched') {
        console.log(`✅ ${result.code} → ${result.matched_code} (${result.confidence_score})`);
      } else if (result.enrichment_status === 'partial') {
        console.log(`⚠️ ${result.code} → Partial match (${result.confidence_score})`);
      } else {
        console.log(`❌ ${result.code} → Not found`);
      }
    });

    // Check statistics
    console.log(`Matched: ${response.statistics.matched}/${response.statistics.total}`);
    console.log(`Processing time: ${response.statistics.processing_time_ms}ms`);

  } catch (error) {
    console.error('Enrichment failed:', error.message);
  }
}

// Usage
enrichEstimate([
  {
    position_id: 'pos_1',
    code: '121151113',
    description: 'Beton C30/37',
    quantity: 850,
    unit: 'm3',
  },
  {
    position_id: 'pos_2',
    code: '121251001',
    description: 'Ocelová síť',
    quantity: 85,
    unit: 't',
  },
]);
```

### Example 2: With Audit

```typescript
async function enrichWithAudit(positions) {
  const response = await client.enrichPositions(positions, {
    include_audit: true,
    audit_roles: ['SME', 'ARCH', 'ENG', 'SUP'],
  });

  // Check audit results
  response.audits.forEach((audit) => {
    if (audit.classification === 'RED') {
      console.log(`🚨 Position ${audit.code} requires review`);
      console.log(`   Reason: ${audit.review_reason}`);
    } else if (audit.classification === 'AMBER') {
      console.log(`⚠️ Position ${audit.code} needs attention`);
    } else {
      console.log(`✅ Position ${audit.code} approved`);
    }
  });
}
```

### Example 3: Integration with Express Route

```typescript
import express, { Request, Response } from 'express';
import ConcreteAgentClient from './services/concreteAgentClient';

const router = express.Router();
const concreteClient = new ConcreteAgentClient();

router.post('/api/projects/:projectId/enrich', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { positions } = req.body;

    // Validate input
    if (!positions || positions.length === 0) {
      return res.status(400).json({ error: 'No positions provided' });
    }

    // Check service health
    const isHealthy = await concreteClient.healthCheck();
    if (!isHealthy) {
      return res.status(503).json({ error: 'Concrete-Agent service is unavailable' });
    }

    // Enrich positions
    const enrichmentResponse = await concreteClient.enrichPositions(positions, {
      include_audit: req.query.audit === 'true',
    });

    // Update project with enrichment results
    // TODO: Save enrichment results to database
    // await updateProjectWithEnrichment(projectId, enrichmentResponse);

    res.json({
      projectId,
      enrichmentResponse,
      summary: {
        total: enrichmentResponse.statistics.total,
        matched: enrichmentResponse.statistics.matched,
        accuracy: `${(enrichmentResponse.statistics.matched / enrichmentResponse.statistics.total * 100).toFixed(1)}%`,
      },
    });

  } catch (error) {
    console.error('Enrichment error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
```

### Example 4: Batch Processing with Progress

```typescript
async function enrichProjectBatch(positions, onProgress) {
  const BATCH_SIZE = 20;
  const allEnrichments = [];

  for (let i = 0; i < positions.length; i += BATCH_SIZE) {
    const batch = positions.slice(i, i + BATCH_SIZE);
    const response = await client.enrichPositions(batch);

    allEnrichments.push(...response.enrichments);

    // Report progress
    const progress = Math.min(100, Math.round((allEnrichments.length / positions.length) * 100));
    onProgress(progress);
  }

  return allEnrichments;
}

// Usage with progress callback
enrichProjectBatch(positions, (progress) => {
  console.log(`Progress: ${progress}%`);
  // Update UI progress bar
});
```

---

## 🔌 INTEGRATION WITH MONOLIT-PLANNER

### Step 1: Add Route to Upload Handler

```typescript
// routes/projects.ts
import { enrichWithConcrete } from '../services/enrichmentService';

router.post('/projects/:id/upload', async (req, res) => {
  const { id } = req.params;
  const file = req.files?.xlsx;

  // 1. Parse XLSX
  const positions = parseXLSX(file);

  // 2. Enrich with Concrete-Agent
  const enriched = await enrichWithConcrete(positions);

  // 3. Save to database
  await saveProjectPositions(id, enriched);

  res.json({ success: true, enriched_count: enriched.length });
});
```

### Step 2: Create Enrichment Service

```typescript
// services/enrichmentService.ts
import ConcreteAgentClient from './concreteAgentClient';

const client = new ConcreteAgentClient();

export async function enrichWithConcrete(positions) {
  // Convert XLSX positions to API format
  const apiPositions = positions.map((pos, idx) => ({
    position_id: `pos_${idx}`,
    code: pos.kros_code,
    description: pos.name,
    quantity: pos.quantity,
    unit: pos.unit,
    unit_price: pos.price,
  }));

  // Call Concrete-Agent
  const response = await client.enrichPositions(apiPositions, {
    include_audit: true,
  });

  // Map results back
  return positions.map((pos, idx) => {
    const enrichment = response.enrichments[idx];
    const audit = response.audits[idx];

    return {
      ...pos,
      matched_code: enrichment.matched_code,
      confidence: enrichment.confidence_score,
      price_recommendation: enrichment.price_recommendation,
      audit_status: audit?.classification,
      requires_review: audit?.requires_review,
    };
  });
}
```

### Step 3: Update Frontend to Show Enrichment

```typescript
// components/ProjectEstimate.tsx
import React, { useState } from 'react';

export function ProjectEstimate({ projectId, positions }) {
  const [enriched, setEnriched] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleEnrich = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/enrich`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions }),
        }
      );
      const data = await response.json();
      setEnriched(data.enrichmentResponse);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleEnrich} disabled={loading}>
        {loading ? 'Enriching...' : 'Enrich with AI'}
      </button>

      {enriched && (
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Matched</th>
              <th>Confidence</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {enriched.enrichments.map((e) => (
              <tr key={e.position_id}>
                <td>{e.code}</td>
                <td>{e.matched_code}</td>
                <td>{(e.confidence_score * 100).toFixed(0)}%</td>
                <td>
                  {e.confidence_score > 0.95 ? '✅' : '⚠️'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

---

## ⚙️ CONFIGURATION

### Environment Variables

```env
# URL of Concrete-Agent API
CONCRETE_AGENT_URL=http://concrete-agent:8000

# Service authentication token
CONCRETE_AGENT_TOKEN=sk-service-token-here

# Request timeout in milliseconds
CONCRETE_AGENT_TIMEOUT=30000

# Enable/disable enrichment
CONCRETE_AGENT_ENABLED=true

# Include audit in all enrichment requests
CONCRETE_AGENT_INCLUDE_AUDIT=false

# Audit roles to use
CONCRETE_AGENT_AUDIT_ROLES=SME,ARCH,ENG
```

### Runtime Configuration

```typescript
interface ClientConfig {
  baseUrl: string;           // Concrete-Agent URL
  apiKey: string;            // Service token
  timeout: number;           // Request timeout
  retryAttempts: number;     // Retry failed requests
  cacheResults: boolean;     // Cache enrichment results
  cacheTTL: number;          // Cache TTL in seconds
}

const config: ClientConfig = {
  baseUrl: process.env.CONCRETE_AGENT_URL || 'http://localhost:8000',
  apiKey: process.env.CONCRETE_AGENT_TOKEN || '',
  timeout: 30000,
  retryAttempts: 3,
  cacheResults: true,
  cacheTTL: 3600,
};

const client = new ConcreteAgentClient(config.baseUrl, config.apiKey);
```

---

## 🧪 TESTING

### Unit Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import ConcreteAgentClient from '../services/concreteAgentClient';

describe('ConcreteAgentClient', () => {
  let client: ConcreteAgentClient;

  beforeAll(() => {
    client = new ConcreteAgentClient('http://localhost:8000', 'test-token');
  });

  it('should enrich positions', async () => {
    const response = await client.enrichPositions([
      {
        position_id: 'test_1',
        code: '121151113',
        description: 'Beton C30/37',
        quantity: 100,
        unit: 'm3',
      },
    ]);

    expect(response.status).toBe('success');
    expect(response.enrichments).toHaveLength(1);
    expect(response.enrichments[0].confidence_score).toBeGreaterThan(0);
  });

  it('should handle errors gracefully', async () => {
    const badClient = new ConcreteAgentClient('http://invalid:8000', 'bad-token');

    try {
      await badClient.healthCheck();
      fail('Should have thrown error');
    } catch (error) {
      expect(error.message).toContain('Network error');
    }
  });
});
```

---

## 📊 MONITORING & LOGGING

### Add Logging

```typescript
import * as winston from 'winston';

const logger = winston.createLogger({
  transports: [
    new winston.transports.File({
      filename: 'logs/concrete-agent.log',
      level: 'info',
    }),
  ],
});

class ConcreteAgentClient {
  async enrichPositions(positions, options) {
    logger.info(`Enriching ${positions.length} positions`);
    try {
      const response = await this.client.post('/api/monolit/enrich', {...});
      logger.info(`Successfully enriched ${response.statistics.matched} positions`);
      return response.data;
    } catch (error) {
      logger.error(`Enrichment failed: ${error.message}`);
      throw error;
    }
  }
}
```

### Monitor API Calls

```typescript
// Middleware to track API usage
express.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (req.path.includes('/enrich')) {
      logger.info(`Enrichment request: ${duration}ms, Status: ${res.statusCode}`);
    }
  });

  next();
});
```

---

## 🆘 TROUBLESHOOTING

### Connection Issues

```typescript
// Test connection
async function testConnection() {
  const client = new ConcreteAgentClient();
  const healthy = await client.healthCheck();

  if (healthy) {
    console.log('✅ Connected to Concrete-Agent');
  } else {
    console.log('❌ Cannot connect. Check:');
    console.log('  - CONCRETE_AGENT_URL env var');
    console.log('  - Docker network configuration');
    console.log('  - Firewall rules');
  }
}
```

### Token Issues

```typescript
// Verify token
function verifyToken(token: string): boolean {
  if (!token || !token.startsWith('sk-')) {
    console.error('Invalid token format');
    return false;
  }
  return true;
}
```

---

**Last updated:** 2025-11-16
**Status:** Ready for Integration ✅
