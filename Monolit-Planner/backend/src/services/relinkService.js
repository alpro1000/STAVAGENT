/**
 * Relink Service - Preserve calculations when file updated
 * 
 * 4-Step Algorithm:
 * 1. Primary Match (exact): sheet_name + position_no + catalog_code
 * 2. Fallback Match (positional): sheet_index + row_index (±2) + catalog_code
 * 3. Fuzzy Match (similarity): catalog_code + description similarity > 0.75
 * 4. Classify: Orphaned (removed) + New (added)
 */

import stringSimilarity from 'string-similarity';
import db from '../db/index.js';

/**
 * Step 1: Primary Match (Exact)
 * Confidence: GREEN (100%)
 */
async function primaryMatch(oldPositions, newPositions) {
  const matches = [];
  const unmatchedOld = [];
  const unmatchedNew = [...newPositions];

  for (const oldPos of oldPositions) {
    const matchIndex = unmatchedNew.findIndex(newPos =>
      newPos.position_code === oldPos.position_code &&
      newPos.position_name === oldPos.position_name &&
      newPos.kiosk_data?.catalog_code === oldPos.kiosk_data?.catalog_code
    );

    if (matchIndex !== -1) {
      const match = unmatchedNew[matchIndex];
      matches.push({
        old_position_id: oldPos.id,
        new_position_id: match.id,
        confidence: 'GREEN',
        match_type: 'primary',
        qty_change: calculateQtyChange(oldPos.quantity, match.quantity),
        old_description: oldPos.position_name,
        new_description: match.position_name
      });
      unmatchedNew.splice(matchIndex, 1);
    } else {
      unmatchedOld.push(oldPos);
    }
  }

  return { matches, unmatchedOld, unmatchedNew };
}

/**
 * Step 2: Fallback Match (Positional)
 * Confidence: AMBER (75%)
 */
async function fallbackMatch(unmatchedOld, unmatchedNew) {
  const matches = [];
  const stillUnmatchedOld = [];
  const stillUnmatchedNew = [...unmatchedNew];

  for (const oldPos of unmatchedOld) {
    const oldRowIndex = oldPos.kiosk_data?.row_index || 0;
    const catalogCode = oldPos.kiosk_data?.catalog_code;

    const matchIndex = stillUnmatchedNew.findIndex(newPos => {
      const newRowIndex = newPos.kiosk_data?.row_index || 0;
      const rowDiff = Math.abs(newRowIndex - oldRowIndex);
      return (
        rowDiff <= 2 &&
        newPos.kiosk_data?.catalog_code === catalogCode
      );
    });

    if (matchIndex !== -1) {
      const match = stillUnmatchedNew[matchIndex];
      const rowShift = (match.kiosk_data?.row_index || 0) - oldRowIndex;
      
      matches.push({
        old_position_id: oldPos.id,
        new_position_id: match.id,
        confidence: 'AMBER',
        match_type: 'fallback',
        row_shift: rowShift,
        qty_change: calculateQtyChange(oldPos.quantity, match.quantity),
        old_description: oldPos.position_name,
        new_description: match.position_name
      });
      stillUnmatchedNew.splice(matchIndex, 1);
    } else {
      stillUnmatchedOld.push(oldPos);
    }
  }

  return { matches, unmatchedOld: stillUnmatchedOld, unmatchedNew: stillUnmatchedNew };
}

/**
 * Step 3: Fuzzy Match (Description Similarity)
 * Confidence: AMBER/RED (50-75%)
 */
async function fuzzyMatch(unmatchedOld, unmatchedNew) {
  const matches = [];
  const orphaned = [];
  const newPositions = [...unmatchedNew];

  for (const oldPos of unmatchedOld) {
    const catalogCode = oldPos.kiosk_data?.catalog_code;
    
    // Find candidates with same catalog_code
    const candidates = newPositions.filter(
      newPos => newPos.kiosk_data?.catalog_code === catalogCode
    );

    if (candidates.length === 0) {
      orphaned.push(oldPos);
      continue;
    }

    // Calculate similarity scores
    const scores = candidates.map(candidate => {
      const oldDesc = oldPos.description_normalized || oldPos.position_name.toLowerCase();
      const newDesc = candidate.description_normalized || candidate.position_name.toLowerCase();
      
      return {
        position: candidate,
        similarity: stringSimilarity.compareTwoStrings(oldDesc, newDesc),
        qty_diff: Math.abs(candidate.quantity - oldPos.quantity) / oldPos.quantity
      };
    });

    // Find best match
    const best = scores.reduce((a, b) => a.similarity > b.similarity ? a : b);

    // Match if similarity > 0.75 and qty change < 20%
    if (best.similarity > 0.75 && best.qty_diff < 0.2) {
      matches.push({
        old_position_id: oldPos.id,
        new_position_id: best.position.id,
        confidence: best.similarity > 0.9 ? 'AMBER' : 'RED',
        match_type: 'fuzzy',
        similarity_score: best.similarity,
        qty_change: calculateQtyChange(oldPos.quantity, best.position.quantity),
        old_description: oldPos.position_name,
        new_description: best.position.position_name
      });
      
      const index = newPositions.indexOf(best.position);
      newPositions.splice(index, 1);
    } else {
      orphaned.push(oldPos);
    }
  }

  return { matches, orphaned, newPositions };
}

/**
 * Calculate quantity change percentage
 */
function calculateQtyChange(oldQty, newQty) {
  if (oldQty === 0) return newQty > 0 ? 100 : 0;
  return Math.round(((newQty - oldQty) / oldQty) * 100);
}

