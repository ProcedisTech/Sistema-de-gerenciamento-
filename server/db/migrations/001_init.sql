-- Core schema for Procedi PostgreSQL rollout.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  data_nascimento DATE,
  idade INTEGER,
  sexo TEXT,
  estado_civil TEXT,
  profissao TEXT,
  alergias TEXT,
  cpf TEXT,
  rg TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  instagram TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  ultima_visita DATE,
  proximo_retorno DATE,
  saldo_devedor_centavos INTEGER NOT NULL DEFAULT 0,
  lgpd_assinado BOOLEAN NOT NULL DEFAULT FALSE,
  lgpd_renovacao DATE,
  medicamentos JSONB NOT NULL DEFAULT '[]'::jsonb,
  condicoes_saude TEXT,
  queixas_esteticas JSONB NOT NULL DEFAULT '[]'::jsonb,
  cirurgias_anteriores TEXT,
  observacoes_importantes TEXT,
  evaluation_annotated_photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_cpf_normalized
  ON patients ((regexp_replace(cpf, '\\D', '', 'g')))
  WHERE cpf IS NOT NULL AND regexp_replace(cpf, '\\D', '', 'g') <> '';

CREATE TABLE IF NOT EXISTS patient_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  autor TEXT,
  data DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  data DATE,
  hora TEXT,
  tipo TEXT,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  data DATE,
  hora TEXT,
  nome TEXT NOT NULL,
  profissional TEXT,
  valor_centavos INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  procedure_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);

CREATE TABLE IF NOT EXISTS journeys (
  id TEXT PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  current_step INTEGER NOT NULL DEFAULT 1,
  queixa TEXT,
  expectativas TEXT,
  gestante BOOLEAN NOT NULL DEFAULT FALSE,
  amamentando BOOLEAN NOT NULL DEFAULT FALSE,
  anticoagulantes BOOLEAN NOT NULL DEFAULT FALSE,
  queloides BOOLEAN NOT NULL DEFAULT FALSE,
  termo_lido BOOLEAN NOT NULL DEFAULT FALSE,
  termo_assinado BOOLEAN NOT NULL DEFAULT FALSE,
  orientacoes BOOLEAN NOT NULL DEFAULT FALSE,
  satisfacao BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'finished', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journey_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'anamnese',
  file_name TEXT,
  mime_type TEXT,
  file_size_bytes BIGINT,
  storage_path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journey_photos_journey ON journey_photos(journey_id);

