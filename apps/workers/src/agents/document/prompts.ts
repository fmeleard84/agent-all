export const DETECT_TYPE_PROMPT = `You are a document classification assistant for a business.

Analyze the following document information and classify it:
- invoice: A bill or payment request
- quote: A price quote or estimate
- contract: A legal agreement
- bank_statement: A bank account statement
- other: None of the above

Document name: {filename}
Document content (if available): {content}

Respond with valid JSON:
{
  "type": "invoice|quote|contract|bank_statement|other",
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}`

export const EXTRACT_DATA_PROMPT = `You are a data extraction assistant for business documents.

Extract structured data from this {documentType} document.

Document name: {filename}
Document content: {content}

For invoices, extract:
- vendor: company name
- invoiceNumber: invoice reference
- amount: total amount (number)
- currency: EUR, USD, etc.
- date: invoice date (YYYY-MM-DD)
- dueDate: payment due date (YYYY-MM-DD)
- items: list of line items

For quotes, extract:
- vendor, amount, currency, date, validUntil, items

For contracts, extract:
- parties, startDate, endDate, value, type

For bank_statements, extract:
- bank, accountNumber, period, balance, transactions count

Respond with valid JSON matching the document type.`
