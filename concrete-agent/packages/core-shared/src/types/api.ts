/**
 * API request/response types
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: string;
  request_id?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  status_code: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ParseExcelRequest {
  file?: File;
  file_path?: string;
  options?: {
    header_row?: number;
    skip_rows?: number[];
    format?: string;
  };
}

export interface ParseExcelResponse {
  success: boolean;
  filename: string;
  positions: unknown[];
  diagnostics: {
    raw_total: number;
    normalized_total: number;
    format: string;
    headers_found_at_row: number;
    currency?: string;
    service_rows_removed: number;
    warnings: string[];
  };
}

export interface EnrichmentRequest {
  position: unknown;
  batch_id?: string;
  context?: Record<string, unknown>;
}

export interface EnrichmentResponse {
  position_id: string;
  enriched: unknown;
  metadata: {
    source: string;
    confidence: number;
    execution_time_ms: number;
  };
}

export interface AuditRequest {
  position: unknown;
  roles?: string[];
  project_context?: Record<string, unknown>;
}

export interface AuditResponse {
  position_id: string;
  status: string;
  audit_result: unknown;
  execution_time_ms: number;
}
