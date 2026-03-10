import { Controller, Get, Post, Delete, Param, Query, Body, Res } from '@nestjs/common'
import { FastifyReply } from 'fastify'
import { ToolsService } from './tools.service'

@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get()
  listTools() {
    return this.toolsService.listAll()
  }

  @Get('status/:companyId')
  getStatus(@Param('companyId') companyId: string) {
    return this.toolsService.getConnectionStatus(companyId)
  }

  @Get(':toolId/auth-url')
  getAuthUrl(
    @Param('toolId') toolId: string,
    @Query('companyId') companyId: string,
  ) {
    const url = this.toolsService.getGoogleAuthUrl(toolId, companyId)
    if (!url) return { error: 'Tool not found or does not support OAuth' }
    return { url }
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() reply: FastifyReply,
  ) {
    const result = await this.toolsService.handleGoogleCallback(code, state)
    const frontendUrl = process.env.FRONTEND_URL || 'https://agent-all.ialla.fr'
    reply.redirect(`${frontendUrl}/dashboard/connectors?connected=${result.toolId}`)
  }

  @Post(':toolId/api-key')
  async saveApiKey(
    @Param('toolId') toolId: string,
    @Body() body: { companyId: string; apiKey: string },
  ) {
    await this.toolsService.saveApiKey(body.companyId, toolId, body.apiKey)
    return { status: 'connected' }
  }

  @Delete(':toolId/:companyId')
  async disconnect(
    @Param('toolId') toolId: string,
    @Param('companyId') companyId: string,
  ) {
    await this.toolsService.disconnect(companyId, toolId)
    return { status: 'disconnected' }
  }
}
