/**
 * IP Anti-fraud Middleware
 * Limits registrations per IP to prevent abuse of free tier
 */

import db from '../db/index.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

// Max registrations per IP within the time window
const MAX_REGISTRATIONS_PER_IP = 3;
const WINDOW_HOURS = 24;

/**
 * Middleware that checks registration IP limits.
 * Attach to POST /api/auth/register
 */
export async function checkRegistrationIP(req, res, next) {
  try {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';

    // Count recent registrations from this IP
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - WINDOW_HOURS);

    const count = await db.prepare(`
      SELECT COUNT(*) as count FROM registration_ips
      WHERE ip_address = ? AND created_at > ?
    `).get(ip, cutoff.toISOString());

    if (count && count.count >= MAX_REGISTRATIONS_PER_IP) {
      logger.warn(`[ANTIFRAUD] Registration blocked: IP ${ip} has ${count.count} registrations in last ${WINDOW_HOURS}h`);
      return res.status(429).json({
        error: 'Too many registrations',
        message: `Příliš mnoho registrací z vaší IP adresy. Maximálně ${MAX_REGISTRATIONS_PER_IP} registrace za ${WINDOW_HOURS} hodin.`,
      });
    }

    // Stash IP info for recording after successful registration
    req.registrationIP = ip;
    req.registrationUA = userAgent;
    next();
  } catch (error) {
    logger.error('[ANTIFRAUD] Error checking registration IP:', error);
    // Fail-open
    next();
  }
}

/**
 * Record a registration IP (call after successful user creation)
 */
export async function recordRegistrationIP(ip, userId, userAgent = '') {
  try {
    await db.prepare(`
      INSERT INTO registration_ips (id, ip_address, user_id, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), ip, userId, userAgent, new Date().toISOString());

    // Also store on user record
    await db.prepare(
      'UPDATE users SET registration_ip = ? WHERE id = ?'
    ).run(ip, userId);
  } catch (error) {
    logger.error('[ANTIFRAUD] Error recording registration IP:', error);
  }
}

/**
 * Get registration IP stats for admin
 */
export async function getRegistrationIPStats(days = 7) {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const byIP = await db.prepare(`
      SELECT ip_address, COUNT(*) as count, MAX(created_at) as last_at
      FROM registration_ips
      WHERE created_at > ?
      GROUP BY ip_address
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 50
    `).all(cutoff.toISOString());

    const total = await db.prepare(`
      SELECT COUNT(*) as count FROM registration_ips WHERE created_at > ?
    `).get(cutoff.toISOString());

    return {
      period_days: days,
      total_registrations: total.count,
      suspicious_ips: byIP,
    };
  } catch (error) {
    logger.error('[ANTIFRAUD] Error getting IP stats:', error);
    return { period_days: days, total_registrations: 0, suspicious_ips: [] };
  }
}
