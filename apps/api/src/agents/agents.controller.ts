import { Controller, Get, Post, Param, Body } from '@nestjs/common'
import { PlannerService } from '../planner/planner.service'

@Controller('agents')
export class AgentsController {
  constructor(private readonly planner: PlannerService) {}

  @Post('plan')
  async createPlan(@Body() body: { goal: string; workspaceId: string; companyId: string }) {
    return this.planner.plan(body.goal, body.workspaceId, body.companyId)
  }

  @Post('execute')
  async executePlan(@Body() body: {
    plan: { id: string; agentId: string; goal: string; dependsOn: string[] }[]
    workspaceId: string
    companyId: string
    goal: string
  }) {
    const executionId = await this.planner.executePlan(body.plan, body.workspaceId, body.companyId, body.goal)
    return { workflowExecutionId: executionId }
  }

  @Get('execution/:id')
  async getStatus(@Param('id') id: string) {
    return this.planner.getExecutionStatus(id)
  }

  @Post('execution/:id/approve/:taskId')
  async approveTask(
    @Param('id') executionId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.planner.approveTask(taskId, executionId)
    return { status: 'approved' }
  }
}
