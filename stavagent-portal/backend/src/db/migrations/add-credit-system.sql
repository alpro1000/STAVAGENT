-- Phase 10: Credit System + Anti-fraud
-- Creates operation_prices, credit_transactions, banned_email_domains tables
-- Adds credit_balance, banned columns to users

-- Operation pricing catalog
CREATE TABLE IF NOT EXISTS operation_prices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_key     VARCHAR(100) NOT NULL UNIQUE,
  display_name      VARCHAR(255) NOT NULL,
  description       TEXT,
  credits_cost      INTEGER NOT NULL DEFAULT 1,
  is_ai             BOOLEAN DEFAULT false,
  is_active         BOOLEAN DEFAULT true,
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- Credit transactions
CREATE TABLE IF NOT EXISTS credit_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount            INTEGER NOT NULL,
  balance_after     INTEGER NOT NULL,
  operation_key     VARCHAR(100),
  description       VARCHAR(500),
  reference_id      VARCHAR(255),
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Add SaaS columns to users (may be missing from earlier sessions)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_ip VARCHAR(45);
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_pipeline_runs_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'free';

-- Add credit_balance to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance INTEGER DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_operation ON credit_transactions(operation_key);
CREATE INDEX IF NOT EXISTS idx_operation_prices_key ON operation_prices(operation_key);

-- Seed default operation prices
INSERT INTO operation_prices (id, operation_key, display_name, description, credits_cost, is_ai, sort_order) VALUES
  (gen_random_uuid(), 'document_parse',       'Parsování dokumentu',          'Extrakce dat z PDF/Excel/XML (bez AI)',          2,  false, 1),
  (gen_random_uuid(), 'document_analyze',     'AI analýza dokumentu',         'Kompletní AI analýza s pasportem',              10, true,  2),
  (gen_random_uuid(), 'passport_generate',    'Generování pasportu',          'AI pasport s normami a identifikací',           15, true,  3),
  (gen_random_uuid(), 'nkb_check',            'Kontrola norem (NKB)',         'Kontrola souladu s ČSN/EN normami',              5, true,  4),
  (gen_random_uuid(), 'nkb_advisor',          'NKB poradce',                  'AI poradce pro normativní dotazy',               8, true,  5),
  (gen_random_uuid(), 'workflow_c_audit',     'Audit rozpočtu',               'Multi-role AI validace rozpočtu',                20, true,  6),
  (gen_random_uuid(), 'urs_match',            'URS párování',                 'AI párování položek na URS kódy',                8, true,  7),
  (gen_random_uuid(), 'registry_classify',    'Klasifikace položek',          'AI klasifikace do skupin prací',                 5, true,  8),
  (gen_random_uuid(), 'monolit_calculate',    'Kalkulace monolitu',           'Výpočet ceny betonových prací',                  1, false, 9),
  (gen_random_uuid(), 'pump_calculate',       'Kalkulace čerpadla',           'Výpočet nákladů na čerpadlo',                    1, false, 10),
  (gen_random_uuid(), 'export_xlsx',          'Export do Excel',              'Stažení výsledků jako XLSX',                     1, false, 11),
  (gen_random_uuid(), 'export_csv',           'Export do CSV',                'Stažení výsledků jako CSV',                      1, false, 12),
  (gen_random_uuid(), 'save_to_project',      'Uložení do projektu',          'Trvalé uložení výsledků do databáze',            2, false, 13),
  (gen_random_uuid(), 'chat_message',         'Chat zpráva',                  'AI odpověď v chatu projektu',                    3, true,  14),
  (gen_random_uuid(), 'price_parser',         'Parsování ceníku',             'Extrakce cen z PDF ceníku betonárny',            5, true,  15)
ON CONFLICT (operation_key) DO NOTHING;

-- Seed feature flags for credits
INSERT INTO feature_flags (id, flag_key, display_name, description, category, default_enabled) VALUES
  (gen_random_uuid(), 'credits_system',       'Kreditní systém',              'Pay-as-you-go kreditní systém',                  'module',  true),
  (gen_random_uuid(), 'session_only_mode',    'Session-only režim',           'Bez kreditů = výsledky jen v prohlížeči',        'module',  true)
ON CONFLICT (flag_key) DO NOTHING;

-- Add ban columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_reason VARCHAR(500);

-- Banned email domains
CREATE TABLE IF NOT EXISTS banned_email_domains (
  domain VARCHAR(255) PRIMARY KEY,
  added_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed disposable email domains
INSERT INTO banned_email_domains (domain) VALUES
  ('tempmail.com'), ('temp-mail.org'), ('guerrillamail.com'), ('guerrillamail.de'),
  ('mailinator.com'), ('yopmail.com'), ('throwaway.email'), ('tempail.com'),
  ('trashmail.com'), ('trashmail.me'), ('10minutemail.com'), ('10minute.email'),
  ('minutemail.com'), ('dispostable.com'), ('maildrop.cc'), ('mailnesia.com'),
  ('sharklasers.com'), ('guerrillamailblock.com'), ('grr.la'), ('discard.email'),
  ('discardmail.com'), ('discardmail.de'), ('fakeinbox.com'), ('emailondeck.com'),
  ('tempr.email'), ('temp-mail.io'), ('mohmal.com'), ('getnada.com'),
  ('tmpmail.net'), ('tmpmail.org'), ('burnermail.io'), ('mailsac.com'),
  ('harakirimail.com'), ('crazymailing.com'), ('tmail.ws'), ('tempinbox.com'),
  ('binkmail.com'), ('safetymail.info'), ('filzmail.com'), ('mailcatch.com'),
  ('meltmail.com'), ('spamgourmet.com'), ('mytemp.email'), ('throwam.com'),
  ('mailnull.com'), ('spamfree24.org'), ('jetable.org'), ('trash-mail.com'),
  ('wegwerfmail.de'), ('wegwerfmail.net'), ('einrot.com'), ('sogetthis.com')
ON CONFLICT (domain) DO NOTHING;
