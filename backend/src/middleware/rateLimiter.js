/**
 * Rate Limiting Middleware
 * Protects against DDoS and brute force attacks
 */

import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Příliš mnoho požadavků z vaší IP adresy, zkuste to znovu později',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => {
    // Don't rate limit health checks
    return req.path === '/health';
  },
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}, path: ${req.path}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Příliš mnoho požadavků z vaší IP adresy, zkuste to znovu později'
    });
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per 15 minutes per IP
 * Counts only failed attempts
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skipSuccessfulRequests: true, // Don't count successful requests
  message: 'Příliš mnoho pokusů o přihlášení, zkuste to znovu později',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Příliš mnoho pokusů o přihlášení, zkuste to znovu později'
    });
  }
});

/**
 * Upload rate limiter
 * 10 uploads per hour per IP
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Maximálně 10 nahrání za hodinu',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Upload rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Maximálně 10 nahrání za hodinu'
    });
  }
});

/**
 * OTSKP search rate limiter
 * 50 searches per 15 minutes per IP
 */
export const otskpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: 'Příliš mnoho vyhledávacích požadavků',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`OTSKP search rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Příliš mnoho vyhledávacích požadavků'
    });
  }
});
