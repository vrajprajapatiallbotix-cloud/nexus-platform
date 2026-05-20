import { Injectable, Logger } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway.js';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  notifyUser(userId: string, event: string, data: unknown): void {
    this.gateway.broadcastToUser(userId, event, data);
  }

  notifyWorkspace(workspaceId: string, event: string, data: unknown): void {
    this.gateway.broadcastToWorkspace(workspaceId, event, data);
  }

  notifyTaskUpdate(task: { id: string; projectId?: string | null }, data: unknown): void {
    this.gateway.broadcastToWorkspace(task.projectId ?? '', 'task:updated', data);
  }
}
