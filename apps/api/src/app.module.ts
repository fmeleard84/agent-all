import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { BullModule } from '@nestjs/bullmq'
import { AuthModule } from './auth/auth.module'
import { CompanyModule } from './company/company.module'
import { OrchestratorModule } from './orchestrator/orchestrator.module'
import { WorkspaceModule } from './workspace/workspace.module'
import { ChatModule } from './chat/chat.module'
import { QontoModule } from './qonto/qonto.module'
import { LandingModule } from './landing/landing.module'
import { ToolsModule } from './tools/tools.module'
import { PlannerModule } from './planner/planner.module'
import { AgentsModule } from './agents/agents.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    AuthModule,
    CompanyModule,
    OrchestratorModule,
    WorkspaceModule,
    ChatModule,
    QontoModule,
    LandingModule,
    ToolsModule,
    PlannerModule,
    AgentsModule,
  ],
})
export class AppModule {}
