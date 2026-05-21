import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Nexus Platform database...');

  // ---- Plans ----
  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { type: 'FREE' },
      update: {},
      create: {
        name: 'Free',
        type: 'FREE',
        description: 'Perfect for individuals and small teams getting started',
        price: 0,
        trialDays: 0,
        maxUsers: 5,
        maxProjects: 3,
        maxStorage: 1,
        maxAiCredits: 100,
        features: JSON.stringify(['5 members', '3 projects', '1GB storage', '100 AI credits/month', 'Basic task management', 'Chat']),
      },
    }),
    prisma.plan.upsert({
      where: { type: 'STARTER' },
      update: {},
      create: {
        name: 'Starter',
        type: 'STARTER',
        description: 'For growing teams that need more power',
        price: 12,
        yearlyPrice: 120,
        trialDays: 14,
        maxUsers: 25,
        maxProjects: 20,
        maxStorage: 50,
        maxAiCredits: 1000,
        features: JSON.stringify(['25 members', '20 projects', '50GB storage', '1000 AI credits/month', 'Full task management', 'CRM', 'Time tracking', 'Automations']),
        stripeProductId: process.env['STRIPE_STARTER_PRODUCT_ID'],
        stripePriceId: process.env['STRIPE_STARTER_MONTHLY_PRICE_ID'],
        stripeYearlyPriceId: process.env['STRIPE_STARTER_YEARLY_PRICE_ID'],
      },
    }),
    prisma.plan.upsert({
      where: { type: 'PRO' },
      update: {},
      create: {
        name: 'Pro',
        type: 'PRO',
        description: 'For professional teams requiring advanced features',
        price: 28,
        yearlyPrice: 280,
        trialDays: 14,
        maxUsers: 100,
        maxProjects: null, // Unlimited
        maxStorage: 200,
        maxAiCredits: 5000,
        features: JSON.stringify(['100 members', 'Unlimited projects', '200GB storage', '5000 AI credits/month', 'All Starter features', 'HR module', 'Advanced analytics', 'API access', 'Custom fields', 'Video meetings', 'AI translation']),
        stripeProductId: process.env['STRIPE_PRO_PRODUCT_ID'],
        stripePriceId: process.env['STRIPE_PRO_MONTHLY_PRICE_ID'],
        stripeYearlyPriceId: process.env['STRIPE_PRO_YEARLY_PRICE_ID'],
      },
    }),
    prisma.plan.upsert({
      where: { type: 'ENTERPRISE' },
      update: {},
      create: {
        name: 'Enterprise',
        type: 'ENTERPRISE',
        description: 'For large organizations with enterprise requirements',
        price: 0, // Custom pricing
        trialDays: 30,
        maxUsers: null, // Unlimited
        maxProjects: null,
        maxStorage: null,
        maxAiCredits: null,
        features: JSON.stringify(['Unlimited members', 'Unlimited projects', 'Unlimited storage', 'Unlimited AI credits', 'All Pro features', 'SSO/SAML', 'Custom integrations', 'Dedicated support', 'SLA guarantee', 'On-premise option', 'Custom branding']),
      },
    }),
  ]);

  console.log(`✅ Created ${plans.length} plans`);

  // ---- Demo organization & user ----
  const passwordHash = await bcrypt.hash('Demo123!', 12);

  // Manager (full access) — login: manager@nexus-demo.com / Demo123!
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@nexus-demo.com' },
    update: { role: 'SUPER_ADMIN', status: 'ACTIVE', emailVerified: true },
    create: {
      email: 'admin@nexus-demo.com',
      displayName: 'Admin',
      firstName: 'Admin',
      lastName: 'Nanta',
      passwordHash,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: 'ACTIVE',
      role: 'SUPER_ADMIN',
      onboardingCompleted: true,
      bio: 'Super Administrator — full platform access',
      timezone: 'America/New_York',
    },
  });

  // Manager alias account
  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@nexus-demo.com' },
    update: {},
    create: {
      email: 'manager@nexus-demo.com',
      displayName: 'Alex Johnson (Manager)',
      firstName: 'Alex',
      lastName: 'Johnson',
      passwordHash,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: 'ACTIVE',
      role: 'MANAGER',
      onboardingCompleted: true,
      bio: 'Platform manager — full access',
      timezone: 'America/New_York',
    },
  });

  // Team Lead (ADMIN role) — login: lead@nexus-demo.com / Demo123!
  const teamLeadUser = await prisma.user.upsert({
    where: { email: 'lead@nexus-demo.com' },
    update: {},
    create: {
      email: 'lead@nexus-demo.com',
      displayName: 'Sarah Chen (Team Lead)',
      firstName: 'Sarah',
      lastName: 'Chen',
      passwordHash,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: 'ACTIVE',
      role: 'ADMIN',
      onboardingCompleted: true,
      bio: 'Engineering team lead',
      timezone: 'America/Los_Angeles',
    },
  });

  // Employee — login: employee@nexus-demo.com / Demo123!
  const employeeUser = await prisma.user.upsert({
    where: { email: 'employee@nexus-demo.com' },
    update: {},
    create: {
      email: 'employee@nexus-demo.com',
      displayName: 'Marcus Williams (Employee)',
      firstName: 'Marcus',
      lastName: 'Williams',
      passwordHash,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: 'ACTIVE',
      role: 'MEMBER',
      onboardingCompleted: true,
      bio: 'Frontend developer',
      timezone: 'America/Chicago',
    },
  });

  const demoUsers = await Promise.all(
    [
      { email: 'sarah@nexus-demo.com', displayName: 'Sarah Chen', firstName: 'Sarah', lastName: 'Chen', role: 'ADMIN' as const },
      { email: 'marcus@nexus-demo.com', displayName: 'Marcus Williams', firstName: 'Marcus', lastName: 'Williams', role: 'MEMBER' as const },
      { email: 'priya@nexus-demo.com', displayName: 'Priya Patel', firstName: 'Priya', lastName: 'Patel', role: 'MEMBER' as const },
      { email: 'james@nexus-demo.com', displayName: 'James O\'Brien', firstName: 'James', lastName: 'O\'Brien', role: 'MEMBER' as const },
    ].map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: { role: u.role },
        create: {
          ...u,
          passwordHash,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          status: 'ACTIVE',
          onboardingCompleted: true,
        },
      }),
    ),
  );

  const allUsers = [adminUser, managerUser, teamLeadUser, employeeUser, ...demoUsers];
  console.log(`✅ Created ${allUsers.length} users`);
  console.log('   📌 Demo logins (password: Demo123!):');
  console.log('      Manager:   manager@nexus-demo.com');
  console.log('      Team Lead: lead@nexus-demo.com');
  console.log('      Employee:  employee@nexus-demo.com');

  // ---- Organization ----
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      description: 'A leading technology company',
      industry: 'Technology',
      size: '50-200',
      isVerified: true,
    },
  });

  // Add members to org — role mirrors user.role so RBAC is consistent
  const orgRoleFor = (user: { role: string }, isFirst: boolean): string => {
    if (isFirst) return 'SUPER_ADMIN';
    return user.role;
  };

  await Promise.all(
    allUsers.map((user, i) =>
      prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
        update: { role: orgRoleFor(user, i === 0) as any },
        create: {
          organizationId: org.id,
          userId: user.id,
          role: orgRoleFor(user, i === 0) as any,
          isOwner: i === 0,
        },
      }),
    ),
  );

  // ---- Subscription ----
  const proPlan = plans.find((p) => p.type === 'PRO')!;
  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      planId: proPlan.id,
      status: 'ACTIVE',
      interval: 'MONTHLY',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // ---- Workspace ----
  const workspace = await prisma.workspace.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'main' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Main Workspace',
      slug: 'main',
      isDefault: true,
      description: 'Primary workspace for Acme Corporation',
    },
  });

  await Promise.all(
    allUsers.map((user, i) =>
      prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
        update: {},
        create: {
          workspaceId: workspace.id,
          userId: user.id,
          role: i === 0 ? 'OWNER' : 'MEMBER',
        },
      }),
    ),
  );

  // ---- Demo project ----
  const project = await prisma.project.upsert({
    where: { workspaceId_key: { workspaceId: workspace.id, key: 'NEXUS' } },
    update: {},
    create: {
      workspaceId: workspace.id,
      ownerId: adminUser.id,
      name: 'Nexus Platform v2.0',
      key: 'NEXUS',
      description: 'Building the next generation of our productivity platform',
      status: 'ACTIVE',
      type: 'SCRUM',
      priority: 'HIGH',
      startDate: new Date(),
      targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      progress: 35,
    },
  });

  // ---- Demo tasks (idempotent: delete project tasks first, then recreate) ----
  await prisma.task.deleteMany({ where: { projectId: project.id } });

  const taskData = [
    // Manager account tasks
    { title: 'Review Q3 product roadmap', status: 'TODO' as const, priority: 'URGENT' as const, assigneeId: managerUser.id },
    { title: 'Security audit', status: 'TODO' as const, priority: 'URGENT' as const, assigneeId: managerUser.id },
    { title: 'Billing integration (Stripe)', status: 'IN_PROGRESS' as const, priority: 'HIGH' as const, assigneeId: managerUser.id },
    { title: 'Design system architecture', status: 'DONE' as const, priority: 'HIGH' as const, assigneeId: managerUser.id },
    // Team Lead account tasks
    { title: 'Implement authentication module', status: 'IN_PROGRESS' as const, priority: 'URGENT' as const, assigneeId: teamLeadUser.id },
    { title: 'Realtime collaboration engine', status: 'TODO' as const, priority: 'HIGH' as const, assigneeId: teamLeadUser.id },
    { title: 'Set up CI/CD pipeline', status: 'DONE' as const, priority: 'HIGH' as const, assigneeId: teamLeadUser.id },
    // Employee account tasks
    { title: 'Build task management UI', status: 'IN_PROGRESS' as const, priority: 'HIGH' as const, assigneeId: employeeUser.id },
    { title: 'AI integration & assistant', status: 'TODO' as const, priority: 'HIGH' as const, assigneeId: employeeUser.id },
    { title: 'Write unit tests for auth module', status: 'BACKLOG' as const, priority: 'MEDIUM' as const, assigneeId: employeeUser.id },
    // Shared / unassigned tasks
    { title: 'CRM module development', status: 'TODO' as const, priority: 'MEDIUM' as const, assigneeId: demoUsers[3]?.id },
    { title: 'HR module development', status: 'BACKLOG' as const, priority: 'MEDIUM' as const, assigneeId: null },
    { title: 'Mobile app development', status: 'BACKLOG' as const, priority: 'LOW' as const, assigneeId: null },
    { title: 'Performance optimization', status: 'BACKLOG' as const, priority: 'MEDIUM' as const, assigneeId: demoUsers[0]?.id },
  ];

  await Promise.all(
    taskData.map((data, i) =>
      prisma.task.create({
        data: {
          ...data,
          projectId: project.id,
          creatorId: adminUser.id,
          orderIndex: (i + 1) * 1000,
          estimatedHours: Math.floor(Math.random() * 40) + 4,
          dueDate: new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ),
  );

  console.log(`✅ Created ${taskData.length} demo tasks (manager: 4, lead: 3, employee: 3, shared: 4)`);

  // ---- Chat channels ----
  const channels = await Promise.all([
    prisma.channel.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: 'general' } },
      update: {},
      create: {
        workspaceId: workspace.id,
        name: 'general',
        type: 'PUBLIC',
        isDefault: true,
        description: 'General workspace discussions',
        createdBy: adminUser.id,
      },
    }),
    prisma.channel.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: 'engineering' } },
      update: {},
      create: {
        workspaceId: workspace.id,
        name: 'engineering',
        type: 'PUBLIC',
        description: 'Engineering team discussions',
        createdBy: adminUser.id,
      },
    }),
    prisma.channel.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: 'random' } },
      update: {},
      create: {
        workspaceId: workspace.id,
        name: 'random',
        type: 'PUBLIC',
        description: 'Off-topic conversations',
        createdBy: adminUser.id,
      },
    }),
  ]);

  // Add all users to general channel
  await Promise.all(
    allUsers.map((user) =>
      prisma.channelMember.upsert({
        where: { channelId_userId: { channelId: channels[0]!.id, userId: user.id } },
        update: {},
        create: { channelId: channels[0]!.id, userId: user.id },
      }),
    ),
  );

  console.log(`✅ Created ${channels.length} channels`);

  // ---- Feature flags ----
  await prisma.featureFlag.createMany({
    skipDuplicates: true,
    data: [
      { key: 'ai_assistant', name: 'AI Assistant', description: 'Enable the floating AI assistant', isEnabled: true },
      { key: 'ai_translation', name: 'AI Translation', description: 'Enable real-time AI translation', isEnabled: true },
      { key: 'voice_ai', name: 'Voice AI', description: 'Enable voice-to-text features', isEnabled: true },
      { key: 'video_meetings', name: 'Video Meetings', description: 'Enable WebRTC video meetings', isEnabled: true },
      { key: 'crm_module', name: 'CRM Module', description: 'Enable the CRM module', isEnabled: true },
      { key: 'hr_module', name: 'HR Module', description: 'Enable the HR module', isEnabled: true },
      { key: 'advanced_analytics', name: 'Advanced Analytics', description: 'Enable advanced analytics dashboard', isEnabled: true },
    ],
  });

  console.log('✅ Created feature flags');
  console.log('\n🎉 Database seeded successfully!');
  console.log('\nDemo credentials:');
  console.log('  Email:    admin@nexus-demo.com');
  console.log('  Password: Demo123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
