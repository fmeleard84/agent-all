-- Migration 003: Agent System V1 — leads, interactions, tool connections, execution steps

-- Leads table (CRM)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  source TEXT DEFAULT 'manual',
  source_detail JSONB DEFAULT '{}',
  score INT DEFAULT 0,
  status TEXT DEFAULT 'new',
  tags TEXT[] DEFAULT '{}',
  raw_data JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Interactions table
CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  direction TEXT,
  subject TEXT,
  content TEXT,
  classification TEXT,
  sentiment_score FLOAT,
  objections TEXT[] DEFAULT '{}',
  external_id TEXT,
  thread_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Task execution steps (tool call log for transparency)
CREATE TABLE IF NOT EXISTS task_execution_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_execution_id UUID REFERENCES task_executions(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  agent_id TEXT,
  tool_id TEXT,
  action_id TEXT,
  input JSONB DEFAULT '{}',
  output JSONB DEFAULT '{}',
  error TEXT,
  status TEXT DEFAULT 'running',
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tool connections (OAuth tokens, API keys)
CREATE TABLE IF NOT EXISTS tool_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  tool_id TEXT NOT NULL,
  status TEXT DEFAULT 'connected',
  credentials JSONB DEFAULT '{}',
  account_info JSONB DEFAULT '{}',
  connected_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Add approval_data to task_executions
ALTER TABLE task_executions ADD COLUMN IF NOT EXISTS approval_data JSONB;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_workspace ON leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interactions_lead ON interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_interactions_workspace ON interactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(workspace_id, type);
CREATE INDEX IF NOT EXISTS idx_steps_task ON task_execution_steps(task_execution_id);
CREATE INDEX IF NOT EXISTS idx_tool_connections_company ON tool_connections(company_id);
CREATE INDEX IF NOT EXISTS idx_tool_connections_tool ON tool_connections(company_id, tool_id);

-- RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_execution_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view leads in their workspaces" ON leads
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view interactions in their workspaces" ON interactions
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view task steps via task executions" ON task_execution_steps
  FOR SELECT USING (true);

CREATE POLICY "Users can view their tool connections" ON tool_connections
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );
