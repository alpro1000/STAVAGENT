import crypto from 'crypto';
import fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

export class FileVersioningService {
  static async calculateHash(filePath) {
    const buffer = await readFile(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  static async createOrUpdateFile(db, { objectId, fileName, fileType, filePath, metadata = {} }) {
    const fileHash = await this.calculateHash(filePath);

    // Check if file exists
    const existingFile = await db.query(
      `SELECT id FROM registry_source_files 
       WHERE object_id = $1 AND file_name = $2`,
      [objectId, fileName]
    );

    let sourceFileId;

    if (existingFile.rows.length === 0) {
      // Create new file
      const result = await db.query(
        `INSERT INTO registry_source_files (object_id, file_name, file_type, file_hash, metadata)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [objectId, fileName, fileType, fileHash, metadata]
      );
      sourceFileId = result.rows[0].id;

      // Create version 1
      await db.query(
        `INSERT INTO registry_file_versions (source_file_id, version_number, file_hash)
         VALUES ($1, 1, $2)`,
        [sourceFileId, fileHash]
      );

      return { sourceFileId, version: 1, isNew: true };
    } else {
      sourceFileId = existingFile.rows[0].id;

      // Check if hash changed
      const lastVersion = await db.query(
        `SELECT version_number, file_hash 
         FROM registry_file_versions 
         WHERE source_file_id = $1 
         ORDER BY version_number DESC 
         LIMIT 1`,
        [sourceFileId]
      );

      if (lastVersion.rows[0].file_hash === fileHash) {
        return { sourceFileId, version: lastVersion.rows[0].version_number, isNew: false };
      }

      // Create new version
      const newVersion = lastVersion.rows[0].version_number + 1;
      await db.query(
        `INSERT INTO registry_file_versions (source_file_id, version_number, file_hash)
         VALUES ($1, $2, $3)`,
        [sourceFileId, newVersion, fileHash]
      );

      // Update source file hash
      await db.query(
        `UPDATE registry_source_files 
         SET file_hash = $1, metadata = $2 
         WHERE id = $3`,
        [fileHash, metadata, sourceFileId]
      );

      return { sourceFileId, version: newVersion, isNew: false };
    }
  }
}
