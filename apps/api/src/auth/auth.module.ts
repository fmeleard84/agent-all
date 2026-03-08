import { Module, Global } from '@nestjs/common'
import { SupabaseAuthGuard } from './auth.guard'

@Global()
@Module({
  providers: [SupabaseAuthGuard],
  exports: [SupabaseAuthGuard],
})
export class AuthModule {}
