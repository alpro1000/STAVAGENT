/**
 * Position Linking by OTSKP/URS Code Prefix v1.1
 *
 * Links related positions (beton + bednění + výztuž + předpětí + podpěry + zrání)
 * by their catalog code prefix. The first 4 digits of OTSKP/URS codes identify
 * the construction element; the 5th digit identifies the work type.
 *
 * OTSKP (bridges): 6 digits, d5: 1-3=beton, 6=výztuž, 7=předpětí
 * URS (buildings): 9 digits, d5: 2=beton, 5=bednění, 6=výztuž
 *
 * RTS / unknown: name-based fallback via detectWorkTypeFromName.
 *
 * Reference: OTSKP catalog (17,904 entries), URS classification system.
 */
// ─── Catalog Detection ──────────────────────────────────────────────────────
/**
 * Detect catalog type from code format.
 * OTSKP: 6 digits. URS: 9 digits.
 */
export function detectCatalog(code) {
    if (!code)
        return 'unknown';
    const clean = code.replace(/\s/g, '');
    if (/^\d{6}$/.test(clean))
        return 'otskp';
    if (/^\d{9}$/.test(clean))
        return 'urs';
    return 'unknown';
}
/**
 * Get code prefix (first 4 digits) that identifies the construction element.
 */
export function getCodePrefix(code) {
    if (!code)
        return null;
    const clean = code.replace(/\s/g, '');
    if (clean.length >= 4 && /^\d{4}/.test(clean))
        return clean.slice(0, 4);
    return null;
}
// ─── Work Type Detection ────────────────────────────────────────────────────
/**
 * Detect work type from the 5th digit of the code.
 */
export function detectWorkType(code) {
    const catalog = detectCatalog(code);
    const clean = code.replace(/\s/g, '');
    if (clean.length < 5)
        return 'unknown';
    const d5 = clean[4];
    if (catalog === 'otskp') {
        if (d5 === '1' || d5 === '2' || d5 === '3')
            return 'beton';
        if (d5 === '6')
            return 'výztuž';
        if (d5 === '7')
            return 'předpětí';
        return 'unknown';
    }
    if (catalog === 'urs') {
        if (d5 === '2')
            return 'beton';
        if (d5 === '5') {
            // URS bednění: suffix ...1121 = zřízení, ...1122 = odstranění
            if (clean.endsWith('1122') || clean.endsWith('122'))
                return 'bednění_odstranění';
            if (clean.endsWith('1121') || clean.endsWith('121'))
                return 'bednění_zřízení';
            return 'bednění';
        }
        if (d5 === '6')
            return 'výztuž';
        return 'unknown';
    }
    return 'unknown';
}
/**
 * Map work type to Monolit subtype for display.
 */
export function workTypeToSubtype(wt) {
    switch (wt) {
        case 'beton': return 'beton';
        case 'bednění':
        case 'bednění_zřízení': return 'bednění';
        case 'bednění_odstranění': return 'odbednění';
        case 'výztuž': return 'výztuž';
        case 'předpětí': return 'předpětí';
        case 'podpěry': return 'podpěrná konstr.';
        case 'zrání': return 'zrání';
        default: return 'jiné';
    }
}
/**
 * Find related positions by code prefix — with two fallbacks.
 *
 * Matching strategy (in priority order):
 *   1. Same OTSKP/URS code prefix (first 4 digits of `otskp_code`)
 *      → use detectWorkType(code); if it returns 'unknown', fall back to
 *        detectWorkTypeFromName(item_name|part_name).
 *   2. If `currentCode` has no recognizable prefix BUT the caller passed
 *      `currentPartName` + `currentBridgeId`, we treat all positions sharing
 *      that part_name+bridge_id as siblings (for RTS / no-code soupis).
 *      Work type is derived from each sibling's name.
 *
 * @param currentCode    OTSKP/URS code of the "main" position (may be empty for RTS)
 * @param allPositions   All positions in the project
 * @param ctx            Optional context for sibling-by-name matching
 */
