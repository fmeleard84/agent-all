import { Controller, Post, Body, Get } from '@nestjs/common'
import { OrchestratorService } from './orchestrator.service'
import type { AgentEvent } from '@agent-all/types'

@Controller('orchestrator')
export class OrchestratorController {
  constructor(private readonly orchestratorService: OrchestratorService) {}

  @Post('events')
  async triggerEvent(@Body() event: AgentEvent) {
    await this.orchestratorService.handleEvent(event)
    return { status: 'ok' }
  }

  @Get('agents')
  listAgents() {
    return this.orchestratorService.getAgentRegistry().listAll()
  }
}
