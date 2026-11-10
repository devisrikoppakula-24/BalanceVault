# Threats and controls

## Authentication
- Require strong password policies for production deployments.
- Use JWT secrets from environment variables only.
- Rotate tokens and add refresh-token rotation for production workloads.

## Authorization
- Enforce RBAC on every privileged route.
- Validate ownership wherever a user accesses accounts or ledger entries.

## Data integrity
- Use Prisma transactions for balance updates and ledger entries.
- Store audit records for every sensitive account action.

## Transport security
- Enforce HTTPS in production.
- Use secure cookies or bearer tokens with TLS only.

## Rate limiting
- Add Redis-backed rate limiting before production release.
- Monitor repeated failed login attempts and suspicious activity.
