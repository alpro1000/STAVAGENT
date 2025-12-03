/**
 * File Validator Utility
 * Validates file types using magic bytes (file signatures) to prevent spoofing
 * Supports: PDF, DOCX, XLSX, DWG, JPG, PNG
 */

import fs from 'fs';
import { logger } from './logger.js';

/**
 * Magic bytes signatures for supported file types
 * Each type has one or more possible magic byte sequences
 */
const FILE_SIGNATURES = {
  pdf: [
    Buffer.from([0x25, 0x50, 0x44, 0x46]) // %PDF
  ],
  docx: [
    Buffer.from([0x50, 0x4B, 0x03, 0x04]) // ZIP header (DOCX is ZIP-based)
  ],
  xlsx: [
    Buffer.from([0x50, 0x4B, 0x03, 0x04]) // ZIP header (XLSX is ZIP-based)
  ],
  xls: [
    Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]) // OLE2 header
  ],
  dwg: [
    Buffer.from([0x41, 0x43, 0x31]) // AC1 (AutoCAD)
  ],
  jpg: [
    Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), // JPEG with JFIF
    Buffer.from([0xFF, 0xD8, 0xFF, 0xE1]), // JPEG with EXIF
    Buffer.from([0xFF, 0xD8, 0xFF, 0xE8])  // JPEG with SPIFF
  ],
  png: [
    Buffer.from([0x89, 0x50, 0x4E, 0x47]) // PNG signature
  ],
  csv: [
    // CSV files don't have magic bytes, so we'll accept any text file
    // Validation will be done through extension
  ],
  txt: [
    // TXT files don't have magic bytes, accept any text
  ],
  ods: [
    Buffer.from([0x50, 0x4B, 0x03, 0x04]) // ZIP header (ODS is ZIP-based)
  ]
};

/**
 * MIME type mapping for reference
 */
const MIME_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  dwg: 'image/vnd.dwg',
  jpg: 'image/jpeg',
  png: 'image/png',
  csv: 'text/csv',
  txt: 'text/plain',
  ods: 'application/vnd.oasis.opendocument.spreadsheet'
};

/**
 * Get file extension from filename
 * @param {string} filename
 * @returns {string} Extension in lowercase (without dot)
 */
function getFileExtension(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ext;
}

/**
 * Check if file content matches magic bytes for given type
 * @param {string} filePath - Path to file
 * @param {string} fileType - File type (pdf, docx, jpg, etc.)
 * @returns {Promise<boolean>} True if magic bytes match
 */
async function checkMagicBytes(filePath, fileType) {
  const signatures = FILE_SIGNATURES[fileType];

  // Text-based files don't have magic bytes
  if (!signatures || signatures.length === 0) {
    return true;
  }

  let fd;
  try {
    // Read first 8 bytes of file for signature checking
    const buffer = Buffer.alloc(8);
    fd = await fs.promises.open(filePath, 'r');
    const { bytesRead } = await fd.read(buffer, 0, 8, 0);

    // Check if file starts with any of the known signatures
    for (const signature of signatures) {
      // Only compare if we read enough bytes for this signature
      if (bytesRead >= signature.length && buffer.slice(0, signature.length).equals(signature)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error(`[FileValidator] Error checking magic bytes: ${error.message}`);
    return false;
  } finally {
    // Ensure file descriptor is always closed
    if (fd) {
      await fd.close();
    }
  }
}

/**
 * Validate file type matches actual content
 * Prevents file type spoofing (e.g., .jpg file containing malicious content)
 *
 * @param {string} filePath - Path to uploaded file
 * @param {string} filename - Original filename with extension
 * @returns {Promise<Object>} Validation result { valid: boolean, error?: string, fileType?: string }
 */
export async function validateFileContent(filePath, filename) {
  try {
    const ext = getFileExtension(filename);

    // Check if file type is supported
    if (!FILE_SIGNATURES.hasOwnProperty(ext)) {
      return {
        valid: false,
        error: `Unsupported file type: .${ext}. Allowed: PDF, DOCX, XLSX, XLS, DWG, JPG, PNG, CSV, TXT, ODS`
      };
    }

    // Check file exists and is readable
    if (!fs.existsSync(filePath)) {
      return {
        valid: false,
        error: 'File not found or not accessible'
      };
    }

    // Check file size (prevent empty files)
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return {
        valid: false,
        error: 'File is empty'
      };
    }

    // Check magic bytes
    const magicBytesValid = await checkMagicBytes(filePath, ext);
    if (!magicBytesValid) {
      logger.warn(`[FileValidator] Magic bytes mismatch for file: ${filename} (type: .${ext})`);
      return {
        valid: false,
        error: `File content does not match extension .${ext}. File may be corrupted or misnamed.`
      };
    }

    logger.debug(`[FileValidator] File validation passed: ${filename} (${ext})`);
    return {
      valid: true,
      fileType: ext,
      mimeType: MIME_TYPES[ext] || 'application/octet-stream',
      fileSize: stats.size
    };
  } catch (error) {
    logger.error(`[FileValidator] Error validating file: ${error.message}`);
    return {
      valid: false,
      error: `File validation error: ${error.message}`
    };
  }
}

/**
 * Get supported file types
 */
export function getSupportedFileTypes() {
  return Object.keys(FILE_SIGNATURES).map(type => ({
    extension: type,
    mimeType: MIME_TYPES[type] || 'application/octet-stream'
  }));
}

/**
 * Validate multiple files
 * @param {Array<{path: string, filename: string}>} files - Files to validate
 * @returns {Promise<Object>} Validation results for each file
 */
export async function validateMultipleFiles(files) {
  const results = {};

  if (!Array.isArray(files)) {
    return { valid: false, error: 'Files must be an array' };
  }

  for (const file of files) {
    const validation = await validateFileContent(file.path, file.filename);
    results[file.filename] = validation;
  }

  const allValid = Object.values(results).every(r => r.valid);
  return {
    valid: allValid,
    validatedFiles: results,
    invalidCount: Object.values(results).filter(r => !r.valid).length,
    totalCount: files.length
  };
}
