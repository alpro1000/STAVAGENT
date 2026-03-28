/**
 * Rate Limiting Middleware
 * Protects against DDoS and brute force attacks
 */

import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';

/**
 * General API rate limiter
 * 500 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: 'Příliš mnoho požadavků z vaší IP adresy, zkuste to znovu později',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  validate: { xForwardedForHeader: false }, // Cloud Run sits behind Google's proxy; trust proxy is handled in server.js
  skip: (req) => {
    // Don't rate limit health checks (kiosk endpoints now have service key auth)
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
  validate: { xForwardedForHeader: false },
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
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    logger.warn(`Upload rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Maximálně 10 nahrání za hodinu'
    });
  }
});

/**
 * Connection test rate limiter
 * 5 tests per minute per IP (prevent key-fishing)
 */
export const connectionTestLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: 'Příliš mnoho testů připojení, zkuste to znovu za minutu',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    logger.warn(`Connection test rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Příliš mnoho testů připojení, zkuste to znovu za minutu'
    });
  }
});

/**
 * OTSKP search rate limiter
 * 50 searches per 15 minutes per IP
 */
/**
 * CORE AI rate limiter — stricter for anonymous users
 * Anonymous: 5 AI requests per hour per IP (session-only demo)
 * Authenticated: 100 AI requests per hour per IP (credit-gated)
 */
export const coreAiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req) => req.user?.userId ? 100 : 5,
  message: 'Příliš mnoho AI požadavků. Zaregistrujte se pro vyšší limity.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  keyGenerator: (req) => req.user?.userId ? `user-${req.user.userId}` : req.ip,
  handler: (req, res) => {
    const isAnon = !req.user?.userId;
    logger.warn(`CORE AI rate limit exceeded for ${isAnon ? 'anonymous IP' : 'user'}: ${isAnon ? req.ip : req.user.userId}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: isAnon
        ? 'Dosáhli jste limitu 5 analýz za hodinu. Zaregistrujte se pro 200 kreditů zdarma.'
        : 'Příliš mnoho AI požadavků, zkuste to znovu později.',
      register_hint: isAnon,
    });
  }
});

export const otskpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: 'Příliš mnoho vyhledávacích požadavků',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    logger.warn(`OTSKP search rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Příliš mnoho vyhledávacích požadavků'
    });
  }
});
