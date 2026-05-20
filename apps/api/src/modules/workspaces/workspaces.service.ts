import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.workspace.findUnique({ where: { id } });
  }

  findByOrganization(organizationId: string) {
    return this.prisma.workspace.findMany({ where: { organizationId } });
  }
}
