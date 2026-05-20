import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(workspaceId: string, includeProgress = false) {
    const projects = await this.prisma.project.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!includeProgress) return projects;

    return Promise.all(
      projects.map(async (p) => {
        const [total, completed] = await Promise.all([
          this.prisma.task.count({ where: { projectId: p.id } }),
          this.prisma.task.count({ where: { projectId: p.id, status: 'DONE' } }),
        ]);
        return { ...p, totalTasks: total, completedTasks: completed };
      }),
    );
  }

  findById(id: string) {
    return this.prisma.project.findUnique({ where: { id } });
  }
}
