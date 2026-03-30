CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO departments (name) VALUES
  ('Engineering'),('HR'),('Finance'),('Operations'),('Marketing'),('Management')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(80) NOT NULL UNIQUE, email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'hr',
    is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    employee_id UUID
);
INSERT INTO users (username, email, hashed_password, role) VALUES (
  'admin','admin@company.com',
  '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW','admin'
) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id VARCHAR(20) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE, phone VARCHAR(20),
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    designation VARCHAR(100), joining_date DATE,
    image_path TEXT, face_encoding BYTEA,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_emp_active ON employees(is_active);

CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL, punch_in_time TIMESTAMPTZ, punch_out_time TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'present',
    punch_in_image TEXT, punch_out_image TEXT,
    working_hours NUMERIC(5,2), notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (employee_id, date)
);
CREATE INDEX IF NOT EXISTS idx_att_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_att_emp  ON attendance(employee_id);

-- Link users to employees (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
