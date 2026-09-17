-- ==========================================================
-- SISTEMA CONTABLE Y MESA DE CAMBIO: "CAMBIOS JK"
-- ESQUEMA DE BASE DE DATOS PARA SUPABASE / POSTGRESQL
-- ==========================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA DE CUENTAS BANCARIAS, WALLETS Y CAJAS
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('USD', 'USDT', 'VES', 'COP', 'PEN', 'EUR')),
    type VARCHAR(20) NOT NULL CHECK (type IN ('banco', 'wallet', 'efectivo', 'zelle', 'otro')),
    responsible VARCHAR(100) NOT NULL,
    current_balance NUMERIC(18, 4) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABLA DE VENTAS AL DETAL (RETAIL)
CREATE TABLE IF NOT EXISTS transactions_detal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time TIMESTAMPTZ DEFAULT now(),
    client_name VARCHAR(150) NOT NULL,
    usdt_amount NUMERIC(18, 4) NOT NULL,
    sell_price NUMERIC(18, 6) NOT NULL,
    buy_price NUMERIC(18, 6) NOT NULL,
    total_to_pay NUMERIC(18, 4) NOT NULL,
    received_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    amount_received NUMERIC(18, 4) DEFAULT 0,
    profit_usd NUMERIC(18, 4) NOT NULL,
    paid_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    bank_fee NUMERIC(18, 4) DEFAULT 0,
    reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABLA DE VENTAS AL MAYOR
CREATE TABLE IF NOT EXISTS transactions_mayor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    client_name VARCHAR(150) NOT NULL,
    amount_ves NUMERIC(18, 4) NOT NULL,
    buy_price NUMERIC(18, 6) NOT NULL,
    sell_price NUMERIC(18, 6) NOT NULL,
    total_to_pay NUMERIC(18, 4) NOT NULL,
    received_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    paid_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    commission NUMERIC(18, 4) DEFAULT 0,
    profit_usd NUMERIC(18, 4) NOT NULL,
    reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABLA DE COMPRAS DETAL
CREATE TABLE IF NOT EXISTS compras_detal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    quantity NUMERIC(18, 4) NOT NULL,
    buy_price NUMERIC(18, 6) NOT NULL,
    supplier_dollar NUMERIC(18, 4) NOT NULL,
    credited_amount NUMERIC(18, 4) DEFAULT 0,
    supplier_name VARCHAR(150) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. TABLA DE COMPRA DE BOLÍVARES
CREATE TABLE IF NOT EXISTS compras_bolivares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    quantity NUMERIC(18, 4) NOT NULL,
    buy_price NUMERIC(18, 6) NOT NULL,
    supplier_usd NUMERIC(18, 4) NOT NULL,
    supplier_name VARCHAR(150) NOT NULL,
    credited_amount NUMERIC(18, 4) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TABLA DE CAMBIO DE SALDO (TRASPASOS INTERNOS ENTRE CUENTAS)
