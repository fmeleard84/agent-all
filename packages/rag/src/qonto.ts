import type { QontoTransaction } from "@agent-all/types";

const BASE_URL = "https://thirdparty.qonto.com/v2";

export interface QontoClient {
  getOrganization(): Promise<any>;
  getBankAccounts(): Promise<any[]>;
  getTransactions(
    slug: string,
    options?: {
      per_page?: number;
      current_page?: number;
      status?: string;
      updated_at_from?: string;
      updated_at_to?: string;
    }
  ): Promise<QontoTransaction[]>;
}

function mapTransaction(raw: any): QontoTransaction {
  return {
    transactionId: raw.transaction_id ?? raw.id,
    amount: raw.amount,
    amountCents: raw.amount_cents,
    currency: raw.currency,
    side: raw.side,
    operationType: raw.operation_type,
    label: raw.label,
    settledAt: raw.settled_at,
    emittedAt: raw.emitted_at,
    status: raw.status,
    reference: raw.reference ?? undefined,
    category: raw.category ?? undefined,
  };
}

async function qontoFetch(
  login: string,
  apiKey: string,
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<any> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `${login}:${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Qonto API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

export function createQontoClient(
  login: string,
  apiKey: string
): QontoClient {
  return {
    async getOrganization() {
      const data = await qontoFetch(login, apiKey, "/organization");
      return data.organization;
    },

    async getBankAccounts() {
      const data = await qontoFetch(login, apiKey, "/organization");
      return data.organization.bank_accounts;
    },

    async getTransactions(slug, options = {}) {
      const params: Record<string, string | number | undefined> = {
        slug,
        per_page: options.per_page,
        current_page: options.current_page,
        status: options.status,
        updated_at_from: options.updated_at_from,
        updated_at_to: options.updated_at_to,
      };

      const data = await qontoFetch(login, apiKey, "/transactions", params);
      return (data.transactions ?? []).map(mapTransaction);
    },
  };
}

export async function fetchAllTransactions(
  login: string,
  apiKey: string
): Promise<QontoTransaction[]> {
  const client = createQontoClient(login, apiKey);
  const bankAccounts = await client.getBankAccounts();

  const allTransactions: QontoTransaction[] = [];

  for (const account of bankAccounts) {
    let currentPage = 1;
    const perPage = 100;

    while (true) {
      const transactions = await client.getTransactions(account.slug, {
        per_page: perPage,
        current_page: currentPage,
      });

      allTransactions.push(...transactions);

      if (transactions.length < perPage) {
        break;
      }

      currentPage++;
    }
  }

  return allTransactions;
}
