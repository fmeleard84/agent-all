import { Controller, Post, Param, Body, UseGuards, Req, Res } from '@nestjs/common'
import { ChatService } from './chat.service'
import { SupabaseAuthGuard } from '../auth/auth.guard'
import type { FastifyReply } from 'fastify'

@Controller('chat')
@UseGuards(SupabaseAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post(':workspaceId')
  async chat(
    @Param('workspaceId') workspaceId: string,
    @Body() body: { message: string },
    @Req() req: any,
    @Res() res: FastifyReply,
  ) {
    // SSE streaming
    res.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    })

    try {
      for await (const chunk of this.chatService.chatStream(workspaceId, body.message, req.user.id)) {
        res.raw.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
      }
      res.raw.write(`data: [DONE]\n\n`)
    } catch (err) {
      res.raw.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
    }

    res.raw.end()
  }

  @Post(':workspaceId/upload')
  async uploadDocument(
    @Param('workspaceId') workspaceId: string,
    @Req() req: any,
    @Res() res: FastifyReply,
  ) {
    // Fastify multipart handling
    const data = await (req as any).file()
    if (!data) {
      return res.status(400).send({ error: 'No file uploaded' })
    }

    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(chunk)
    }
    const fileBuffer = Buffer.concat(chunks)
    const fileName = data.filename

    // Extract text from document
    const extractedText = await this.chatService.extractDocumentText(fileBuffer, fileName)

    // Truncate if too long (keep first 4000 chars for context)
    const truncated = extractedText.length > 4000
      ? extractedText.substring(0, 4000) + '\n\n[... document tronque pour la conversation]'
      : extractedText

    // Send as a chat message with document context
    const message = `J'ai uploade le document "${fileName}". Voici son contenu :\n\n${truncated}`

    // Stream the response
    res.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    })

    try {
      for await (const chunk of this.chatService.chatStream(workspaceId, message, req.user.id)) {
        res.raw.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
      }
      res.raw.write(`data: [DONE]\n\n`)
    } catch (err) {
      res.raw.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
    }

    res.raw.end()
  }
}
