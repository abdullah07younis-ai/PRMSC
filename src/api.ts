import type {AuthStatusResponse, LoginResponse, PortalState} from './types';

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as {error?: string} & T;
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function getAuthStatus(): Promise<AuthStatusResponse> {
  const res = await fetch('/api/auth/status');
  return parseJson<AuthStatusResponse>(res);
}

export async function setupAdminCredentials(
  login: string,
  password: string,
): Promise<{ok: boolean; login: string}> {
  const res = await fetch('/api/auth/setup', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({login, password}),
  });
  return parseJson<{ok: boolean; login: string}>(res);
}

export async function loginAdmin(login: string, password: string): Promise<LoginResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({login, password}),
  });
  return parseJson<LoginResponse>(res);
}

function authHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchPortalState(token: string): Promise<PortalState> {
  const res = await fetch('/api/portal', {
    headers: {Authorization: `Bearer ${token}`},
  });
  return parseJson<PortalState>(res);
}

export async function fixTotalQuantities(
  token: string,
  quantities: Record<string, number>,
): Promise<PortalState> {
  const res = await fetch('/api/inventory/fix', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({quantities}),
  });
  return parseJson<PortalState>(res);
}

export async function adjustItemStock(
  token: string,
  itemId: string,
  mode: 'add' | 'set',
  amount: number,
): Promise<PortalState> {
  const res = await fetch('/api/inventory/adjust', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({itemId, mode, amount}),
  });
  return parseJson<PortalState>(res);
}

export async function issueHardware(
  token: string,
  payload: {
    itemId: string;
    employeeName: string;
    designation: string;
    quantity: number;
    isPrmscEmployee: boolean;
  },
): Promise<PortalState> {
  const res = await fetch('/api/issue', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return parseJson<PortalState>(res);
}

export async function returnHardware(
  token: string,
  issuanceId: string,
  quantity: number,
): Promise<PortalState> {
  const res = await fetch('/api/return', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({issuanceId, quantity}),
  });
  return parseJson<PortalState>(res);
}
