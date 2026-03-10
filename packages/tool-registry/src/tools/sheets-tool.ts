import { google } from 'googleapis'
import { BaseTool } from '../base-tool'
import { ToolDefinition, ToolResult, ToolCredentials } from '../types'

export class SheetsTool extends BaseTool {
  readonly definition: ToolDefinition = {
    toolId: 'sheets',
    name: 'Google Sheets',
    description: 'Export de donnees vers Google Sheets',
    service: 'google',
    actions: [
      {
        actionId: 'create_sheet',
        description: 'Creer un nouveau spreadsheet',
        inputSchema: { title: 'string', headers: 'string[]' },
        outputSchema: { spreadsheetId: 'string', url: 'string' },
      },
      {
        actionId: 'append_rows',
        description: 'Ajouter des lignes a un spreadsheet',
        inputSchema: { spreadsheetId: 'string', rows: 'any[][]' },
        outputSchema: { updatedRows: 'number' },
      },
      {
        actionId: 'read_rows',
        description: 'Lire les lignes d\'un spreadsheet',
        inputSchema: { spreadsheetId: 'string', range: 'string?' },
        outputSchema: { rows: 'any[][]' },
      },
    ],
    authType: 'oauth2',
    oauthConfig: {
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
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
        case 'create_sheet': return this.createSheet(input, credentials)
        case 'append_rows': return this.appendRows(input, credentials)
        case 'read_rows': return this.readRows(input, credentials)
        default: return this.makeError(`Unknown action: ${actionId}`)
      }
    } catch (err: any) {
      return this.makeError(`Sheets error: ${err.message}`)
    }
  }

  private async createSheet(input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const auth = this.getAuth(credentials)
    const sheets = google.sheets({ version: 'v4', auth })
    const res = await sheets.spreadsheets.create({
      requestBody: { properties: { title: input.title } },
    })
    if (input.headers?.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: res.data.spreadsheetId!,
        range: 'A1',
        valueInputOption: 'RAW',
        requestBody: { values: [input.headers] },
      })
    }
    return this.makeResult({
      spreadsheetId: res.data.spreadsheetId,
      url: res.data.spreadsheetUrl,
    })
  }

  private async appendRows(input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const auth = this.getAuth(credentials)
    const sheets = google.sheets({ version: 'v4', auth })
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: input.spreadsheetId,
      range: 'A1',
      valueInputOption: 'RAW',
      requestBody: { values: input.rows },
    })
    return this.makeResult({ updatedRows: res.data.updates?.updatedRows || 0 })
  }

  private async readRows(input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const auth = this.getAuth(credentials)
    const sheets = google.sheets({ version: 'v4', auth })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: input.spreadsheetId,
      range: input.range || 'A:Z',
    })
    return this.makeResult({ rows: res.data.values || [] })
  }
}
