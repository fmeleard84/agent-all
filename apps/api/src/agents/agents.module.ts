import { Module } from '@nestjs/common'
import { AgentsController } from './agents.controller'
import { PlannerModule } from '../planner/planner.module'

@Module({
  imports: [PlannerModule],
  controllers: [AgentsController],
})
export class AgentsModule {}