CREATE TABLE IF NOT EXISTS balance_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    from_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
    to_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
    amount_sent NUMERIC(18, 4) NOT NULL,
    percentage_fee NUMERIC(8, 4) DEFAULT 0,
    commission NUMERIC(18, 4) DEFAULT 0,
    amount_received NUMERIC(18, 4) NOT NULL,
    concept VARCHAR(150),
    reference VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. TABLA DE GASTOS Y OTROS
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('USD', 'USDT', 'VES', 'COP', 'EUR', 'PEN')),
    concept VARCHAR(50) DEFAULT 'GASTOS',
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    amount_usd NUMERIC(18, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. TABLA DE CIERRE DIARIO Y GANANCIAS
CREATE TABLE IF NOT EXISTS daily_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
    closed_at TIMESTAMPTZ DEFAULT now(),
    profit_detal NUMERIC(18, 4) NOT NULL DEFAULT 0,
    profit_mayor NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_expenses NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_net_profit NUMERIC(18, 4) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. TABLA DE DEUDORES / CUENTAS POR COBRAR
CREATE TABLE IF NOT EXISTS debtors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name VARCHAR(150) NOT NULL UNIQUE,
    current_debt NUMERIC(18, 4) NOT NULL DEFAULT 0,
    phone VARCHAR(50),
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- DATOS INICIALES DE CUENTAS (Extracción directa de CAMBIOS JK)
INSERT INTO accounts (name, bank_name, currency, type, responsible, current_balance) VALUES
-- Cuentas Ecuador / Dólares
('EFECTIVO GENERAL', 'Caja Efectivo', 'USD', 'efectivo', 'EFECTIVO', 5981.20),
('BANCO PICHINCHA', 'Banco Pichincha', 'USD', 'banco', 'KELVIN Pichincha CTE', 0.00),
('BANCO GUAYAQUIL', 'Banco Guayaquil', 'USD', 'banco', 'KELVIN Guayaquil', 0.00),
('PRODUBANCO', 'Produbanco', 'USD', 'banco', 'KELVIN Produbanco', 0.00),
('BANCO PACÍFICO', 'Banco del Pacífico', 'USD', 'banco', 'KELVIN Pacífico', 0.00),
('COOPERATIVA JEP', 'Coop. JEP', 'USD', 'banco', 'KELVIN Jep', 0.00),
('BANCO AUSTRO', 'Banco del Austro', 'USD', 'banco', 'KELVIN Austro', 0.00),

-- Cuentas Cripto / Binance / Wallets
('BINANCE KELVIN', 'Binance', 'USDT', 'wallet', 'Kelvin', 40.20),
('BINANCE DARIO', 'Binance', 'USDT', 'wallet', 'Dario', -55.83),
('BINANCE GLENDYS', 'Binance', 'USDT', 'wallet', 'Glendys', 10856.78),
('BINANCE CAROLINA', 'Binance', 'USDT', 'wallet', 'Carolina', 585.69),
('TRON KELVIN', 'Tron Wallet', 'USDT', 'wallet', 'Kelvin', 11.61),
('TRON CAROLINA', 'Tron Wallet', 'USDT', 'wallet', 'Carolina', -7163.91),

-- Cuentas Zelle
('ZELLE Andrea B', 'Zelle', 'USD', 'zelle', 'Andrea B', 92.00),
('ZELLE Oscar Soto', 'Zelle', 'USD', 'zelle', 'Oscar Soto', 0.10),

-- Cuentas Venezuela / Bolívares
('BANESCO Yurley Delgado', 'Banesco', 'VES', 'banco', 'Yurley Delgado', 213578.99),
('BANESCO Yaylib Escalona', 'Banesco', 'VES', 'banco', 'Yaylib Escalona', 31580.92),
('BANESCO Yelitza GUEDEZ', 'Banesco', 'VES', 'banco', 'Yelitza Guedez', 3298.04),
('BANESCO Belgica Rocio', 'Banesco', 'VES', 'banco', 'Belgica Rocio', 86521.86),
('BANCO VENEZUELA Ivan Araujo', 'Banco de Venezuela', 'VES', 'banco', 'Ivan Araujo', 641973.41),
('BANCO VENEZUELA Syolys Araujo', 'Banco de Venezuela', 'VES', 'banco', 'Syolys Araujo', 1695.24),
('BANCO VENEZUELA Yurley Delgado', 'Banco de Venezuela', 'VES', 'banco', 'Yurley Delgado', 39200.11),
('BANCO VENEZUELA Emilia Araujo', 'Banco de Venezuela', 'VES', 'banco', 'Emilia Araujo', 71867.51),
('BANCO VENEZUELA Anthony Jimenez', 'Banco de Venezuela', 'VES', 'banco', 'Anthony Jimenez', 59245.54),

-- Cuentas Colombia / Pesos
('BANCOLOMBIA Dario', 'Bancolombia', 'COP', 'banco', 'Dario', 0.00),
('BANCOLOMBIA Glendys', 'Bancolombia', 'COP', 'banco', 'Glendys', 0.00),
('NEQUI Glendys', 'Nequi', 'COP', 'banco', 'Glendys', 0.00)
ON CONFLICT DO NOTHING;
