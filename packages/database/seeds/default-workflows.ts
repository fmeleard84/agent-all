import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL || 'https://yojesskmdehepeqkdelp.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function seed() {
  if (!supabaseKey) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const db = createClient(supabaseUrl, supabaseKey)

  // Workflow 1: Process incoming email
  const processEmail = {
    id: 'process-incoming-email',
    name: 'Process Incoming Email',
    trigger: 'EMAIL_RECEIVED',
    tasks: [
      {
        id: 'classify-email',
        agentId: 'email-agent',
        action: 'classify_email',
      },
      {
        id: 'extract-attachments',
        agentId: 'email-agent',
        action: 'extract_attachments',
        dependsOn: ['classify-email'],
      },
      {
        id: 'detect-document-type',
        agentId: 'document-agent',
        action: 'detect_type',
        dependsOn: ['extract-attachments'],
      },
      {
        id: 'extract-document-data',
        agentId: 'document-agent',
        action: 'extract_data',
        dependsOn: ['detect-document-type'],
      },
      {
        id: 'categorize-expense',
        agentId: 'accounting-agent',
        action: 'categorize_expense',
        dependsOn: ['extract-document-data'],
      },
    ],
  }

  // Workflow 2: Process document upload
  const processDocument = {
    id: 'process-document-upload',
    name: 'Process Document Upload',
    trigger: 'DOCUMENT_UPLOADED',
    tasks: [
      {
        id: 'detect-document-type',
        agentId: 'document-agent',
        action: 'detect_type',
      },
      {
        id: 'extract-document-data',
        agentId: 'document-agent',
        action: 'extract_data',
        dependsOn: ['detect-document-type'],
      },
      {
        id: 'rename-document',
        agentId: 'document-agent',
        action: 'rename_document',
        dependsOn: ['extract-document-data'],
      },
      {
        id: 'categorize-expense',
        agentId: 'accounting-agent',
        action: 'categorize_expense',
        dependsOn: ['extract-document-data'],
      },
    ],
  }

  // Delete existing default workflows
  await db.from('workflows').delete().is('company_id', null)

  // Insert
  const { error: err1 } = await db.from('workflows').insert({
    company_id: null,
    trigger_event: 'EMAIL_RECEIVED',
    definition: processEmail,
    enabled: true,
  })
  if (err1) console.error('Error inserting email workflow:', err1.message)
  else console.log('Inserted: process-incoming-email')

  const { error: err2 } = await db.from('workflows').insert({
    company_id: null,
    trigger_event: 'DOCUMENT_UPLOADED',
    definition: processDocument,
    enabled: true,
  })
  if (err2) console.error('Error inserting document workflow:', err2.message)
  else console.log('Inserted: process-document-upload')

  console.log('Seeding complete!')
}

seed().catch(console.error)
