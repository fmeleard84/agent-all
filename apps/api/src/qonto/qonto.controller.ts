import { Controller, Post, Param, Body, UseGuards, Req } from '@nestjs/common'
import { SupabaseAuthGuard } from '../auth/auth.guard'
import { QontoService } from './qonto.service'

@Controller('qonto')
@UseGuards(SupabaseAuthGuard)
export class QontoController {
  constructor(private readonly qontoService: QontoService) {}

  @Post(':workspaceId/connect')
  async connect(
    @Req() req: any,
    @Param('workspaceId') workspaceId: string,
    @Body() body: { login: string; apiKey: string },
  ) {
    return this.qontoService.connectAndSync(
      workspaceId,
      req.user.id,
      body.login,
      body.apiKey,
    )
  }
}