export function findLinkedPositions(currentCode, allPositions, ctx) {
    const prefix = getCodePrefix(currentCode);
    const catalog = detectCatalog(currentCode);
    const partName = ctx?.currentPartName?.trim();
    const bridgeId = ctx?.currentBridgeId;
    // No prefix AND no part_name fallback → empty group
    if (!prefix && !partName) {
        return { prefix: '', catalog: 'unknown', main: null, related: [], all: [] };
    }
    const linked = [];
    let main = null;
    const seen = new Set();
    const consider = (pos, codeWasUsed) => {
        if (seen.has(pos.id))
            return;
        // Resolve work type: try code first, fall back to name
        let wt = 'unknown';
        if (codeWasUsed && pos.otskp_code) {
            wt = detectWorkType(pos.otskp_code);
        }
        if (wt === 'unknown') {
            wt = detectWorkTypeFromName(pos.item_name || pos.part_name || '');
        }
        if (wt === 'unknown') {
            // Last resort: trust the existing subtype if it maps cleanly
            wt = subtypeToWorkType(pos.subtype);
        }
        const lp = {
            id: pos.id,
            code: pos.otskp_code || '',
            work_type: wt,
            name: pos.item_name || pos.part_name || '',
            unit: pos.unit,
            qty: pos.qty,
            subtype: pos.subtype,
        };
        seen.add(pos.id);
        if (wt === 'beton') {
            // First beton wins (in case of duplicates)
            if (!main)
                main = lp;
            else
                linked.push(lp);
        }
        else {
            linked.push(lp);
        }
    };
    // Pass 1: code-prefix match
    if (prefix) {
        for (const pos of allPositions) {
            if (!pos.otskp_code)
                continue;
            const posPrefix = getCodePrefix(pos.otskp_code);
            if (posPrefix !== prefix)
                continue;
            consider(pos, true);
        }
    }
    // Pass 2: part_name + bridge_id sibling match (catches positions that have
    // no OTSKP code at all, e.g. RTS imports or manually added rows).
    if (partName) {
        for (const pos of allPositions) {
            if (seen.has(pos.id))
                continue;
            if (!pos.part_name)
                continue;
            if (pos.part_name.trim() !== partName)
                continue;
            if (bridgeId && pos.bridge_id && pos.bridge_id !== bridgeId)
                continue;
            consider(pos, false);
        }
    }
    return {
        prefix: prefix || '',
        catalog,
        main,
        related: linked,
        all: main ? [main, ...linked] : linked,
    };
}
/**
 * Coarse mapping from existing Monolit subtype → WorkType (used when we have
 * neither a recognizable OTSKP/URS code nor a meaningful name).
 */
function subtypeToWorkType(subtype) {
    switch ((subtype || '').toLowerCase()) {
        case 'beton': return 'beton';
        case 'bednění': return 'bednění_zřízení';
        case 'odbednění': return 'bednění_odstranění';
        case 'výztuž': return 'výztuž';
        case 'předpětí': return 'předpětí';
        case 'podpěrná konstr.':
        case 'podpěrná konstr':
        case 'podpěry':
        case 'skruž':
            return 'podpěry';
        case 'zrání': return 'zrání';
        default: return 'unknown';
    }
}
/**
 * Fallback: detect work type from position name (when no OTSKP/URS code).
 *
 * Used by findLinkedPositions when detectWorkType(code) returns 'unknown'
 * (e.g. RTS soupis, manually added positions, OTSKP positions with mistyped
 * codes). Patterns are diacritic-insensitive and match Czech + a couple of
 * common English / German equivalents.
 */
export function detectWorkTypeFromName(name) {
    if (!name)
        return 'unknown';
    // Strip diacritics so that "BEDNĚNÍ" and "bedneni" match the same regex
    const lower = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    // Order matters — more specific patterns must come first.
    // Předpětí must match before výztuž (which would also catch "predpinaci vyztuz").
    if (/predpet|predpinan|predpinac|predpjat|y1860|y\s*1860/.test(lower))
        return 'předpětí';
    // Odstranění bednění (must precede generic bedneni)
    if (/odstran.*bedn|odbedn|demont.*bedn|stripping/.test(lower))
        return 'bednění_odstranění';
    // Zřízení bednění
    if (/zrizen.*bedn|montaz.*bedn|bedneni|salovan|formwork|forma\s*beton/.test(lower))
        return 'bednění_zřízení';
    // Podpěrná konstrukce / skruž / shoring (BUT not "shoring" inside another keyword)
    if (/podper|skruz|stojk|falsework|shoring/.test(lower))
        return 'podpěry';
    // Ošetřování / zrání (curing) — intentionally before "vyztuž" to avoid
    // matching "ošetřování výztuže".
    if (/osetrov|zrani(?!\s*v)|curing|kropeni/.test(lower))
        return 'zrání';
    // Výztuž / armování
    if (/vyztuz|armovan|armatura|ocel\s*b500|kari\s*sit/.test(lower))
        return 'výztuž';
    // Beton (generic) — comes last to avoid swallowing the more specific ones
    if (/beton|zelezobet|prosty\s*bet/.test(lower))
        return 'beton';
    return 'unknown';
}
