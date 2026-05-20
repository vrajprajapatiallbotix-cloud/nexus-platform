import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { TasksService } from './tasks.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { TaskFiltersDto } from './dto/task-filters.dto.js';

class AddCommentDto { content!: string; parentId?: string; }
class AddDependencyDto { blockingId!: string; }
class BulkUpdateDto { ids!: string[]; data!: Partial<UpdateTaskDto>; }
class ReorderDto { orderedIds!: string[]; }

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a task' })
  create(@Body() dto: CreateTaskDto, @CurrentUser('id') userId: string) {
    return this.tasksService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List tasks with filters' })
  findAll(@Query() filters: TaskFiltersDto, @CurrentUser('id') userId: string, @CurrentUser('role') userRole: string) {
    return this.tasksService.findAll(filters, userId, userRole);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my assigned tasks' })
  getMyTasks(@CurrentUser('id') userId: string, @Query() filters: Partial<TaskFiltersDto>) {
    return this.tasksService.getMyTasks(userId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.tasksService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @CurrentUser('id') userId: string) {
    return this.tasksService.update(id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a task' })
  delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.tasksService.delete(id, userId);
  }

  @Post('bulk-update')
  @ApiOperation({ summary: 'Bulk update tasks' })
  bulkUpdate(@Body() dto: BulkUpdateDto, @CurrentUser('id') userId: string) {
    return this.tasksService.bulkUpdate(dto.ids, dto.data, userId);
  }

  @Post(':id/reorder')
  @ApiOperation({ summary: 'Reorder tasks within a project' })
  reorder(@Param('id') projectId: string, @Body() dto: ReorderDto) {
    return this.tasksService.reorder(projectId, dto.orderedIds);
  }

  @Post(':id/dependencies')
  @ApiOperation({ summary: 'Add a task dependency' })
  addDependency(@Param('id') taskId: string, @Body() dto: AddDependencyDto) {
    return this.tasksService.addDependency(taskId, dto.blockingId);
  }

  @Delete(':id/dependencies/:blockingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDependency(@Param('id') taskId: string, @Param('blockingId') blockingId: string) {
    return this.tasksService.removeDependency(taskId, blockingId);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get task comments' })
  getComments(@Param('id') taskId: string) {
    return this.tasksService.getComments(taskId);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to a task' })
  addComment(@Param('id') taskId: string, @Body() dto: AddCommentDto, @CurrentUser('id') userId: string) {
    return this.tasksService.addComment(taskId, dto.content, userId, dto.parentId);
  }

  @Post(':id/watch')
  @ApiOperation({ summary: 'Toggle watch on a task' })
  toggleWatch(@Param('id') taskId: string, @CurrentUser('id') userId: string) {
    return this.tasksService.toggleWatch(taskId, userId);
  }
}
