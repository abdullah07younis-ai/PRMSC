import crypto from 'crypto';
import dotenv from 'dotenv';
import express, {type NextFunction, type Request, type Response} from 'express';
import fs from 'fs';
import path from 'path';
import {createServer as createViteServer} from 'vite';
import {
  createHistoryEntry,
  createIssuanceRecord,
  getPublicPortalState,
  hashPassword,
  loadStore,
  saveStore,
  verifyPassword,
} from './server/store.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length > 0
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

interface SessionPayload {
  login: string;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  adminLogin?: string;
}

function getEnvCredentials(): {login: string; password: string} | null {
  const password = process.env.PRMSC_ADMIN_PASSWORD?.trim();
  if (!password) {
    return null;
  }
  const login = process.env.PRMSC_ADMIN_LOGIN?.trim() || 'admin';
  return {login, password};
}

function signToken(login: string): string {
  const payload: SessionPayload = {
    login,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const [encoded, sig] = parts;
  if (!encoded || !sig) {
    return null;
  }
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.login || typeof payload.exp !== 'number' || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function constantTimeEquals(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a).digest();
  const digestB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({error: 'Authentication required. Please sign in.'});
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({error: 'Session expired or invalid. Please sign in again.'});
    return;
  }
  req.adminLogin = payload.login;
  next();
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({limit: '1mb'}));

  // Public auth status check
  app.get('/api/auth/status', (_req: Request, res: Response) => {
    const envCreds = getEnvCredentials();
    if (envCreds) {
      res.json({setupRequired: false, authMode: 'env'});
      return;
    }
    const store = loadStore();
    if (store.adminCredential) {
      res.json({setupRequired: false, authMode: 'local'});
      return;
    }
    res.json({setupRequired: true, authMode: 'setup'});
  });

  // First-run administrator setup (locks atomically once claimed or if env password is set)
  app.post('/api/auth/setup', (req: Request, res: Response) => {
    const envCreds = getEnvCredentials();
    if (envCreds) {
      res.status(409).json({error: 'Portal credentials are already configured via environment secrets.'});
      return;
    }
    const store = loadStore();
    if (store.adminCredential) {
      res.status(409).json({error: 'Administrator credentials have already been claimed.'});
      return;
    }

    const rawLogin = typeof req.body?.login === 'string' ? req.body.login.trim() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (rawLogin.length < 2 || rawLogin.length > 64) {
      res.status(400).json({error: 'Login ID must be between 2 and 64 characters.'});
      return;
    }
    if (rawPassword.length < 4 || rawPassword.length > 128) {
      res.status(400).json({error: 'Password must be between 4 and 128 characters.'});
      return;
    }

    const {salt, hash} = hashPassword(rawPassword);
    store.adminCredential = {
      login: rawLogin,
      salt,
      hash,
      createdAt: new Date().toISOString(),
    };
    saveStore(store);

    res.status(201).json({ok: true, login: rawLogin});
  });

  // Login verification
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const rawLogin = typeof req.body?.login === 'string' ? req.body.login.trim() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!rawLogin || !rawPassword) {
      res.status(400).json({error: 'Both login ID and password are required.'});
      return;
    }

    const envCreds = getEnvCredentials();
    if (envCreds) {
      const loginOk = constantTimeEquals(rawLogin.toLowerCase(), envCreds.login.toLowerCase());
      const passOk = constantTimeEquals(rawPassword, envCreds.password);
      if (!loginOk || !passOk) {
        res.status(401).json({error: 'Incorrect login ID or password. Access denied.'});
        return;
      }
      const token = signToken(envCreds.login);
      res.json({token, login: envCreds.login});
      return;
    }

    const store = loadStore();
    if (!store.adminCredential) {
      res.status(400).json({error: 'Portal administrator credentials have not been set up yet.'});
      return;
    }

    const loginMatches = constantTimeEquals(
      rawLogin.toLowerCase(),
      store.adminCredential.login.toLowerCase(),
    );
    const passwordMatches = verifyPassword(
      rawPassword,
      store.adminCredential.salt,
      store.adminCredential.hash,
    );

    if (!loginMatches || !passwordMatches) {
      res.status(401).json({error: 'Incorrect login ID or password. Access denied.'});
      return;
    }

    const token = signToken(store.adminCredential.login);
    res.json({token, login: store.adminCredential.login});
  });

  // Protected: Fetch full inventory, active issuances, and history
  app.get('/api/portal', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const store = loadStore();
    res.json(getPublicPortalState(store));
  });

  // Protected: Fix total quantities for all 6 hardware items
  app.post('/api/inventory/fix', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const quantities = req.body?.quantities;
    if (!quantities || typeof quantities !== 'object') {
      res.status(400).json({error: 'Quantities for all hardware items are required.'});
      return;
    }

    const store = loadStore();
    const pendingTotals: Record<string, number> = {};

    for (const item of store.items) {
      const val = Number((quantities as Record<string, unknown>)[item.id]);
      if (!Number.isInteger(val) || val < 0 || val > 100000) {
        res.status(400).json({
          error: `Total quantity for ${item.name} must be a whole number (0 or greater).`,
        });
        return;
      }
      if (val < item.issuedQuantity) {
        res.status(400).json({
          error: `Total quantity for ${item.name} cannot be less than currently issued units (${item.issuedQuantity}).`,
        });
        return;
      }
      pendingTotals[item.id] = val;
    }

    const totalSum = Object.values(pendingTotals).reduce((acc, n) => acc + n, 0);
    if (totalSum <= 0) {
      res.status(400).json({
        error: 'Please enter a total quantity of at least 1 unit across your laptops or desktops.',
      });
      return;
    }

    const isInitialFix = !store.quantitiesFixed;

    for (const item of store.items) {
      const nextTotal = pendingTotals[item.id];
      const delta = nextTotal - item.totalQuantity;
      item.totalQuantity = nextTotal;

      if (delta !== 0 || (isInitialFix && nextTotal > 0)) {
        const entry = createHistoryEntry(store, {
          action: 'Stock Updated',
          itemId: item.id,
          itemName: item.name,
          category: item.category,
          employeeName: req.adminLogin || 'Administrator',
          designation: 'PRMSC Asset Store',
          quantity: isInitialFix ? nextTotal : Math.abs(delta),
          remainingAvailable: item.totalQuantity - item.issuedQuantity,
          note: isInitialFix
            ? `Initial total quantity fixed at ${nextTotal} units`
            : delta > 0
              ? `Added ${delta} units to total stock (now ${nextTotal})`
              : `Reduced total stock by ${Math.abs(delta)} units (now ${nextTotal})`,
        });
        store.history.unshift(entry);
      }
    }

    store.quantitiesFixed = true;
    saveStore(store);
    res.json(getPublicPortalState(store));
  });

  // Protected: Add or adjust stock for a single hardware item
  app.post('/api/inventory/adjust', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const itemId = typeof req.body?.itemId === 'string' ? req.body.itemId : '';
    const mode = req.body?.mode === 'add' ? 'add' : 'set';
    const rawAmount = Number(req.body?.amount);

    if (!Number.isInteger(rawAmount) || rawAmount < 0 || rawAmount > 100000) {
      res.status(400).json({error: 'Stock quantity must be a valid whole number.'});
      return;
    }

    const store = loadStore();
    const item = store.items.find((it) => it.id === itemId);
    if (!item) {
      res.status(404).json({error: 'Selected hardware item was not found.'});
      return;
    }

    const nextTotal = mode === 'add' ? item.totalQuantity + rawAmount : rawAmount;
    if (mode === 'add' && rawAmount === 0) {
      res.status(400).json({error: 'Please enter at least 1 unit to add to stock.'});
      return;
    }
    if (nextTotal < item.issuedQuantity) {
      res.status(400).json({
        error: `Cannot set total below currently issued units (${item.issuedQuantity}).`,
      });
      return;
    }

    const delta = nextTotal - item.totalQuantity;
    item.totalQuantity = nextTotal;
    if (nextTotal > 0) {
      store.quantitiesFixed = true;
    }

    if (delta !== 0) {
      const entry = createHistoryEntry(store, {
        action: 'Stock Updated',
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        employeeName: req.adminLogin || 'Administrator',
        designation: 'PRMSC Asset Store',
        quantity: Math.abs(delta),
        remainingAvailable: item.totalQuantity - item.issuedQuantity,
        note:
          delta > 0
            ? `Added ${delta} units to stock (Total: ${nextTotal})`
            : `Updated total stock to ${nextTotal} units`,
      });
      store.history.unshift(entry);
    }

    saveStore(store);
    res.json(getPublicPortalState(store));
  });

  // Protected: Issue laptop or desktop to a PRMSC employee
  app.post('/api/issue', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const store = loadStore();
    if (!store.quantitiesFixed) {
      res.status(400).json({error: 'Fix total item quantities before issuing hardware.'});
      return;
    }

    const itemId = typeof req.body?.itemId === 'string' ? req.body.itemId : '';
    const employeeName =
      typeof req.body?.employeeName === 'string' ? req.body.employeeName.trim() : '';
    const designation =
      typeof req.body?.designation === 'string' ? req.body.designation.trim() : '';
    const quantity = Number(req.body?.quantity);
    const isPrmscEmployee = Boolean(req.body?.isPrmscEmployee);

    if (!isPrmscEmployee) {
      res.status(400).json({
        error: 'Items may only be issued to verified Punjab Rural Municipal Services Company employees.',
      });
      return;
    }
    if (employeeName.length < 2 || employeeName.length > 100) {
      res.status(400).json({error: 'Employee Name is required (at least 2 characters).'});
      return;
    }
    if (designation.length < 2 || designation.length > 100) {
      res.status(400).json({error: 'Employee Designation is required (at least 2 characters).'});
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      res.status(400).json({error: 'Quantity to issue must be a positive whole number.'});
      return;
    }

    const item = store.items.find((it) => it.id === itemId);
    if (!item) {
      res.status(404).json({error: 'Selected hardware type was not found.'});
      return;
    }

    const available = item.totalQuantity - item.issuedQuantity;
    if (quantity > available) {
      res.status(400).json({
        error: `Only ${available} unit${available === 1 ? '' : 's'} of ${item.name} currently available.`,
      });
      return;
    }

    item.issuedQuantity += quantity;
    const remainingAvailable = item.totalQuantity - item.issuedQuantity;

    const record = createIssuanceRecord(store, {
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      employeeName,
      designation,
      quantity,
    });
    store.issuances.unshift(record);

    const logEntry = createHistoryEntry(store, {
      action: 'Issued',
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      employeeName,
      designation,
      quantity,
      remainingAvailable,
      note: `Issued ${quantity} × ${item.name} (${record.id})`,
    });
    store.history.unshift(logEntry);

    saveStore(store);
    res.status(201).json(getPublicPortalState(store));
  });

  // Protected: Return an issued laptop or desktop back to inventory
  app.post('/api/return', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const issuanceId = typeof req.body?.issuanceId === 'string' ? req.body.issuanceId : '';
    const quantity = Number(req.body?.quantity);

    if (!Number.isInteger(quantity) || quantity < 1) {
      res.status(400).json({error: 'Return quantity must be a positive whole number.'});
      return;
    }

    const store = loadStore();
    const record = store.issuances.find((r) => r.id === issuanceId);
    if (!record) {
      res.status(404).json({error: 'Issuance record not found.'});
      return;
    }

    const outstanding = record.quantity - record.returnedQuantity;
    if (outstanding <= 0) {
      res.status(400).json({error: 'All units in this issuance record have already been returned.'});
      return;
    }
    if (quantity > outstanding) {
      res.status(400).json({
        error: `Cannot return ${quantity} unit(s); employee only holds ${outstanding}.`,
      });
      return;
    }

    const item = store.items.find((it) => it.id === record.itemId);
    if (!item) {
      res.status(404).json({error: 'Associated inventory item not found.'});
      return;
    }

    item.issuedQuantity = Math.max(0, item.issuedQuantity - quantity);
    record.returnedQuantity += quantity;
    record.lastReturnedAt = new Date().toISOString();
    record.status = record.returnedQuantity >= record.quantity ? 'Returned' : 'Partially Returned';

    const remainingAvailable = item.totalQuantity - item.issuedQuantity;

    const logEntry = createHistoryEntry(store, {
      action: 'Returned',
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      employeeName: record.employeeName,
      designation: record.designation,
      quantity,
      remainingAvailable,
      note: `Returned ${quantity} × ${item.name} (${record.id})`,
    });
    store.history.unshift(logEntry);

    saveStore(store);
    res.json(getPublicPortalState(store));
  });

  // Vite integration in development / static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.resolve(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PRMSC Asset Registry server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start PRMSC server:', err);
  process.exit(1);
});
