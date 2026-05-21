import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { Task, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';

export interface AiTaskSuggestion {
  title: string;
  description?: string;
  priority: string;
  estimatedHours?: number;
  subtasks?: string[];
}

export interface AiProjectInsight {
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  risks: string[];
  recommendations: string[];
  velocityTrend: string;
  completionPrediction?: string;
}

export interface AiMeetingSummary {
  summary: string;
  keyPoints: string[];
  actionItems: Array<{ task: string; assignee?: string; dueDate?: string }>;
  decisions: string[];
  nextSteps: string[];
}

export interface AiTranslationResult {
  translatedText: string;
  sourceLanguage: string;
  confidence: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI | null = null;
  private readonly anthropic: Anthropic | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const openaiKey = configService.get<string>('OPENAI_API_KEY');
    const anthropicKey = configService.get<string>('ANTHROPIC_API_KEY');

    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    } else {
      this.logger.warn('OPENAI_API_KEY not set — AI features disabled');
    }

    if (anthropicKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicKey });
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set — Anthropic features disabled');
    }
  }

  private requireOpenAI(): OpenAI {
    if (!this.openai) throw new ServiceUnavailableException('OpenAI is not configured on this server');
    return this.openai;
  }

  private requireAnthropic(): Anthropic {
    if (!this.anthropic) throw new ServiceUnavailableException('Anthropic is not configured on this server');
    return this.anthropic;
  }

  // ---- Task AI ----
  async generateTasksFromDescription(description: string, projectContext?: string): Promise<AiTaskSuggestion[]> {
    const completion = await this.requireOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a project management AI. Given a project description, generate actionable tasks.
Return a JSON array of tasks with: title, description, priority (URGENT/HIGH/MEDIUM/LOW), estimatedHours, subtasks (array of strings).
Generate 5-10 tasks that cover all aspects of the described work. Be specific and actionable.`,
        },
        {
          role: 'user',
          content: `${projectContext ? `Project context: ${projectContext}\n\n` : ''}Generate tasks for: ${description}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message.content ?? '{"tasks":[]}';
    const parsed = JSON.parse(content) as { tasks?: AiTaskSuggestion[] };
    return parsed.tasks ?? [];
  }

  async generateSubtasks(taskTitle: string, taskDescription?: string): Promise<string[]> {
    const completion = await this.requireOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Generate a list of specific subtasks for the given task. Return JSON: {"subtasks": ["subtask1", "subtask2", ...]}. Generate 3-7 subtasks.',
        },
        {
          role: 'user',
          content: `Task: ${taskTitle}${taskDescription ? `\nDescription: ${taskDescription}` : ''}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0]?.message.content ?? '{"subtasks":[]}') as { subtasks?: string[] };
    return parsed.subtasks ?? [];
  }

  async generateTaskDescription(title: string): Promise<string> {
    const completion = await this.requireOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Write a clear, professional task description in 2-3 sentences. Focus on the goal, acceptance criteria, and any important context.',
        },
        { role: 'user', content: `Write a description for this task: "${title}"` },
      ],
      max_tokens: 200,
    });

    return completion.choices[0]?.message.content ?? '';
  }

  // ---- Project AI ----
  async generateProjectInsights(projectId: string): Promise<AiProjectInsight> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          where: { deletedAt: null },
          select: { status: true, priority: true, dueDate: true, completedAt: true, estimatedHours: true, trackedHours: true },
        },
        members: { select: { userId: true } },
        sprints: { select: { startDate: true, endDate: true, isActive: true } },
      },
    });

    if (!project) throw new Error('Project not found');

    const taskStats = {
      total: project.tasks.length,
      done: project.tasks.filter((t) => t.status === 'DONE').length,
      inProgress: project.tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      overdue: project.tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE').length,
      urgent: project.tasks.filter((t) => t.priority === 'URGENT').length,
    };

    const completion = await this.requireOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a project analytics AI. Analyze project data and provide insights.
Return JSON: { summary, riskLevel: "low"|"medium"|"high", risks: [], recommendations: [], velocityTrend, completionPrediction }`,
        },
        {
          role: 'user',
          content: `Analyze project "${project.name}":
- Status: ${project.status}
- Progress: ${project.progress}%
- Tasks: ${taskStats.total} total, ${taskStats.done} done, ${taskStats.inProgress} in progress, ${taskStats.overdue} overdue, ${taskStats.urgent} urgent
- Team size: ${project.members.length}
- Target date: ${project.targetDate?.toISOString() ?? 'Not set'}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0]?.message.content ?? '{}') as AiProjectInsight;
    return {
      summary: parsed.summary ?? 'Unable to generate insights',
      riskLevel: parsed.riskLevel ?? 'low',
      risks: parsed.risks ?? [],
      recommendations: parsed.recommendations ?? [],
      velocityTrend: parsed.velocityTrend ?? 'stable',
      completionPrediction: parsed.completionPrediction,
    };
  }

  // ---- Document AI ----
  async generateDocumentContent(prompt: string, context?: string): Promise<string> {
    const message = await this.requireAnthropic().messages.create({
      model: 'claude-opus-4-7-20251101',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `${context ? `Context: ${context}\n\n` : ''}Write professional documentation for: ${prompt}

Format the response in clear markdown with appropriate headings, bullet points, and structure.`,
        },
      ],
    });

    const block = message.content[0];
    return block?.type === 'text' ? block.text : '';
  }

  async summarizeDocument(content: string): Promise<string> {
    const completion = await this.requireOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Summarize the following document in 3-5 sentences. Focus on key points and decisions.',
        },
        { role: 'user', content: content.slice(0, 8000) },
      ],
      max_tokens: 300,
    });

    return completion.choices[0]?.message.content ?? '';
  }

  // ---- Meeting AI ----
  async generateMeetingSummary(transcript: string, participants?: string[]): Promise<AiMeetingSummary> {
    const message = await this.requireAnthropic().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Analyze this meeting transcript and extract:
1. A brief summary (2-3 sentences)
2. Key discussion points
3. Action items with responsible person and due date if mentioned
4. Decisions made
5. Next steps

${participants ? `Participants: ${participants.join(', ')}\n\n` : ''}Transcript:
${transcript}

Return as JSON: { summary, keyPoints: [], actionItems: [{task, assignee?, dueDate?}], decisions: [], nextSteps: [] }`,
        },
      ],
    });

    const block = message.content[0];
    const text = block?.type === 'text' ? block.text : '{}';

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] ?? '{}') as AiMeetingSummary;
      return {
        summary: parsed.summary ?? '',
        keyPoints: parsed.keyPoints ?? [],
        actionItems: parsed.actionItems ?? [],
        decisions: parsed.decisions ?? [],
        nextSteps: parsed.nextSteps ?? [],
      };
    } catch {
      return { summary: text, keyPoints: [], actionItems: [], decisions: [], nextSteps: [] };
    }
  }

  // ---- Translation ----
  async translateText(text: string, targetLanguage: string, sourceLanguage = 'auto'): Promise<AiTranslationResult> {
    const completion = await this.requireOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the provided text to ${targetLanguage}.
Preserve formatting, tone, and nuances. Return JSON: { translatedText, sourceLanguage, confidence }`,
        },
        {
          role: 'user',
          content: `${sourceLanguage !== 'auto' ? `Source language: ${sourceLanguage}\n` : ''}Translate to ${targetLanguage}:\n\n${text}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0]?.message.content ?? '{}') as AiTranslationResult;
    return {
      translatedText: parsed.translatedText ?? text,
      sourceLanguage: parsed.sourceLanguage ?? 'unknown',
      confidence: parsed.confidence ?? 0.9,
    };
  }

  // ---- Transcription (Whisper) ----
  async transcribeAudio(audioBuffer: Buffer, language?: string): Promise<{ text: string; language: string }> {
    const file = new File([audioBuffer as unknown as BlobPart], 'audio.webm', { type: 'audio/webm' });

    const transcription = await this.requireOpenAI().audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language,
      response_format: 'verbose_json',
    });

    return {
      text: transcription.text,
      language: (transcription as { language?: string }).language ?? language ?? 'en',
    };
  }

  // ---- Chat assistant ----
  async chat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: { workspaceId?: string; userId?: string },
  ): Promise<string> {
    const systemPrompt = `You are Nexus AI, an intelligent assistant for the Nexus productivity platform.
You help users with:
- Creating and managing tasks, projects, and documents
- Analyzing project progress and team productivity
- Drafting communications and documents
- Answering questions about their workspace

Be concise, helpful, and proactive. When appropriate, suggest specific actions the user can take.`;

    const completion = await this.requireOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    return completion.choices[0]?.message.content ?? 'I apologize, I could not generate a response.';
  }

  // ---- Automation AI ----
  async suggestAutomations(workspaceId: string): Promise<Array<{ name: string; description: string; trigger: string; action: string }>> {
    const recentActivity = await this.prisma.activityLog.findMany({
      where: { organizationId: undefined },
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: { action: true, entityType: true },
    });

    const patterns = recentActivity.map((a) => `${a.action} on ${a.entityType}`).join(', ');

    const completion = await this.requireOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Based on workspace activity patterns, suggest 5 workflow automations. Return JSON: { automations: [{name, description, trigger, action}] }',
        },
        { role: 'user', content: `Recent activity patterns: ${patterns}` },
      ],
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0]?.message.content ?? '{"automations":[]}') as {
      automations?: Array<{ name: string; description: string; trigger: string; action: string }>;
    };
    return parsed.automations ?? [];
  }

  // ---- User Insights (dashboard widget) ----
  async getUserInsights(userId: string) {
    try {
      const [overdueTasks, dueSoon, completedThisWeek] = await Promise.all([
        this.prisma.task.count({
          where: { assigneeId: userId, deletedAt: null, dueDate: { lt: new Date() }, status: { notIn: ['DONE', 'CANCELLED'] } },
        }),
        this.prisma.task.count({
          where: { assigneeId: userId, deletedAt: null, dueDate: { gte: new Date(), lte: new Date(Date.now() + 7 * 86400_000) }, status: { notIn: ['DONE', 'CANCELLED'] } },
        }),
        this.prisma.task.count({
          where: { assigneeId: userId, deletedAt: null, status: 'DONE', completedAt: { gte: new Date(Date.now() - 7 * 86400_000) } },
        }),
      ]);

      const insights = [
        ...(overdueTasks > 0 ? [{ type: 'warning', title: `${overdueTasks} overdue task${overdueTasks > 1 ? 's' : ''}`, description: 'You have tasks past their due date. Review and update them.' }] : []),
        ...(dueSoon > 0 ? [{ type: 'tip', title: 'Upcoming deadlines', description: `${dueSoon} task${dueSoon > 1 ? 's' : ''} due in the next 7 days. Stay on track!` }] : []),
        { type: 'trend', title: completedThisWeek > 0 ? 'Good progress!' : 'Start completing tasks', description: completedThisWeek > 0 ? `You completed ${completedThisWeek} task${completedThisWeek > 1 ? 's' : ''} this week. Keep it up!` : 'No tasks completed this week yet. Pick a task and get started.' },
      ];

      return { insights: insights.slice(0, 3) };
    } catch {
      return {
        insights: [
          { type: 'tip', title: 'Focus time', description: 'Review your high-priority tasks and plan your week.' },
          { type: 'trend', title: 'Stay consistent', description: 'Consistent daily progress leads to better outcomes.' },
        ],
      };
    }
  }

  // ---- Productivity AI ----
  async generateProductivityReport(userId: string, period: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const startDate = this.getPeriodStartDate(period);

    const [tasksCompleted, tasksCreated, timeEntries, commentsCreated] = await Promise.all([
      this.prisma.task.count({
        where: { assigneeId: userId, status: 'DONE', completedAt: { gte: startDate }, deletedAt: null },
      }),
      this.prisma.task.count({ where: { creatorId: userId, createdAt: { gte: startDate }, deletedAt: null } }),
      this.prisma.timeEntry.aggregate({
        where: { userId, startTime: { gte: startDate }, endTime: { not: null } },
        _sum: { duration: true },
      }),
      this.prisma.taskComment.count({ where: { authorId: userId, createdAt: { gte: startDate }, deletedAt: null } }),
    ]);

    const totalHours = Math.round((timeEntries._sum.duration ?? 0) / 3600);

    const completion = await this.requireOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Generate an encouraging, actionable productivity report. Be specific and include suggestions.',
        },
        {
          role: 'user',
          content: `Generate productivity report for ${user?.displayName ?? 'the user'} for ${period}:
- Tasks completed: ${tasksCompleted}
- Tasks created: ${tasksCreated}
- Time tracked: ${totalHours} hours
- Comments/feedback given: ${commentsCreated}`,
        },
      ],
      max_tokens: 500,
    });

    return completion.choices[0]?.message.content ?? '';
  }

  // ---- RAG (Knowledge Base search) ----
  async searchKnowledgeBase(query: string, workspaceId: string): Promise<Array<{ content: string; sourceType: string; sourceId: string; score: number }>> {
    // Generate embedding for the query
    const embeddingResponse = await this.requireOpenAI().embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    const queryEmbedding = embeddingResponse.data[0]?.embedding;
    if (!queryEmbedding) return [];

    // In production, this would query Pinecone/Weaviate
    // For now, fall back to full-text search
    const results = await this.prisma.knowledgeBase.findMany({
      where: {
        workspaceId,
        content: { contains: query, mode: 'insensitive' },
      },
      take: 5,
    });

    return results.map((r) => ({
      content: r.content,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      score: 0.8, // Would be cosine similarity from vector DB
    }));
  }

  private getPeriodStartDate(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'quarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      default: return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }
}
