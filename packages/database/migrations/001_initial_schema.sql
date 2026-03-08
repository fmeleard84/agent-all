-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company users (links to Supabase Auth)
CREATE TABLE company_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- Company agents
CREATE TABLE company_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  autonomy_level INT NOT NULL DEFAULT 1 CHECK (autonomy_level BETWEEN 1 AND 4),
  config JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, agent_id)
);

-- Workflows
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  trigger_event TEXT NOT NULL,
  definition JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow executions
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  trigger_event JSONB NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Task executions
CREATE TABLE task_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  task_def_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'blocked', 'running', 'completed', 'failed', 'retrying')),
  input JSONB,
  output JSONB,
  confidence FLOAT,
  attempts INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  workflow_execution_id UUID REFERENCES workflow_executions(id),
  task_execution_id UUID REFERENCES task_executions(id),
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  confidence FLOAT,
  human_override BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company memory
CREATE TABLE company_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  preferences JSONB DEFAULT '{}',
  connected_services JSONB DEFAULT '[]',
  internal_rules JSONB DEFAULT '[]',
  custom_categories JSONB DEFAULT '[]'
);

-- Agent memory per company
CREATE TABLE agent_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  decisions JSONB DEFAULT '[]',
  corrections JSONB DEFAULT '[]',
  stats JSONB DEFAULT '{"totalTasks":0,"successRate":0,"avgConfidence":0,"avgDurationMs":0}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, company_id)
);

-- Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  type TEXT NOT NULL CHECK (type IN ('invoice', 'quote', 'contract', 'bank_statement', 'other')),
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  extracted_data JSONB DEFAULT '{}',
  source TEXT NOT NULL CHECK (source IN ('email', 'upload', 'api')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emails
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  from_address TEXT NOT NULL,
  subject TEXT,
  category TEXT CHECK (category IN ('invoice', 'prospect', 'support', 'info', 'spam')),
  raw_content TEXT,
  attachments JSONB DEFAULT '[]',
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounting entries
CREATE TABLE accounting_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  document_id UUID REFERENCES documents(id),
  category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  due_date DATE,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_company_users_company ON company_users(company_id);
CREATE INDEX idx_company_users_user ON company_users(user_id);
CREATE INDEX idx_company_agents_company ON company_agents(company_id);
CREATE INDEX idx_workflow_executions_company ON workflow_executions(company_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_task_executions_workflow ON task_executions(workflow_execution_id);
CREATE INDEX idx_task_executions_status ON task_executions(status);
CREATE INDEX idx_audit_log_company ON audit_log(company_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_documents_company ON documents(company_id);
CREATE INDEX idx_emails_company ON emails(company_id);
CREATE INDEX idx_accounting_entries_company ON accounting_entries(company_id);

-- RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users see own company" ON companies
  FOR SELECT USING (
    id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own company_users" ON company_users
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users manage own company_agents" ON company_agents
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own workflows" ON workflows
  FOR SELECT USING (
    company_id IS NULL OR company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own workflow_executions" ON workflow_executions
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own task_executions" ON task_executions
  FOR SELECT USING (
    workflow_execution_id IN (
      SELECT id FROM workflow_executions WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users see own audit_log" ON audit_log
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users manage own company_memory" ON company_memory
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own agent_memory" ON agent_memory
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users manage own documents" ON documents
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users manage own emails" ON emails
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users manage own accounting_entries" ON accounting_entries
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );
