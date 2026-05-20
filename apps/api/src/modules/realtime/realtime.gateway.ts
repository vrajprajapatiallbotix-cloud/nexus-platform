import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service.js';

interface AuthenticatedSocket extends Socket {
  userId: string;
  workspaceId?: string;
}

interface PresenceData {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: string;
  currentWorkspaceId?: string;
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
})
@Injectable()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private readonly server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  private readonly PRESENCE_KEY = 'nexus:presence';
  private readonly USER_SOCKET_KEY = 'nexus:user_sockets';
  private readonly PRESENCE_TTL = 300; // 5 minutes

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(): void {
    this.logger.log('WebSocket gateway initialized');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) throw new WsException('No auth token');

      const payload = this.jwtService.verify<{ sub: string; email: string }>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, displayName: true, avatarUrl: true, status: true },
      });

      if (!user || user.status !== 'ACTIVE') throw new WsException('Unauthorized');

      (client as AuthenticatedSocket).userId = user.id;

      this.logger.debug(`Client connected: ${user.id} [${client.id}]`);
      client.emit('connected', { userId: user.id, socketId: client.id });
    } catch (err) {
      this.logger.warn(`Connection rejected: ${(err as Error).message}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    if (!client.userId) return;

    this.logger.debug(`Client disconnected: ${client.userId} [${client.id}]`);

    // Check if user has other active connections
    const rooms = [...client.rooms].filter((r) => r !== client.id);
    for (const room of rooms) {
      client.to(room).emit('user:left', { userId: client.userId, roomId: room });
    }

    // Mark user offline after a grace period (handled by Redis TTL)
    await this.updatePresence(client.userId, 'offline');
  }

  // ---- Workspace rooms ----
  @SubscribeMessage('workspace:join')
  async joinWorkspace(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { workspaceId: string },
  ) {
    const { workspaceId } = data;

    // Verify access
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: client.userId } },
    });
    if (!member) throw new WsException('Not a workspace member');

    await client.join(`workspace:${workspaceId}`);
    client.workspaceId = workspaceId;

    await this.updatePresence(client.userId, 'online', workspaceId);

    // Send current online users in this workspace
    const onlineUsers = await this.getWorkspacePresence(workspaceId);
    client.emit('workspace:presence', { workspaceId, users: onlineUsers });

    // Notify others
    client.to(`workspace:${workspaceId}`).emit('user:online', {
      userId: client.userId,
      workspaceId,
    });

    this.logger.debug(`${client.userId} joined workspace ${workspaceId}`);
  }

  @SubscribeMessage('workspace:leave')
  async leaveWorkspace(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { workspaceId: string },
  ) {
    await client.leave(`workspace:${data.workspaceId}`);
    client.to(`workspace:${data.workspaceId}`).emit('user:offline', {
      userId: client.userId,
      workspaceId: data.workspaceId,
    });
  }

  // ---- Channel rooms (chat) ----
  @SubscribeMessage('channel:join')
  async joinChannel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    const member = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId: data.channelId, userId: client.userId } },
    });
    if (!member) throw new WsException('Not a channel member');

    await client.join(`channel:${data.channelId}`);

    // Update last read
    await this.prisma.channelMember.update({
      where: { channelId_userId: { channelId: data.channelId, userId: client.userId } },
      data: { lastReadAt: new Date() },
    });

    client.emit('channel:joined', { channelId: data.channelId });
  }

  // ---- Typing indicators ----
  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    client.to(`channel:${data.channelId}`).emit('user:typing', {
      userId: client.userId,
      channelId: data.channelId,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    client.to(`channel:${data.channelId}`).emit('user:stopped_typing', {
      userId: client.userId,
      channelId: data.channelId,
    });
  }

  // ---- Document collaboration ----
  @SubscribeMessage('document:join')
  async joinDocument(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { documentId: string },
  ) {
    await client.join(`document:${data.documentId}`);
    const collaborators = await this.getDocumentCollaborators(data.documentId);

    client.emit('document:collaborators', { documentId: data.documentId, collaborators });
    client.to(`document:${data.documentId}`).emit('document:user_joined', {
      userId: client.userId,
      documentId: data.documentId,
    });
  }

  @SubscribeMessage('document:cursor')
  handleDocumentCursor(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { documentId: string; cursor: unknown },
  ) {
    client.to(`document:${data.documentId}`).emit('document:cursor_moved', {
      userId: client.userId,
      cursor: data.cursor,
    });
  }

  @SubscribeMessage('document:change')
  handleDocumentChange(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { documentId: string; change: unknown },
  ) {
    client.to(`document:${data.documentId}`).emit('document:changed', {
      userId: client.userId,
      change: data.change,
    });
  }

  // ---- Presence ----
  @SubscribeMessage('presence:update')
  async updateUserPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { status: 'online' | 'away' | 'busy' },
  ) {
    await this.updatePresence(client.userId, data.status, client.workspaceId);
    if (client.workspaceId) {
      client.to(`workspace:${client.workspaceId}`).emit('user:presence_updated', {
        userId: client.userId,
        status: data.status,
      });
    }
  }

  // ---- Task room for collaborative editing ----
  @SubscribeMessage('task:join')
  async joinTask(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { taskId: string },
  ) {
    await client.join(`task:${data.taskId}`);
    client.to(`task:${data.taskId}`).emit('task:user_viewing', { userId: client.userId });
  }

  // ---- Event handlers (emit to clients) ----
  @OnEvent('task.created')
  handleTaskCreated(payload: { task: { projectId?: string; id: string }; creatorId: string }) {
    if (payload.task.projectId) {
      this.server.to(`project:${payload.task.projectId}`).emit('task:created', payload.task);
    }
  }

  @OnEvent('task.updated')
  handleTaskUpdated(payload: { task: { projectId?: string; id: string } }) {
    this.server.to(`task:${payload.task.id}`).emit('task:updated', payload.task);
    if (payload.task.projectId) {
      this.server.to(`project:${payload.task.projectId}`).emit('task:updated', payload.task);
    }
  }

  @OnEvent('task.deleted')
  handleTaskDeleted(payload: { taskId: string }) {
    this.server.emit('task:deleted', { taskId: payload.taskId });
  }

  @OnEvent('task.comment_added')
  handleCommentAdded(payload: { comment: unknown; taskId: string }) {
    this.server.to(`task:${payload.taskId}`).emit('task:comment_added', payload);
  }

  @OnEvent('message.created')
  handleMessageCreated(payload: { message: { channelId: string } }) {
    this.server.to(`channel:${payload.message.channelId}`).emit('message:new', payload.message);
  }

  @OnEvent('notification.created')
  handleNotificationCreated(payload: { userId: string; notification: unknown }) {
    this.server.to(`user:${payload.userId}`).emit('notification:new', payload.notification);
  }

  // ---- Broadcast helpers ----
  broadcastToWorkspace(workspaceId: string, event: string, data: unknown): void {
    this.server.to(`workspace:${workspaceId}`).emit(event, data);
  }

  broadcastToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // ---- Private helpers ----
  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: string };
    const query = client.handshake.query as { token?: string };
    const header = client.handshake.headers.authorization;

    return auth.token ?? query.token ?? (header?.startsWith('Bearer ') ? header.slice(7) : null) ?? null;
  }

  private async updatePresence(userId: string, status: string, workspaceId?: string): Promise<void> {
    // Store in Redis with TTL
    const key = `${this.PRESENCE_KEY}:${userId}`;
    const data: PresenceData = {
      userId,
      displayName: '',
      status: status as PresenceData['status'],
      lastSeen: new Date().toISOString(),
      currentWorkspaceId: workspaceId,
    };
    // Would use injected Redis client here
    this.logger.debug(`Presence: ${userId} → ${status}`);
  }

  private async getWorkspacePresence(_workspaceId: string): Promise<PresenceData[]> {
    // Would scan Redis for workspace members' presence
    return [];
  }

  private async getDocumentCollaborators(documentId: string): Promise<string[]> {
    const sockets = await this.server.in(`document:${documentId}`).fetchSockets();
    return sockets.map((s) => (s.data as { userId?: string }).userId ?? '').filter(Boolean);
  }
}
