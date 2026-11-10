const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
require('dotenv').config();

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT) || 4000;
const jwtSecret = process.env.JWT_SECRET;
const frontendOrigin = process.env.FRONTEND_ORIGIN;

if (!jwtSecret || Buffer.byteLength(jwtSecret, 'utf8') < 32) {
  throw new Error('JWT_SECRET must be set to a random secret of at least 32 bytes.');
}

if (!frontendOrigin) {
  throw new Error('FRONTEND_ORIGIN must be set to the frontend origin allowed to access this API.');
}

let parsedFrontendOrigin;
try {
  parsedFrontendOrigin = new URL(frontendOrigin);
} catch {
  throw new Error('FRONTEND_ORIGIN must be a valid HTTP or HTTPS origin.');
}

if (!['http:', 'https:'].includes(parsedFrontendOrigin.protocol) || parsedFrontendOrigin.origin !== frontendOrigin) {
  throw new Error('FRONTEND_ORIGIN must be a valid HTTP or HTTPS origin without a path or trailing slash.');
}

app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(helmet());
app.use(express.json());

const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
});

const accountSchema = z.object({
  name: z.string().trim().min(2),
  type: z.enum(['CHECKING', 'SAVINGS', 'INVESTMENT']).optional(),
  initialBalance: z.number().min(0).optional().default(0),
});

const ledgerSchema = z.object({
  accountId: z.string().trim().min(1),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL']),
  amount: z.number().positive(),
  description: z.string().trim().min(2),
});

function sanitizeUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function createToken(user) {
  return jwt.sign({ userId: user.id, role: user.role }, jwtSecret, { expiresIn: '7d' });
}

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail && !adminPassword) {
    return;
  }

  if (!adminEmail || !adminPassword) {
    throw new Error('Set both ADMIN_EMAIL and ADMIN_PASSWORD to provision the initial administrator.');
  }

  if (!z.string().email().safeParse(adminEmail).success) {
    throw new Error('ADMIN_EMAIL must be a valid email address.');
  }

  if (Buffer.byteLength(adminPassword, 'utf8') < 16) {
    throw new Error('ADMIN_PASSWORD must be at least 16 bytes.');
  }

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existingAdmin) {
    if (existingAdmin.role !== 'ADMIN') {
      throw new Error('ADMIN_EMAIL already belongs to a non-administrator account.');
    }
    return;
  }

  await prisma.user.create({
    data: {
      name: 'System Admin',
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: 'ADMIN',
    },
  });
}

async function seedDemoData() {
  const demoEmail = 'demo@balancevault.dev';

  const existingDemo = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (!existingDemo) {
    const demoUser = await prisma.user.create({
      data: {
        name: 'Demo Customer',
        email: demoEmail,
        passwordHash: await bcrypt.hash('demo123', 10),
        role: 'USER',
      },
    });

    const account = await prisma.account.create({
      data: {
        userId: demoUser.id,
        name: 'Primary Checking',
        type: 'CHECKING',
        balance: 2450,
        status: 'ACTIVE',
        currency: 'USD',
      },
    });

    await prisma.ledgerEntry.createMany({
      data: [
        { accountId: account.id, type: 'DEPOSIT', amount: 3000, description: 'Initial funding deposit' },
        { accountId: account.id, type: 'WITHDRAWAL', amount: 550, description: 'Subscription payment' },
      ],
    });
  }
}

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, jwtSecret);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to access this resource.' });
    }
    next();
  };
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'BalanceVault API' });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid registration payload.' });
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existingUser) {
      return res.status(409).json({ message: 'An account already exists for that email.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        role: 'USER',
      },
    });

    const token = createToken(user);
    res.status(201).json({
      message: 'Registration successful.',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Unable to complete registration.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid login payload.' });
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = createToken(user);
    res.json({ message: 'Login successful.', token, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Unable to log in.' });
  }
});

app.get('/api/users/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { accounts: true },
  });

  res.json({ user: sanitizeUser(user) });
});

