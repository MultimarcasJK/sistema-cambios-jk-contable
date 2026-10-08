-- =========================================================================
-- SISTEMA CAMBIOS JK - MIGRACIÓN NÓMINAS Y GASTOS DE SERVICIOS
-- Tablas 100% aisladas e independientes para DETAL y MAYOR
-- =========================================================================

-- 1. DETAL: EMPLEADOS
CREATE TABLE IF NOT EXISTS detal_empleados (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  identification TEXT,
  phone TEXT,
  position TEXT NOT NULL,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  salary_currency TEXT NOT NULL DEFAULT 'USD',
  payment_frequency TEXT NOT NULL DEFAULT 'quincenal',
  payment_details TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. DETAL: PAGOS DE NÓMINA
CREATE TABLE IF NOT EXISTS detal_pagos_nomina (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  period TEXT NOT NULL,
  base_amount NUMERIC NOT NULL DEFAULT 0,
  bonuses NUMERIC NOT NULL DEFAULT 0,
  deductions NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  amount_currency NUMERIC NOT NULL DEFAULT 0,
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  account_id TEXT,
  expense_id TEXT,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DETAL: GASTOS DE SERVICIOS
CREATE TABLE IF NOT EXISTS detal_gastos_servicios (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  invoice_number TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  account_id TEXT,
  expense_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MAYOR: EMPLEADOS
CREATE TABLE IF NOT EXISTS mayor_empleados (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  identification TEXT,
  phone TEXT,
  position TEXT NOT NULL,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  salary_currency TEXT NOT NULL DEFAULT 'USD',
  payment_frequency TEXT NOT NULL DEFAULT 'quincenal',
  payment_details TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. MAYOR: PAGOS DE NÓMINA
CREATE TABLE IF NOT EXISTS mayor_pagos_nomina (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  period TEXT NOT NULL,
  base_amount NUMERIC NOT NULL DEFAULT 0,
  bonuses NUMERIC NOT NULL DEFAULT 0,
  deductions NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  amount_currency NUMERIC NOT NULL DEFAULT 0,
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  account_id TEXT,
  expense_id TEXT,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MAYOR: GASTOS DE SERVICIOS
CREATE TABLE IF NOT EXISTS mayor_gastos_servicios (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  invoice_number TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  account_id TEXT,
  expense_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- POLÍTICAS DE ACCESO (ROW LEVEL SECURITY - RLS)
-- Permite acceso público con clave Publishable/Anon para operar sin bloqueo
-- =========================================================================
DO $$
DECLARE 
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'detal_empleados',
        'detal_pagos_nomina',
        'detal_gastos_servicios',
        'mayor_empleados',
        'mayor_pagos_nomina',
        'mayor_gastos_servicios'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'allow_all_for_anon_' || tbl, tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (true) WITH CHECK (true);', 'allow_all_for_anon_' || tbl, tbl);
    END LOOP;
END $$;
