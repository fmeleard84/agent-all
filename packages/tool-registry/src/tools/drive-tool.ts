import { google } from 'googleapis'
import { BaseTool } from '../base-tool'
import { ToolDefinition, ToolResult, ToolCredentials } from '../types'
import { Readable } from 'stream'

export class DriveTool extends BaseTool {
  readonly definition: ToolDefinition = {
    toolId: 'drive',
    name: 'Google Drive',
    description: 'Gestion de documents sur Google Drive',
    service: 'google',
    actions: [
      {
        actionId: 'create_document',
        description: 'Creer un Google Doc',
        inputSchema: { title: 'string', content: 'string' },
        outputSchema: { documentId: 'string', url: 'string' },
      },
      {
        actionId: 'save_file',
        description: 'Sauvegarder un fichier sur Drive',
        inputSchema: { name: 'string', content: 'string', mimeType: 'string?' },
        outputSchema: { fileId: 'string', url: 'string' },
      },
    ],
    authType: 'oauth2',
    oauthConfig: {
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      provider: 'google',
    },
  }

  private getAuth(credentials: ToolCredentials) {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    )
    oauth2.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
    })
    return oauth2
  }

  async execute(actionId: string, input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    try {
      switch (actionId) {
        case 'create_document': return this.createDocument(input, credentials)
        case 'save_file': return this.saveFile(input, credentials)
        default: return this.makeError(`Unknown action: ${actionId}`)
      }
    } catch (err: any) {
      return this.makeError(`Drive error: ${err.message}`)
    }
  }

  private async createDocument(input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const auth = this.getAuth(credentials)
    const drive = google.drive({ version: 'v3', auth })
    const res = await drive.files.create({
      requestBody: { name: input.title, mimeType: 'application/vnd.google-apps.document' },
      media: { mimeType: 'text/plain', body: Readable.from(input.content) },
    })
    return this.makeResult({
      documentId: res.data.id,
      url: `https://docs.google.com/document/d/${res.data.id}/edit`,
    })
  }

  private async saveFile(input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const auth = this.getAuth(credentials)
    const drive = google.drive({ version: 'v3', auth })
    const res = await drive.files.create({
      requestBody: { name: input.name },
      media: { mimeType: input.mimeType || 'text/plain', body: Readable.from(input.content) },
    })
    return this.makeResult({
      fileId: res.data.id,
      url: `https://drive.google.com/file/d/${res.data.id}/view`,
    })
  }
}
