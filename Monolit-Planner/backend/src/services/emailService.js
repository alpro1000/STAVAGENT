/**
 * Email Service
 * Handles sending emails via Resend
 * https://resend.com/docs
 */

import { logger } from '../utils/logger.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
// Default from-address must use a Resend-verified domain. stavagent.cz is
// verified (DNS + DKIM) for the project. The previous default
// 'noreply@monolit-planner.com' is a non-existent domain that would
// trigger a 403 validation_error. This file is currently unused (no
// importer) but the default is kept consistent with stavagent-portal so
// any future wiring works out of the box. Override via RESEND_FROM_EMAIL.
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'STAVAGENT <noreply@stavagent.cz>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Send email via Resend API
 * @param {Object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.html - Email HTML content
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendEmail({ to, subject, html }) {
  try {
    if (!RESEND_API_KEY) {
      logger.warn('RESEND_API_KEY not configured - email will not be sent (dev mode)');
      // In development, just log the email
      logger.info(`📧 [DEV MODE] Email would be sent to: ${to}, Subject: ${subject}`);
      return { success: true, messageId: 'dev-mode-' + Date.now() };
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to,
        subject,
        html
      })
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error(`Failed to send email to ${to}:`, error);
      return {
        success: false,
        error: error.message || 'Failed to send email'
      };
    }

    const data = await response.json();
    logger.info(`✉️ Email sent to ${to} (ID: ${data.id})`);
    return { success: true, messageId: data.id };
  } catch (error) {
    logger.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send email verification link
 * @param {string} email - User email
 * @param {string} token - Verification token
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendVerificationEmail(email, token) {
  const verificationUrl = `${FRONTEND_URL}/verify?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .button { display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666; }
          .expires { color: #999; font-size: 12px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Ověřit e-mail</h1>
          </div>
          <div class="content">
            <p>Děkujeme za registraci na Monolit-Planner!</p>
            <p>Klikněte na tlačítko níže a ověřte svou e-mailovou adresu:</p>
            <a href="${verificationUrl}" class="button">Ověřit e-mail</a>
            <p>Nebo zkopírujte tento odkaz do prohlížeče:</p>
            <p style="word-break: break-all; font-size: 12px; color: #666;">
              ${verificationUrl}
            </p>
            <p class="expires">Tento odkaz vyprší za 24 hodin.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Monolit-Planner. Všechna práva vyhrazena.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Ověřte svou e-mailovou adresu - Monolit-Planner',
    html
  });
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @param {string} token - Reset token
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .button { display: inline-block; background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666; }
          .expires { color: #999; font-size: 12px; margin-top: 10px; }
          .warning { background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Resetovat heslo</h1>
          </div>
          <div class="content">
            <p>Obdrželi jsme žádost o resetování hesla k vašemu účtu.</p>
            <p>Klikněte na tlačítko níže pro nastavení nového hesla:</p>
            <a href="${resetUrl}" class="button">Resetovat heslo</a>
            <p>Nebo zkopírujte tento odkaz do prohlížeče:</p>
            <p style="word-break: break-all; font-size: 12px; color: #666;">
              ${resetUrl}
            </p>
            <div class="warning">
              <strong>⚠️ Bezpečnostní upozornění:</strong> Pokud jste si tuto žádost nevysílali, ignorujte tento e-mail.
            </div>
            <p class="expires">Tento odkaz vyprší za 1 hodinu.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Monolit-Planner. Všechna práva vyhrazena.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Resetovat heslo - Monolit-Planner',
    html
  });
}

export { sendEmail };
