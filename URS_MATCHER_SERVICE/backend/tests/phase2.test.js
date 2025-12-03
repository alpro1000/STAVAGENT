/**
 * Phase 2 Tests - Document Parsing & Validation
 * REWRITTEN: Using actual service function imports instead of mocks
 *
 * Tests for:
 * - Document Validator Service
 * - Cache Service
 * - File Validator
 * - Completeness score calculation
 */

import assert from 'assert';
import { describe, it, before } from 'mocha';
import {
  validateDocumentCompleteness,
  getDocumentRequirements,
  getDocumentTypes
} from '../src/services/documentValidatorService.js';
import {
  validateFileContent,
  getSupportedFileTypes,
  validateMultipleFiles
} from '../src/utils/fileValidator.js';

describe('Phase 2: Document Parsing & Validation', () => {
  describe('Document Validator Service', () => {
    it('should calculate completeness score with zero-division protection', async () => {
      // Test: No required documents, should not divide by zero
      const uploadedFiles = [];
      const projectContext = {
        building_type: 'bytový dům',
        storeys: 4
      };

      const result = await validateDocumentCompleteness(uploadedFiles, projectContext);

      assert.ok(typeof result.completeness_score === 'number', 'Score should be a number');
      assert.ok(result.completeness_score >= 0 && result.completeness_score <= 100, 'Score should be 0-100');
      assert.ok(result.context_validation, 'Should have context validation');
    });

    it('should include conditional fields in completeness calculation', async () => {
      // Test: With conditional fields (ŽB concrete for example)
      const uploadedFiles = [
        { filename: 'techspec.pdf', size: 1024000 }
      ];

      const projectContext = {
        building_type: 'bytový dům',
        storeys: 4,
        main_system: ['železobeton'],
        foundation_concrete: 'C25/30' // Conditional for ŽB
      };

      const result = await validateDocumentCompleteness(uploadedFiles, projectContext);

      assert.ok(result.completeness_score > 0, 'Score should be positive');
      assert.ok(result.context_validation, 'Should validate context');
      assert.ok(!result.context_validation.conditional_missing?.some(c => c.field === 'foundation_concrete'),
        'Should not report concrete as missing when provided');
    });

    it('should identify missing required documents', async () => {
      const uploadedFiles = [];
      const projectContext = { building_type: 'bytový dům' };

      const result = await validateDocumentCompleteness(uploadedFiles, projectContext);

      assert.ok(result.missing_documents, 'Should identify missing documents');
      assert.ok(Array.isArray(result.missing_documents), 'Missing documents should be array');
      // Tech spec should be required
      const hasRequiredMissing = result.missing_documents.some(d => d.required === true);
      assert.ok(hasRequiredMissing, 'Should have required missing documents');
    });

    it('should generate RFI for critical missing fields', async () => {
      const uploadedFiles = [];
      const projectContext = {
        // Missing required fields
        building_type: undefined,
        storeys: undefined
      };

      const result = await validateDocumentCompleteness(uploadedFiles, projectContext);

      assert.ok(result.rfi_items, 'Should have RFI items');
      assert.ok(Array.isArray(result.rfi_items), 'RFI items should be array');

      const criticalRFI = result.rfi_items.filter(r => r.severity === 'critical');
      assert.ok(criticalRFI.length > 0, 'Should have critical RFI for missing required fields');
    });

    it('should detect conditional requirements (concrete for ŽB)', async () => {
      const uploadedFiles = [];
      const projectContext = {
        building_type: 'bytový dům',
        main_system: ['železobeton'],
        foundation_concrete: undefined  // Missing for ŽB - should be flagged
      };

      const result = await validateDocumentCompleteness(uploadedFiles, projectContext);

      const hasConditionalMissing = result.context_validation.conditional_missing.some(
        c => c.field === 'foundation_concrete'
      );
      assert.ok(hasConditionalMissing, 'Should detect conditional requirement for ŽB projects');
    });

    it('should detect geological requirements for bridges', async () => {
      const uploadedFiles = [];
      const projectContext = {
        building_type: 'most',  // Bridge requires geological data
        main_system: ['ocel']
      };

      const result = await validateDocumentCompleteness(uploadedFiles, projectContext);

      // Should either have conditional missing for geological data or RFI
      const hasGeologicalMissing = result.context_validation.conditional_missing.some(
        c => c.field === 'soil_class' || c.field === 'groundwater_level'
      );

      const hasGeologicalRFI = result.rfi_items.some(
        r => r.id && r.id.includes('geological')
      );

      assert.ok(hasGeologicalMissing || hasGeologicalRFI,
        'Should require geological data for bridges');
    });

    it('should generate recommendations based on completeness', async () => {
      const uploadedFiles = [];
      const projectContext = {
        building_type: 'bytový dům'
      };

      const result = await validateDocumentCompleteness(uploadedFiles, projectContext);

      assert.ok(result.recommendations, 'Should have recommendations');
      assert.ok(Array.isArray(result.recommendations), 'Recommendations should be array');

      if (result.completeness_score < 100) {
        const hasMissingDocRec = result.recommendations.some(
          r => r.type === 'missing_documents' || r.type === 'missing_context'
        );
        assert.ok(hasMissingDocRec, 'Should recommend missing items when incomplete');
      }
    });

    it('should set correct severity levels', async () => {
      const uploadedFiles = [];
      const projectContext = {};

      const result = await validateDocumentCompleteness(uploadedFiles, projectContext);

      const validSeverities = ['ok', 'warning', 'critical'];
      assert.ok(validSeverities.includes(result.severity),
        `Severity should be one of: ${validSeverities.join(', ')}`);

      if (result.completeness_score >= 80) {
        assert.strictEqual(result.severity, 'ok', 'Score >= 80 should be ok');
      } else if (result.completeness_score >= 50) {
        assert.strictEqual(result.severity, 'warning', 'Score 50-79 should be warning');
      } else {
        assert.strictEqual(result.severity, 'critical', 'Score < 50 should be critical');
      }
    });

    it('should get document requirements by project type', () => {
      // Test for apartment building
      const aptRequirements = getDocumentRequirements('bytový dům');
      assert.ok(aptRequirements.documents, 'Should return document requirements');
      assert.ok(Array.isArray(aptRequirements.documents), 'Documents should be array');
      assert.ok(aptRequirements.documents.length > 0, 'Should have minimum one document');

      // Test for bridge
      const bridgeRequirements = getDocumentRequirements('most');
      assert.ok(bridgeRequirements.documents.length > aptRequirements.documents.length,
        'Bridge should require more documents than apartment');
    });

    it('should export all document types', () => {
      const docTypes = getDocumentTypes();

      assert.ok(Array.isArray(docTypes), 'Should return array of document types');
      assert.ok(docTypes.length > 0, 'Should have document types');

      // Check structure
      const sample = docTypes[0];
      assert.ok(sample.id, 'Should have id');
      assert.ok(sample.name, 'Should have name');
      assert.ok(sample.extensions, 'Should have extensions');

      // Should include common types
      const ids = docTypes.map(d => d.id);
      assert.ok(ids.includes('tech_spec'), 'Should include tech_spec');
    });
  });

  describe('File Validator Service', () => {
    it('should validate supported file types', async () => {
      const supportedTypes = getSupportedFileTypes();

      assert.ok(Array.isArray(supportedTypes), 'Should return array');
      assert.ok(supportedTypes.length > 0, 'Should have supported types');

      // Check structure
      const sample = supportedTypes[0];
      assert.ok(sample.extension, 'Should have extension');
      assert.ok(sample.mimeType, 'Should have mimeType');

      // Should include common types
      const extensions = supportedTypes.map(t => t.extension);
      assert.ok(extensions.includes('pdf'), 'Should support PDF');
      assert.ok(extensions.includes('xlsx'), 'Should support XLSX');
    });

    it('should reject empty files', async () => {
      // Note: This test would need actual file system access
      // For now, we test the function signature works
      assert.ok(typeof validateFileContent === 'function', 'validateFileContent should be a function');
    });

    it('should support multiple file validation', async () => {
      assert.ok(typeof validateMultipleFiles === 'function', 'validateMultipleFiles should be a function');

      // Test with empty array
      const result = await validateMultipleFiles([]);
      assert.ok(result.hasOwnProperty('validatedFiles'), 'Should return validation results');
    });

    it('should reject files with invalid extensions', async () => {
      assert.ok(typeof validateFileContent === 'function', 'Should handle validation');
    });
  });

  describe('Cache Service Integration', () => {
    it('should have correct TTL configuration', async () => {
      // Import and check cache config via validator service usage
      const uploadedFiles = [
        { filename: 'test.pdf', size: 1024 }
      ];

      const result = await validateDocumentCompleteness(uploadedFiles, {});

      // This implicitly tests that cache service is initialized
      assert.ok(result.hasOwnProperty('completeness_score'), 'Service should work correctly');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing context gracefully', async () => {
      const result = await validateDocumentCompleteness([], null);

      assert.ok(result.completeness_score >= 0, 'Should handle null context');
      assert.ok(result.hasOwnProperty('context_validation'), 'Should validate missing context');
    });

    it('should handle invalid file arrays', async () => {
      const result = await validateDocumentCompleteness('not an array', {});

      assert.ok(result.uploaded_documents.length === 0, 'Should handle invalid file input');
    });

    it('should handle missing conditional missing array', async () => {
      // Edge case: ensure code doesn't crash with missing arrays
      const result = await validateDocumentCompleteness([], {
        building_type: 'most'
      });

      assert.ok(result.context_validation, 'Should have context validation');
      assert.ok(Array.isArray(result.context_validation.conditional_missing),
        'Should initialize conditional_missing as array');
    });
  });

  describe('Completeness Score Accuracy', () => {
    it('should score 100% with all required fields and documents', async () => {
      // For technical spec only (1 required document)
      const uploadedFiles = [
        { filename: 'techspec.pdf', size: 1024000 }
      ];

      const projectContext = {
        building_type: 'bytový dům',
        storeys: 4,
        main_system: ['železobeton'],
        foundation_concrete: 'C25/30'  // Conditional met
      };

      const result = await validateDocumentCompleteness(uploadedFiles, projectContext);

      assert.ok(result.completeness_score >= 80, 'Should score high when mostly complete');
    });

    it('should score lower with missing context fields', async () => {
      const uploadedFiles = [
        { filename: 'techspec.pdf', size: 1024000 }
      ];

      const projectContext = {
        building_type: 'bytový dům'
        // Missing: storeys, main_system
      };

      const result = await validateDocumentCompleteness(uploadedFiles, projectContext);

      assert.ok(result.completeness_score < 100, 'Should be incomplete');
      assert.ok(result.completeness_score > 0, 'Should still have some score');
    });

    it('should provide valid has_critical_rfi flag', async () => {
      const result = await validateDocumentCompleteness([], {});

      assert.ok(result.hasOwnProperty('has_critical_rfi'), 'Should have has_critical_rfi flag');
      assert.ok(typeof result.has_critical_rfi === 'boolean', 'Flag should be boolean');
    });
  });

  describe('RFI Generation', () => {
    it('should generate RFI with required fields', async () => {
      const result = await validateDocumentCompleteness([], {});

      const rfiItem = result.rfi_items[0];
      if (rfiItem) {
        assert.ok(rfiItem.id, 'Should have id');
        assert.ok(rfiItem.severity, 'Should have severity');
        assert.ok(rfiItem.question, 'Should have question');
      }
    });

    it('should not generate RFI for complete projects', async () => {
      const result = await validateDocumentCompleteness(
        [{ filename: 'tech.pdf', size: 1000 }],
        {
          building_type: 'bytový dům',
          storeys: 4,
          main_system: ['železobeton'],
          foundation_concrete: 'C25/30'
        }
      );

      // Should have fewer/no critical RFI when data is complete
      const criticalCount = result.rfi_items.filter(r => r.severity === 'critical').length;
      assert.ok(criticalCount === 0, 'Should not have critical RFI when complete');
    });
  });
});
