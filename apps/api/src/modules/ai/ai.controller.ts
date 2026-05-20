import { Controller, Post, Get, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AiService } from './ai.service.js';

class GenerateTasksDto { description!: string; projectContext?: string; }
class GenerateSubtasksDto { title!: string; description?: string; }
class ChatDto { messages!: Array<{ role: 'user' | 'assistant'; content: string }>; workspaceId?: string; }
class TranslateDto { text!: string; targetLanguage!: string; sourceLanguage?: string; }
class GenerateDocumentDto { prompt!: string; context?: string; }
class SummarizeDocumentDto { content!: string; }
class ProductivityReportDto { period!: 'week' | 'month' | 'quarter'; }

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('tasks/generate')
  @ApiOperation({ summary: 'Generate tasks from a description using AI' })
  generateTasks(@Body() dto: GenerateTasksDto) {
    return this.aiService.generateTasksFromDescription(dto.description, dto.projectContext);
  }

  @Post('tasks/subtasks')
  @ApiOperation({ summary: 'Generate subtasks for a task using AI' })
  generateSubtasks(@Body() dto: GenerateSubtasksDto) {
    return this.aiService.generateSubtasks(dto.title, dto.description);
  }

  @Post('tasks/description')
  @ApiOperation({ summary: 'Auto-generate task description' })
  generateTaskDescription(@Body() dto: { title: string }) {
    return this.aiService.generateTaskDescription(dto.title);
  }

  @Get('projects/:id/insights')
  @ApiOperation({ summary: 'Get AI insights for a project' })
  getProjectInsights(@Param('id') projectId: string) {
    return this.aiService.generateProjectInsights(projectId);
  }

  @Post('chat')
  @ApiOperation({ summary: 'Chat with the AI assistant' })
  chat(@Body() dto: ChatDto, @CurrentUser('id') userId: string) {
    return this.aiService.chat(dto.messages, { userId, workspaceId: dto.workspaceId });
  }

  @Post('translate')
  @ApiOperation({ summary: 'Translate text using AI' })
  translate(@Body() dto: TranslateDto) {
    return this.aiService.translateText(dto.text, dto.targetLanguage, dto.sourceLanguage);
  }

  @Post('transcribe')
  @ApiOperation({ summary: 'Transcribe audio to text' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('audio'))
  transcribe(@UploadedFile() file: Express.Multer.File, @Body() body: { language?: string }) {
    return this.aiService.transcribeAudio(file.buffer, body.language);
  }

  @Post('documents/generate')
  @ApiOperation({ summary: 'Generate document content using AI' })
  generateDocument(@Body() dto: GenerateDocumentDto) {
    return this.aiService.generateDocumentContent(dto.prompt, dto.context);
  }

  @Post('documents/summarize')
  @ApiOperation({ summary: 'Summarize a document using AI' })
  summarizeDocument(@Body() dto: SummarizeDocumentDto) {
    return this.aiService.summarizeDocument(dto.content);
  }

  @Post('meetings/summary')
  @ApiOperation({ summary: 'Generate meeting summary from transcript' })
  generateMeetingSummary(@Body() dto: { transcript: string; participants?: string[] }) {
    return this.aiService.generateMeetingSummary(dto.transcript, dto.participants);
  }

  @Get('insights')
  @ApiOperation({ summary: 'Get AI-generated insights for the current user' })
  getInsights(@CurrentUser('id') userId: string) {
    return this.aiService.getUserInsights(userId);
  }

  @Get('productivity/report')
  @ApiOperation({ summary: 'Generate AI productivity report for current user' })
  getProductivityReport(@CurrentUser('id') userId: string, @Query('period') period: string) {
    return this.aiService.generateProductivityReport(userId, period ?? 'week');
  }

  @Get('workspace/:id/automation-suggestions')
  @ApiOperation({ summary: 'Get AI-suggested automations for a workspace' })
  getAutomationSuggestions(@Param('id') workspaceId: string) {
    return this.aiService.suggestAutomations(workspaceId);
  }

  @Get('knowledge/search')
  @ApiOperation({ summary: 'Semantic search in knowledge base' })
  searchKnowledge(@Query('q') query: string, @Query('workspaceId') workspaceId: string) {
    return this.aiService.searchKnowledgeBase(query, workspaceId);
  }
}
