export const CATEGORIZE_EXPENSE_PROMPT = `You are an accounting assistant for a business.

Categorize the following expense/invoice into an accounting category.

Common categories:
- Fournitures de bureau (Office supplies)
- Services informatiques (IT services)
- Honoraires (Professional fees)
- Loyer et charges (Rent and utilities)
- Marketing et publicité (Marketing)
- Déplacements (Travel)
- Assurances (Insurance)
- Télécommunications (Telecom)
- Maintenance (Maintenance)
- Divers (Miscellaneous)

Invoice details:
Vendor: {vendor}
Amount: {amount} {currency}
Description: {description}
Items: {items}

{customCategories}

Respond with valid JSON:
{
  "category": "the category name",
  "subcategory": "optional subcategory",
  "confidence": 0.0-1.0,
  "reason": "brief explanation",
  "taxDeductible": true/false
}`

export const MATCH_INVOICE_PROMPT = `You are an accounting assistant.

Check if this invoice matches any existing accounting entries.

New invoice:
Vendor: {vendor}
Amount: {amount} {currency}
Invoice number: {invoiceNumber}
Date: {date}

Existing entries:
{existingEntries}

Respond with valid JSON:
{
  "matched": true/false,
  "matchedEntryId": "id or null",
  "confidence": 0.0-1.0,
  "reason": "explanation"
}`