app.get('/api/accounts', requireAuth, async (req, res) => {
  try {
    const accounts = req.user.role === 'ADMIN'
      ? await prisma.account.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } })
      : await prisma.account.findMany({
          where: { userId: req.user.id },
          orderBy: { createdAt: 'desc' },
        });

    res.json({ accounts });
  } catch (error) {
    console.error('Accounts error:', error);
    res.status(500).json({ message: 'Unable to fetch accounts.' });
  }
});

app.post('/api/accounts', requireAuth, async (req, res) => {
  try {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid account details.' });
    }

    const { name, type = 'CHECKING', initialBalance } = parsed.data;
    const account = await prisma.account.create({
      data: {
        userId: req.user.id,
        name,
        type,
        balance: initialBalance,
        status: 'PENDING',
        currency: 'USD',
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: 'ACCOUNT_CREATED',
        details: JSON.stringify({ accountId: account.id, name, initialBalance }),
      },
    });

    res.status(201).json({ message: 'Account submitted for onboarding review.', account });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ message: 'Unable to create account.' });
  }
});

app.get('/api/ledger', requireAuth, async (req, res) => {
  try {
    const entries = req.user.role === 'ADMIN'
      ? await prisma.ledgerEntry.findMany({
          include: { account: { include: { user: true } } },
          orderBy: { createdAt: 'desc' },
        })
      : await prisma.ledgerEntry.findMany({
          where: {
            account: {
              userId: req.user.id,
            },
          },
          include: { account: true },
          orderBy: { createdAt: 'desc' },
        });

    res.json({ entries });
  } catch (error) {
    console.error('Ledger error:', error);
    res.status(500).json({ message: 'Unable to fetch ledger operations.' });
  }
});

app.post('/api/ledger', requireAuth, async (req, res) => {
  try {
    const parsed = ledgerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid ledger request.' });
    }

    const { accountId, type, amount, description } = parsed.data;
    const account = await prisma.account.findUnique({ where: { id: accountId } });

    if (!account) {
      return res.status(404).json({ message: 'Account not found.' });
    }

    if (req.user.role !== 'ADMIN' && account.userId !== req.user.id) {
      return res.status(403).json({ message: 'You can only move funds on your own accounts.' });
    }

    const updatedBalance = type === 'DEPOSIT' ? account.balance + amount : account.balance - amount;
    if (updatedBalance < 0) {
      return res.status(400).json({ message: 'Insufficient funds for this withdrawal.' });
    }

    const [updatedAccount, entry] = await prisma.$transaction([
      prisma.account.update({
        where: { id: accountId },
        data: { balance: updatedBalance },
      }),
      prisma.ledgerEntry.create({
        data: {
          accountId,
          type,
          amount,
          description,
        },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: `LEDGER_${type}`,
        details: JSON.stringify({ accountId, amount, description, newBalance: updatedAccount.balance }),
      },
    });

    res.status(201).json({ message: 'Ledger entry created successfully.', entry, account: updatedAccount });
  } catch (error) {
    console.error('Ledger create error:', error);
    res.status(500).json({ message: 'Unable to process the ledger entry.' });
  }
});

app.get('/api/admin/users', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const users = await prisma.user.findMany({
    include: { accounts: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ users: users.map((user) => ({ ...sanitizeUser(user), accounts: user.accounts })) });
});

app.post('/api/admin/accounts/:id/approve', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const account = await prisma.account.findUnique({ where: { id: req.params.id } });

  if (!account) {
    return res.status(404).json({ message: 'Account not found.' });
  }

  const updated = await prisma.account.update({
    where: { id: account.id },
    data: { status: 'ACTIVE' },
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.id,
      action: 'ACCOUNT_APPROVED',
      details: JSON.stringify({ accountId: account.id, userId: account.userId }),
    },
  });

  res.json({ message: 'Account approved.', account: updated });
});

async function startServer() {
  await seedAdmin();
  await seedDemoData();
  app.listen(port, () => {
    console.log(`BalanceVault API running on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
