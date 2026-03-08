import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { OrchestratorService } from './orchestrator.service'
import { OrchestratorController } from './orchestrator.controller'
import { AgentRegistry } from '@agent-all/agent-registry'
import { getSupabaseServiceClient } from '@agent-all/database'

@Module({
  imports: [
    BullModule.registerQueue({ name: 'agent-tasks' }),
  ],
  controllers: [OrchestratorController],
  providers: [
    OrchestratorService,
    {
      provide: AgentRegistry,
      useFactory: () => new AgentRegistry(getSupabaseServiceClient()),
    },
  ],
  exports: [OrchestratorService, AgentRegistry],
})
export class OrchestratorModule {}
