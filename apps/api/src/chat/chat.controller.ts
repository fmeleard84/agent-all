import { Controller, Post, Param, Body, UseGuards, Req } from '@nestjs/common'
import { ChatService } from './chat.service'
import { SupabaseAuthGuard } from '../auth/auth.guard'

@Controller('chat')
@UseGuards(SupabaseAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post(':workspaceId')
  async chat(
    @Param('workspaceId') workspaceId: string,
    @Body() body: { message: string },
    @Req() req: any,
  ) {
    const response = await this.chatService.chat(workspaceId, body.message, req.user.id)
    return { response }
  }
}
