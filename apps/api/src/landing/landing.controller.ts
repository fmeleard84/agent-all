import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common'
import { LandingService } from './landing.service'
import { SupabaseAuthGuard } from '../auth/auth.guard'

@Controller('landing')
export class LandingController {
  constructor(private readonly landingService: LandingService) {}

  // Public endpoints (no auth) - for landing page form submissions
  @Post('newsletter')
  async submitNewsletter(@Body() body: { workspace_id: string; landing_slug: string; email: string }) {
    return this.landingService.submitNewsletter(body)
  }

  @Post('contact')
  async submitContact(
    @Body() body: {
      workspace_id: string
      landing_slug: string
      first_name: string
      last_name: string
      email: string
      phone?: string
      message: string
    },
  ) {
    return this.landingService.submitContact(body)
  }

  // Protected endpoint - for CRM view
  @Get('contacts/:workspaceId')
  @UseGuards(SupabaseAuthGuard)
  async getContacts(@Param('workspaceId') workspaceId: string) {
    return this.landingService.getContacts(workspaceId)
  }
}
