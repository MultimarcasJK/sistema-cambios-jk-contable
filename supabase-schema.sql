-- =========================================================================
-- SISTEMA CAMBIOS JK - ESQUEMA SUPABASE POSTGRESQL
-- 100% SEPARADO: GRUPO DETAL Y GRUPO MAYOR TOTALMENTE INDEPENDIENTES
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. GRUPO DETAL (100% INDEPENDIENTE)
-- =========================================================================

-- 1.1 Cuentas Bancarias / Wallets Detal
CREATE TABLE IF NOT EXISTS detal_accounts (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 currency TEXT NOT NULL,
 current_balance NUMERIC NOT NULL DEFAULT 0,
 initial_balance NUMERIC NOT NULL DEFAULT 0,
 type TEXT NOT NULL DEFAULT 'banco',
 bank_name TEXT,
 responsible TEXT,
 country TEXT DEFAULT 'ECUADOR',
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 Clientes y Deudas Detal
CREATE TABLE IF NOT EXISTS detal_clients (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 phone TEXT,
 current_debt NUMERIC NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.3 Transacciones Detal (Cripto / Dólar)
CREATE TABLE IF NOT EXISTS detal_transactions (
 id TEXT PRIMARY KEY,
 date DATE NOT NULL,
 client_name TEXT NOT NULL,
 client_id TEXT REFERENCES detal_clients(id) ON DELETE SET NULL,
 usdt_amount NUMERIC NOT NULL DEFAULT 0,
 sell_price NUMERIC NOT NULL DEFAULT 0,
 buy_price NUMERIC NOT NULL DEFAULT 0,
 total_to_pay NUMERIC NOT NULL DEFAULT 0,
 received_account_id TEXT,
 amount_received NUMERIC NOT NULL DEFAULT 0,
 paid_account_id TEXT,
 bank_fee NUMERIC NOT NULL DEFAULT 0,
 fee_percent NUMERIC,
 profit_usd NUMERIC NOT NULL DEFAULT 0,
 payment_status TEXT NOT NULL DEFAULT 'PENDIENTE',
 reference TEXT,
 notes TEXT,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.4 Cambio Saldos / Traspasos Detal
CREATE TABLE IF NOT EXISTS detal_transfers (
 id TEXT PRIMARY KEY,
 date DATE NOT NULL,
 from_account_id TEXT NOT NULL REFERENCES detal_accounts(id) ON DELETE CASCADE,
 to_account_id TEXT NOT NULL REFERENCES detal_accounts(id) ON DELETE CASCADE,
 amount_sent NUMERIC NOT NULL,
 percentage_fee NUMERIC NOT NULL DEFAULT 0,
 commission NUMERIC NOT NULL DEFAULT 0,
 amount_received NUMERIC NOT NULL,
 concept TEXT,
 reference TEXT,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.5 Ingresos y Gastos Detal
CREATE TABLE IF NOT EXISTS detal_expenses (
 id TEXT PRIMARY KEY,
 date DATE NOT NULL,
 type TEXT NOT NULL, -- 'egreso' | 'ingreso'
 description TEXT NOT NULL,
 amount NUMERIC NOT NULL,
 currency TEXT NOT NULL,
 concept TEXT,
 account_id TEXT REFERENCES detal_accounts(id) ON DELETE SET NULL,
 amount_usd NUMERIC NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.6 Cierres Diarios Detal
CREATE TABLE IF NOT EXISTS detal_closures (
 id TEXT PRIMARY KEY,
 date DATE NOT NULL,
 closed_at TIMESTAMPTZ NOT NULL,
 responsible TEXT NOT NULL,
 accounts_snapshot JSONB NOT NULL,
 total_profit_usd NUMERIC NOT NULL DEFAULT 0,
 total_volume_usdt NUMERIC NOT NULL DEFAULT 0,
 pending_debt_usd NUMERIC NOT NULL DEFAULT 0,
 notes TEXT,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.7 Catálogo de Monedas Detal
CREATE TABLE IF NOT EXISTS detal_currencies (
 code TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 symbol TEXT NOT NULL,
 decimals INTEGER NOT NULL DEFAULT 2,
 is_active BOOLEAN NOT NULL DEFAULT true,
 is_crypto BOOLEAN NOT NULL DEFAULT false,
 country TEXT,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.8 Tasas Oficiales Detal
CREATE TABLE IF NOT EXISTS detal_rates (
 id TEXT PRIMARY KEY,
 currency TEXT NOT NULL,
 buy_rate NUMERIC NOT NULL,
 sell_rate NUMERIC NOT NULL,
 updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.9 Proveedores y Compras Detal
CREATE TABLE IF NOT EXISTS detal_suppliers (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 contact_info TEXT,
 current_debt_usd NUMERIC NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS detal_supplier_purchases (
 id TEXT PRIMARY KEY,
 date DATE NOT NULL,
 supplier_id TEXT NOT NULL REFERENCES detal_suppliers(id) ON DELETE CASCADE,
 currency TEXT NOT NULL DEFAULT 'USDT',
 quantity NUMERIC NOT NULL,
 rate NUMERIC NOT NULL,
 cost_usd NUMERIC NOT NULL,
 account_id TEXT,
 credited_amount NUMERIC NOT NULL DEFAULT 0,
 reference TEXT,
 notes TEXT,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS detal_supplier_payments (
 id TEXT PRIMARY KEY,
 date DATE NOT NULL,
 supplier_id TEXT NOT NULL REFERENCES detal_suppliers(id) ON DELETE CASCADE,
 amount_usd NUMERIC NOT NULL,
 account_id TEXT,
 reference TEXT,
 notes TEXT,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 2. GRUPO MAYOR (100% INDEPENDIENTE)
-- =========================================================================

-- 2.1 Cuentas Bancarias / Wallets Mayor
CREATE TABLE IF NOT EXISTS mayor_accounts (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 currency TEXT NOT NULL,
 current_balance NUMERIC NOT NULL DEFAULT 0,
 initial_balance NUMERIC NOT NULL DEFAULT 0,
 type TEXT NOT NULL DEFAULT 'banco',
 bank_name TEXT,
 responsible TEXT,
 country TEXT DEFAULT 'VENEZUELA',
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 Clientes y Deudas Mayor
CREATE TABLE IF NOT EXISTS mayor_clients (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 phone TEXT,
 current_debt NUMERIC NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 Transacciones Mayor (Emergentes)
CREATE TABLE IF NOT EXISTS mayor_transactions (
 id TEXT PRIMARY KEY,
 date DATE NOT NULL,
 client_name TEXT NOT NULL,
 client_id TEXT REFERENCES mayor_clients(id) ON DELETE SET NULL,
 currency TEXT NOT NULL DEFAULT 'VES',
 amount_ves NUMERIC NOT NULL DEFAULT 0,
 buy_price NUMERIC NOT NULL DEFAULT 0,
 sell_price NUMERIC NOT NULL DEFAULT 0,
 total_to_pay NUMERIC NOT NULL DEFAULT 0,
 received_account_id TEXT,
 amount_received NUMERIC NOT NULL DEFAULT 0,
 paid_account_id TEXT,
 commission NUMERIC NOT NULL DEFAULT 0,
 fee_percent NUMERIC,
 profit_usd NUMERIC NOT NULL DEFAULT 0,
 payment_status TEXT NOT NULL DEFAULT 'PENDIENTE',
 reference TEXT,
 notes TEXT,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4 Cambio Saldos / Traspasos Mayor
CREATE TABLE IF NOT EXISTS mayor_transfers (
 id TEXT PRIMARY KEY,
 date DATE NOT NULL,
 from_account_id TEXT NOT NULL REFERENCES mayor_accounts(id) ON DELETE CASCADE,
 to_account_id TEXT NOT NULL REFERENCES mayor_accounts(id) ON DELETE CASCADE,
 amount_sent NUMERIC NOT NULL,
 percentage_fee NUMERIC NOT NULL DEFAULT 0,
 commission NUMERIC NOT NULL DEFAULT 0,
 amount_received NUMERIC NOT NULL,
 concept TEXT,
 reference TEXT,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 Ingresos y Gastos Mayor
CREATE TABLE IF NOT EXISTS mayor_expenses (
 id TEXT PRIMARY KEY,
 date DATE NOT NULL,
 type TEXT NOT NULL, -- 'egreso' | 'ingreso'
 description TEXT NOT NULL,
 amount NUMERIC NOT NULL,
 currency TEXT NOT NULL,
 concept TEXT,
 account_id TEXT REFERENCES mayor_accounts(id) ON DELETE SET NULL,
 amount_usd NUMERIC NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.6 Cierres Diarios Mayor
CREATE TABLE IF NOT EXISTS mayor_closures (
 id TEXT PRIMARY KEY,
 date DATE NOT NULL,
 closed_at TIMESTAMPTZ NOT NULL,
 responsible TEXT NOT NULL,
 accounts_snapshot JSONB NOT NULL,
 total_profit_usd NUMERIC NOT NULL DEFAULT 0,
 total_volume_ves NUMERIC NOT NULL DEFAULT 0,
 pending_debt_usd NUMERIC NOT NULL DEFAULT 0,
 notes TEXT,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.7 Catálogo de Monedas Mayor
CREATE TABLE IF NOT EXISTS mayor_currencies (
 code TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 symbol TEXT NOT NULL,
 decimals INTEGER NOT NULL DEFAULT 2,
 is_active BOOLEAN NOT NULL DEFAULT true,
 is_crypto BOOLEAN NOT NULL DEFAULT false,
 country TEXT,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.8 Tasas Oficiales Mayor
CREATE TABLE IF NOT EXISTS mayor_rates (
 id TEXT PRIMARY KEY,
 currency TEXT NOT NULL,
 buy_rate NUMERIC NOT NULL,
 sell_rate NUMERIC NOT NULL,
 updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.9 Proveedores y Compras Mayor
CREATE TABLE IF NOT EXISTS mayor_suppliers (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 contact_info TEXT,
 current_debt_usd NUMERIC NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mayor_supplier_purchases (
 id TEXT PRIMARY KEY,
 date DATE NOT NULL,
 supplier_id TEXT NOT NULL REFERENCES mayor_suppliers(id) ON DELETE CASCADE,
 currency TEXT NOT NULL DEFAULT 'USDT',
 quantity NUMERIC NOT NULL,
 rate NUMERIC NOT NULL,
 cost_usd NUMERIC NOT NULL,
 account_id TEXT,
 credited_amount NUMERIC NOT NULL DEFAULT 0,
 reference TEXT,
 notes TEXT,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mayor_supplier_payments (
 id TEXT PRIMARY KEY,
 date DATE NOT NULL,
 supplier_id TEXT NOT NULL REFERENCES mayor_suppliers(id) ON DELETE CASCADE,
 amount_usd NUMERIC NOT NULL,
 account_id TEXT,
 reference TEXT,
 notes TEXT,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 3. POLÍTICAS DE ACCESO (ROW LEVEL SECURITY - RLS)
-- Permite acceso público con la clave Publishable/Anon para operar sin bloqueo
-- =========================================================================
DO $$
DECLARE 
    tbl TEXT;
    tables TEXT[] := ARRAY[
        -- Grupo Detal
        'detal_accounts', 'detal_clients', 'detal_transactions', 'detal_transfers', 'detal_expenses', 'detal_closures',
        'detal_currencies', 'detal_rates', 'detal_suppliers', 'detal_supplier_purchases', 'detal_supplier_payments',
        -- Grupo Mayor
        'mayor_accounts', 'mayor_clients', 'mayor_transactions', 'mayor_transfers', 'mayor_expenses', 'mayor_closures',
        'mayor_currencies', 'mayor_rates', 'mayor_suppliers', 'mayor_supplier_purchases', 'mayor_supplier_payments'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'allow_all_for_anon_' || tbl, tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (true) WITH CHECK (true);', 'allow_all_for_anon_' || tbl, tbl);
    END LOOP;
END $$;
