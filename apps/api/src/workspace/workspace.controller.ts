import { Controller, Get, Post, Param, Body, Query, UseGuards, Req } from '@nestjs/common'
import { WorkspaceService } from './workspace.service'
import { SupabaseAuthGuard } from '../auth/auth.guard'
import type { AxeType } from '@agent-all/types'

@Controller('workspaces')
@UseGuards(SupabaseAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  async createWorkspace(
    @Req() req: any,
    @Body() body: { axeType: AxeType; name?: string },
  ) {
    return this.workspaceService.create(req.user.id, body.axeType, body.name)
  }

  @Get()
  async listWorkspaces(@Req() req: any) {
    return this.workspaceService.findByUser(req.user.id)
  }

  @Get(':id')
  async getWorkspace(@Param('id') id: string) {
    return this.workspaceService.findById(id)
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.workspaceService.getMessages(id, limit ? parseInt(limit, 10) : 50)
  }

  @Post(':id/messages')
  async addMessage(
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.workspaceService.addMessage(id, 'user', body.content)
  }

  @Post(':id/metadata')
  async updateMetadata(
    @Param('id') id: string,
    @Body() body: Record<string, any>,
  ) {
    return this.workspaceService.updateMetadata(id, body)
  }
}
