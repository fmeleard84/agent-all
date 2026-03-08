import { Module } from '@nestjs/common'
import { WorkspaceModule } from '../workspace/workspace.module'
import { ChatService } from './chat.service'
import { ChatController } from './chat.controller'

@Module({
  imports: [WorkspaceModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
