import { Controller, Get, Post, Put, Param, Body, UseGuards, Req } from '@nestjs/common'
import { CompanyService } from './company.service'
import { SupabaseAuthGuard } from '../auth/auth.guard'

@Controller('companies')
@UseGuards(SupabaseAuthGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  async listCompanies(@Req() req: any) {
    return this.companyService.findByUser(req.user.id)
  }

  @Post()
  async createCompany(@Req() req: any, @Body() body: { name: string }) {
    return this.companyService.create(body.name, req.user.id)
  }

  @Get(':id')
  async getCompany(@Param('id') id: string) {
    return this.companyService.findById(id)
  }

  @Put(':id')
  async updateCompany(@Param('id') id: string, @Body() body: any) {
    return this.companyService.update(id, body)
  }

  @Post(':id/agents')
  async enableAgent(
    @Param('id') companyId: string,
    @Body() body: { agentId: string; autonomyLevel?: number },
  ) {
    await this.companyService.enableAgent(companyId, body.agentId, body.autonomyLevel)
    return { status: 'ok' }
  }

  @Get(':id/agents')
  async getAgents(@Param('id') companyId: string) {
    return this.companyService.getCompanyAgents(companyId)
  }
}
