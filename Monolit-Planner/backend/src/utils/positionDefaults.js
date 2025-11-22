/**
 * Position Defaults Utility
 * Centralizes default values and generation logic for position creation
 * Used across all endpoints that create positions (bridges, projects, manual entry)
 *
 * Goal: Single source of truth for position defaults to ensure consistency
 */

/**
 * Standard defaults for position creation
 * These are used whenever a new position is created without specific values
 */
export const POSITION_DEFAULTS = {
  crew_size: 4,              // Standard crew size for most work
  wage_czk_ph: 398,          // Czech wage per person-hour (updated as needed)
  shift_hours: 10,           // Standard 10-hour work day
  days: 0,                   // Days on-site (filled by user)
  qty: 0,                    // Quantity (filled by user)
  qty_m3_helper: null,       // Helper for cubic meter calculations
  subtype: 'beton',          // Default subtype: concrete
  unit: 'M3',                // Default unit: cubic meters
  otskp_code: null           // OTSKP code (filled by user)
};

/**
 * Generate a unique position ID
 * Uses UUID format (v4 if available) or timestamp-based fallback
 *
 * @param {string} projectId - Project/bridge ID for context
 * @returns {string} Unique position ID
 */
export function generatePositionId(projectId) {
  // Try to use crypto.randomUUID if available (Node 15+)
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {
    // Fallback if crypto not available
  }

  // Fallback: use uuid import (already imported in routes that call this)
  // or return timestamp-based ID
  return `${projectId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a default position object for a template part
 * Used when creating projects and adding new parts
 *
 * @param {Object} template - Part template with at least {part_name, item_name, subtype, unit}
 * @param {string} projectId - Project/bridge ID
 * @returns {Object} Position object ready for database insertion
 */
export function createDefaultPosition(template, projectId) {
  return {
    id: generatePositionId(projectId),
    bridge_id: projectId,        // Using bridge_id for backward compatibility
    part_name: template.part_name,
    item_name: template.item_name || template.part_name,
    subtype: template.subtype || POSITION_DEFAULTS.subtype,
    unit: template.unit || POSITION_DEFAULTS.unit,
    qty: POSITION_DEFAULTS.qty,
    qty_m3_helper: POSITION_DEFAULTS.qty_m3_helper,
    crew_size: POSITION_DEFAULTS.crew_size,
    wage_czk_ph: POSITION_DEFAULTS.wage_czk_ph,
    shift_hours: POSITION_DEFAULTS.shift_hours,
    days: POSITION_DEFAULTS.days,
    otskp_code: POSITION_DEFAULTS.otskp_code
  };
}

/**
 * Create multiple default positions for an array of templates
 * Used when creating projects with template parts
 *
 * @param {Array} templates - Array of part templates
 * @param {string} projectId - Project/bridge ID
 * @returns {Array} Array of position objects ready for batch insertion
 */
export function createDefaultPositions(templates, projectId) {
  return templates.map(template => createDefaultPosition(template, projectId));
}

/**
 * Get position defaults as a flat object (for database insertion)
 * Useful for INSERT statements where you need just the default values
 *
 * @returns {Object} Flat object with all default values
 */
export function getDefaultPositionValues() {
  return { ...POSITION_DEFAULTS };
}

/**
 * Validate that a position object has all required fields
 *
 * @param {Object} position - Position object to validate
 * @returns {Object} {valid: boolean, errors: string[]}
 */
export function validatePosition(position) {
  const errors = [];

  if (!position.id) errors.push('position.id is required');
  if (!position.bridge_id) errors.push('position.bridge_id is required');
  if (!position.part_name) errors.push('position.part_name is required');
  if (!position.subtype) errors.push('position.subtype is required');
  if (!position.unit) errors.push('position.unit is required');
  if (position.qty === undefined || position.qty === null) errors.push('position.qty is required');
  if (!Number.isFinite(position.crew_size)) errors.push('position.crew_size must be a valid number');
  if (!Number.isFinite(position.wage_czk_ph)) errors.push('position.wage_czk_ph must be a valid number');
  if (!Number.isFinite(position.shift_hours)) errors.push('position.shift_hours must be a valid number');
  if (!Number.isFinite(position.days)) errors.push('position.days must be a valid number');

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Documentation: Where position defaults are used
 *
 * 1. **Project Creation** (monolith-projects.js)
 *    - When user creates a new project with an object type
 *    - Each template part gets a default position created
 *    - Users then fill in quantities and other details
 *
 * 2. **Bridge Creation** (bridges.js)
 *    - Legacy endpoint for creating bridges
 *    - Creates positions from BRIDGE_TEMPLATE_POSITIONS
 *    - Should be migrated to use monolith-projects flow
 *
 * 3. **Manual Part Creation** (PositionsTable.tsx → NewPartModal → positionsAPI.create)
 *    - When user clicks "Přidat novou část konstrukce"
 *    - Frontend creates position with OTSKP code + part name
 *    - Uses same defaults as template positions
 *
 * 4. **File Upload** (upload.js)
 *    - When user uploads Excel file
 *    - Creates positions from parsed rows
 *    - May override defaults with values from file
 *
 * Consistency: All code should use these defaults instead of hardcoding values
 */
