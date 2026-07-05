import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { CommerceValidationError } from "../lib/commerce.errors.js";

const PHONE_RE = /^\+?[\d\s\-()\\.]{7,20}$/;

export type ProfileDto = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  emailVerified: boolean;
  avatar: string | null;
  createdAt: string;
};

export type UpdateProfileInput = {
  name?: string;
  phone?: string | null;
  avatarUrl?: string | null;
};

export const profileService = {
  async getProfile(userId: string): Promise<ProfileDto> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        profile: { select: { avatarUrl: true } },
      },
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role as string,
      emailVerified: user.emailVerified,
      avatar: user.profile?.avatarUrl ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  },

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<ProfileDto> {
    const { name, phone, avatarUrl } = input;

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) throw new CommerceValidationError("name cannot be empty");
      if (trimmed.length > 100)
        throw new CommerceValidationError("name must be 100 characters or fewer");
    }

    if (phone !== undefined && phone !== null && phone.trim()) {
      if (!PHONE_RE.test(phone.trim()))
        throw new CommerceValidationError("phone must be a valid phone number");
    }

    if (avatarUrl !== undefined && avatarUrl !== null && avatarUrl.trim()) {
      try {
        new URL(avatarUrl);
      } catch {
        throw new CommerceValidationError("avatarUrl must be a valid URL");
      }
    }

    const userUpdate: Prisma.UserUpdateInput = {};
    if (name !== undefined) userUpdate.name = name.trim();
    if (phone !== undefined)
      userUpdate.phone = phone === null || !phone.trim() ? null : phone.trim();

    const ops: Prisma.PrismaPromise<unknown>[] = [];

    if (Object.keys(userUpdate).length > 0) {
      ops.push(prisma.user.update({ where: { id: userId }, data: userUpdate }));
    }

    if (avatarUrl !== undefined) {
      const normalizedUrl =
        avatarUrl === null || !avatarUrl.trim() ? null : avatarUrl.trim();
      ops.push(
        prisma.userProfile.upsert({
          where: { userId },
          create: { userId, avatarUrl: normalizedUrl },
          update: { avatarUrl: normalizedUrl },
        })
      );
    }

    if (ops.length > 0) await prisma.$transaction(ops);

    return this.getProfile(userId);
  },
};
