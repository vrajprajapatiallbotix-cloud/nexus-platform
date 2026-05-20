import { registerAs } from '@nestjs/config';

export const emailConfig = registerAs('email', () => ({
  from: process.env.EMAIL_FROM ?? 'noreply@nexusplatform.io',
  smtpHost: process.env.SMTP_HOST ?? 'localhost',
  smtpPort: parseInt(process.env.SMTP_PORT ?? '1025', 10),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpSecure: process.env.SMTP_SECURE === 'true',
  resendApiKey: process.env.RESEND_API_KEY,
}));
