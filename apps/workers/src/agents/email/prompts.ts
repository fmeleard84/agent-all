export const CLASSIFY_EMAIL_PROMPT = `You are an email classification assistant for a business.

Classify the following email into one of these categories:
- invoice: Contains or relates to an invoice, bill, or payment request
- prospect: A potential business lead or sales opportunity
- support: A customer support request or complaint
- info: General information, newsletter, or notification
- spam: Unsolicited or irrelevant email

Email subject: {subject}
Email from: {from}
Email content:
{content}

Respond with valid JSON:
{
  "category": "invoice|prospect|support|info|spam",
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}`

export const DRAFT_REPLY_PROMPT = `You are a professional business assistant.

Draft a reply to the following email. Be polite, professional, and concise.

Original email:
From: {from}
Subject: {subject}
Content: {content}

Company context: {companyName}

Respond with valid JSON:
{
  "subject": "Re: original subject",
  "body": "the reply text",
  "tone": "professional|friendly|formal"
}`
