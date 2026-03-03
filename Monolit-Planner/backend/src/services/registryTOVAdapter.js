import db from '../db/index.js';

export class RegistryTOVAdapter {
  // Convert Registry TOV project → Unified Registry project
  static async importRegistryTOVProject(registryProjectId, registryApiUrl) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Fetch Registry TOV project data
      const response = await fetch(`${registryApiUrl}/api/registry/projects/${registryProjectId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch project: ${response.status} ${response.statusText}`);
      }
      const { project } = await response.json();
      
      if (!project || !project.project_name) {
        throw new Error('Invalid project data received from Registry TOV API');
      }

      // Create unified registry project
      const projectResult = await client.query(
        `INSERT INTO registry_projects (project_name, display_name, metadata)
         VALUES ($1, $1, $2)
         ON CONFLICT (project_name) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [project.project_name, { source: 'registry_tov', registry_project_id: registryProjectId }]
      );
      
      if (!projectResult.rows || projectResult.rows.length === 0) {
        throw new Error('Failed to create/update registry project');
      }
      const projectId = projectResult.rows[0].id;

      // Fetch sheets
      const sheetsResponse = await fetch(`${registryApiUrl}/api/registry/projects/${registryProjectId}/sheets`);
      if (!sheetsResponse.ok) {
        throw new Error(`Failed to fetch sheets: ${sheetsResponse.status} ${sheetsResponse.statusText}`);
      }
      const { sheets } = await sheetsResponse.json();

      const importSummary = {
        project_id: projectId,
        objects_imported: 0,
        positions_imported: 0
      };

      for (const sheet of sheets) {
        // Create object for each sheet
        const objectResult = await client.query(
          `INSERT INTO registry_objects (project_id, object_name, object_type, metadata)
           VALUES ($1, $2, 'sheet', $3)
           ON CONFLICT (project_id, object_name) DO UPDATE SET updated_at = NOW()
           RETURNING id`,
          [projectId, sheet.sheet_name, { registry_sheet_id: sheet.sheet_id }]
        );
        const objectId = objectResult.rows[0].id;
        importSummary.objects_imported++;

        // Fetch items for this sheet
        const itemsResponse = await fetch(`${registryApiUrl}/api/registry/sheets/${sheet.sheet_id}/items`);
        if (!itemsResponse.ok) {
          throw new Error(`Failed to fetch items: ${itemsResponse.status} ${itemsResponse.statusText}`);
        }
        const { items } = await itemsResponse.json();

        if (items.length > 0) {
          // Create virtual source file
          const sourceFile = await client.query(
            `INSERT INTO registry_source_files 
             (object_id, file_name, file_type, metadata)
             VALUES ($1, $2, 'registry_tov_import', $3)
             RETURNING id`,
            [objectId, `${sheet.sheet_name}_import.json`, { imported_at: new Date() }]
          );
          const sourceFileId = sourceFile.rows[0].id;

          // Create version 1
          const version = await client.query(
            `INSERT INTO registry_file_versions (source_file_id, version_number, file_hash)
             VALUES ($1, 1, 'registry_tov_import_v1')
             RETURNING id`,
            [sourceFileId]
          );
          const versionId = version.rows[0].id;

          // Import all items as positions
          for (const item of items) {
            const mappedPos = this.mapRegistryTOVItem(item, objectId, sourceFileId, versionId);
            await client.query(
              `INSERT INTO registry_position_instances 
               (object_id, source_file_id, file_version_id, position_code, position_name,
                unit, quantity, kiosk_type, kiosk_data)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [mappedPos.object_id, mappedPos.source_file_id, mappedPos.file_version_id,
               mappedPos.position_code, mappedPos.position_name, mappedPos.unit,
               mappedPos.quantity, mappedPos.kiosk_type, mappedPos.kiosk_data]
            );
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

  // Map Registry TOV item → Unified position instance
  static mapRegistryTOVItem(item, objectId, sourceFileId, fileVersionId) {
    return {
      object_id: objectId,
      source_file_id: sourceFileId,
      file_version_id: fileVersionId,
      position_code: item.kod || 'N/A',
      position_name: item.popis || 'Unnamed Item',
      unit: item.mj || 'ks',
      quantity: item.mnozstvi || 0,
      kiosk_type: 'registry_tov',
      kiosk_data: {
        // Registry TOV specific fields
        item_id: item.item_id,
        cena_jednotkova: item.cena_jednotkova,
        cena_celkem: item.cena_celkem,
        tov_data: item.tov_data,
        sync_metadata: item.sync_metadata
      }
    };
  }
}
