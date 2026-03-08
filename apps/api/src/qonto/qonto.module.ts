import { Module } from '@nestjs/common'
import { WorkspaceModule } from '../workspace/workspace.module'
import { QontoService } from './qonto.service'
import { QontoController } from './qonto.controller'

@Module({
  imports: [WorkspaceModule],
  controllers: [QontoController],
  providers: [QontoService],
})
export class QontoModule {}
