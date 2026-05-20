import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { OrganizationsService } from './organizations.service.js';

class ChangeRoleDto { role!: string; }

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Get('members')
  getMembers(@CurrentUser('id') userId: string) {
    return this.orgsService.getMembers(userId);
  }

  @Patch('members/:userId/role')
  changeRole(
    @CurrentUser('id') requesterId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.orgsService.changeMemberRole(requesterId, targetUserId, dto.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orgsService.findById(id);
  }
}
