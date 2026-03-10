import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { PlannerService } from './planner.service'
import { ToolsModule } from '../tools/tools.module'

@Module({
  imports: [
    BullModule.registerQueue({ name: 'agent-tasks' }),
    ToolsModule,
  ],
  providers: [PlannerService],
  exports: [PlannerService],
})
export class PlannerModule {}