/**
 * Generate complete relink report
 */
async function generateRelinkReport(oldVersionId, newVersionId) {
  // Get all positions for both versions
  const oldPositions = await db.query(`
    SELECT * FROM registry_position_instances
    WHERE file_version_id = $1 AND is_active = true
    ORDER BY position_code
  `, [oldVersionId]);

  const newPositions = await db.query(`
    SELECT * FROM registry_position_instances
    WHERE file_version_id = $1 AND is_active = true
    ORDER BY position_code
  `, [newVersionId]);

  const oldRows = oldPositions.rows;
  const newRows = newPositions.rows;

  // Step 1: Primary match
  let result = await primaryMatch(oldRows, newRows);
  const allMatches = [...result.matches];

  // Step 2: Fallback match
  result = await fallbackMatch(result.unmatchedOld, result.unmatchedNew);
  allMatches.push(...result.matches);

  // Step 3: Fuzzy match
  result = await fuzzyMatch(result.unmatchedOld, result.unmatchedNew);
  allMatches.push(...result.matches);

  // Step 4: Classify remainder
  const orphaned = result.orphaned;
  const newItems = result.newPositions;

  // Generate summary
  const summary = {
    total_old: oldRows.length,
    total_new: newRows.length,
    matched_exact: allMatches.filter(m => m.match_type === 'primary').length,
    matched_fallback: allMatches.filter(m => m.match_type === 'fallback').length,
    matched_fuzzy: allMatches.filter(m => m.match_type === 'fuzzy').length,
    orphaned: orphaned.length,
    new_positions: newItems.length,
    confidence_green: allMatches.filter(m => m.confidence === 'GREEN').length,
    confidence_amber: allMatches.filter(m => m.confidence === 'AMBER').length,
    confidence_red: allMatches.filter(m => m.confidence === 'RED').length,
    match_rate: Math.round((allMatches.length / oldRows.length) * 100)
  };

  // Save report to database
  const reportResult = await db.query(`
    INSERT INTO registry_relink_reports 
      (old_version_id, new_version_id, summary, details, relink_date)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING id
  `, [
    oldVersionId,
    newVersionId,
    JSON.stringify(summary),
    JSON.stringify({ matches: allMatches, orphaned, newItems })
  ]);

  return {
    report_id: reportResult.rows[0].id,
    summary,
    details: { matches: allMatches, orphaned, newItems }
  };
}

/**
 * Apply relink - copy calculations from old to new positions
 */
async function applyRelink(reportId) {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get report
    const reportResult = await client.query(`
      SELECT * FROM registry_relink_reports WHERE id = $1
    `, [reportId]);

    if (reportResult.rows.length === 0) {
      throw new Error('Report not found');
    }

    const report = reportResult.rows[0];
    const details = report.details;
    let appliedCount = 0;

    // Apply each match
    for (const match of details.matches) {
      // Get old position payload
      const oldPosResult = await client.query(`
        SELECT kiosk_data FROM registry_position_instances WHERE id = $1
      `, [match.old_position_id]);

      if (oldPosResult.rows.length === 0) continue;

      const oldPayload = oldPosResult.rows[0].kiosk_data;

      // Copy to new position
      await client.query(`
        UPDATE registry_position_instances
        SET kiosk_data = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [oldPayload, match.new_position_id]);

      // Flag if qty changed significantly
      if (Math.abs(match.qty_change) > 20) {
        await client.query(`
          UPDATE registry_position_instances
          SET status = 'needs_review'
          WHERE id = $1
        `, [match.new_position_id]);
      }

      appliedCount++;
    }

    // Mark old positions as archived
    await client.query(`
      UPDATE registry_position_instances
      SET status = 'archived', is_active = false
      WHERE file_version_id = $1
    `, [report.old_version_id]);

    // Update relink status
    await client.query(`
      UPDATE registry_file_versions
      SET relink_status = 'completed'
      WHERE id = $1
    `, [report.new_version_id]);

    // Mark report as reviewed
    await client.query(`
      UPDATE registry_relink_reports
      SET reviewed_at = NOW()
      WHERE id = $1
    `, [reportId]);

    await client.query('COMMIT');

    return { success: true, applied: appliedCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Manual match - user overrides automatic matching
 */
async function manualMatch(reportId, oldPositionId, newPositionId) {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get old position payload
    const oldPosResult = await client.query(`
      SELECT kiosk_data FROM registry_position_instances WHERE id = $1
    `, [oldPositionId]);

    if (oldPosResult.rows.length === 0) {
      throw new Error('Old position not found');
    }

    const oldPayload = oldPosResult.rows[0].kiosk_data;

    // Copy to new position
    await client.query(`
      UPDATE registry_position_instances
      SET kiosk_data = $1,
          updated_at = NOW()
      WHERE id = $2
    `, [oldPayload, newPositionId]);

    // Update report with manual match
    await client.query(`
      UPDATE registry_relink_reports
      SET details = jsonb_set(
        details,
        '{manual_matches}',
        COALESCE(details->'manual_matches', '[]'::jsonb) || $1::jsonb
      )
      WHERE id = $2
    `, [
      JSON.stringify({ old_position_id: oldPositionId, new_position_id: newPositionId }),
      reportId
    ]);

    await client.query('COMMIT');

    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export {
  generateRelinkReport,
  applyRelink,
  manualMatch,
  primaryMatch,
  fallbackMatch,
  fuzzyMatch
};
