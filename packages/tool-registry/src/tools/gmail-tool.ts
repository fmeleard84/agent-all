import { google } from 'googleapis'
import { BaseTool } from '../base-tool'
import { ToolDefinition, ToolResult, ToolCredentials } from '../types'

export class GmailTool extends BaseTool {
  readonly definition: ToolDefinition = {
    toolId: 'gmail',
    name: 'Gmail',
    description: 'Envoi et lecture d\'emails via Gmail',
    service: 'google',
    actions: [
      {
        actionId: 'send_email',
        description: 'Envoyer un email',
        inputSchema: { to: 'string', subject: 'string', body: 'string', replyToMessageId: 'string?' },
        outputSchema: { messageId: 'string', threadId: 'string' },
      },
      {
        actionId: 'read_threads',
        description: 'Lire les threads recents ou par query',
        inputSchema: { query: 'string?', maxResults: 'number?' },
        outputSchema: { threads: 'array' },
      },
      {
        actionId: 'list_messages',
        description: 'Lister les messages d\'un thread',
        inputSchema: { threadId: 'string' },
        outputSchema: { messages: 'array' },
      },
    ],
    authType: 'oauth2',
    oauthConfig: {
      scopes: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
      ],
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
        case 'send_email': return this.sendEmail(input, credentials)
        case 'read_threads': return this.readThreads(input, credentials)
        case 'list_messages': return this.listMessages(input, credentials)
        default: return this.makeError(`Unknown action: ${actionId}`)
      }
    } catch (err: any) {
      return this.makeError(`Gmail error: ${err.message}`)
    }
  }

  private async sendEmail(input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const auth = this.getAuth(credentials)
    const gmail = google.gmail({ version: 'v1', auth })

    const raw = Buffer.from(
      `To: ${input.to}\r\n` +
      `Subject: ${input.subject}\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n\r\n` +
      `${input.body}`
    ).toString('base64url')

    const params: any = { userId: 'me', requestBody: { raw } }
    if (input.replyToMessageId) {
      params.requestBody.threadId = input.threadId
    }

    const res = await gmail.users.messages.send(params)
    return this.makeResult({
      messageId: res.data.id,
      threadId: res.data.threadId,
    })
  }

  private async readThreads(input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const auth = this.getAuth(credentials)
    const gmail = google.gmail({ version: 'v1', auth })

    const res = await gmail.users.threads.list({
      userId: 'me',
      q: input.query || '',
      maxResults: input.maxResults || 20,
    })

    const threads = []
    for (const thread of (res.data.threads || []).slice(0, 10)) {
      const detail = await gmail.users.threads.get({ userId: 'me', id: thread.id! })
      const firstMsg = detail.data.messages?.[0]
      const headers = firstMsg?.payload?.headers || []
      threads.push({
        threadId: thread.id,
        subject: headers.find((h: any) => h.name === 'Subject')?.value || '',
        from: headers.find((h: any) => h.name === 'From')?.value || '',
        date: headers.find((h: any) => h.name === 'Date')?.value || '',
        snippet: firstMsg?.snippet || '',
        messageCount: detail.data.messages?.length || 0,
      })
    }

    return this.makeResult({ threads })
  }

  private async listMessages(input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const auth = this.getAuth(credentials)
    const gmail = google.gmail({ version: 'v1', auth })

    const res = await gmail.users.threads.get({ userId: 'me', id: input.threadId })
    const messages = (res.data.messages || []).map((msg: any) => {
      const headers = msg.payload?.headers || []
      const body = msg.payload?.body?.data
        ? Buffer.from(msg.payload.body.data, 'base64url').toString('utf-8')
        : msg.snippet || ''
      return {
        messageId: msg.id,
        from: headers.find((h: any) => h.name === 'From')?.value || '',
        to: headers.find((h: any) => h.name === 'To')?.value || '',
        date: headers.find((h: any) => h.name === 'Date')?.value || '',
        subject: headers.find((h: any) => h.name === 'Subject')?.value || '',
        body,
      }
    })

    return this.makeResult({ messages })
  }
}
