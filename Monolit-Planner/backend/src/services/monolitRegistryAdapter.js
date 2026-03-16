import db from '../db/index.js';
import { FileVersioningService } from './fileVersioningService.js';

// Categorize Monolit position into work_category based on subtype/fields
function categorizeMonolitPosition(position) {
  const subtype = (position.subtype || '').toLowerCase();
  if (subtype === 'beton' || position.concrete_volume) return 'beton';
  if (subtype === 'bednění' || subtype === 'bedneni' || position.formwork_area) return 'bedneni';
  if (subtype === 'výztuž' || subtype === 'vystuz' || position.reinforcement_weight) return 'vystuz';
  if (subtype === 'čerpání' || subtype === 'cerpani') return 'cerpani';
  return 'ostatni';
}

export class MonolitRegistryAdapter {
  // Convert Monolit project → Registry project
  static async importMonolitProject(projectName, queryFn = db.query.bind(db)) {
    const result = await queryFn(
      `INSERT INTO registry_projects (project_name, display_name, metadata)
       VALUES ($1, $1, $2)
       ON CONFLICT (project_name) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [projectName, { source: 'monolit' }]
    );
    return result.rows[0].id;
  }

  // Convert Monolit bridge → Registry object
  static async importMonolitBridge(projectId, bridgeName, bridgeData, queryFn = db.query.bind(db)) {
    const result = await queryFn(
      `INSERT INTO registry_objects (project_id, object_name, object_type, metadata)
       VALUES ($1, $2, 'bridge', $3)
       ON CONFLICT (project_id, object_name) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [projectId, bridgeName, { source: 'monolit', ...bridgeData }]
    );
    return result.rows[0].id;
  }

  // Convert Monolit position → Registry position instance
  static mapMonolitPosition(position, objectId, sourceFileId, fileVersionId) {
    return {
      object_id: objectId,
      source_file_id: sourceFileId,
      file_version_id: fileVersionId,
      position_code: position.code || position.position_code || 'N/A',
      position_name: position.name || position.position_name || 'Unnamed Position',
      unit: position.unit || 'ks',
      quantity: position.quantity || 0,
      kiosk_type: 'monolit',
      // Preserve Portal's position_instance_id if already linked
      position_instance_id: position.position_instance_id || null,
      kiosk_data: {
        // Monolit-specific fields
        concrete_class: position.concrete_class,
        concrete_volume: position.concrete_volume,
        reinforcement_weight: position.reinforcement_weight,
        formwork_area: position.formwork_area,
        days: position.days,
        part_id: position.part_id,
        etap: position.etap,
        original_id: position.id,
        // Work category for filtering
        work_category: categorizeMonolitPosition(position)
      }
    };
  }

  // Full import: Monolit project → Registry
  static async importFullMonolitProject(projectName) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Create/get registry project (use client to stay in transaction)
      const queryFn = client.query.bind(client);
      const projectId = await this.importMonolitProject(projectName, queryFn);

      // 2. Get all Monolit bridges for this project
      const bridges = await client.query(
        `SELECT * FROM bridges WHERE project_name = $1`,
        [projectName]
      );

      const importSummary = {
        project_id: projectId,
        objects_imported: 0,
        positions_imported: 0
      };

      for (const bridge of bridges.rows) {
        // 3. Create registry object
        const objectId = await this.importMonolitBridge(
          projectId,
          bridge.bridge_name,
          { bridge_id: bridge.id },
          queryFn
        );
        importSummary.objects_imported++;

        // 4. Get all positions for this bridge
        const positions = await client.query(
          `SELECT * FROM positions WHERE bridge_id = $1`,
          [bridge.id]
        );

        if (positions.rows.length > 0) {
          // 5. Create virtual source file entry
          const sourceFile = await client.query(
            `INSERT INTO registry_source_files 
             (object_id, file_name, file_type, metadata)
             VALUES ($1, $2, 'monolit_import', $3)
             RETURNING id`,
            [objectId, `${bridge.bridge_name}_import.json`, { imported_at: new Date() }]
          );
          const sourceFileId = sourceFile.rows[0].id;

          // 6. Create version 1
          const version = await client.query(
            `INSERT INTO registry_file_versions (source_file_id, version_number, file_hash)
             VALUES ($1, 1, 'monolit_import_v1')
             RETURNING id`,
            [sourceFileId]
          );
          const versionId = version.rows[0].id;

          // 7. Import all positions (with position_instance_id bidirectional linking)
          for (const pos of positions.rows) {
            const mappedPos = this.mapMonolitPosition(pos, objectId, sourceFileId, versionId);
            const insertResult = await client.query(
              `INSERT INTO registry_position_instances
               (object_id, source_file_id, file_version_id, position_code, position_name,
                unit, quantity, kiosk_type, kiosk_data)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (object_id, position_code, file_version_id) DO UPDATE
               SET kiosk_data = $9, updated_at = NOW()
               RETURNING id`,
              [mappedPos.object_id, mappedPos.source_file_id, mappedPos.file_version_id,
               mappedPos.position_code, mappedPos.position_name, mappedPos.unit,
               mappedPos.quantity, mappedPos.kiosk_type, mappedPos.kiosk_data]
            );

            // Write registry position ID back to Monolit positions table as position_instance_id
            const registryPositionId = insertResult.rows[0].id;
            if (pos.id && !pos.position_instance_id) {
              await client.query(
                `UPDATE positions SET position_instance_id = $1 WHERE id = $2 AND position_instance_id IS NULL`,
                [String(registryPositionId), pos.id]
              );
            }
            importSummary.positions_imported++;
          }
        }
      }

      await client.query('COMMIT');
      return importSummary;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
