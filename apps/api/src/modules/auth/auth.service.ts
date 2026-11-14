import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenType, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import type { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { resetPasswordMail, verifyEmailMail } from '../mail/mail.templates';
import type { LoginDto, RegisterDto } from './auth.dto';

const RESERVED = new Set(['admin', 'administrator', 'hrone', 'support', 'root', 'moderator', 'system', 'api', 'null', 'official']);

export const SELF_SELECT = {
  id: true,
  username: true,
  displayName: true,
  headline: true,
  bio: true,
  role: true,
  verification: true,
  emailVerifiedAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

const HOUR = 3_600_000;
const TOKEN_TTL: Record<AuthTokenType, number> = { EMAIL_VERIFY: 24 * HOUR, PASSWORD_RESET: HOUR };

export interface IssuedTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  /** Verified against when the account does not exist, to keep login timing uniform. */
  private dummyHash?: Promise<string>;
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const usernameLower = dto.username.toLowerCase();
    if (RESERVED.has(usernameLower)) throw new ConflictException('Username or email already in use');
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    try {
      const user = await this.prisma.user.create({
        data: { username: dto.username, usernameLower, email: dto.email, passwordHash, displayName: dto.displayName },
        select: SELF_SELECT,
      });
      void this.sendVerification(user.id, dto.email, user.displayName); // fire-and-forget: a mail outage must not block signup
      return { user, tokens: await this.issueTokens(user.id) };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Username or email already in use');
      }
      throw e;
    }
  }

  async login(dto: LoginDto) {
    const id = dto.identifier.toLowerCase();
    const found = await this.prisma.user.findFirst({
      where: { OR: [{ email: id }, { usernameLower: id }] },
      select: { ...SELF_SELECT, passwordHash: true, isActive: true },
    });
    this.dummyHash ??= argon2.hash('timing-equaliser', { type: argon2.argon2id });
    const ok = await argon2.verify(found?.passwordHash ?? (await this.dummyHash), dto.password).catch(() => false);
    if (!found || !ok || !found.isActive) throw new UnauthorizedException('Invalid credentials');
    const { passwordHash: _p, isActive: _a, ...user } = found;
    return { user, tokens: await this.issueTokens(user.id) };
  }

  /**
   * Refresh-token rotation with reuse detection:
   * every refresh revokes the presented token and issues a new one in the same family;
   * presenting an already-revoked token burns the whole family (stolen-token signal).
   */
  async refresh(raw: string | undefined) {
    if (!raw) throw new UnauthorizedException('Missing refresh token');
    const rec = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(raw) },
      include: { user: { select: { ...SELF_SELECT, isActive: true } } },
    });
    if (!rec) throw new UnauthorizedException('Invalid refresh token');
    if (rec.revokedAt) {
      await this.revokeFamily(rec.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (rec.expiresAt < new Date() || !rec.user.isActive) throw new UnauthorizedException('Refresh token expired');

    // Atomic claim: only one concurrent request can revoke this token.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: rec.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) {
      await this.revokeFamily(rec.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    const { isActive: _a, ...user } = rec.user;
    return { user, tokens: await this.issueTokens(rec.userId, rec.familyId) };
  }

  async logout(raw: string | undefined) {
    if (!raw) return;
    const rec = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(raw) }, select: { familyId: true } });
    if (rec) await this.revokeFamily(rec.familyId);
  }

  me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: SELF_SELECT });
  }

  private revokeFamily(familyId: string) {
    return this.prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async issueTokens(userId: string, familyId: string = randomUUID()): Promise<IssuedTokens> {
    const expiresIn = this.config.get('ACCESS_TTL_SECONDS', { infer: true });
    const accessToken = await this.jwt.signAsync({ sub: userId }, { expiresIn });
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + this.config.get('REFRESH_TTL_DAYS', { infer: true }) * 86_400_000);
    await this.prisma.refreshToken.create({
      data: { userId, familyId, tokenHash: sha256(refreshToken), expiresAt: refreshExpiresAt },
    });
    return { accessToken, expiresIn, refreshToken, refreshExpiresAt };
  }

  // ───────────── email verification & password reset ─────────────

  /** Issues a one-time link; any earlier unused link of the same type is invalidated. Only the hash is stored. */
  private async createLinkToken(userId: string, type: AuthTokenType): Promise<string> {
    const raw = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.authToken.create({ data: { userId, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + TOKEN_TTL[type]) } }),
    ]);
    return raw;
  }

  /** Atomically consumes a link token (single use, even under concurrent clicks). */
  private async consumeLinkToken(raw: string, type: AuthTokenType): Promise<string> {
    const rec = await this.prisma.authToken.findUnique({ where: { tokenHash: sha256(raw) } });
    const invalid = new BadRequestException({ message: 'الرابط غير صالح أو منتهي', code: 'INVALID_LINK' });
    if (!rec || rec.type !== type || rec.usedAt || rec.expiresAt < new Date()) throw invalid;
    const claimed = await this.prisma.authToken.updateMany({ where: { id: rec.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count === 0) throw invalid;
    return rec.userId;
  }

  private webUrl(path: string, token: string) {
    return `${this.config.get('WEB_ORIGIN', { infer: true }).replace(/\/$/, '')}${path}?token=${encodeURIComponent(token)}`;
  }

  private async sendVerification(userId: string, email: string, name: string) {
    try {
      const token = await this.createLinkToken(userId, 'EMAIL_VERIFY');
      await this.mail.send({ to: email, ...verifyEmailMail(name, this.webUrl('/verify-email', token)) });
    } catch (e) {
      this.log.error(`verification mail failed: ${(e as Error).message}`);
    }
  }

  async resendVerification(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, displayName: true, emailVerifiedAt: true } });
    if (u.emailVerifiedAt) return { alreadyVerified: true };
    await this.sendVerification(userId, u.email, u.displayName);
    return { sent: true };
  }

  async verifyEmail(token: string) {
    const userId = await this.consumeLinkToken(token, 'EMAIL_VERIFY');
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    return { verified: true };
  }

  /** Always answers the same way so the endpoint cannot be used to discover which emails are registered. */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true, email: true, displayName: true, isActive: true } });
    if (user?.isActive) {
      void (async () => {
        try {
          const token = await this.createLinkToken(user.id, 'PASSWORD_RESET');
          await this.mail.send({ to: user.email, ...resetPasswordMail(user.displayName, this.webUrl('/reset-password', token)) });
        } catch (e) {
          this.log.error(`reset mail failed: ${(e as Error).message}`);
        }
      })();
    }
    return { sent: true };
  }

  /** Sets a new password, then kills every session (a leaked old password or stolen cookie stops working). */
  async resetPassword(token: string, password: string) {
    const userId = await this.consumeLinkToken(token, 'PASSWORD_RESET');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.prisma.$transaction([
      // Reaching this link proves control of the mailbox, so it also verifies the address.
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash, emailVerifiedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { reset: true };
  }
}
