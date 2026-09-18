// api/index.ts
import express20 from "express";
import cors from "cors";
import dotenv2 from "dotenv";
import fs from "fs";
import path from "path";

// api/_server/routes/auth.ts
import express from "express";
import bcrypt from "bcryptjs";
import jwt2 from "jsonwebtoken";

// api/_server/middleware/authMiddleware.ts
import jwt from "jsonwebtoken";
var authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  const secret = process.env.JWT_SECRET || "supersecretkeyshouldbeenv";
  if (!token) return res.sendStatus(401);
  jwt.verify(token, secret, (err, user) => {
    if (err) {
      console.error("[AUTH] JWT Verification failed:", err.message);
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};
var requireParentSession = (req, res, next) => {
  if (req.user?.act === "child") {
    return res.status(403).json({
      error: "Switch back to the parent profile to do this.",
      code: "PARENT_SESSION_REQUIRED"
    });
  }
  next();
};

// api/_server/db.ts
import { PrismaClient } from "@prisma/client";
var prisma = new PrismaClient();
var db_default = prisma;

// api/_server/utils/family.ts
var CHILD_EMAIL_DOMAIN = "profiles.akshara.local";
var childEmailFor = (id) => `child.${id}@${CHILD_EMAIL_DOMAIN}`;
var MAX_PROFILES = 10;
async function billingAccountId(userId) {
  const u = await db_default.user.findUnique({ where: { id: userId }, select: { parentId: true } });
  return u?.parentId || userId;
}
async function activeChildren(parentId) {
  return db_default.user.findMany({
    where: { parentId, archivedAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      avatar: true,
      grade: true,
      gradeSyllabus: true,
      birthday: true,
      xp: true,
      coins: true,
      createdAt: true,
      profileCompleted: true
    }
  });
}
var EXTRA_CHILD_CENTS = 4500;
var familyPriceCents = (unitCents, seats) => unitCents + EXTRA_CHILD_CENTS * Math.max(0, seats - 1);
async function seatCountFor(userId) {
  const u = await db_default.user.findUnique({ where: { id: userId }, select: { role: true, parentId: true } });
  if (!u || u.role !== "parent") return 1;
  const n = await db_default.user.count({ where: { parentId: userId, archivedAt: null } });
  return Math.max(1, n);
}
var SUB_SELECT = {
  id: true,
  parentId: true,
  isSubscribed: true,
  subscriptionInterval: true,
  subscriptionStartDate: true,
  subscriptionEndDate: true,
  subscriptionLevel: true,
  subscribedSyllabus: true,
  cancelAtPeriodEnd: true,
  questsPlayed: true,
  questsCreated: true,
  subscriptionSeats: true
};
async function effectiveSubscription(userId) {
  const own = await db_default.user.findUnique({ where: { id: userId }, select: SUB_SELECT });
  if (!own) return null;
  if (!own.parentId) {
    return {
      billingId: own.id,
      isSubscribed: own.isSubscribed,
      subscriptionInterval: own.subscriptionInterval,
      subscriptionStartDate: own.subscriptionStartDate,
      subscriptionEndDate: own.subscriptionEndDate,
      subscriptionLevel: own.subscriptionLevel,
      subscribedSyllabus: own.subscribedSyllabus,
      cancelAtPeriodEnd: own.cancelAtPeriodEnd,
      questsPlayed: own.questsPlayed,
      questsCreated: own.questsCreated,
      seats: own.subscriptionSeats,
      seatIndex: null,
      seatCovered: true,
      isChild: false,
      parentId: null
    };
  }
  const parent = await db_default.user.findUnique({ where: { id: own.parentId }, select: SUB_SELECT });
  if (!parent) {
    return {
      billingId: own.id,
      isSubscribed: false,
      subscriptionInterval: null,
      subscriptionStartDate: null,
      subscriptionEndDate: null,
      subscriptionLevel: null,
      subscribedSyllabus: null,
      cancelAtPeriodEnd: false,
      questsPlayed: own.questsPlayed,
      questsCreated: own.questsCreated,
      seats: 0,
      seatIndex: null,
      seatCovered: false,
      isChild: true,
      parentId: own.parentId
    };
  }
  const siblings = await db_default.user.findMany({
    where: { parentId: parent.id, archivedAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true }
  });
  const seatIndex = siblings.findIndex((s) => s.id === own.id);
  const seatCovered = seatIndex >= 0 && seatIndex < parent.subscriptionSeats;
  return {
    billingId: parent.id,
    isSubscribed: parent.isSubscribed && seatCovered,
    subscriptionInterval: parent.subscriptionInterval,
    subscriptionStartDate: parent.subscriptionStartDate,
    subscriptionEndDate: parent.subscriptionEndDate,
    subscriptionLevel: parent.subscriptionLevel,
    subscribedSyllabus: parent.subscribedSyllabus,
    cancelAtPeriodEnd: parent.cancelAtPeriodEnd,
    questsPlayed: parent.questsPlayed,
    questsCreated: parent.questsCreated,
    seats: parent.subscriptionSeats,
    seatIndex: seatIndex < 0 ? null : seatIndex,
    seatCovered,
    isChild: true,
    parentId: parent.id
  };
}
async function countFreeQuest(userId) {
  const billingId = await billingAccountId(userId);
  await db_default.user.update({ where: { id: billingId }, data: { questsPlayed: { increment: 1 } } });
}

// api/_server/middleware/checkExpiredSubscriptions.ts
async function checkExpiredSubscriptions(req, res, next) {
  if (!req.user?.id) {
    return next();
  }
  try {
    const billingId = await billingAccountId(req.user.id);
    const user = await db_default.user.findUnique({
      where: { id: billingId },
      select: {
        isSubscribed: true,
        cancelAtPeriodEnd: true,
        subscriptionEndDate: true
      }
    });
    if (!user) {
      return next();
    }
    const now = /* @__PURE__ */ new Date();
    const endDate = user.subscriptionEndDate;
    const userIdShort = req.user.id ? String(req.user.id).substring(0, 8) : "unknown";
    console.log(`[SUBSCRIPTION CHECK] User: ${userIdShort}...`);
    console.log(`[SUBSCRIPTION CHECK] isSubscribed: ${user.isSubscribed}, endDate: ${endDate?.toISOString() || "null"}`);
    console.log(`[SUBSCRIPTION CHECK] Current time: ${now.toISOString()}`);
    if (user.isSubscribed && endDate && now > endDate) {
      console.log(`[SUBSCRIPTION] \u26A0\uFE0F EXPIRING SUBSCRIPTION - End date passed!`);
      console.log(`[SUBSCRIPTION] End date was: ${endDate.toISOString()}, Current time: ${now.toISOString()}`);
      await db_default.user.update({
        where: { id: billingId },
        data: {
          isSubscribed: false,
          cancelAtPeriodEnd: false
        }
      });
      req.user.isSubscribed = false;
      console.log(`[SUBSCRIPTION] \u2705 Subscription cancelled for user: ${userIdShort}...`);
    } else if (user.isSubscribed && endDate) {
      const timeLeft = endDate.getTime() - now.getTime();
      const daysLeft = Math.floor(timeLeft / (1e3 * 60 * 60 * 24));
      console.log(`[SUBSCRIPTION CHECK] \u2705 Active - ${daysLeft} days remaining`);
    }
    next();
  } catch (error) {
    console.error("[SUBSCRIPTION] Error checking expired subscriptions:", error);
    next();
  }
}

// api/_server/utils/referral.ts
var DEFAULT_TIERS = [
  { minCount: 1, maxCount: 25, amountCents: 1e4, splitMonths: 2 },
  { minCount: 26, maxCount: 100, amountCents: 2e4, splitMonths: 4 },
  { minCount: 101, maxCount: 150, amountCents: 3e4, splitMonths: 5 },
  { minCount: 151, maxCount: null, amountCents: 5e4, splitMonths: 5 }
];
var getSetting = async (key2, fallback) => {
  try {
    const row = await db_default.appSetting.findUnique({ where: { key: key2 } });
    return row?.value ?? fallback;
  } catch {
    return fallback;
  }
};
var isTieredEnabled = async () => await getSetting("referral.tiered", "true") === "true";
var getTiers = async () => {
  try {
    const rows = await db_default.referralTier.findMany({ orderBy: { sortOrder: "asc" } });
    if (rows.length) {
      return rows.map((r) => ({ minCount: r.minCount, maxCount: r.maxCount, amountCents: r.amountCents, splitMonths: r.splitMonths }));
    }
  } catch (e) {
    console.warn(`[REFERRAL] Tier lookup failed (${e.message}); using defaults`);
  }
  return DEFAULT_TIERS;
};
var tierFor = (tiers, tiered, paidCount) => {
  if (!tiered || tiers.length === 0) return tiers[0] ?? DEFAULT_TIERS[0];
  return tiers.find((t) => paidCount >= t.minCount && (t.maxCount === null || paidCount <= t.maxCount)) ?? tiers[tiers.length - 1];
};
var addMonths = (d, n) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};
var releaseDueInstalments = async (userId) => {
  try {
    const due = await db_default.referralInstalment.findMany({
      where: { creditedAt: null, dueDate: { lte: /* @__PURE__ */ new Date() }, earning: { referrerId: userId } }
    });
    let total = 0;
    for (const inst of due) {
      const claimed = await db_default.referralInstalment.updateMany({
        where: { id: inst.id, creditedAt: null },
        data: { creditedAt: /* @__PURE__ */ new Date() }
      });
      if (claimed.count === 0) continue;
      await db_default.user.update({ where: { id: userId }, data: { referralCreditCents: { increment: inst.amountCents } } });
      total += inst.amountCents;
    }
    if (total > 0) console.log(`[REFERRAL] Released RM${(total / 100).toFixed(2)} of due instalments to ${userId}`);
    return total;
  } catch (e) {
    console.error("[REFERRAL] releaseDueInstalments failed:", e.message);
    return 0;
  }
};
var grantReferralEarning = async (referrerId, referredUserId) => {
  const existing = await db_default.referralEarning.findUnique({ where: { referredUserId } });
  if (existing) return existing;
  const [tiers, tiered, priorCount] = await Promise.all([
    getTiers(),
    isTieredEnabled(),
    db_default.referralEarning.count({ where: { referrerId } })
  ]);
  const tier = tierFor(tiers, tiered, priorCount + 1);
  const n = Math.max(1, tier.splitMonths);
  const base = Math.floor(tier.amountCents / n);
  const now = /* @__PURE__ */ new Date();
  const instalments = Array.from({ length: n }, (_, i) => ({
    dueDate: addMonths(now, i),
    amountCents: i === n - 1 ? tier.amountCents - base * (n - 1) : base,
    // remainder on the last
    creditedAt: i === 0 ? now : null
  }));
  const earning = await db_default.referralEarning.create({
    data: {
      referrerId,
      referredUserId,
      tierAmountCents: tier.amountCents,
      splitMonths: n,
      instalments: { create: instalments }
    }
  });
  await db_default.user.update({ where: { id: referrerId }, data: { referralCreditCents: { increment: instalments[0].amountCents } } });
  console.log(`[REFERRAL] Conversion #${priorCount + 1} for ${referrerId}: RM${(tier.amountCents / 100).toFixed(2)} over ${n} month(s); RM${(instalments[0].amountCents / 100).toFixed(2)} credited now`);
  return earning;
};
var settleReferralGrant = async (payerId) => {
  try {
    const payer = await db_default.user.findUnique({
      where: { id: payerId },
      select: { referredById: true, referralRewardGranted: true }
    });
    if (!payer?.referredById || payer.referralRewardGranted) return;
    const referrer = await db_default.user.findUnique({ where: { id: payer.referredById }, select: { id: true } });
    if (referrer) {
      await grantReferralEarning(referrer.id, payerId);
    } else {
      console.warn(`[REFERRAL] Referrer ${payer.referredById} not found; flagging ${payerId} to avoid retries.`);
    }
    await db_default.user.update({ where: { id: payerId }, data: { referralRewardGranted: true } });
  } catch (e) {
    console.error("[REFERRAL] settleReferralGrant failed:", e.message);
  }
};
var referralStatsFor = async (userId) => {
  const [earnings, tiers, tiered] = await Promise.all([
    db_default.referralEarning.findMany({ where: { referrerId: userId }, include: { instalments: true } }),
    getTiers(),
    isTieredEnabled()
  ]);
  let totalEarnedCents = 0, creditedCents = 0, pendingCents = 0;
  let nextDue = null;
  for (const e of earnings) {
    totalEarnedCents += e.tierAmountCents;
    for (const i of e.instalments) {
      if (i.creditedAt) creditedCents += i.amountCents;
      else {
        pendingCents += i.amountCents;
        if (!nextDue || i.dueDate < nextDue) nextDue = i.dueDate;
      }
    }
  }
  const paidReferrals = earnings.length;
  return {
    paidReferrals,
    tier: tierFor(tiers, tiered, paidReferrals + 1),
    // what the NEXT conversion pays
    tiered,
    totalEarnedCents,
    creditedCents,
    pendingCents,
    nextDue
  };
};

// api/_server/services/mailService.ts
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();
var transporter = nodemailer.createTransport({
  host: process.env.GMAIL_SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.GMAIL_SMTP_PORT) || 465,
  secure: process.env.GMAIL_SMTP_SECURE === "true",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});
console.log(`[MAIL CONFIG] Loaded User: ${process.env.GMAIL_USER}`);
var pass = process.env.GMAIL_PASS || "";
console.log(`[MAIL CONFIG] Loaded Pass: ${pass.substring(0, 3)}...${pass.substring(pass.length - 3)} (Length: ${pass.length})`);
transporter.verify((error, success) => {
  if (error) {
    console.error("[MAIL CONFIG] \u274C Connection error:", error.message);
  } else {
    console.log("[MAIL CONFIG] \u2705 Server is ready to take our messages");
  }
});
var sendOTPEmail = async (email, code) => {
  const mailOptions = {
    from: `"Akshara LearnQuest" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Your Akshara LearnQuest Verification Code",
    html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #ff8c00; text-align: center;">Welcome to Akshara LearnQuest!</h2>
                <p>Thank you for joining our learning community. Please use the verification code below to activate your account:</p>
                <div style="background: #f8f9fa; padding: 30px; text-align: center; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff8c00;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 5px; color: #007bff;">${code}</span>
                </div>
                <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;" />
                <p style="font-size: 11px; color: #999; text-align: center;">
                    Akshara LearnQuest - Gamified Learning for Malaysia<br/>
                    Powered by @Akshara LearnQuest Team
                </p>
            </div>
        `
  };
  if (!process.env.GMAIL_USER) {
    console.log(`[MAIL MOCK] \u{1F6E1}\uFE0F Email sending mocked for local dev.`);
    console.log(`[MAIL MOCK] \u{1F4E7} To: ${email}`);
    console.log(`[MAIL MOCK] \u{1F511} OTP Code: ${code}`);
    return true;
  }
  try {
    console.log(`[MAIL] Attempting to send OTP to ${email}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAIL] \u2705 Email successfully sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("[MAIL] \u274C Error sending email:", error.message);
    if (error.code === "EAUTH") {
      console.error("[MAIL] Authentication failed. Check GMAIL_USER and GMAIL_PASS (App Password).");
    } else if (error.code === "ESOCKET") {
      console.error("[MAIL] Network/Socket error. Check firewall or SMTP port settings.");
    }
    return false;
  }
};
var sendWelcomeEmail = async (email, name, tempPassword2) => {
  const appUrl = process.env.FRONTEND_URL || "https://akshara-music-hub.vercel.app";
  const mailOptions = {
    from: `"Akshara LearnQuest" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Your Akshara LearnQuest account is ready",
    html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #ff8c00; text-align: center;">Welcome to Akshara LearnQuest, ${name}!</h2>
                <p>An account has been created for you Powered by Akshara Fine Arts. Log in with the details below and change your password from your profile afterwards.</p>
                <div style="background: #f8f9fa; padding: 24px; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff8c00;">
                    <p style="margin: 0 0 8px 0;"><b>Email:</b> ${email}</p>
                    <p style="margin: 0;"><b>Temporary password:</b> <span style="font-family: monospace; font-size: 18px; color: #007bff;">${tempPassword2}</span></p>
                </div>
                <p style="text-align: center;"><a href="${appUrl}" style="display: inline-block; background: #ff8c00; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Log in now</a></p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;" />
                <p style="font-size: 11px; color: #999; text-align: center;">
                    Akshara LearnQuest - Gamified Learning for Malaysia<br/>
                    Powered by @Akshara LearnQuest Team
                </p>
            </div>
        `
  };
  if (!process.env.GMAIL_USER) {
    console.log(`[MAIL MOCK] \u{1F6E1}\uFE0F Email sending mocked for local dev.`);
    console.log(`[MAIL MOCK] \u{1F4E7} To: ${email}`);
    console.log(`[MAIL MOCK] \u{1F511} Temp Password: ${tempPassword2}`);
    return true;
  }
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAIL] \u2705 Welcome email sent to ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[MAIL] \u274C Welcome email to ${email} failed:`, error.message);
    return false;
  }
};
var sendPasswordResetEmail = async (email, otp) => {
  const mailOptions = {
    from: `"Akshara LearnQuest" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Reset Your Akshara LearnQuest Password",
    html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #ff8c00; text-align: center;">Password Reset Request</h2>
                <p>We received a request to reset your Akshara LearnQuest password. Use the code below to proceed:</p>
                <div style="background: #f8f9fa; padding: 30px; text-align: center; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff8c00;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 5px; color: #007bff;">${otp}</span>
                </div>
                <p>This code will expire in <strong>10 minutes</strong>. If you did not request a password reset, please ignore this email \u2014 your account remains secure.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;" />
                <p style="font-size: 11px; color: #999; text-align: center;">
                    Akshara LearnQuest - Gamified Learning for Malaysia<br/>
                    Powered by @Akshara LearnQuest Team
                </p>
            </div>
        `
  };
  if (!process.env.GMAIL_USER) {
    console.log(`[MAIL MOCK] \u{1F6E1}\uFE0F Email sending mocked for local dev.`);
    console.log(`[MAIL MOCK] \u{1F4E7} To: ${email}`);
    console.log(`[MAIL MOCK] \u{1F511} Reset OTP: ${otp}`);
    return true;
  }
  try {
    console.log(`[MAIL] Attempting to send password reset OTP to ${email}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAIL] \u2705 Password reset email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("[MAIL] \u274C Error sending password reset email:", error.message);
    return false;
  }
};

// api/_server/utils/seasonScore.ts
var effectiveStatus = (season, now) => {
  if (season.status === "finalized") return "finalized";
  if (now < season.startDate) return "upcoming";
  if (now <= season.endDate) return "active";
  return "ended";
};
var seasonScores = async (start, end) => {
  const results = await db_default.result.findMany({
    where: { date: { gte: start, lte: end }, user: { role: "student", archivedAt: null } },
    select: { userId: true, score: true, xpAwarded: true, grade: true }
  });
  const totals = /* @__PURE__ */ new Map();
  for (const r of results) {
    const pts = r.grade === null && r.xpAwarded === 0 ? r.score : r.xpAwarded;
    totals.set(r.userId, (totals.get(r.userId) || 0) + pts);
  }
  return Array.from(totals.entries()).map(([userId, points]) => ({ userId, points })).sort((a, b) => b.points - a.points);
};
var getActiveSeason = async (now) => {
  const seasons = await db_default.season.findMany({
    where: {
      status: { not: "finalized" },
      startDate: { lte: now },
      endDate: { gte: now }
    },
    orderBy: { startDate: "desc" }
  });
  return seasons[0] || null;
};
var getUserSeasonXp = async (userId, now) => {
  const season = await getActiveSeason(now);
  if (!season) return 0;
  const results = await db_default.result.findMany({
    where: { userId, date: { gte: season.startDate, lte: season.endDate } },
    select: { score: true, xpAwarded: true, grade: true }
  });
  let total = 0;
  for (const r of results) {
    total += r.grade === null && r.xpAwarded === 0 ? r.score : r.xpAwarded;
  }
  return total;
};

// api/_server/utils/ageGrade.ts
var GATE_LENIENCY = 1;
var isMusicSyllabus = (syllabus) => syllabus === "Western Music" || syllabus === "Carnatic Music" || syllabus === "Hindustani Music" || syllabus === "Indian Music";
var schoolAge = (birthday, now) => now.getUTCFullYear() - birthday.getUTCFullYear();
var clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
var FORM_6 = "Form 6 (STPM)";
var formName = (n) => n >= 6 ? FORM_6 : `Form ${n}`;
var expectedGradeFor = (syllabus, birthday, now) => {
  if (isMusicSyllabus(syllabus)) return null;
  const a = schoolAge(birthday, now);
  if (!Number.isFinite(a)) return null;
  switch (syllabus) {
    case "Cambridge IGCSE":
    case "International Baccalaureate (IB)":
      return `Year ${clamp(a - 5, 1, 13)}`;
    case "Unified Examination Certificate (UEC)":
      return formName(clamp(a - 12, 1, 6));
    case "Singapore National Curriculum":
      if (a < 7) return "Standard 1";
      if (a <= 12) return `Standard ${a - 6}`;
      return `Secondary ${Math.min(a - 12, 5)}`;
    case "Malaysia National Curriculum":
    default:
      if (a < 7) return "Standard 1";
      if (a <= 12) return `Standard ${a - 6}`;
      if (a <= 17) return formName(a - 12);
      return FORM_6;
  }
};

// api/_server/routes/auth.ts
var router = express.Router();
var JWT_SECRET = process.env.JWT_SECRET || "supersecretkeyshouldbeenv";
var parseBirthday = (value) => {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (isNaN(date.getTime())) return null;
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
};
var ADMIN_EMAILS = /* @__PURE__ */ new Set([
  "khlee030314@gmail.com"
]);
var isAdminEmail = (email) => ADMIN_EMAILS.has(email.trim().toLowerCase());
router.post("/signup", async (req, res) => {
  const { name, email, password, grade, syllabus, birthday, phone, referralCode } = req.body;
  const role = "student";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Please provide a valid email address" });
  }
  const parsedBirthday = parseBirthday(birthday);
  if (!parsedBirthday) {
    return res.status(400).json({ error: "Please provide a valid date of birth (YYYY-MM-DD)" });
  }
  const age = schoolAge(parsedBirthday, /* @__PURE__ */ new Date());
  if (age < 4 || age > 100) {
    return res.status(400).json({ error: "Please provide a valid date of birth" });
  }
  try {
    const existingUser = await db_default.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "This email is already registered. Please login instead." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(1e5 + Math.random() * 9e5).toString();
    let referredById = null;
    if (referralCode && typeof referralCode === "string") {
      const normalized = referralCode.trim().toUpperCase();
      if (normalized) {
        const referrer = await db_default.user.findUnique({ where: { referralCode: normalized } });
        if (referrer && referrer.email !== email) {
          referredById = referrer.id;
        }
      }
    }
    await db_default.pendingUser.upsert({
      where: { email },
      update: {
        name,
        password: hashedPassword,
        role,
        grade: grade || null,
        syllabus: syllabus || null,
        birthday: parsedBirthday,
        parentPhone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
        referredById,
        verificationCode
      },
      create: {
        name,
        email,
        password: hashedPassword,
        role,
        grade: grade || null,
        syllabus: syllabus || null,
        birthday: parsedBirthday,
        parentPhone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
        referredById,
        verificationCode
      }
    });
    const emailSent = await sendOTPEmail(email, verificationCode);
    if (!emailSent) {
      console.error(`[AUTH] Failed to send email to ${email}. Code was: ${verificationCode}`);
      return res.status(500).json({
        error: "Verification email could not be sent. Please contact support or try again later.",
        debug: process.env.NODE_ENV === "development" ? `Code: ${verificationCode}` : void 0
      });
    }
    res.json({ message: "Verification code sent to your email", email });
  } catch (error) {
    console.error("[AUTH] signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/verify", async (req, res) => {
  const { email, code } = req.body;
  try {
    const pendingUser = await db_default.pendingUser.findUnique({ where: { email } });
    if (!pendingUser) {
      const registeredUser = await db_default.user.findUnique({ where: { email } });
      if (registeredUser) {
        return res.status(400).json({ error: "Email already verified. Please login." });
      }
      return res.status(404).json({ error: "No pending registration found for this email." });
    }
    if (pendingUser.verificationCode !== code) {
      return res.status(400).json({ error: "Invalid verification code" });
    }
    const user = await db_default.user.create({
      data: {
        name: pendingUser.name,
        email: pendingUser.email,
        password: pendingUser.password,
        role: pendingUser.role,
        grade: pendingUser.grade,
        gradeSyllabus: pendingUser.syllabus,
        birthday: pendingUser.birthday,
        parentPhone: pendingUser.parentPhone,
        referredById: pendingUser.referredById,
        isVerified: true,
        isAdmin: isAdminEmail(pendingUser.email)
      }
    });
    await db_default.pendingUser.delete({ where: { email } });
    const token = jwt2.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        grade: user.grade,
        gradeSyllabus: user.gradeSyllabus,
        birthday: user.birthday ? user.birthday.toISOString().slice(0, 10) : null,
        avatar: user.avatar,
        profileCompleted: user.profileCompleted,
        isAdmin: user.isAdmin,
        isSubscribed: user.isSubscribed,
        subscriptionInterval: user.subscriptionInterval,
        subscriptionStartDate: user.subscriptionStartDate,
        subscriptionEndDate: user.subscriptionEndDate,
        subscriptionLevel: user.subscriptionLevel,
        subscribedSyllabus: user.subscribedSyllabus,
        cancelAtPeriodEnd: user.cancelAtPeriodEnd,
        questsPlayed: user.questsPlayed,
        questsCreated: user.questsCreated,
        language: user.language,
        lastSeenSeasonId: user.lastSeenSeasonId
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/resend-otp", async (req, res) => {
  const { email } = req.body;
  try {
    const pendingUser = await db_default.pendingUser.findUnique({ where: { email } });
    if (!pendingUser) {
      const user = await db_default.user.findUnique({ where: { email } });
      if (user) return res.status(400).json({ error: "Email already verified." });
      return res.status(404).json({ error: "User not found" });
    }
    const verificationCode = Math.floor(1e5 + Math.random() * 9e5).toString();
    await db_default.pendingUser.update({
      where: { email },
      data: { verificationCode }
    });
    const emailSent = await sendOTPEmail(email, verificationCode);
    res.json({ message: "New verification code sent. If email fails, check server/otp_test_fallback.txt", email });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/login", async (req, res) => {
  const { identifier, email, password } = req.body;
  const loginId = identifier || email;
  try {
    const user = await db_default.user.findFirst({
      where: {
        // Child profiles (parentId set) have no login of their own.
        parentId: null,
        OR: [
          { email: loginId },
          { name: loginId }
        ]
      },
      include: { _count: { select: { results: true } } }
    });
    if (!user) {
      const pending = await db_default.pendingUser.findUnique({ where: { email: loginId } });
      if (pending) {
        return res.status(403).json({
          error: "Your email is not verified. Please check your email for the code.",
          needsVerification: true,
          email: pending.email
        });
      }
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log(`[AUTH] Login failed: Invalid password for ${loginId}`);
      return res.status(400).json({ error: "Invalid credentials" });
    }
    let isAdmin = user.isAdmin;
    if (isAdminEmail(user.email) && !user.isAdmin) {
      await db_default.user.update({ where: { id: user.id }, data: { isAdmin: true } });
      isAdmin = true;
      console.log(`[AUTH] Promoted ${user.email} to admin`);
    }
    const token = jwt2.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    const seasonXp = await getUserSeasonXp(user.id, /* @__PURE__ */ new Date());
    const familyProfiles = user.role === "parent" ? await db_default.user.count({ where: { parentId: user.id, archivedAt: null } }) : 0;
    res.json({
      token,
      user: {
        subscriptionSeats: user.subscriptionSeats,
        familyProfiles,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        grade: user.grade,
        gradeSyllabus: user.gradeSyllabus,
        birthday: user.birthday ? user.birthday.toISOString().slice(0, 10) : null,
        avatar: user.avatar,
        profileCompleted: user.profileCompleted,
        xp: user.xp,
        seasonXp,
        lifetimeXp: user.xp,
        level: Math.floor(seasonXp / 1e3) + 1,
        coins: user.coins,
        isSubscribed: user.isSubscribed,
        subscriptionInterval: user.subscriptionInterval,
        subscriptionStartDate: user.subscriptionStartDate,
        subscriptionEndDate: user.subscriptionEndDate,
        subscriptionLevel: user.subscriptionLevel,
        subscribedSyllabus: user.subscribedSyllabus,
        cancelAtPeriodEnd: user.cancelAtPeriodEnd,
        isAdmin,
        questsPlayed: user.questsPlayed,
        questsCreated: user.questsCreated,
        completedQuizzes: user._count.results,
        language: user.language,
        lastSeenSeasonId: user.lastSeenSeasonId
      }
    });
  } catch (error) {
    console.error("[AUTH] Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/me", authenticateToken, checkExpiredSubscriptions, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    await releaseDueInstalments(userId);
    const user = await db_default.user.findUnique({
      where: { id: userId },
      include: { _count: { select: { results: true } } }
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    let isAdmin = user.isAdmin;
    if (isAdminEmail(user.email) && !user.isAdmin) {
      await db_default.user.update({ where: { id: user.id }, data: { isAdmin: true } });
      isAdmin = true;
    }
    const seasonXp = await getUserSeasonXp(user.id, /* @__PURE__ */ new Date());
    const sub = await effectiveSubscription(user.id);
    const familyProfiles = user.role === "parent" ? await db_default.user.count({ where: { parentId: user.id, archivedAt: null } }) : 0;
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        grade: user.grade,
        gradeSyllabus: user.gradeSyllabus,
        birthday: user.birthday ? user.birthday.toISOString().slice(0, 10) : null,
        avatar: user.avatar,
        profileCompleted: user.profileCompleted,
        xp: user.xp,
        seasonXp,
        lifetimeXp: user.xp,
        coins: user.coins,
        level: Math.floor(seasonXp / 1e3) + 1,
        isSubscribed: sub ? sub.isSubscribed : user.isSubscribed,
        subscriptionInterval: sub ? sub.subscriptionInterval : user.subscriptionInterval,
        subscriptionStartDate: sub ? sub.subscriptionStartDate : user.subscriptionStartDate,
        subscriptionEndDate: sub ? sub.subscriptionEndDate : user.subscriptionEndDate,
        subscriptionLevel: sub ? sub.subscriptionLevel : user.subscriptionLevel,
        subscribedSyllabus: sub ? sub.subscribedSyllabus : user.subscribedSyllabus,
        cancelAtPeriodEnd: sub ? sub.cancelAtPeriodEnd : user.cancelAtPeriodEnd,
        subscriptionSeats: sub ? sub.seats : user.subscriptionSeats,
        seatCovered: sub ? sub.seatCovered : true,
        isAdmin,
        questsPlayed: sub ? sub.questsPlayed : user.questsPlayed,
        questsCreated: user.questsCreated,
        completedQuizzes: user._count.results,
        language: user.language,
        lastSeenSeasonId: user.lastSeenSeasonId,
        parentId: user.parentId ?? null,
        isChildProfile: !!user.parentId,
        actingAsChild: req.user?.act === "child",
        familyProfiles
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
  try {
    const user = await db_default.user.findUnique({ where: { email } });
    if (!user || user.parentId) {
      return res.status(404).json({ error: "No account found with that email address." });
    }
    const otp = Math.floor(1e5 + Math.random() * 9e5).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1e3);
    await db_default.user.update({
      where: { email },
      data: {
        resetPasswordOtp: otp,
        resetPasswordOtpExpiry: expiry
      }
    });
    const emailSent = await sendPasswordResetEmail(email, otp);
    if (!emailSent) {
      return res.status(500).json({ error: "Failed to send reset email. Please try again." });
    }
    console.log(`[AUTH] Password reset OTP sent to ${email}`);
    res.json({ message: "Password reset code sent to your email.", email });
  } catch (error) {
    console.error("[AUTH] forgot-password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/verify-reset-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });
  try {
    const user = await db_default.user.findUnique({ where: { email } });
    if (!user || !user.resetPasswordOtp || !user.resetPasswordOtpExpiry) {
      return res.status(400).json({ error: "No password reset request found. Please request a new code." });
    }
    if (user.resetPasswordOtp !== otp) {
      return res.status(400).json({ error: "Invalid reset code. Please try again." });
    }
    if (/* @__PURE__ */ new Date() > user.resetPasswordOtpExpiry) {
      return res.status(400).json({ error: "Reset code has expired. Please request a new one." });
    }
    const resetToken = jwt2.sign(
      { id: user.id, purpose: "password_reset" },
      JWT_SECRET,
      { expiresIn: "5m" }
    );
    res.json({ message: "OTP verified successfully.", resetToken });
  } catch (error) {
    console.error("[AUTH] verify-reset-otp error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/reset-password", async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) {
    return res.status(400).json({ error: "Reset token and new password are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long." });
  }
  try {
    let payload;
    try {
      payload = jwt2.verify(resetToken, JWT_SECRET);
    } catch (e) {
      return res.status(400).json({ error: "Reset link has expired or is invalid. Please request a new one." });
    }
    if (payload.purpose !== "password_reset") {
      return res.status(400).json({ error: "Invalid reset token." });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db_default.user.update({
      where: { id: payload.id },
      data: {
        password: hashedPassword,
        resetPasswordOtp: null,
        resetPasswordOtpExpiry: null
      }
    });
    console.log(`[AUTH] Password reset successfully for user ${payload.id}`);
    res.json({ message: "Password reset successfully. You can now log in with your new password." });
  } catch (error) {
    console.error("[AUTH] reset-password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
var auth_default = router;

// api/_server/routes/quests.ts
import express2 from "express";
var router2 = express2.Router();
router2.get("/", authenticateToken, async (req, res) => {
  try {
    console.log("[API] Fetching all quests...");
    const quests = await db_default.quest.findMany({
      include: { creator: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" }
      // Newest first
    });
    console.log(`[API] Found ${quests.length} quests`);
    const parsedQuests = quests.map((q) => {
      try {
        return {
          ...q,
          questions: JSON.parse(q.questions)
        };
      } catch (e) {
        console.error(`[API] Failed to parse questions for quest ${q.id}:`, e);
        return {
          ...q,
          questions: []
        };
      }
    });
    res.json(parsedQuests);
  } catch (error) {
    console.error("[API] Error fetching quests:", error);
    res.status(500).json({ error: "Failed to fetch quests" });
  }
});
router2.post("/", authenticateToken, checkExpiredSubscriptions, async (req, res) => {
  const { title, subject, grade, syllabus, questions } = req.body;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  console.log(`[API] Creating quest. User: ${userId}, Role: ${userRole}`);
  if (userRole !== "teacher" && userRole !== "TEACHER") {
    return res.status(403).json({ error: "Only teachers can create quests" });
  }
  if (!Array.isArray(questions) || questions.length < 20) {
    return res.status(400).json({ error: "A quest must contain at least 20 questions." });
  }
  try {
    const own = await db_default.user.findUnique({ where: { id: userId } });
    const sub = await effectiveSubscription(userId);
    if (!own || !sub) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = { ...own, isSubscribed: sub.isSubscribed, subscriptionLevel: sub.subscriptionLevel, subscribedSyllabus: sub.subscribedSyllabus };
    console.log(`[API] User Subscribed: ${user.isSubscribed}, Quests Created: ${user.questsCreated}`);
    if (!user.isSubscribed && (userRole === "teacher" || userRole === "TEACHER")) {
      if (user.questsCreated >= 1) {
        console.log("[API] \u274C Quest creation blocked: Free limit reached");
        return res.status(403).json({
          error: "Free teachers are limited to 1 quest creation. Upgrade to Pro for unlimited creation.",
          limit: "quest_creation",
          current: user.questsCreated,
          max: 1
        });
      }
    }
    const subLevel = user.subscriptionLevel;
    const subSyllabus = user.subscribedSyllabus;
    if (user.isSubscribed && subLevel === "single" && syllabus !== subSyllabus) {
      return res.status(403).json({
        error: `Your plan only allows creating quests for the ${subSyllabus} syllabus.`,
        requiredSyllabus: subSyllabus
      });
    }
    const newQuest = await db_default.quest.create({
      data: {
        title,
        subject,
        grade,
        syllabus,
        questions: JSON.stringify(questions),
        creatorId: userId
      }
    });
    console.log(`[API] \u2705 Quest created: ${newQuest.id}`);
    if (!user.isSubscribed) {
      await db_default.user.update({
        where: { id: userId },
        data: { questsCreated: { increment: 1 } }
      });
      console.log(`[API] Incremented questsCreated count`);
    }
    res.json(newQuest);
  } catch (error) {
    console.error("[API] Error creating quest:", error);
    res.status(500).json({ error: "Failed to create quest" });
  }
});
router2.delete("/:id", authenticateToken, checkExpiredSubscriptions, async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (userRole !== "teacher" && userRole !== "TEACHER") {
    return res.status(403).json({ error: "Only teachers can delete quests" });
  }
  try {
    const quest = await db_default.quest.findUnique({ where: { id } });
    if (!quest) return res.status(404).json({ error: "Quest not found" });
    if (quest.creatorId !== userId) return res.status(403).json({ error: "You can only delete your own quests" });
    await db_default.quest.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete quest" });
  }
});
var quests_default = router2;

// api/_server/routes/results.ts
import express3 from "express";

// api/_server/utils/gradeRank.ts
var gradeRank = (grade) => {
  if (!grade) return null;
  const cleaned = grade.replace(" (STPM)", "").trim();
  const match = cleaned.match(/^(Standard|Form|Year|Secondary|Grade)\s+(\d+)$/i);
  if (!match) return null;
  const prefix = match[1].toLowerCase();
  const n = parseInt(match[2], 10);
  if (isNaN(n)) return null;
  switch (prefix) {
    case "standard":
      return { family: "academic", rank: n };
    case "form":
      return { family: "academic", rank: 6 + n };
    case "year":
      return { family: "academic", rank: n };
    case "secondary":
      return { family: "academic", rank: 6 + n };
    case "grade":
      return { family: "music", rank: n };
    default:
      return null;
  }
};
var shouldAwardPoints = (userGrade, quizGrade, leniency = 0) => {
  const userRank = gradeRank(userGrade);
  if (!userRank) return true;
  const quizRank = gradeRank(quizGrade);
  if (!quizRank) return true;
  if (userRank.family !== quizRank.family) return true;
  return quizRank.rank >= userRank.rank - leniency;
};

// api/_server/routes/results.ts
var router3 = express3.Router();
router3.use(authenticateToken, checkExpiredSubscriptions);
router3.post("/", authenticateToken, async (req, res) => {
  const { score, mode, questId, correctAnswers, totalQuestions, subject, topic, grade, syllabus } = req.body;
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }
  try {
    const user = await db_default.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const ageGrade = !isMusicSyllabus(user.gradeSyllabus) && user.birthday ? expectedGradeFor(user.gradeSyllabus, user.birthday, /* @__PURE__ */ new Date()) : null;
    const gateGrade = ageGrade ?? user.grade;
    const gateSource = ageGrade ? "age" : "profile";
    let award = shouldAwardPoints(gateGrade, grade, gateSource === "age" ? GATE_LENIENCY : 0);
    if (!award && typeof syllabus === "string" && isMusicSyllabus(syllabus) && syllabus !== user.gradeSyllabus) {
      award = true;
    }
    console.log(
      `[GATE] user=${userId} birthday=${user.birthday ? user.birthday.toISOString().slice(0, 10) : "none"} syllabus=${user.gradeSyllabus ?? "none"} profileGrade=${user.grade ?? "none"} gateGrade=${gateGrade ?? "none"} source=${gateSource} quizGrade=${grade ?? "none"} award=${award}`
    );
    if (questId) {
      const quest = await db_default.quest.findUnique({
        where: { id: questId },
        include: { creator: { select: { role: true, isAdmin: true } } }
      });
      if (quest && (quest.creator.role !== "student" || quest.creator.isAdmin)) {
        award = true;
      }
    }
    const xpAwarded = award ? score : 0;
    const coinsAwarded = award ? correctAnswers || 0 : 0;
    const result = await db_default.result.create({
      data: {
        userId,
        score,
        mode,
        totalQuestions: totalQuestions || 0,
        correctAnswers: correctAnswers || 0,
        subject: subject || void 0,
        topic: topic || void 0,
        grade: grade || void 0,
        xpAwarded,
        coinsAwarded,
        questId: questId || void 0
      }
    });
    console.log(`[API] \u2705 Result saved: ${result.id}`);
    if (xpAwarded > 0 || coinsAwarded > 0) {
      await db_default.user.update({
        where: { id: userId },
        data: {
          xp: { increment: xpAwarded },
          coins: { increment: coinsAwarded }
          // questsPlayed increment moved to /api/generation/quest
        }
      });
    }
    const updatedUser = await db_default.user.findUnique({
      where: { id: userId },
      select: { coins: true }
    });
    console.log(`[API] \u2705 Result saved! User XP: ${user.xp} -> +${xpAwarded}, Coins: +${coinsAwarded} (total: ${updatedUser?.coins}, gated: ${!award})`);
    res.json({
      ...result,
      newCoinTotal: updatedUser?.coins ?? 0,
      xpAwarded,
      coinsAwarded,
      gated: !award,
      gateGrade: gateGrade ?? null,
      gateSource
    });
  } catch (error) {
    console.error("[API] Error saving result:", error);
    res.status(500).json({ error: "Failed to save result" });
  }
});
router3.get("/my-results", authenticateToken, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "User not authenticated" });
  try {
    const results = await db_default.result.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      include: { quest: { select: { title: true } } }
    });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch results" });
  }
});
var results_default = router3;

// api/_server/routes/subscription.ts
import express4 from "express";
import Stripe from "stripe";
var router4 = express4.Router();
var stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
var FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
router4.post("/create-payment-intent", authenticateToken, requireParentSession, async (req, res) => {
  const user = req.user;
  const { amount, currency, interval, planLevel, syllabus } = req.body;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  const isMockMode2 = !secretKey.startsWith("sk_") || process.env.STRIPE_MOCK_MODE === "true";
  const PRICE_TABLE = { single: 5990, all: 9990 };
  const unitAmount = PRICE_TABLE[planLevel] ?? PRICE_TABLE.single;
  const seats = await seatCountFor(user.id);
  let finalAmount = familyPriceCents(unitAmount, seats);
  const finalCurrency = "myr";
  const STRIPE_MIN = 200;
  let appliedCredit = 0;
  try {
    await releaseDueInstalments(user.id);
    const payer = await db_default.user.findUnique({
      where: { id: user.id },
      select: { referralCreditCents: true }
    });
    const balance = payer?.referralCreditCents ?? 0;
    appliedCredit = Math.max(0, Math.min(balance, finalAmount - STRIPE_MIN));
    finalAmount -= appliedCredit;
  } catch (creditErr) {
    console.error("[SUBSCRIPTION] Failed to load referral credit, charging full price:", creditErr);
    appliedCredit = 0;
  }
  if (isMockMode2) {
    console.warn(`\u26A0\uFE0F STRIPE MOCK MODE ENABLED. Processing ${finalCurrency.toUpperCase()} ${finalAmount / 100} (${interval || "month"})${appliedCredit > 0 ? ` [referral credit -${appliedCredit / 100}]` : ""}`);
    return res.json({
      clientSecret: `mock_secret_${Date.now()}`,
      amount: finalAmount,
      appliedCredit,
      seats,
      unitAmount,
      extraChildAmount: EXTRA_CHILD_CENTS,
      interval: interval || "month",
      planLevel: planLevel || "single",
      syllabus: syllabus || null,
      isMock: true
    });
  }
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: finalCurrency,
      payment_method_types: ["card"],
      metadata: {
        userId: user.id,
        planLevel: planLevel || "single",
        syllabus: syllabus || "",
        appliedCredit: String(appliedCredit),
        seats: String(seats)
      }
    });
    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: finalAmount,
      appliedCredit,
      seats,
      unitAmount,
      extraChildAmount: EXTRA_CHILD_CENTS,
      isMock: false
    });
  } catch (error) {
    console.error("Stripe Intent Error:", error);
    res.status(500).json({ error: error.message });
  }
});
router4.post("/confirm-payment", authenticateToken, requireParentSession, async (req, res) => {
  const { paymentIntentId, interval, planLevel, syllabus } = req.body;
  const userId = req.user?.id;
  if (!paymentIntentId || !userId) return res.status(400).json({ error: "Missing data" });
  const STRIPE_MIN = 200;
  const PRICE_TABLE = { single: 5990, all: 9990 };
  const payer = await db_default.user.findUnique({ where: { id: userId } });
  if (!payer) return res.status(404).json({ error: "User not found" });
  const settleReferral = async (appliedCredit) => {
    if (appliedCredit > 0) {
      const decrementBy = Math.min(appliedCredit, payer.referralCreditCents);
      if (decrementBy > 0) {
        try {
          await db_default.user.update({
            where: { id: userId },
            data: { referralCreditCents: { decrement: decrementBy } }
          });
          console.log(`[REFERRAL] Redeemed ${decrementBy / 100} MYR credit for payer ${userId}`);
        } catch (decErr) {
          console.error("[REFERRAL] Failed to decrement applied credit:", decErr);
        }
      }
    }
    await settleReferralGrant(userId);
  };
  if (paymentIntentId.startsWith("mock_")) {
    const startDate = /* @__PURE__ */ new Date();
    const endDate = /* @__PURE__ */ new Date();
    const seats = await seatCountFor(userId);
    endDate.setDate(endDate.getDate() + 30);
    await db_default.user.update({
      where: { id: userId },
      data: {
        isSubscribed: true,
        subscriptionInterval: interval || "month",
        subscriptionLevel: planLevel || "single",
        subscribedSyllabus: syllabus || null,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        subscriptionSeats: seats,
        cancelAtPeriodEnd: false,
        questsPlayed: 0,
        // Reset counters on subscription
        questsCreated: 0
      }
    });
    const price = familyPriceCents(PRICE_TABLE[planLevel || "single"] ?? PRICE_TABLE.single, seats);
    const applied = Math.max(0, Math.min(payer.referralCreditCents, price - STRIPE_MIN));
    await settleReferral(applied);
    return res.json({ success: true, isMock: true });
  }
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status === "succeeded") {
      const startDate = /* @__PURE__ */ new Date();
      const endDate = /* @__PURE__ */ new Date();
      endDate.setDate(endDate.getDate() + 30);
      await db_default.user.update({
        where: { id: userId },
        data: {
          isSubscribed: true,
          subscriptionInterval: interval || "month",
          subscriptionLevel: paymentIntent.metadata?.planLevel || planLevel || "single",
          subscribedSyllabus: paymentIntent.metadata?.syllabus || syllabus || null,
          subscriptionSeats: Math.max(1, parseInt(paymentIntent.metadata?.seats || "1", 10) || 1),
          subscriptionStartDate: startDate,
          subscriptionEndDate: endDate,
          cancelAtPeriodEnd: false,
          questsPlayed: 0,
          // Reset counters on subscription
          questsCreated: 0
        }
      });
      const applied = parseInt(paymentIntent.metadata?.appliedCredit || "0", 10) || 0;
      await settleReferral(applied);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Payment not successful" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Confirmation failed" });
  }
});
router4.post("/checkout", authenticateToken, requireParentSession, async (req, res) => {
  const user = req.user;
  const { amount, currency, interval } = req.body;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const finalAmount = amount || 2500;
  const finalCurrency = (currency || "myr").toLowerCase();
  const finalInterval = interval === "year" ? "year" : "month";
  try {
    console.log(`Processing Real Payment: ${finalCurrency.toUpperCase()} ${finalAmount / 100} (${finalInterval})...`);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: finalCurrency,
            product_data: {
              name: `Akshara LearnQuest Pro - ${finalInterval === "year" ? "1 Year" : "1 Month"} Access`,
              description: `Unlimited Quizzes and Quest Creation for ${finalInterval === "year" ? "1 year" : "1 month"}. No auto-renewal.`
            },
            unit_amount: finalAmount
            // REMOVED: recurring - this makes it a one-time payment
          },
          quantity: 1
        }
      ],
      mode: "payment",
      // Changed from 'subscription' to 'payment'
      success_url: `${FRONTEND_URL}?success=true&session_id={CHECKOUT_SESSION_ID}&interval=${finalInterval}`,
      cancel_url: `${FRONTEND_URL}?canceled=true`,
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        interval: finalInterval
        // Store interval in metadata
      }
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Error:", error);
    res.status(500).json({ error: error.message });
  }
});
router4.get("/verify-session", authenticateToken, requireParentSession, async (req, res) => {
  const { session_id, interval } = req.query;
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });
  if (String(session_id).startsWith("mock_session")) {
    return res.json({ success: true, isSubscribed: true });
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status === "paid") {
      const userId = req.user?.id;
      if (userId) {
        const startDate = /* @__PURE__ */ new Date();
        const endDate = /* @__PURE__ */ new Date();
        const subscriptionInterval = session.metadata?.interval || interval || "month";
        if (subscriptionInterval === "year") {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
          endDate.setMonth(endDate.getMonth() + 1);
        }
        await db_default.user.update({
          where: { id: userId },
          data: {
            isSubscribed: true,
            subscriptionInterval,
            subscriptionStartDate: startDate,
            subscriptionEndDate: endDate,
            subscriptionSeats: await seatCountFor(userId),
            cancelAtPeriodEnd: false,
            questsPlayed: 0,
            // Reset counters on subscription
            questsCreated: 0
          }
        });
      }
      res.json({ success: true, isSubscribed: true });
    } else {
      res.json({ success: false, status: session.payment_status });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Verification failed" });
  }
});
router4.post("/cancel-subscription", authenticateToken, requireParentSession, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  const isMockMode2 = !secretKey.startsWith("sk_") || process.env.STRIPE_MOCK_MODE === "true";
  try {
    const user = await db_default.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (isMockMode2) {
      console.log(`[MOCK] Scheduling cancellation for user: ${userId} at period end`);
      await db_default.user.update({
        where: { id: userId },
        data: { cancelAtPeriodEnd: true }
      });
      const endDate2 = user.subscriptionEndDate || /* @__PURE__ */ new Date();
      return res.json({
        success: true,
        message: `Subscription will cancel on ${endDate2.toLocaleDateString()}`,
        cancelAt: endDate2
      });
    }
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }
    if (!customerId) {
      await db_default.user.update({
        where: { id: userId },
        data: { cancelAtPeriodEnd: true }
      });
      const endDate2 = user.subscriptionEndDate || /* @__PURE__ */ new Date();
      return res.json({
        success: true,
        message: `Subscription will cancel on ${endDate2.toLocaleDateString()}`,
        cancelAt: endDate2
      });
    }
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1
    });
    if (subscriptions.data.length > 0) {
      await stripe.subscriptions.update(subscriptions.data[0].id, {
        cancel_at_period_end: true
      });
    }
    await db_default.user.update({
      where: { id: userId },
      data: { cancelAtPeriodEnd: true }
    });
    const endDate = user.subscriptionEndDate || /* @__PURE__ */ new Date();
    res.json({
      success: true,
      message: `Subscription will cancel on ${endDate.toLocaleDateString()}. You'll have access until then.`,
      cancelAt: endDate
    });
  } catch (error) {
    console.error("Cancellation error:", error);
    res.status(500).json({ error: error.message || "Failed to cancel subscription" });
  }
});
router4.get("/check-subscription-status", authenticateToken, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
  const userId = await billingAccountId(req.user.id);
  try {
    const user = await db_default.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const now = /* @__PURE__ */ new Date();
    const endDate = user.subscriptionEndDate;
    if (user.isSubscribed && endDate && now > endDate) {
      console.log(`[SUBSCRIPTION] Subscription expired for user ${userId}`);
      console.log(`[SUBSCRIPTION] End date: ${endDate.toISOString()}, Current: ${now.toISOString()}`);
      await db_default.user.update({
        where: { id: userId },
        data: {
          isSubscribed: false,
          cancelAtPeriodEnd: false
        }
      });
      return res.json({
        isSubscribed: false,
        message: "Subscription has expired",
        expiredOn: endDate
      });
    }
    const eff = await effectiveSubscription(req.user.id);
    res.json({
      isSubscribed: eff ? eff.isSubscribed : user.isSubscribed,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      subscriptionEndDate: user.subscriptionEndDate,
      subscriptionInterval: user.subscriptionInterval,
      subscriptionLevel: user.subscriptionLevel,
      subscribedSyllabus: user.subscribedSyllabus,
      subscriptionSeats: user.subscriptionSeats,
      seatCovered: eff ? eff.seatCovered : true,
      questsPlayed: user.questsPlayed,
      questsCreated: user.questsCreated
    });
  } catch (error) {
    console.error("Status check error:", error);
    res.status(500).json({ error: error.message || "Failed to check subscription status" });
  }
});
router4.post("/reactivate-subscription", authenticateToken, requireParentSession, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  const isMockMode2 = !secretKey.startsWith("sk_") || process.env.STRIPE_MOCK_MODE === "true";
  try {
    const user = await db_default.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!user.cancelAtPeriodEnd) {
      return res.json({ success: true, message: "Subscription is not scheduled for cancellation" });
    }
    if (isMockMode2) {
      console.log(`[MOCK] Reactivating subscription for user: ${userId}`);
      await db_default.user.update({
        where: { id: userId },
        data: { cancelAtPeriodEnd: false }
      });
      return res.json({
        success: true,
        message: "Subscription reactivated successfully (Mock Mode)"
      });
    }
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }
    if (customerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1
      });
      if (subscriptions.data.length > 0) {
        await stripe.subscriptions.update(subscriptions.data[0].id, {
          cancel_at_period_end: false
        });
      }
    }
    await db_default.user.update({
      where: { id: userId },
      data: { cancelAtPeriodEnd: false }
    });
    res.json({
      success: true,
      message: "Subscription reactivated successfully. Your subscription will continue."
    });
  } catch (error) {
    console.error("Reactivation error:", error);
    res.status(500).json({ error: error.message || "Failed to reactivate subscription" });
  }
});
var subscription_default = router4;

// api/_server/routes/generation.ts
import express5 from "express";

// api/_server/utils/ai.ts
var PRIMARY_MODEL = "gemini-3-flash-preview";
var FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-flash-latest"];
async function generateAIContent(prompt, modelName = PRIMARY_MODEL, responseMimeType) {
  const chain = [modelName, ...FALLBACK_MODELS.filter((m) => m !== modelName)];
  let lastError = null;
  for (const model of chain) {
    try {
      return await callGemini(prompt, model, responseMimeType);
    } catch (err) {
      lastError = err;
      console.warn(`[AI] Model ${model} failed (${err.message}); trying next fallback...`);
    }
  }
  throw lastError ?? new Error("All Gemini models failed");
}
async function callGemini(prompt, modelName, responseMimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  const cleanModelName = modelName.includes("/") ? modelName.split("/").pop() : modelName;
  const modelPath = `models/${cleanModelName}`;
  const keySnippet = apiKey.substring(apiKey.length - 6);
  console.log(`[AI] >>> KEY VERIFICATION: Using API Key ending in "...${keySnippet}" | Model: ${modelPath} | JSON Mode: ${!!responseMimeType} <<<`);
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${apiKey}`;
  try {
    const referers = [
      "https://revisionlab.vercel.app",
      "https://revisonlab.vercel.app",
      "http://localhost:3000",
      "http://localhost:5173"
    ];
    const startTime = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": referers[0],
        "Origin": referers[0]
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          topK: 40,
          // Thinking tokens count against the output budget; with 8192 the JSON
          // for a full question set was routinely truncated (the repair step then
          // salvaged only 2-3 questions). Keep thinking small and the budget large.
          max_output_tokens: 16384,
          // thinkingBudget is the Gemini 2.5 control; Gemini 3 uses thinkingLevel.
          ...cleanModelName?.startsWith("gemini-2.5") ? { thinkingConfig: { thinkingBudget: 1024 } } : {},
          ...cleanModelName?.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: "low" } } : {},
          response_mime_type: responseMimeType
        }
      })
    });
    const duration = (Date.now() - startTime) / 1e3;
    console.log(`[AI] Gemini API Response received in ${duration}s (Status: ${response.status})`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI] Gemini API Error Response (${response.status}): ${errorText}`);
      try {
        const errorJson = JSON.parse(errorText);
        const message = errorJson.error?.message || errorText;
        if (response.status === 404) {
          throw new Error(`Model not found or invalid: ${modelPath}. Check if Gemini 2.5 is available for this API key.`);
        }
        throw new Error(`Gemini API Error (${response.status}): ${message}`);
      } catch (e) {
        if (e.message.includes("Gemini API Error") || e.message.includes("Model not found")) throw e;
        throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
      }
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("[AI] No text in response:", JSON.stringify(data));
      throw new Error("Empty response from Gemini API");
    }
    return text;
  } catch (error) {
    console.error("[AI] Generation Failed:", error.message);
    throw error;
  }
}

// api/_server/data/musicCurriculum.ts
var SANGEETHAM = {
  "Grade 1": [
    "Topic 1: Shruti Basics (Meaning of Shruti, mother of music, sound vs musical pitch)",
    "Topic 2: Voice Preparation (Sitting posture, open throat, relaxed jaw, steady breath)",
    "Topic 3: Sapta Swaras (Sa Ri Ga Ma Pa Da Ni, ascending and descending order)",
    "Topic 4: Arohanam and Avarohanam (Upward and downward swara movement)",
    "Topic 5: Tala Introduction (Meaning of tala, clapping method, counting beats, steady time)",
    "Topic 6: Adi Tala Introduction (8-beat structure, Laghu, Drutam, counting 1 to 8)",
    "Topic 7: Beginner Listening (Recognising high and low pitch, matching the teacher\u2019s Sa)",
    "Topic 8: Practice Discipline (Daily Shruti practice, swara practice, listening homework)"
  ],
  "Grade 2": [
    "Topic 1: Sarali Varisai (Meaning and purpose, first swara exercise, voice training)",
    "Topic 2: Mayamalavagowla Scale (Swaras, Arohanam, Avarohanam, why beginners use this raga)",
    "Topic 3: Swara Clarity (Clean Sa Ri Ga Ma, clear vowel sound, not swallowing notes)",
    "Topic 4: Laya Basics (Equal gap between swaras, not rushing, not dragging)",
    "Topic 5: Adi Tala with Sarali (Singing while putting tala, matching swara to beat)",
    "Topic 6: Kalapramanam (Meaning of speed, first speed, second speed introduction)",
    "Topic 7: Listening and Correction (Identifying flat notes, sharp notes, broken rhythm)",
    "Topic 8: Practice Method (Slow practice, phrase practice, teacher-follow method)"
  ],
  "Grade 3": [
    "Topic 1: Janta Varisai (Repeated swaras, double-note singing, strengthening the voice)",
    "Topic 2: Voice Stability (Same pitch repetition, avoiding shaking, maintaining Shruti)",
    "Topic 3: Swara Pressure (Strength vs shouting, balanced sound production)",
    "Topic 4: Gamaka Preparation (Plain note vs curved note, why some notes need life)",
    "Topic 5: Tala Stability (Singing repeated notes without disturbing the beat)",
    "Topic 6: Speed Development (Clarity in first and second speed, keeping Shruti)",
    "Topic 7: Breath Management (Where to breathe, completing a pattern without breaking)",
    "Topic 8: Common Janta Mistakes (Unequal repetition, wrong pitch, rushing the second note)"
  ],
  "Grade 4": [
    "Topic 1: Dhatu Varisai (Jumping swaras, non-linear movement, Sarali vs Dhatu)",
    "Topic 2: Swara Navigation (Skipping notes, returning to base swara, accuracy)",
    "Topic 3: Mental Concentration (Swara memory, predicting the next note)",
    "Topic 4: Voice Flexibility (Smooth jumps low to high and high to low)",
    "Topic 5: Dhatu with Adi Tala (Keeping tala while singing non-linear patterns)",
    "Topic 6: Raga Sense (Mayamalavagowla identity within jumping patterns)",
    "Topic 7: Listening Skill (Detecting wrong jumps, correcting through slow practice)",
    "Topic 8: Practice Strategy (Chunking method, breaking long patterns into phrases)"
  ],
  "Grade 5": [
    "Topic 1: Alankaram (Decorative swara patterns, bridge to Geetham)",
    "Topic 2: Sapta Tala (Dhruva, Matya, Rupaka, Jhampa, Triputa, Ata, Eka)",
    "Topic 3: Tala Angas (Laghu, Drutam, Anudrutam, hand gestures)",
    "Topic 4: Jathi Introduction (Tisra, Chatusra, Khanda, Misra, Sankeerna)",
    "Topic 5: Adi Tala Deeper Study (Why Adi Tala is Chatusra Jathi Triputa Tala)",
    "Topic 6: Swara-Tala Alignment (Matching each swara to the tala count)",
    "Topic 7: Speed Control (First, second and third speed awareness)",
    "Topic 8: Discipline in Practice (Accuracy before speed, why Alankaram must not be rushed)"
  ],
  "Grade 6": [
    "Topic 1: Geetham (Simple composition, bridge from exercise to song)",
    "Topic 2: Types of Geetham (Samanya Geetham, Lakshana Geetham, differences)",
    "Topic 3: Sahitya Introduction (Lyrics, pronunciation, meaning, emotional connection)",
    "Topic 4: Raga Lakshana (Arohanam, Avarohanam, important swaras, simple raga phrases)",
    "Topic 5: Tala in Composition (Keeping tala while singing lyrics and swaras)",
    "Topic 6: Swara-Sahitya Link (How words sit on notes, syllable awareness)",
    "Topic 7: Memorisation (Phrase-by-phrase learning, repetition, correction)",
    "Topic 8: Bhava Introduction (Singing with simple feeling, not flat recitation)"
  ],
  "Grade 7": [
    "Topic 1: Varnam (Why Varnam is central to Carnatic training, voice development)",
    "Topic 2: Varnam Structure (Pallavi, Anupallavi, Mukthayi Swaram, Charanam, Chitta Swaram)",
    "Topic 3: Raga Development (Signature phrases, important prayogas, raga colour)",
    "Topic 4: Tala Discipline (Long-form tala control, maintaining speed and structure)",
    "Topic 5: Swara-Sahitya Balance (Switching between swara and lyrics confidently)",
    "Topic 6: Stamina Training (Singing a full Varnam without losing Shruti or energy)",
    "Topic 7: Gamaka Application (Basic gamakas suitable for the raga)",
    "Topic 8: Performance Preparation (Starting pitch, tala confidence, memory, presentation)"
  ],
  "Grade 8": [
    "Topic 1: Kriti (Difference between Geetham, Varnam and Kriti)",
    "Topic 2: Kriti Structure (Pallavi, Anupallavi, Charanam)",
    "Topic 3: Composer Study (Tyagaraja, Muthuswami Dikshitar, Syama Sastri, Purandaradasa)",
    "Topic 4: Sahitya Meaning (Word meaning, devotional meaning, pronunciation)",
    "Topic 5: Raga Bhava (How raga supports meaning, mood of the composition)",
    "Topic 6: Sangati (Meaning of sangati, gradual variation development)",
    "Topic 7: Tala and Eduppu (Samam, Ateeta Eduppu, Anagata Eduppu)",
    "Topic 8: Presentation Skill (Shruti, tala, bhava, clarity, ending a Kriti properly)"
  ],
  "Grade 9": [
    "Topic 1: Manodharma Introduction (Creative music, learnt vs created music)",
    "Topic 2: Raga Alapana (Exploring raga without tala, building mood, raga identity)",
    "Topic 3: Raga Lakshana (Arohanam, Avarohanam, jeeva swaras, nyasa swaras, prayogas)",
    "Topic 4: Phrase Building (Starting from simple phrases, expanding naturally)",
    "Topic 5: Gamaka Development (Correct gamaka usage, avoiding mechanical notes)",
    "Topic 6: Voice Flow (Breath and continuity, smooth movement, maintaining tone)",
    "Topic 7: Listening Analysis (Learning from masters, identifying phrases, comparing styles)",
    "Topic 8: Short Alapana Practice (1-minute and 2-minute alapana, ending on a stable swara)"
  ],
  "Grade 10": [
    "Topic 1: RTP Introduction (Ragam, Tanam, Pallavi as the advanced Carnatic form)",
    "Topic 2: Ragam (Detailed raga exploration, gradual development, emotional depth)",
    "Topic 3: Tanam (Syllabic melodic movement, pulse without fixed tala, voice control)",
    "Topic 4: Pallavi (Meaning, structure, sahitya, tala placement)",
    "Topic 5: Neraval (Improvising on a line, maintaining sahitya, raga and tala discipline)",
    "Topic 6: Kalpana Swaram (Creative swara patterns, ending correctly, eduppu control)",
    "Topic 7: Laya Complexity (Gati, nadai, kanakku, kuraippu basics)",
    "Topic 8: Concert Presentation (Confidence, planning, stage discipline, respecting tradition)"
  ]
};
var MRIDANGAM = {
  "Grade 1": [
    "Topic 1: Introduction to Mridangam (Role in Carnatic music, percussion and accompaniment)",
    "Topic 2: Parts of the Mridangam (Right side head, left side head, black central spot, body, straps)",
    "Topic 3: Sitting Posture and Placement (Cross-legged posture, straight back, stable placement)",
    "Topic 4: Hand Position (Right and left hand position, finger curve, wrist relaxation)",
    "Topic 5: Basic Strokes (Tha, Dhi, Nam, Thom, Chapu)",
    "Topic 6: Right-Hand and Left-Hand Practice (Single strokes, Tha Dhi Tha Dhi, Thom Thom patterns)",
    "Topic 7: Combined Hand Practice (Tha Thom, Dhi Thom, Tha Dhi Thom Nam)",
    "Topic 8: Basic Sollukattu (Tha Ka, Tha Ki Ta, Tha Ka Dhi Mi, Tha Ri Ki Ta)",
    "Topic 9: Adi Tala Awareness (8-count hand actions, clap, finger counts, wave)"
  ],
  "Grade 2": [
    "Topic 1: Level 1 Revision (Strokes, posture, basic sollukattu)",
    "Topic 2: Chatusra Nadai (Meaning of 4-count subdivision)",
    "Topic 3: Sarvalaghu (Meaning, smooth rhythm flow, rhythm walking)",
    "Topic 4: Akshara and Matra Awareness (Counting units inside the tala)",
    "Topic 5: Adi Tala in Chatusra Nadai (Playing 4-count flow inside 8 beats)",
    "Topic 6: Chatusra Sollukattu (Tha Ka Dhi Mi, Tha Ri Ki Ta, Tha Ka Thom Nam, Tha Dhi Thom Nam)",
    "Topic 7: Sarvalaghu Lesson Groups (4-syllable and 8-syllable sarvalaghu, mixed flow)",
    "Topic 8: Right-Left Coordination (Bass and treble balance, steady tempo, no rushing)"
  ],
  "Grade 3": [
    "Topic 1: Meaning of Jathi (Rhythmic grouping and count structure)",
    "Topic 2: Tisra Jathi (3 counts, Tha Ki Ta)",
    "Topic 3: Chatusra Jathi (4 counts, Tha Ka Dhi Mi)",
    "Topic 4: Khanda Jathi (5 counts, Tha Ka Tha Ki Ta)",
    "Topic 5: Misra Jathi Introduction (7 counts, Tha Ki Ta Tha Ka Dhi Mi)",
    "Topic 6: Sollu and Sollukattu (Rhythmic syllables, recite before playing)",
    "Topic 7: Both-Hand Jathi Coordination (Fingering changes across groupings, steady laya)",
    "Topic 8: Question-and-Answer Rhythm (Short call-and-response phrases)"
  ],
  "Grade 4": [
    "Topic 1: Kalapramanam (Meaning of tempo discipline)",
    "Topic 2: First Speed (Slow, clear stroke placement)",
    "Topic 3: Second Speed (Doubling while keeping clarity)",
    "Topic 4: Third Speed Introduction (Controlled fast playing)",
    "Topic 5: Speed vs Rushing (Difference between speed and losing control)",
    "Topic 6: Multi-Speed Recitation (Voice recitation in multiple speeds)",
    "Topic 7: Speed Practice Across Jathis (Chatusra, Tisra, Khanda and mixed patterns in Adi Tala)",
    "Topic 8: Starting and Ending Correctly (Clean ending on samam)"
  ],
  "Grade 5": [
    "Topic 1: Tala and Alankara (Rhythmic cycle, structured patterns inside talas)",
    "Topic 2: Tala Angas (Laghu, Dhrutam, Anudhrutam, hand actions)",
    "Topic 3: Sapta Tala (Dhruva, Matya, Rupaka, Jhampa, Triputa, Ata, Eka)",
    "Topic 4: Important Talas (Adi Tala, Rupaka Tala, Eka Tala, Misra Chapu, Khanda Chapu)",
    "Topic 5: Akshara and Matra (Counting structure inside tala cycles)",
    "Topic 6: Fitting Jathi into Tala (Where the sollu sits inside the tala)",
    "Topic 7: Rhythmic Placement (Starting and ending patterns on samam)",
    "Topic 8: Fingering and Sound Clarity (Clean strokes inside tala cycles)"
  ],
  "Grade 6": [
    "Topic 1: Meaning of Eduppu (Starting point of a phrase in the tala cycle)",
    "Topic 2: Samam, Ateeta and Anagata Eduppu (On the beat, before the beat, after the beat)",
    "Topic 3: Meaning of Arudi (Rhythmic resting point)",
    "Topic 4: Role of Mridangam in Accompaniment (Musical service, not showing off)",
    "Topic 5: Simple Song Support Patterns (Sarvalaghu for songs)",
    "Topic 6: Playing for Geetham-Type Compositions (Supporting simple compositions)",
    "Topic 7: Listening Skill (Following the main artist while playing)",
    "Topic 8: Volume Control, Silence and Space (Soft balanced accompaniment, avoiding overplaying)"
  ],
  "Grade 7": [
    "Topic 1: Meaning of Mora (Structured ending pattern)",
    "Topic 2: Three-Time Repetition Method (Repeating a phrase three times to land)",
    "Topic 3: Meaning of Korvai (Composed rhythmic structure)",
    "Topic 4: Difference Between Mora and Korvai",
    "Topic 5: Meaning of Kanakku (Rhythmic calculation, counting phrase length)",
    "Topic 6: Simple Kanakku (Tha Ka Dhi Mi x3 = 12, Tha Ki Ta x3 = 9, Tha Ka Tha Ki Ta x3 = 15)",
    "Topic 7: Landing on Samam (Counting, saying, then playing)",
    "Topic 8: Endings After Sarvalaghu (Clean simple endings without rushing)"
  ],
  "Grade 8": [
    "Topic 1: Meaning of Nadai (Rhythmic gait, subdivision of the beat)",
    "Topic 2: Nadai Bhedam (Changing the rhythmic texture without losing the tala)",
    "Topic 3: Difference Between Jathi and Nadai (Count shape vs how the beat walks)",
    "Topic 4: The Five Nadais (Tisra 3, Chatusra 4, Khanda 5, Misra 7, Sankirna 9)",
    "Topic 5: Nadai Transitions (Chatusra to Tisra, Chatusra to Khanda)",
    "Topic 6: Laya Stability (Keeping the tala steady during subdivision changes)",
    "Topic 7: Fingering for Nadai Patterns (Correct fingering per subdivision)",
    "Topic 8: Nadai Patterns in Adi Tala (Applying subdivision changes inside the cycle)"
  ],
  "Grade 9": [
    "Topic 1: Structure of a Kriti (Pallavi, Anupallavi, Charanam and the Mridangam role in each)",
    "Topic 2: Meaning of Sangati (Phrase development and variation support)",
    "Topic 3: Kriti Eduppu and Arudi (Correct entry and resting points in compositions)",
    "Topic 4: Sarvalaghu for Kriti Accompaniment (Playing according to song mood)",
    "Topic 5: Kalpana Swaram Support (Responding to creative swara singing)",
    "Topic 6: Neraval Support (Sensitive accompaniment for improvised lines)",
    "Topic 7: Accompanying Different Instruments (Vocal, Veena, Keyboard, group singing)",
    "Topic 8: Concert Etiquette (Volume, tone control, stage discipline)"
  ],
  "Grade 10": [
    "Topic 1: Meaning of Tani Avartanam (The percussion solo in a Carnatic concert)",
    "Topic 2: Tani Avartanam Structure (Opening sarvalaghu, development, nadai variation, kuraippu, mora, korvai, return)",
    "Topic 3: Sarvalaghu Development (Expanding rhythmic ideas gradually)",
    "Topic 4: Nadai Variation in Tani (Tasteful subdivision changes)",
    "Topic 5: Kuraippu (Systematically reducing phrase length)",
    "Topic 6: Advanced Mora and Korvai (Calculated endings, correct landing)",
    "Topic 7: Ragam-Tanam-Pallavi Support (Pallavi eduppu, arudi, trikalam awareness)",
    "Topic 8: Professional Concert Etiquette (When to play, what to play, how much, when to stop)"
  ]
};
var KEYBOARD_CARNATIC = {
  "Grade 1": [
    "Topic 1: Instrument Care and Posture (Safe handling, sitting position, relaxed shoulders)",
    "Topic 2: Finger Numbers and Hand Position (Thumb 1 to little finger 5, curved fingers, neutral wrist)",
    "Topic 3: Keyboard Layout (White and black keys, groups of two and three black keys)",
    "Topic 4: Sapta Swaras on the Keyboard (Sa Ri Ga Ma Pa Da Ni orientation)",
    "Topic 5: Selected Tonic (Sa = E, why Sa must be declared)",
    "Topic 6: Five-Finger Swara Patterns (Simple right-hand patterns)",
    "Topic 7: Basic Pulse (Steady counting, short continuous exercises)"
  ],
  "Grade 2": [
    "Topic 1: Sarali Varisai on Keyboard (First swara exercises)",
    "Topic 2: Janta Varisai (Repeated-note control)",
    "Topic 3: Sthayi Development (Tara Sa, octave awareness)",
    "Topic 4: Tonic Mapping (Sa = E and Sa = G, locating swaras from a stated tonic)",
    "Topic 5: Left-Hand Tonic Support (Single Sa or Pa support)",
    "Topic 6: Second Speed Introduction (Playing patterns in two speeds)"
  ],
  "Grade 3": [
    "Topic 1: Dhatu Varisai (Jumping swara patterns on keys)",
    "Topic 2: Three Sthayis (Mandra, Madhya, Tara awareness)",
    "Topic 3: Thumb Crossing (Introductory crossing technique)",
    "Topic 4: Alankaram (Selected Alankarams on keyboard)",
    "Topic 5: Sapta Tala (Seven talas and their structure)",
    "Topic 6: Two-Hand Coordination (Two-hand independence foundations)"
  ],
  "Grade 4": [
    "Topic 1: Geetham on Keyboard (Playing simple compositions)",
    "Topic 2: Raga Identity (Arohanam, Avarohanam, recognising the raga)",
    "Topic 3: Phrase Fingering (Fingering chosen to protect the phrase)",
    "Topic 4: Grace Notes (Introductory ornamentation)",
    "Topic 5: Sa-Pa Drone (Left-hand drone support)",
    "Topic 6: Transposition Introduction (Moving phrases to a new Sa)"
  ],
  "Grade 5": [
    "Topic 1: Jatiswaram (Structure and performance)",
    "Topic 2: Swarajati (Structure and performance)",
    "Topic 3: Raga Classification (Grouping and identifying ragas)",
    "Topic 4: Position Shifts and Substitution (Moving hand positions smoothly)",
    "Topic 5: Three Speeds (First, second and third speed control)",
    "Topic 6: Octave Support and Dynamics (Left-hand octaves, volume shaping, group playing)"
  ],
  "Grade 6": [
    "Topic 1: Varnam on Keyboard (Varnam fingering and stamina)",
    "Topic 2: 72-Melakarta Introduction (The Melakarta system)",
    "Topic 3: Twelve Swarasthanas (Semitone positions, shared positions R2/G1, R3/G2, D2/N1, D3/N2)",
    "Topic 4: M1 and M2 (Shuddha and Prati Madhyama recognition)",
    "Topic 5: Transposition (Playing in different tonics)",
    "Topic 6: Gamaka Approximation (Suggesting gamakas within keyboard limits)"
  ],
  "Grade 7": [
    "Topic 1: Kriti on Keyboard (Kriti fingering and structure)",
    "Topic 2: Sangati and Sahitya (Variations and lyric awareness)",
    "Topic 3: Eduppu (Correct entry points)",
    "Topic 4: Composer Study (Tyagaraja, Muthuswami Dikshitar, Syama Sastri)",
    "Topic 5: Accompaniment Skills (Supporting a vocalist, Bhajan accompaniment)",
    "Topic 6: Kalpana Swara Introduction (Introductory creative swara playing)"
  ],
  "Grade 8": [
    "Topic 1: Raga Lakshana (Grammar and identity of ragas)",
    "Topic 2: Janya and Vakra Forms (Derived and zigzag raga structures)",
    "Topic 3: Short Alapana (Free raga exploration on keyboard)",
    "Topic 4: Developed Kalpana Swara (Creative swara patterns with correct endings)",
    "Topic 5: Gamaka Strategy (Planning ornaments for raga identity)",
    "Topic 6: Ensemble Response (Reacting musically within a group)"
  ],
  "Grade 9": [
    "Topic 1: Advanced Varnam and Kriti (Advanced repertoire and register control)",
    "Topic 2: Alapana Development (Extended raga exploration)",
    "Topic 3: Kalpana Swara (Advanced creative swara playing)",
    "Topic 4: Korappu (Structured rhythmic-melodic reduction)",
    "Topic 5: Concert Accompaniment (Supporting concert items)",
    "Topic 6: Keyboard Controls and Planning (Sound settings, concert preparation)"
  ],
  "Grade 10": [
    "Topic 1: Concert Repertoire (Complete concert-level pieces)",
    "Topic 2: Advanced Manodharma (Independent creative performance)",
    "Topic 3: RTP Awareness (Ragam, Tanam, Pallavi support)",
    "Topic 4: All 72 Melakartas (Complete Melakarta command)",
    "Topic 5: Professional Accompaniment (Concert-grade support)",
    "Topic 6: Ensemble Leadership (Leading and presenting professionally)"
  ]
};
var HARMONIUM = {
  "Grade 1": [
    "Topic 1: Introduction to Harmonium (Keyboard, bellows, reeds, airflow, how sound is produced)",
    "Topic 2: Main Instrument Parts (White keys, black keys, bellows, stops, drone knobs, lid)",
    "Topic 3: Safe Opening, Closing and Care (Correct sequence, storage, clean and safe habits)",
    "Topic 4: Sitting Posture and Placement (Upright spine, relaxed shoulders, centre position, keyboard reach)",
    "Topic 5: Left-Hand Bellows Control (Opening and closing gently, sustained airflow, air-pressure awareness)",
    "Topic 6: Right-Hand Position and Finger Numbers (Curved fingers, neutral wrist, thumb 1 to little finger 5)",
    "Topic 7: Keyboard Layout and Pitch Direction (Black-key groups, higher and lower sound direction)",
    "Topic 8: Selected Tonic and First Swaras (Sa = E, Sa = G, Sa-Pa-upper Sa, introductory S R G M)",
    "Topic 9: Mayamalavagowla Awareness (Introductory Sa, R1, G3, M1 recognition)",
    "Topic 10: Four-Count Pulse and Listening Discipline (Steady count, matching Sa, teacher-led response)"
  ]
  // Grades 2-10: the official Akshara grade breakdown is not yet available —
  // these fall through to AI generation with the Carnatic prompt rules.
};
var WESTERN_THEORY = {
  "Grade 1": [
    "Topic 1: Note Values (Semibreve, minim, crotchet, quaver, tied notes, dotted notes)",
    "Topic 2: Rests (Semibreve, minim, crotchet and quaver rests)",
    "Topic 3: Time Signatures (2/4, 3/4, 4/4, bar lines, grouping of notes)",
    "Topic 4: The Treble Clef (Note names on lines and spaces, middle C)",
    "Topic 5: The Bass Clef (Note names on lines and spaces)",
    "Topic 6: Accidentals (Sharp, flat and natural signs)",
    "Topic 7: Major Scales and Key Signatures (C, G, D and F major)",
    "Topic 8: Tonic Triads (Root position triads of C, G, D and F major)",
    "Topic 9: Basic Terms and Signs (Dynamics p to f, tempo terms, slurs and ties)"
  ],
  "Grade 2": [
    "Topic 1: New Note Values (Semiquavers, dotted quavers, grouping in simple time)",
    "Topic 2: Ledger Lines (Notes above and below the staff)",
    "Topic 3: New Time Signatures (2/2, 3/2, 4/2 and 3/8)",
    "Topic 4: Major Keys to Two Sharps and Flats (A, B flat and E flat major)",
    "Topic 5: Minor Scales Introduction (A, E and D minor, harmonic form)",
    "Topic 6: Intervals by Number (2nd to octave above the tonic)",
    "Topic 7: Triplets (Grouping three notes in the time of two)",
    "Topic 8: Tonic Triads of New Keys (Major and minor tonic triads)",
    "Topic 9: More Terms and Signs (Tempo changes, articulation, dynamics pp to ff)"
  ],
  "Grade 3": [
    "Topic 1: Compound Time (6/8, 9/8, 12/8, grouping and dotted rhythms)",
    "Topic 2: Demisemiquavers (Very short note values and rests)",
    "Topic 3: Major Keys to Four Sharps and Flats (E, A flat major and relatives)",
    "Topic 4: Minor Scales (Harmonic and melodic forms, key signatures)",
    "Topic 5: Intervals by Number and Quality (Major, minor and perfect intervals above the tonic)",
    "Topic 6: Transposition at the Octave (Rewriting melodies an octave up or down)",
    "Topic 7: Four-Bar Rhythm Writing (Completing a rhythm in a given time signature)",
    "Topic 8: Phrase Structure (Question and answer phrases, anacrusis)"
  ],
  "Grade 4": [
    "Topic 1: The Chromatic Scale (Construction and notation)",
    "Topic 2: Double Sharps and Double Flats (Enharmonic equivalents)",
    "Topic 3: Major and Minor Keys to Five Sharps and Flats",
    "Topic 4: Technical Names of Scale Degrees (Tonic, supertonic, mediant, subdominant, dominant)",
    "Topic 5: All Intervals Within an Octave (Including augmented and diminished)",
    "Topic 6: Triads and Chords (Tonic, subdominant and dominant triads, chord identification)",
    "Topic 7: Duplets and Swung Rhythms (Irregular note groupings)",
    "Topic 8: The Alto Clef Introduction (Reading simple melodies in C clef)"
  ],
  "Grade 5": [
    "Topic 1: Irregular Time Signatures (5/4, 7/4, 5/8 and irregular groupings)",
    "Topic 2: All Major and Minor Keys (Up to six sharps and flats, circle of fifths)",
    "Topic 3: The Tenor Clef (Reading and transposing in all four clefs)",
    "Topic 4: Transposition for Orchestral Instruments (Transposing by major 2nd, minor 3rd, perfect 5th)",
    "Topic 5: Compound Intervals (Intervals larger than an octave)",
    "Topic 6: Chords and Inversions (Tonic, supertonic, subdominant, dominant chords in inversion)",
    "Topic 7: Cadence Recognition (Perfect, imperfect and plagal cadences)",
    "Topic 8: Ornaments and Musical Signs (Trill, turn, mordent, acciaccatura, appoggiatura)",
    "Topic 9: Instruments of the Orchestra (Families, ranges and transposing instruments)"
  ],
  "Grade 6": [
    "Topic 1: Harmonic Vocabulary (Diatonic chords in root position and inversions, figured indications)",
    "Topic 2: Cadences and Progressions (Perfect, imperfect, plagal, interrupted cadences)",
    "Topic 3: Melody Writing (Composing a balanced melody for a given opening)",
    "Topic 4: Figuration and Non-Chord Notes (Passing notes, auxiliary notes, suspensions)",
    "Topic 5: Score Reading (Short and open scores, SATB layout)",
    "Topic 6: Baroque and Classical Style (Composers, forms and characteristics)",
    "Topic 7: Analysis of Short Pieces (Keys, modulations, chords and structure)"
  ],
  "Grade 7": [
    "Topic 1: Advanced Harmony (Secondary dominants, dominant sevenths, modulation to related keys)",
    "Topic 2: Continuing a Bass Line or Melody (Stylistic completion exercises)",
    "Topic 3: Counterpoint Basics (Two-part writing, contrary and parallel motion)",
    "Topic 4: Romantic Period Style (Composers, harmony and expression)",
    "Topic 5: Orchestration Awareness (Instrumental colour, reading full scores)",
    "Topic 6: Analysis of Extended Passages (Modulation paths, thematic development)",
    "Topic 7: Historical Context (Performance practice across periods)"
  ],
  "Grade 8": [
    "Topic 1: Chromatic Harmony (Neapolitan sixth, augmented sixth chords, diminished sevenths)",
    "Topic 2: Advanced Modulation (Distant keys, enharmonic modulation)",
    "Topic 3: Completing a Passage in Style (Baroque chorale or trio sonata textures)",
    "Topic 4: Twentieth-Century Techniques (Modes, whole-tone and pentatonic scales, serial ideas)",
    "Topic 5: Full Score Analysis (Orchestral scores, transposing instruments at pitch)",
    "Topic 6: Composers and Repertoire Across History (Medieval to contemporary overview)",
    "Topic 7: Form and Structure (Sonata form, rondo, variations, fugue)"
  ]
};
var PIANO = {
  "Grade 1": [
    "Topic 1: Posture and Hand Position (Sitting height, curved fingers, relaxed wrist)",
    "Topic 2: Note Reading (Treble and bass clef within an octave of middle C)",
    "Topic 3: Five-Finger Patterns (Legato and staccato touch)",
    "Topic 4: Scales (C, G major hands separately, one octave)",
    "Topic 5: Broken Chords (Simple broken triads, hands separately)",
    "Topic 6: Rhythm Basics (Crotchets, minims, quavers, steady pulse)",
    "Topic 7: Dynamics and Expression (Piano, forte, crescendo, diminuendo)",
    "Topic 8: Simple Repertoire (Short pieces in C and G major)"
  ],
  "Grade 2": [
    "Topic 1: Scales (Major and minor scales to two sharps and flats, hands separately)",
    "Topic 2: Broken Chords and Arpeggio Preparation",
    "Topic 3: Hands-Together Coordination (Simple two-hand textures)",
    "Topic 4: Articulation (Slurs, staccato, accents, phrasing)",
    "Topic 5: Sight-Reading Basics (Simple five-finger position pieces)",
    "Topic 6: Aural Skills (Echo clapping, pitch matching, recognising dynamics)",
    "Topic 7: Repertoire (Contrasting pieces from different periods)"
  ],
  "Grade 3": [
    "Topic 1: Scales (Major and minor to four sharps and flats, hands together, two octaves)",
    "Topic 2: Arpeggios (Root position, hands separately)",
    "Topic 3: Chromatic Scale (Beginning on any note)",
    "Topic 4: Finger Independence (Voicing, evenness, thumb-under technique)",
    "Topic 5: Pedalling Introduction (Simple sustain pedal use)",
    "Topic 6: Sight-Reading (Simple pieces with hand position changes)",
    "Topic 7: Repertoire (Baroque, Classical and modern pieces)"
  ],
  "Grade 4": [
    "Topic 1: Scales and Arpeggios (Most major and minor keys, two octaves hands together)",
    "Topic 2: Alberti Bass and Accompaniment Figures",
    "Topic 3: Ornaments (Trills, mordents, grace notes)",
    "Topic 4: Pedalling Technique (Legato pedalling, syncopated pedalling)",
    "Topic 5: Tone Control (Cantabile melody over accompaniment)",
    "Topic 6: Sight-Reading (Keys to three sharps and flats)",
    "Topic 7: Repertoire (Contrasting styles with character and expression)"
  ],
  "Grade 5": [
    "Topic 1: Scales (All keys, four octaves preparation, contrary motion)",
    "Topic 2: Arpeggios and Dominant Sevenths",
    "Topic 3: Velocity and Evenness (Faster passagework, rotation technique)",
    "Topic 4: Rubato and Romantic Phrasing",
    "Topic 5: Balance Between Hands (Voicing melody in chordal textures)",
    "Topic 6: Sight-Reading (Moderate difficulty with pedal)",
    "Topic 7: Repertoire (Sonatina movements, Romantic character pieces)"
  ],
  "Grade 6": [
    "Topic 1: Advanced Scales (Thirds, staccato scales, all keys)",
    "Topic 2: Arpeggios in Inversions",
    "Topic 3: Polyphonic Playing (Two- and three-part Baroque textures)",
    "Topic 4: Advanced Pedalling (Half pedal, una corda)",
    "Topic 5: Structural Interpretation (Sonata form awareness in performance)",
    "Topic 6: Sight-Reading (Full textures with expression)",
    "Topic 7: Repertoire (Bach inventions, Classical sonatas, Romantic and modern works)"
  ],
  "Grade 7": [
    "Topic 1: Virtuosic Technique Foundations (Octaves, double notes, leaps)",
    "Topic 2: Advanced Ornamentation and Style (Baroque and Classical conventions)",
    "Topic 3: Colour and Sonority (Layered voicing, orchestral thinking)",
    "Topic 4: Extended Works (Longer movements, stamina and memory)",
    "Topic 5: Sight-Reading (Advanced, all keys)",
    "Topic 6: Repertoire (Preludes and fugues, full sonata movements, impressionist works)"
  ],
  "Grade 8": [
    "Topic 1: Complete Technical Command (All scales, arpeggios and double notes at speed)",
    "Topic 2: Concert Repertoire (Major works from Baroque to contemporary)",
    "Topic 3: Interpretation and Personal Voice (Stylistic fidelity with individual expression)",
    "Topic 4: Performance Psychology (Stage presence, memory security, recovery)",
    "Topic 5: Advanced Sight-Reading and Quick Study",
    "Topic 6: Programme Building (Balancing a recital programme)"
  ]
};
var VIOLIN = {
  "Grade 1": [
    "Topic 1: Instrument and Bow Hold (Posture, left-hand shape, relaxed bow grip)",
    "Topic 2: Open Strings (G, D, A, E, bowing straight, tone production)",
    "Topic 3: First Finger Patterns (First position, finger placement, intonation)",
    "Topic 4: Simple Scales (D and A major, one octave)",
    "Topic 5: Basic Bowing (Detache, smooth string crossing)",
    "Topic 6: Rhythm and Pulse (Crotchets, minims, quavers with the bow)",
    "Topic 7: Simple Pieces (Folk tunes and easy melodies in first position)"
  ],
  "Grade 2": [
    "Topic 1: Scales (G, D, A major two octaves preparation, natural minor introduction)",
    "Topic 2: Finger Patterns (High and low second finger)",
    "Topic 3: Slurred Bowing (Two and four notes per bow)",
    "Topic 4: Tone Development (Bow speed, weight and contact point)",
    "Topic 5: Sight-Reading Basics (Simple first-position melodies)",
    "Topic 6: Aural Skills (Echo singing, pitch matching)",
    "Topic 7: Repertoire (Contrasting short pieces)"
  ],
  "Grade 3": [
    "Topic 1: Scales and Arpeggios (Majors and minors two octaves)",
    "Topic 2: Introduction to Third Position (Simple shifts)",
    "Topic 3: Bowing Styles (Staccato, martele, string crossings)",
    "Topic 4: Dynamics with the Bow (Controlling volume and colour)",
    "Topic 5: Intonation Refinement (Listening and adjusting)",
    "Topic 6: Sight-Reading (Keys to two sharps and flats)",
    "Topic 7: Repertoire (Dances and character pieces)"
  ],
  "Grade 4": [
    "Topic 1: Position Work (First to third position shifting fluency)",
    "Topic 2: Introduction to Vibrato (Arm and wrist vibrato preparation)",
    "Topic 3: Scales and Arpeggios (Two octaves with shifts)",
    "Topic 4: Advanced Bow Strokes (Spiccato preparation, hooked bowing)",
    "Topic 5: Double Stop Preparation (Open-string double stops)",
    "Topic 6: Sight-Reading (Pieces with position changes)",
    "Topic 7: Repertoire (Concertino movements, expressive pieces)"
  ],
  "Grade 5": [
    "Topic 1: Positions One to Five (Fluent shifting)",
    "Topic 2: Vibrato Development (Consistent expressive vibrato)",
    "Topic 3: Three-Octave Scales Preparation",
    "Topic 4: Spiccato and Sautille (Off-string bowing)",
    "Topic 5: Double Stops (Thirds and sixths introduction)",
    "Topic 6: Sight-Reading (Moderate difficulty, dynamics and articulation)",
    "Topic 7: Repertoire (Concerto movements, sonatas)"
  ],
  "Grade 6": [
    "Topic 1: Advanced Positions (Up to seventh position)",
    "Topic 2: Three-Octave Scales and Arpeggios",
    "Topic 3: Expressive Techniques (Portamento, varied vibrato speeds)",
    "Topic 4: Complex Bowing Patterns (Mixed strokes, chords)",
    "Topic 5: Double Stops (Octaves introduction)",
    "Topic 6: Sight-Reading (Advanced first-to-fifth position)",
    "Topic 7: Repertoire (Baroque sonatas, Romantic showpieces)"
  ],
  "Grade 7": [
    "Topic 1: Virtuosic Left Hand (Fast passagework, trills, harmonics)",
    "Topic 2: Advanced Double Stops (Thirds, sixths, octaves in scales)",
    "Topic 3: Bowing Mastery (Ricochet, flying staccato introduction)",
    "Topic 4: Interpretation (Stylistic awareness across periods)",
    "Topic 5: Sight-Reading (Complex rhythms and positions)",
    "Topic 6: Repertoire (Concerto movements, virtuoso pieces)"
  ],
  "Grade 8": [
    "Topic 1: Complete Technical Command (All scales, arpeggios and double stops at speed)",
    "Topic 2: Concert Repertoire (Major concertos and sonatas)",
    "Topic 3: Advanced Interpretation (Personal voice, historical style)",
    "Topic 4: Performance Skills (Stage presence, memory, ensemble leading)",
    "Topic 5: Advanced Sight-Reading and Quick Study",
    "Topic 6: Orchestral Excerpts Awareness (Common audition passages)"
  ]
};
var GUITAR = {
  "Grade 1": [
    "Topic 1: Instrument Basics (Parts of the guitar, tuning, sitting position)",
    "Topic 2: Right-Hand Technique (Rest stroke, free stroke or pick control)",
    "Topic 3: Open Chords (C, G, D, E minor, A minor)",
    "Topic 4: Simple Strumming Patterns (Down strums, steady pulse)",
    "Topic 5: Single-Note Melodies (First position, open strings and first frets)",
    "Topic 6: Basic Scales (C major one octave)",
    "Topic 7: Simple Pieces and Songs (Melody and chord accompaniment)"
  ],
  "Grade 2": [
    "Topic 1: More Open Chords (A, D minor, E, seventh chords)",
    "Topic 2: Strumming Development (Up and down strums, syncopation)",
    "Topic 3: Fingerstyle Introduction (Simple arpeggiated patterns)",
    "Topic 4: Scales (G and D major, A minor, two positions)",
    "Topic 5: Chord Changes (Smooth transitions in time)",
    "Topic 6: Sight-Reading Basics (First-position melodies)",
    "Topic 7: Repertoire (Easy classical or contemporary pieces)"
  ],
  "Grade 3": [
    "Topic 1: Barre Chord Introduction (F major shape, partial barres)",
    "Topic 2: Fingerstyle Patterns (Alternating bass, arpeggios)",
    "Topic 3: Scales (Two octaves, movable shapes)",
    "Topic 4: Position Playing (Notes up to fifth position)",
    "Topic 5: Dynamics and Tone (Tone colour, ponticello and tasto)",
    "Topic 6: Sight-Reading (Simple two-voice textures)",
    "Topic 7: Repertoire (Classical studies, folk arrangements)"
  ],
  "Grade 4": [
    "Topic 1: Full Barre Chords (Major and minor shapes across the neck)",
    "Topic 2: Advanced Fingerstyle (Independence of thumb and fingers)",
    "Topic 3: Scales and Arpeggios (Major, minor and chromatic, two octaves)",
    "Topic 4: Slurs (Hammer-ons and pull-offs)",
    "Topic 5: Position Shifts (Fluent movement along the neck)",
    "Topic 6: Sight-Reading (Melody with bass line)",
    "Topic 7: Repertoire (Classical pieces, contemporary styles)"
  ],
  "Grade 5": [
    "Topic 1: Advanced Chord Vocabulary (Extended and altered chords)",
    "Topic 2: Ornaments and Slur Combinations (Trills, grace notes)",
    "Topic 3: Scales (Three octaves where practical, all positions)",
    "Topic 4: Tremolo Introduction (Classical tremolo technique)",
    "Topic 5: Natural and Artificial Harmonics",
    "Topic 6: Sight-Reading (Multi-voice textures)",
    "Topic 7: Repertoire (Intermediate classical and fingerstyle works)"
  ],
  "Grade 6": [
    "Topic 1: Advanced Technique (Speed, accuracy, right-hand control)",
    "Topic 2: Polyphonic Playing (Independent voices, counterpoint)",
    "Topic 3: Advanced Harmonics and Percussive Effects",
    "Topic 4: Interpretation (Phrasing, rubato, stylistic awareness)",
    "Topic 5: Sight-Reading (Advanced positions and textures)",
    "Topic 6: Repertoire (Renaissance to modern guitar literature)"
  ],
  "Grade 7": [
    "Topic 1: Virtuosic Studies (Villa-Lobos style etudes, advanced arpeggios)",
    "Topic 2: Advanced Tremolo and Rasgueado",
    "Topic 3: Complete Fingerboard Knowledge (All keys in all positions)",
    "Topic 4: Stylistic Breadth (Baroque transcriptions, Spanish repertoire, modern works)",
    "Topic 5: Sight-Reading (Complex polyphony)",
    "Topic 6: Repertoire (Concert-level solo pieces)"
  ],
  "Grade 8": [
    "Topic 1: Complete Technical Command (All scales, arpeggios and slur patterns at speed)",
    "Topic 2: Concert Repertoire (Major works of the guitar literature)",
    "Topic 3: Advanced Interpretation (Personal voice, period style)",
    "Topic 4: Performance Skills (Stage presence, memory, programming)",
    "Topic 5: Advanced Sight-Reading and Quick Study",
    "Topic 6: Arrangement Awareness (Adapting music for guitar)"
  ]
};
var WESTERN_VOCAL = {
  "Grade 1": [
    "Topic 1: Posture and Breathing (Aligned posture, diaphragmatic breath support)",
    "Topic 2: Pitch Matching (Singing back single notes and simple patterns)",
    "Topic 3: Simple Scales and Warm-Ups (Five-note patterns, humming, vowels)",
    "Topic 4: Diction Basics (Clear vowels and consonants)",
    "Topic 5: Rhythm in Singing (Keeping pulse, simple note values)",
    "Topic 6: Simple Songs (Folk songs and easy melodies within an octave)"
  ],
  "Grade 2": [
    "Topic 1: Breath Control Development (Longer phrases, sustained notes)",
    "Topic 2: Extending Range (Comfortable notes above and below the middle range)",
    "Topic 3: Major Scales and Arpeggios (Sung with letter names or solfege)",
    "Topic 4: Dynamics in Singing (Soft and loud with support)",
    "Topic 5: Simple Sight-Singing (Stepwise melodies)",
    "Topic 6: Repertoire (Contrasting songs with accompaniment)"
  ],
  "Grade 3": [
    "Topic 1: Tone Quality (Resonance, avoiding strain, open throat)",
    "Topic 2: Minor Scales and Intervals (Singing minor patterns and simple intervals)",
    "Topic 3: Legato and Phrasing (Smooth lines, phrase shaping)",
    "Topic 4: Diction in Performance (Text clarity, word stress)",
    "Topic 5: Sight-Singing (Simple leaps and dotted rhythms)",
    "Topic 6: Repertoire (Art songs, musical theatre, traditional songs)"
  ],
  "Grade 4": [
    "Topic 1: Register Blending (Smooth transitions between chest and head voice)",
    "Topic 2: Agility (Faster scale passages, simple melisma)",
    "Topic 3: Expression and Interpretation (Communicating the meaning of a song)",
    "Topic 4: Foreign Language Introduction (Simple Italian or other language songs)",
    "Topic 5: Sight-Singing (Wider range and varied rhythms)",
    "Topic 6: Repertoire (Contrasting periods and styles)"
  ],
  "Grade 5": [
    "Topic 1: Advanced Breath Management (Dynamic control across long phrases)",
    "Topic 2: Vibrato Awareness (Natural, healthy vibrato)",
    "Topic 3: Ornamentation Introduction (Simple Baroque and classical ornaments)",
    "Topic 4: Language Repertoire (Italian, German or French songs)",
    "Topic 5: Sight-Singing (Chromatic notes, minor keys)",
    "Topic 6: Repertoire (Art song, opera or musical theatre selections)"
  ],
  "Grade 6": [
    "Topic 1: Vocal Colour and Dynamics (Messa di voce, tonal variety)",
    "Topic 2: Advanced Agility (Runs, coloratura preparation)",
    "Topic 3: Stylistic Awareness (Baroque, Classical, Romantic, contemporary styles)",
    "Topic 4: Recitative and Aria Introduction",
    "Topic 5: Sight-Singing (Advanced intervals and modulation)",
    "Topic 6: Repertoire (Extended works in multiple languages)"
  ],
  "Grade 7": [
    "Topic 1: Advanced Technique (Full range command, sustained tessitura)",
    "Topic 2: Dramatic Interpretation (Character, text painting, stage presence)",
    "Topic 3: Complex Ornamentation (Cadenzas, da capo variation)",
    "Topic 4: Ensemble Singing Awareness (Duets, blending)",
    "Topic 5: Sight-Singing (Complex rhythms and chromaticism)",
    "Topic 6: Repertoire (Opera arias, lieder, oratorio, advanced musical theatre)"
  ],
  "Grade 8": [
    "Topic 1: Complete Vocal Command (Technical security across the full range)",
    "Topic 2: Recital Repertoire (Programme spanning periods and languages)",
    "Topic 3: Advanced Interpretation (Personal artistry, stylistic fidelity)",
    "Topic 4: Performance Psychology (Stagecraft, memory, recovery)",
    "Topic 5: Advanced Sight-Singing and Quick Study",
    "Topic 6: Vocal Health (Sustainable technique, care of the voice)"
  ]
};
var makeWesternInstrumentTopics = (name, t) => ({
  "Grade 1": [
    `Topic 1: Instrument Basics (Parts of the ${name}, care, posture and hold)`,
    `Topic 2: Sound Production (${t.found})`,
    "Topic 3: Note Reading Basics (Staff notation, note names, simple rhythms)",
    "Topic 4: First Scales (C and G major, one octave)",
    "Topic 5: Rhythm and Pulse (Crotchets, minims, quavers, steady beat)",
    "Topic 6: Simple Pieces (Easy melodies and folk tunes)"
  ],
  "Grade 2": [
    `Topic 1: Technique Development (${t.found})`,
    "Topic 2: Scales (Major keys to two sharps and flats, minor scale introduction)",
    "Topic 3: Articulation and Dynamics (Legato, staccato, soft and loud playing)",
    "Topic 4: Sight-Reading Basics (Simple stepwise melodies)",
    "Topic 5: Aural Skills (Echo patterns, pitch matching, pulse recognition)",
    "Topic 6: Repertoire (Contrasting short pieces)"
  ],
  "Grade 3": [
    `Topic 1: Intermediate Technique (${t.inter})`,
    "Topic 2: Scales and Arpeggios (Majors and minors to four sharps and flats)",
    "Topic 3: Tone Quality (Evenness, control, projection)",
    "Topic 4: Phrasing (Shaping musical lines, breathing/bowing/picking plans)",
    "Topic 5: Sight-Reading (Keys to two sharps and flats)",
    "Topic 6: Repertoire (Dances and character pieces)"
  ],
  "Grade 4": [
    `Topic 1: Technique Expansion (${t.inter})`,
    "Topic 2: Scales and Arpeggios (Wider keys and ranges)",
    "Topic 3: Ornaments (Grace notes, trills, simple decorations)",
    "Topic 4: Ensemble Skills (Playing in time with others, balance)",
    "Topic 5: Sight-Reading (Pieces with position or register changes)",
    "Topic 6: Repertoire (Contrasting styles with character and expression)"
  ],
  "Grade 5": [
    `Topic 1: Advanced-Intermediate Technique (${t.inter})`,
    "Topic 2: Scales (All common keys, extended range)",
    "Topic 3: Expressive Playing (Rubato, dynamics shading, tonal colour)",
    "Topic 4: Style Awareness (Baroque, Classical, Romantic and modern styles)",
    "Topic 5: Sight-Reading (Moderate difficulty with expression marks)",
    "Topic 6: Repertoire (Sonatina-level and characteristic works)"
  ],
  "Grade 6": [
    `Topic 1: Advanced Technique (${t.adv})`,
    "Topic 2: Scales and Arpeggios (All keys, faster tempi)",
    "Topic 3: Interpretation (Structural awareness, period style)",
    "Topic 4: Extended Works (Longer movements, stamina)",
    "Topic 5: Sight-Reading (Full textures with expression)",
    "Topic 6: Repertoire (Intermediate-advanced literature)"
  ],
  "Grade 7": [
    `Topic 1: Virtuosic Foundations (${t.adv})`,
    "Topic 2: Complete Key Command (All scales and arpeggios at speed)",
    "Topic 3: Advanced Interpretation (Stylistic fidelity across periods)",
    "Topic 4: Performance Stamina (Extended programmes, memory)",
    "Topic 5: Sight-Reading (Complex rhythms and keys)",
    "Topic 6: Repertoire (Advanced concert works)"
  ],
  "Grade 8": [
    `Topic 1: Complete Technical Command (${t.adv})`,
    "Topic 2: Concert Repertoire (Major works of the instrument\u2019s literature)",
    "Topic 3: Personal Interpretation (Individual voice with stylistic fidelity)",
    "Topic 4: Performance Skills (Stage presence, memory security, recovery)",
    "Topic 5: Advanced Sight-Reading and Quick Study",
    "Topic 6: Programme Building (Balancing a recital programme)"
  ]
});
var DRUMS = {
  "Grade 1": [
    "Topic 1: Kit Basics (Parts of the drum kit, setup, posture, stick grip)",
    "Topic 2: First Strokes (Full, down, tap and up strokes on the snare)",
    "Topic 3: Reading Drum Notation (Kit staff, note values, rests)",
    "Topic 4: Basic Rock Beat (Kick, snare and hi-hat coordination in 4/4)",
    "Topic 5: Simple Fills (One-bar crotchet and quaver fills)",
    "Topic 6: Pulse and Timing (Playing with a metronome, steady tempo)"
  ],
  "Grade 2": [
    "Topic 1: Rudiment Foundations (Single stroke roll, double stroke roll, single paradiddle)",
    "Topic 2: Groove Development (Eighth-note rock and pop beats, hi-hat variations)",
    "Topic 3: Fills and Dynamics (Two-bar fills, accents, ghost note introduction)",
    "Topic 4: Reading Development (Groove charts, repeat signs)",
    "Topic 5: Aural Skills (Echo rhythms, recognising tempo changes)",
    "Topic 6: Song Playing (Keeping a beat through a full song form)"
  ],
  "Grade 3": [
    "Topic 1: Rudiment Development (Flams, drags, paradiddle variations)",
    "Topic 2: Groove Styles (Rock, pop and 12/8 blues shuffles)",
    "Topic 3: Sixteenth-Note Patterns (Hands and kick drum sixteenths)",
    "Topic 4: Hi-Hat Technique (Foot splashes, open and closed sounds)",
    "Topic 5: Sight-Reading (Simple kit parts with fills)",
    "Topic 6: Musical Form (Intros, verses, choruses, endings)"
  ],
  "Grade 4": [
    "Topic 1: Advanced Rudiments (Five and nine stroke rolls, flam taps)",
    "Topic 2: Groove Vocabulary (Funk sixteenth grooves, syncopation, ghost notes)",
    "Topic 3: Coordination Studies (Four-way independence foundations)",
    "Topic 4: Odd Time Introduction (3/4 and 6/8 grooves)",
    "Topic 5: Sight-Reading (Charts with dynamics and accents)",
    "Topic 6: Style Studies (Rock, funk, blues and pop feels)"
  ],
  "Grade 5": [
    "Topic 1: Rudiment Application (Applying rudiments around the kit)",
    "Topic 2: Latin and World Grooves (Bossa nova, samba introduction)",
    "Topic 3: Jazz Foundations (Swing ride pattern, comping introduction)",
    "Topic 4: Odd Time Signatures (5/4 and 7/8 grooves)",
    "Topic 5: Soloing Basics (Two and four bar solo phrases, trading fours)",
    "Topic 6: Sight-Reading (Medium-difficulty charts)"
  ],
  "Grade 6": [
    "Topic 1: Advanced Coordination (Full four-way independence)",
    "Topic 2: Jazz Development (Comping, brushes introduction, up-tempo swing)",
    "Topic 3: Latin Styles (Afro-Cuban patterns, songo and mambo introduction)",
    "Topic 4: Advanced Fills and Phrasing (Over-the-barline ideas, quintuplets)",
    "Topic 5: Chart Reading (Big band style figures and kicks)",
    "Topic 6: Dynamic Control (Playing musically at all volumes)"
  ],
  "Grade 7": [
    "Topic 1: Virtuosic Technique (Speed, endurance, finger control, Moeller technique)",
    "Topic 2: Advanced Styles (Fusion, drum and bass, metal double kick foundations)",
    "Topic 3: Metric Modulation (Implied time and tempo shifts)",
    "Topic 4: Extended Soloing (Structured solos, thematic development)",
    "Topic 5: Advanced Reading (Complex charts at sight)",
    "Topic 6: Studio Awareness (Playing to click, tone choices)"
  ],
  "Grade 8": [
    "Topic 1: Complete Technical Command (All rudiments at speed around the kit)",
    "Topic 2: Complete Style Command (Rock, jazz, Latin, funk and odd-time mastery)",
    "Topic 3: Musical Leadership (Driving a band, arrangement awareness)",
    "Topic 4: Concert Solo Performance (Extended solo construction)",
    "Topic 5: Advanced Sight-Reading and Quick Study",
    "Topic 6: Professional Practice (Gig preparation, sound checks, equipment care)"
  ]
};
var OTHER_WESTERN_INSTRUMENTS = {
  "Trumpet": {
    found: "Embouchure formation, breath support, first valve combinations",
    inter: "Lip flexibility, tonguing styles, slurs across harmonics",
    adv: "Double and triple tonguing, extended range, vibrato control"
  },
  "Saxophone": {
    found: "Embouchure, reed care, breath support, first fingerings",
    inter: "Tonguing styles, dynamic control, register evenness",
    adv: "Altissimo preparation, vibrato, advanced articulation and subtone"
  },
  "Flute": {
    found: "Embouchure and air stream, head-joint tone, first fingerings",
    inter: "Breath control, tonguing, second octave and tone colours",
    adv: "Vibrato, third octave, double tonguing and harmonics"
  },
  "Bass Guitar": {
    found: "Right-hand plucking, fretting-hand position, open-string grooves",
    inter: "Scale patterns across the neck, slap basics, locking with the drums",
    adv: "Advanced grooves, soloing, harmonics, slap and tap techniques"
  },
  "Cello": {
    found: "Bow hold, sitting posture, open strings, first position",
    inter: "Shifting to fourth position, vibrato preparation, string crossings",
    adv: "Thumb position, advanced vibrato, double stops"
  },
  "Trombone": {
    found: "Embouchure, breath support, slide positions one to three",
    inter: "Legato tonguing, all seven slide positions, lip slurs",
    adv: "Alternate positions, extended range, advanced legato style"
  },
  "Organ": {
    found: "Manual technique, posture at the console, basic registration",
    inter: "Pedal technique, legato fingering and substitution, hymn playing",
    adv: "Advanced registration, trio textures, organ literature"
  },
  "Ukulele": {
    found: "Holding and tuning, first chords (C, F, G7), simple strums",
    inter: "Fingerpicking patterns, barre chords, movable shapes",
    adv: "Campanella style, solo arrangements, advanced strumming"
  },
  "Clarinet": {
    found: "Embouchure, reed care, breath support, first fingerings",
    inter: "Crossing the break, tonguing, dynamic control",
    adv: "Altissimo register, advanced articulation, tone colours"
  },
  "Harmonica": {
    found: "Single-note playing, breath control, hole numbering",
    inter: "Note bending, cross-harp second position, articulation",
    adv: "Overblows, advanced positions, tongue-blocking textures"
  },
  "Viola": {
    found: "Bow hold, posture, open strings, alto clef basics, first position",
    inter: "Third position shifting, vibrato preparation, tone development",
    adv: "Higher positions, double stops, advanced vibrato"
  },
  "Oboe": {
    found: "Embouchure, reed basics, breath support, first fingerings",
    inter: "Breath management, tonguing, half-hole and octave keys",
    adv: "Reed adjustment, vibrato, advanced fingerings"
  },
  "French Horn": {
    found: "Embouchure, right-hand position in the bell, first harmonics",
    inter: "Lip slurs, accuracy across harmonics, stopped horn introduction",
    adv: "Extended range, stopped horn technique, transposition"
  },
  "Banjo": {
    found: "Holding and tuning, basic rolls (forward, backward), first chords",
    inter: "Alternating rolls, slides, hammer-ons and pull-offs",
    adv: "Melodic style, up-the-neck playing, backup techniques"
  },
  "Accordion": {
    found: "Bellows control, right-hand keyboard position, first bass buttons",
    inter: "Bellows shading, stradella bass patterns, register switches",
    adv: "Advanced bellows techniques, complex bass work, style repertoire"
  }
};
var INSTRUMENT_FACTS = {
  "Veena": [
    "The player sits cross-legged on the floor.",
    "The kudam (large resonator) rests ON THE FLOOR at the player's right side \u2014 never on the lap, shoulder or head.",
    "The small gourd (surakkai) rests on or near the player's left thigh; the neck slopes diagonally up to the left.",
    "The right hand plucks the strings (index and middle fingers on the main strings, little finger strums the tala strings); the left hand presses and slides on the frets.",
    "The Saraswati veena has 4 main playing strings and 3 tala (side/drone) strings, with 24 fixed frets.",
    "The instrument is tuned to the selected Sa; always state Sa in any pitch-dependent question."
  ],
  "Mridangam": [
    "The Valanthalai is the smaller RIGHT-side head and produces the higher/treble sound.",
    "The Thoppi is the larger LEFT-side head and produces the bass sound.",
    "The black central spot (karanai) is on the right head.",
    "Basic strokes: Tha, Dhi and Nam are right-hand strokes; Thom is the left-hand bass stroke; Chapu is a sharp right-hand stroke.",
    "The player sits cross-legged with the mridangam placed horizontally and stable in front, right head to the right.",
    "Adi Tala has 8 counts (clap + 3 finger counts + clap + wave + clap + wave)."
  ],
  "Tabla": [
    "The tabla is a PAIR of drums: the smaller wooden dayan (right drum) and the larger metal-bodied bayan (left/bass drum).",
    "Both drum heads carry a black tuning paste (syahi).",
    "It is played with the fingers and palms, never with sticks.",
    "The player sits cross-legged with both drums in front.",
    "Common bols: Na, Tin, Ta on the dayan; Ge, Ke on the bayan; Dha = Na + Ge together; Dhin = Tin + Ge together.",
    "Teentaal has 16 matras in four vibhags; sam is matra 1 and khali is matra 9."
  ],
  "Sitar": [
    "The player sits cross-legged with the gourd resting on the LEFT foot/thigh and the neck sloping up at an angle.",
    "The strings are plucked with a wire plectrum called a mizrab worn on the RIGHT index finger.",
    "The left hand presses and pulls the strings on curved movable frets.",
    "Meend is the glide produced by pulling the string sideways across the fret.",
    "The sitar has main playing strings, chikari (rhythm/drone) strings, and sympathetic (tarab) strings that resonate underneath.",
    "Basic mizrab strokes: da (inward), ra (outward), diri (da-ra fast pair)."
  ],
  "Vocal (Hindustani)": [
    "The sargam swaras are Sa Re Ga Ma Pa Dha Ni.",
    "Komal (flattened) swaras are Re, Ga, Dha, Ni; Ma is the only swara with a tivra (raised) form; Sa and Pa are immovable.",
    "The three saptaks are mandra (low), madhya (middle) and taar (high).",
    "Teentaal has 16 matras, Keherwa 8, Dadra 6, Jhaptaal 10, Rupak 7, Ektaal 12.",
    "Sam is the first matra of the taal cycle; khali is the waved (empty) beat.",
    "A khayal bandish has two sections: sthayi (lower/main) and antara (upper/second)."
  ],
  "Harmonium": [
    "The LEFT hand pumps the bellows; the RIGHT hand plays the keyboard.",
    "Sound is produced by air from the bellows passing over free reeds.",
    "Black keys repeat in groups of two and three; there is no black key between E-F or B-C.",
    "Finger numbering: thumb = 1, index = 2, middle = 3, ring = 4, little = 5.",
    "The tonic Sa must be stated in any pitch question (e.g. if Sa = E, then Pa = B; if Sa = G, then Pa = D)."
  ],
  "Keyboard (Carnatic)": [
    "Swara-to-semitone distances above Sa: S=0, R1=1, R2/G1=2, R3/G2=3, G3=4, M1=5, M2=6, P=7, D1=8, D2/N1=9, D3/N2=10, N3=11, upper S=12.",
    "Shared physical positions: R2=G1, R3=G2, D2=N1, D3=N2.",
    "If Sa = E: R1=F, G3=G#, M1=A, P=B, N3=D#. If Sa = G: R1=G#, G3=B, M1=C, P=D.",
    "Finger numbering: thumb = 1, index = 2, middle = 3, ring = 4, little = 5.",
    "Always state the selected Sa in any pitch-dependent question."
  ],
  "Violin (Carnatic)": [
    "The Carnatic violin is played SEATED cross-legged, with the scroll resting on the player's right ankle/foot and the body against the chest \u2014 not under the chin as in Western playing.",
    "The bow is held in the right hand; the left hand fingers the strings and produces gamakas by sliding.",
    "The four strings are tuned to Sa Pa Sa Pa (lower to higher) relative to the chosen sruti.",
    "Baluswami Dikshitar (brother of Muthuswami Dikshitar) adapted the violin into Carnatic music.",
    "Parts: body, fingerboard, tailpiece, scroll, bridge, pegs, sound post."
  ],
  "Flute (Carnatic)": [
    "The Carnatic flute (venu/pullanguzhal) is a transverse bamboo flute with 8 holes; it is held horizontally.",
    "Sound is produced by blowing across the embouchure hole; tonguing articulates the notes.",
    "Fingering and half-holing produce gamakas; beginners often start varisais in Harikambodhi on the flute.",
    "Different flute lengths give different sruti (pitch); the player chooses the flute to match the singer or ensemble."
  ],
  "Tavil": [
    "The Tavil (Thavil) is a barrel-shaped South Indian drum played with a stick in the LEFT hand and the fingers (with hard thimbles/caps) of the RIGHT hand.",
    "It is the traditional partner of the Nadaswaram; together they are called Mangala Vadyam and Raja Vadyam and are played at temples and auspicious occasions.",
    "It is played standing or seated with the drum hung from the shoulder or resting in front.",
    "Basic vocabulary includes Pillaiyar paadam, Oru/Iru/Nangu Vazhi Paadam, mohra, korvai and arudhi."
  ],
  "Bharatanatyam (Dance)": [
    "Bharatanatyam is a classical dance of Tamil Nadu based on the Natyasastra and Abhinayadarpanam.",
    "Adavus are the basic dance units; a korvai is a sequence of adavus; a tirmanam is a concluding rhythmic phrase.",
    "Hastas: asamyuta (single-hand) and samyuta (double-hand) gestures, each with viniyogas (uses); Pataka is the first asamyuta hasta.",
    "Abhinaya has four types: Angika, Vachika, Aharya, Sattvika.",
    "The Margam order: Alarippu, Jatiswaram, Shabdam, Varnam, Padam/Javali, Thillana.",
    "Bhedas: Siro (head), Drishti (eye), Griva (neck) movements."
  ],
  "Sangeetham (Vocal)": [
    "The sapta swaras are Sa Ri Ga Ma Pa Da Ni.",
    "Adi Tala = Chatusra Jathi Triputa Tala = 4+2+2 = 8 counts.",
    "Mayamalavagowla is the traditional beginner raga for Sarali Varisai.",
    "The Carnatic Trinity: Tyagaraja, Muthuswami Dikshitar, Syama Sastri (Purandaradasa is the Pitamaha/father of Carnatic music).",
    "Kriti sections in order: Pallavi, Anupallavi, Charanam.",
    "Eduppu types: Samam (starts on the beat), Ateeta (starts before the beat), Anagata (starts after the beat)."
  ]
};
var getInstrumentFacts = (subject) => INSTRUMENT_FACTS[subject] ?? [];
var makeHindustaniMelodicTopics = (name, t) => ({
  "Grade 1": [
    `Topic 1: ${name} Basics (Care, posture and hold, ${t.found})`,
    "Topic 2: Sargam Introduction (Sa Re Ga Ma Pa Dha Ni, ascending and descending)",
    "Topic 3: Shuddha Swaras (The seven natural notes, matching the tanpura Sa)",
    "Topic 4: Basic Pulse (Steady matra counting, clapping the beat)",
    "Topic 5: Simple Alankar (Straight sargam patterns in madhya saptak)",
    "Topic 6: Listening Discipline (Matching Sa, listening before playing/singing)"
  ],
  "Grade 2": [
    `Topic 1: Technique Development (${t.found})`,
    "Topic 2: Alankar Patterns (Paltas: SaReGa ReGaMa sequences, ascending-descending)",
    "Topic 3: Saptak Awareness (Mandra, madhya and taar saptak)",
    "Topic 4: Taal Introduction (Keherwa 8 matras, Dadra 6 matras, theka bols)",
    "Topic 5: Komal Swaras Introduction (Komal Re, Ga, Dha, Ni)",
    "Topic 6: Simple Exercises (Sargam in one speed with steady laya)"
  ],
  "Grade 3": [
    `Topic 1: Intermediate Technique (${t.inter})`,
    "Topic 2: All Twelve Swaras (Shuddha, komal and tivra Ma positions)",
    "Topic 3: Teentaal (16 matras, four vibhags, sam and khali)",
    "Topic 4: Alankar in Two Speeds (Barabar and dugun laya)",
    "Topic 5: Raag Bilawal Introduction (Aaroh, avroh, the natural-note raag)",
    "Topic 6: Ear Training (Recognising higher and lower swaras)"
  ],
  "Grade 4": [
    `Topic 1: Technique Expansion (${t.inter})`,
    "Topic 2: First Raags (Bilawal, Yaman introduction \u2014 aaroh, avroh, pakad)",
    "Topic 3: Vadi and Samvadi (Important swaras of a raag)",
    "Topic 4: Taal Variety (Jhaptaal 10 matras, revision of Teentaal/Keherwa/Dadra)",
    "Topic 5: Simple Bandish (Sthayi of an easy composition)",
    "Topic 6: Laya Discipline (Keeping the theka steady while performing)"
  ],
  "Grade 5": [
    `Topic 1: Advanced-Intermediate Technique (${t.inter})`,
    "Topic 2: Raag Development (Yaman, Bhupali, Kafi \u2014 characteristics and pakad)",
    "Topic 3: Bandish Repertoire (Sthayi and antara of learnt compositions)",
    "Topic 4: Aaroh-Avroh Mastery (Jati classification: audav, shadav, sampurna)",
    "Topic 5: Three Speeds (Barabar, dugun, chaugun laya)",
    "Topic 6: Taal Depth (Rupak 7 matras, khali and bhari awareness)"
  ],
  "Grade 6": [
    `Topic 1: Advanced Technique (${t.adv})`,
    "Topic 2: Raag Expansion (Khamaj, Bhairav, Bihag \u2014 thaat awareness)",
    "Topic 3: Alap Introduction (Slow raag exploration without taal)",
    "Topic 4: Bandish Performance (Complete compositions with expression)",
    "Topic 5: The Ten Thaats (Classification system of raags)",
    "Topic 6: Taan Preparation (Fast sargam runs within the raag)"
  ],
  "Grade 7": [
    `Topic 1: Virtuosic Foundations (${t.adv})`,
    "Topic 2: Alap Development (Structured raag unfolding, nyas swaras)",
    "Topic 3: Taan and Layakari (Fast passages, rhythmic play against the theka)",
    "Topic 4: Raag Comparison (Distinguishing similar raags, time theory of raags)",
    "Topic 5: Advanced Taals (Ektaal 12 matras, Choutaal awareness)",
    "Topic 6: Gharana Awareness (Major traditions and their styles)"
  ],
  "Grade 8": [
    `Topic 1: Advanced Repertoire (${t.adv})`,
    "Topic 2: Advanced Raags (Marwa, Purvi, Todi families)",
    "Topic 3: Improvisation (Alap, taan and layakari within a performance)",
    "Topic 4: Bada and Chota Khayal Structure",
    "Topic 5: Ornamentation (Meend, kan, murki, gamak)",
    "Topic 6: Stage Presentation (Complete raag performance with taal)"
  ],
  "Grade 9": [
    "Topic 1: Concert Repertoire (Extended raag presentations)",
    "Topic 2: Advanced Improvisation (Independent alap-jod-bandish development)",
    "Topic 3: Rare Raags and Jod Raags (Compound and seasonal raags)",
    "Topic 4: Accompaniment Skills (Working with tabla and tanpura)",
    "Topic 5: Music History (Great masters and gharana lineages)",
    "Topic 6: Performance Stamina (Full-length presentations)"
  ],
  "Grade 10": [
    "Topic 1: Complete Command (Full technical and raag mastery)",
    "Topic 2: Concert Performance (Complete recital planning and delivery)",
    "Topic 3: Advanced Raag Science (Shruti awareness, raag time cycle, rasa)",
    "Topic 4: Personal Style (Individual expression within tradition)",
    "Topic 5: Teaching Awareness (Explaining and demonstrating fundamentals)",
    "Topic 6: Professional Etiquette (Stage discipline, respecting the tradition)"
  ]
});
var TABLA_HINDUSTANI = {
  "Grade 1": [
    "Topic 1: Introduction to Tabla (The dayan and bayan pair, parts, syahi, care)",
    "Topic 2: Sitting Posture and Placement (Cross-legged posture, drum angles)",
    "Topic 3: Basic Bols (Na, Tin, Ta on dayan; Ge, Ke on bayan)",
    "Topic 4: Hand Position (Finger and palm placement on each drum)",
    "Topic 5: Combined Bols (Dha = Na + Ge, Dhin = Tin + Ge)",
    "Topic 6: Matra Counting (Steady beat, clapping and reciting)"
  ],
  "Grade 2": [
    "Topic 1: Bol Clarity (Clean separation of each stroke)",
    "Topic 2: Keherwa Taal (8 matras, theka Dha Ge Na Tin Na Ke Dhin Na)",
    "Topic 3: Dadra Taal (6 matras, theka Dha Dhin Na Dha Tin Na)",
    "Topic 4: Bol Recitation (Padhant \u2014 saying before playing)",
    "Topic 5: Simple Combinations (DhaGe, NaKe, TiRaKiTa introduction)",
    "Topic 6: Practice Discipline (Slow steady repetition)"
  ],
  "Grade 3": [
    "Topic 1: Teentaal (16 matras, four vibhags, sam, khali on 9th matra)",
    "Topic 2: Theka Mastery (Playing Teentaal steadily at slow tempo)",
    "Topic 3: TiRaKiTa Development (Clean four-stroke rolls)",
    "Topic 4: Simple Kaida Introduction (Theme with basic development)",
    "Topic 5: Sam and Khali (Feeling the cycle, showing the sam)",
    "Topic 6: Laya Control (Playing without rushing or dragging)"
  ],
  "Grade 4": [
    "Topic 1: Kaida Development (Palta variations of a kaida theme)",
    "Topic 2: Tihai Introduction (Three-time repetition landing on sam)",
    "Topic 3: Jhaptaal (10 matras, theka Dhin Na Dhin Dhin Na, Tin Na Dhin Dhin Na)",
    "Topic 4: Dugun Laya (Double-speed playing within the cycle)",
    "Topic 5: Bayan Control (Ghumki and bass modulation basics)",
    "Topic 6: Padhant Skills (Reciting compositions with hand-taal)"
  ],
  "Grade 5": [
    "Topic 1: Multiple Kaidas (Kaidas in Teentaal and Jhaptaal)",
    "Topic 2: Rela Introduction (Fast flowing compositions)",
    "Topic 3: Rupak Taal (7 matras, khali on sam)",
    "Topic 4: Tukra and Mukhda (Short cadential compositions)",
    "Topic 5: Accompaniment Basics (Supporting a melody in Keherwa/Dadra)",
    "Topic 6: Three Speeds (Barabar, dugun, chaugun)"
  ],
  "Grade 6": [
    "Topic 1: Ektaal (12 matras, theka and structure)",
    "Topic 2: Kaida-Rela Development (Extended variation sets)",
    "Topic 3: Chakradar Tihai (Tihai of tihais)",
    "Topic 4: Accompaniment Skills (Khayal accompaniment, following the bandish)",
    "Topic 5: Gharana Awareness (Delhi, Ajrara, Lucknow, Farukhabad, Benares, Punjab)",
    "Topic 6: Tonal Quality (Clarity and balance between drums)"
  ],
  "Grade 7": [
    "Topic 1: Advanced Kaidas (Complex themes with chalan)",
    "Topic 2: Gat and Paran (Traditional solo compositions)",
    "Topic 3: Layakari (Aad, kuad \u2014 playing against the beat)",
    "Topic 4: Choutaal and Dhamar (Pakhawaj-derived taals awareness)",
    "Topic 5: Solo Structure (Peshkar, kaida, rela, tukra ordering)",
    "Topic 6: Advanced Accompaniment (Instrumental and vocal styles)"
  ],
  "Grade 8": [
    "Topic 1: Peshkar Development (Opening a tabla solo)",
    "Topic 2: Advanced Relas and Rous (Speed with clarity)",
    "Topic 3: Chakradar and Farmaishi Compositions",
    "Topic 4: Uncommon Taals (Pancham Sawari, Ada Choutaal awareness)",
    "Topic 5: Improvisation Within Kaida Rules",
    "Topic 6: Complete Solo Performance (Structured 15-minute solo)"
  ],
  "Grade 9": [
    "Topic 1: Concert Solo Repertoire (Extended traditional compositions)",
    "Topic 2: Advanced Layakari (Complex cross-rhythms)",
    "Topic 3: Gharana Repertoire (Signature compositions of major gharanas)",
    "Topic 4: Concert Accompaniment (Khayal, instrumental and dance support)",
    "Topic 5: History of Tabla (Masters and lineages)",
    "Topic 6: Stage Craft (Tuning on stage, presentation discipline)"
  ],
  "Grade 10": [
    "Topic 1: Complete Command (All taals, kaidas and compositions at speed)",
    "Topic 2: Full Solo Performance (Peshkar to chakradar, professionally structured)",
    "Topic 3: Sensitive Accompaniment (When to lead, when to support)",
    "Topic 4: Personal Style Within Tradition",
    "Topic 5: Teaching Awareness (Explaining bols and structure)",
    "Topic 6: Professional Etiquette (Concert discipline and tradition)"
  ]
};
var HINDUSTANI_INSTRUMENTS = {
  "Vocal (Hindustani)": {
    found: "posture, breath support, open-throat aakar practice",
    inter: "voice flexibility across saptaks, sustained swaras, breath phrases",
    adv: "taan agility, meend and murki, dynamic control"
  },
  "Sitar": {
    found: "sitting position, mizrab grip, da and ra strokes, open string clarity",
    inter: "fretting accuracy, diri strokes, simple meend (one-swara glide)",
    adv: "extended meend, krintan and zamzama, jhala technique"
  },
  "Harmonium": {
    found: "left-hand bellows control, right-hand finger numbering, key groups",
    inter: "bellows shading, sargam fluency in all saptaks, komal/tivra keys",
    adv: "raag accompaniment, following a vocalist, interlude playing"
  }
};
var CARNATIC_MUSIC_TOPICS = {
  "Sangeetham (Vocal)": SANGEETHAM,
  "Mridangam": MRIDANGAM,
  "Keyboard (Carnatic)": KEYBOARD_CARNATIC,
  "Harmonium": HARMONIUM
  // Veena: no curated data yet — AI fallback with Carnatic prompt rules.
};
var HINDUSTANI_MUSIC_TOPICS = {
  "Tabla": TABLA_HINDUSTANI,
  ...Object.fromEntries(
    Object.entries(HINDUSTANI_INSTRUMENTS).map(([name, t]) => [name, makeHindustaniMelodicTopics(name, t)])
  )
};
var WESTERN_MUSIC_TOPICS = {
  "Music Theory": WESTERN_THEORY,
  "Piano": PIANO,
  "Violin": VIOLIN,
  "Guitar": GUITAR,
  "Vocal (Western)": WESTERN_VOCAL,
  "Drums": DRUMS,
  ...Object.fromEntries(
    Object.entries(OTHER_WESTERN_INSTRUMENTS).map(([name, t]) => [name, makeWesternInstrumentTopics(name, t)])
  )
};
var getCuratedTopics = (syllabus, subject, grade) => {
  const map = syllabus === "Carnatic Music" || syllabus === "Indian Music" ? CARNATIC_MUSIC_TOPICS : syllabus === "Hindustani Music" ? HINDUSTANI_MUSIC_TOPICS : syllabus === "Western Music" ? WESTERN_MUSIC_TOPICS : null;
  return map?.[subject]?.[grade] ?? null;
};

// api/_server/data/referenceBanks.ts
var REFERENCE_QUESTIONS = [
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which hand normally operates the bellows in the Akshara Fine Arts beginner method?",
    "options": [
      "Left hand",
      "Right hand",
      "Both feet",
      "Both hands together"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which hand normally plays the Harmonium keyboard?",
    "options": [
      "Left hand",
      "Right hand",
      "Both elbows",
      "Left foot"
    ],
    "correctIndex": 1,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which number represents the right-hand middle finger?",
    "options": [
      "1",
      "2",
      "3",
      "5"
    ],
    "correctIndex": 2,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which shoulder position is correct while operating the bellows?",
    "options": [
      "Lifted very high",
      "Pulled tightly backwards",
      "Moving up on every count",
      "Relaxed and comfortable"
    ],
    "correctIndex": 3,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "How should a Grade 1 student move the bellows?",
    "options": [
      "Smoothly and gently",
      "As fast as possible",
      "With sudden jerks",
      "Only after the sound stops"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which black-key groups repeat across the keyboard?",
    "options": [
      "Groups of one and four",
      "Groups of two and three",
      "Groups of five and six",
      "Groups of seven and eight"
    ],
    "correctIndex": 1,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "How should the fingers generally be positioned over the keys?",
    "options": [
      "Completely flat and stiff",
      "Closed into a fist",
      "Naturally curved and relaxed",
      "Lifted as high as possible"
    ],
    "correctIndex": 2,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Where should the Harmonium normally be placed?",
    "options": [
      "Behind the student",
      "Far to the left",
      "Above the student's head",
      "Comfortably in front of the student"
    ],
    "correctIndex": 3,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "On a standard keyboard, moving towards the right generally produces what?",
    "options": [
      "Higher notes",
      "Lower notes",
      "No sound",
      "Slower Tala"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Moving towards the left side of the keyboard generally produces what?",
    "options": [
      "Faster notes",
      "Lower notes",
      "Louder Tala",
      "A different instrument"
    ],
    "correctIndex": 1,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which number represents the little finger?",
    "options": [
      "2",
      "3",
      "5",
      "1"
    ],
    "correctIndex": 2,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "What may happen when the bellows are pushed with excessive pressure?",
    "options": [
      "The keys disappear",
      "The raga changes automatically",
      "The Tala becomes longer",
      "The sound may become too loud or harsh"
    ],
    "correctIndex": 3,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "What may happen when the bellows pressure is too weak?",
    "options": [
      "The sound may become faint or unstable",
      "Upper Sa changes into Pa",
      "White keys become black",
      "The student automatically plays faster"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "How should a beginner press a Harmonium key?",
    "options": [
      "With the entire arm",
      "Gently and fully enough to sound the note",
      "With a closed fist",
      "As hard as possible"
    ],
    "correctIndex": 1,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which number represents the index finger?",
    "options": [
      "1",
      "5",
      "2",
      "4"
    ],
    "correctIndex": 2,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which item should be kept away from the Harmonium?",
    "options": [
      "Music notebook",
      "Teacher's pencil",
      "Clean practice cloth",
      "Open drink container"
    ],
    "correctIndex": 3,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "What must continue while a note is being sustained?",
    "options": [
      "Controlled airflow",
      "Finger-number recitation only",
      "Changing the tonic",
      "Closing the keyboard cover"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which sitting position is best for beginner practice?",
    "options": [
      "Twisted sideways",
      "Naturally upright and comfortable",
      "Lying on the floor",
      "Leaning heavily over the keyboard"
    ],
    "correctIndex": 1,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which description is correct?",
    "options": [
      "Keyboard contains only black keys",
      "Keyboard contains only white keys",
      "Keyboard contains white and black keys",
      "Keyboard contains drum skins"
    ],
    "correctIndex": 2,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "What should the student do before playing the teacher's Sa?",
    "options": [
      "Play any nearby note",
      "Close the bellows",
      "Increase the speed",
      "Listen carefully to the teacher's pitch"
    ],
    "correctIndex": 3,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "What is the main function of the bellows?",
    "options": [
      "To supply air",
      "To count Tala",
      "To change finger numbers",
      "To cover the keys"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "What does the keyboard help the player select?",
    "options": [
      "The student's seat",
      "Different pitches",
      "The instrument cover",
      "The practice duration"
    ],
    "correctIndex": 1,
    "classification": "Theory"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which number represents the ring finger?",
    "options": [
      "2",
      "5",
      "4",
      "1"
    ],
    "correctIndex": 2,
    "classification": "Theory"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which two actions are required to produce a normal Harmonium note?",
    "options": [
      "Clapping and singing",
      "Turning and shaking the instrument",
      "Closing the lid and pressing a stop",
      "Supplying air and pressing a key"
    ],
    "correctIndex": 3,
    "classification": "Theory"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which number represents the thumb?",
    "options": [
      "1",
      "2",
      "4",
      "5"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "What should happen immediately before the first key is pressed?",
    "options": [
      "Close the instrument",
      "Prepare gentle airflow",
      "Lift the shoulder",
      "Play Pa first"
    ],
    "correctIndex": 1,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which student shows the better posture?",
    "options": [
      "Twisting away from the keyboard",
      "Stretching both shoulders upwards",
      "Sitting upright with relaxed shoulders",
      "Leaning heavily on the instrument"
    ],
    "correctIndex": 2,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "A student presses Sa correctly, but the sound stops after two counts. What is the most likely cause?",
    "options": [
      "Student used finger 2",
      "Note was a white key",
      "Teacher counted slowly",
      "Bellows movement stopped"
    ],
    "correctIndex": 3,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "If Sa = E, which key is Pa?",
    "options": [
      "B",
      "A",
      "C",
      "D"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "If Sa = G, which key is Pa?",
    "options": [
      "C",
      "D",
      "E",
      "F"
    ],
    "correctIndex": 1,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "A student's sound becomes louder and softer repeatedly even though the same key is held. What is a likely reason?",
    "options": [
      "Note is Sa",
      "Right hand uses finger 1",
      "Bellows movement is uneven",
      "Student counts four beats"
    ],
    "correctIndex": 2,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "What is the best correction for a wrist that has collapsed towards the keyboard?",
    "options": [
      "Press harder",
      "Lift the entire shoulder",
      "Use only the little finger",
      "Restore a relaxed, neutral wrist"
    ],
    "correctIndex": 3,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "The student must stretch the right arm fully to reach the keys. What should be corrected?",
    "options": [
      "Move the Harmonium to a comfortable distance",
      "Increase bellows pressure",
      "Change Sa from E to G",
      "Play only black keys"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "When should the student prepare to change the bellows direction?",
    "options": [
      "Only after sound stops",
      "Before available movement is fully exhausted",
      "After changing tonic",
      "On every keyboard key"
    ],
    "correctIndex": 1,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "The teacher sings Sa, but the student presses a different key. What should the student do first?",
    "options": [
      "Play faster",
      "Increase volume",
      "Stop, listen again, and compare pitch",
      "Change to Pa"
    ],
    "correctIndex": 2,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which count is the most suitable beginner pulse?",
    "options": [
      "1\u20132\u20134\u20138",
      "1\u20133\u20132\u20134",
      "1\u20132\u20133\u20135",
      "1\u20132\u20133\u20134 evenly"
    ],
    "correctIndex": 3,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "What should the left hand do while the right hand moves from Sa to Pa?",
    "options": [
      "Continue supplying controlled air",
      "Stop completely",
      "Move to the keyboard",
      "Close the instrument"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Why should a beginner avoid lifting the fingers very high above the keyboard?",
    "options": [
      "It changes raga automatically",
      "It creates unnecessary movement and reduces control",
      "It stops the bellows",
      "It makes the instrument heavier"
    ],
    "correctIndex": 1,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "A student raises the left shoulder every time the bellows are closed. What is the best correction?",
    "options": [
      "Close bellows faster",
      "Press keyboard harder",
      "Relax shoulder and use controlled arm movement",
      "Change hands after each count"
    ],
    "correctIndex": 2,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "What should the student do before covering and storing the Harmonium?",
    "options": [
      "Leave bellows fully open",
      "Leave keys pressed",
      "Place a drink on the lid",
      "Close carefully according to the teacher's method"
    ],
    "correctIndex": 3,
    "classification": "Practical"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which swara is commonly used with Sa to establish the basic Sa\u2013Pa relationship?",
    "options": [
      "Pa",
      "Ri",
      "Ga",
      "Ni"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "What should a Grade 1 student do before pulling an unfamiliar stop?",
    "options": [
      "Pull every stop",
      "Ask the teacher for guidance",
      "Strike keyboard loudly",
      "Turn Harmonium upside down"
    ],
    "correctIndex": 1,
    "classification": "Theory"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Why must a pitch question state the selected Sa?",
    "options": [
      "Finger numbers change daily",
      "Bellows can play Tala",
      "Western key for each swara depends on tonic",
      "Every white key is always Pa"
    ],
    "correctIndex": 2,
    "classification": "Theory"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "A key is pressed fully, but no sound is produced. The instrument is otherwise functioning normally. Which action should be checked first?",
    "options": [
      "Whether student knows Adi Tala",
      "Whether key is white or black",
      "Whether finger 3 was used",
      "Whether air is supplied through bellows"
    ],
    "correctIndex": 3,
    "classification": "Theory"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "If Madhya Sa is E, where is the next upper Sa?",
    "options": [
      "Next E to the right",
      "F immediately to the right",
      "B to the right",
      "D-sharp before E"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "A student sustains Sa. The note begins clearly, becomes very loud, then stops suddenly. Which explanation is best?",
    "options": [
      "Student selected Pa",
      "Pressure became excessive and direction change was late",
      "Student used a curved finger",
      "Student counted four beats"
    ],
    "correctIndex": 1,
    "classification": "Theory"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "A student leans sideways, raises the left shoulder, and pumps the bellows quickly. Which correction is best?",
    "options": [
      "Play faster",
      "Move Harmonium farther away",
      "Re-centre body, relax shoulder, and slow bellows",
      "Use only black keys"
    ],
    "correctIndex": 2,
    "classification": "Theory"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which task is not appropriate as a compulsory Grade 1 assessment?",
    "options": [
      "Sustaining Sa for four counts",
      "Identifying finger 1",
      "Recognising bellows hand",
      "Accompanying advanced Kalpana Swara independently"
    ],
    "correctIndex": 3,
    "classification": "Theory"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "The teacher sustains a soft Sa. Which Grade 1 Harmonium response is most suitable?",
    "options": [
      "Match Sa softly with steady airflow",
      "Play unrelated fast notes",
      "Activate every stop",
      "Change tonic without asking"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Harmonium",
    "grade": "Grade 1",
    "question": "Which practice sequence is most appropriate for a Grade 1 beginner?",
    "options": [
      "Play fast, select chords, then locate Sa",
      "Sit correctly, prepare airflow, locate Sa, and play slowly",
      "Begin advanced songs and correct posture later",
      "Pull every stop and press several keys"
    ],
    "correctIndex": 1,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "While sitting to play the Mridangam, the student should keep the body:",
    "options": [
      "Bent and tense",
      "Relaxed and upright",
      "Leaning backwards always",
      "Moving continuously"
    ],
    "correctIndex": 1,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The Mridangam should be placed in a stable position because it helps:",
    "options": [
      "Clear and controlled playing",
      "The drum to move around",
      "The student to play randomly",
      "The hands to become stiff"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Before playing any basic lesson, the student should first:",
    "options": [
      "Say the solkattu clearly",
      "Hit the drum fast",
      "Skip the counting",
      "Play without listening"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "In basic Mridangam playing, the wrist should be:",
    "options": [
      "Stiff and locked",
      "Flexible and relaxed",
      "Hidden behind the drum",
      "Pressed tightly at all times"
    ],
    "correctIndex": 1,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The fingers should strike the Mridangam with:",
    "options": [
      "Controlled movement",
      "Random force",
      "Closed fist only",
      "The elbow only"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The main aim of beginner fingering practice is to develop:",
    "options": [
      "Clear sound and control",
      "Only speed",
      "Only loudness",
      "Decoration of the instrument"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "When playing a basic stroke, the finger should usually:",
    "options": [
      "Strike and return naturally",
      "Stay stuck on the head",
      "Move without control",
      "Hit the wooden body only"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A beginner should first practise basic strokes at:",
    "options": [
      "Slow and steady speed",
      "Maximum speed",
      "Changing speed every second",
      "No fixed speed"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "If the sound is unclear, the first thing to check is:",
    "options": [
      "Finger placement",
      "The wall colour",
      "The student's school uniform",
      "The audience size"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Proper finger placement helps to create:",
    "options": [
      "Clear tone",
      "Confusion",
      "Random noise",
      "Silence only"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The right side of the Mridangam is usually used for:",
    "options": [
      "Clear treble strokes",
      "Only bass sounds",
      "Carrying the instrument",
      "Tuning the voice"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The left side of the Mridangam is usually used for:",
    "options": [
      "Bass support",
      "Keyboard notes",
      "Violin bowing",
      "Singing lyrics"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The right-hand fingers should be kept:",
    "options": [
      "Ready and relaxed",
      "Closed tightly always",
      "Far away from the drum",
      "Behind the back"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The left hand should not be too stiff because:",
    "options": [
      "Bass sound needs control and relaxation",
      "It makes the drum look nice",
      "It avoids learning tala",
      "It makes the lesson shorter"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "In basic practice, both hands must work with:",
    "options": [
      "Coordination",
      "Confusion",
      "Tension",
      "Carelessness"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'When playing "Ta Ki Ta," the student should maintain:',
    "options": [
      "Equal spacing",
      "Uneven gaps",
      "Sudden stopping",
      "Random hand movement"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": '"Ta Ki Ta" should not be played by:',
    "options": [
      "Rushing the syllables",
      "Counting clearly",
      "Listening carefully",
      "Keeping the hand relaxed"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The syllable "Ta" should be played with:',
    "options": [
      "Clear and controlled stroke",
      "Random slap",
      "Full arm force",
      "No finger movement"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The syllable "Ki" in basic practice should be played with:',
    "options": [
      "Proper finger or hand placement according to teacher's method",
      "Careless movement",
      "Foot tapping only",
      "No sound"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The last "Ta" in "Ta Ki Ta" should be:',
    "options": [
      "As clear as the first syllable",
      "Hidden and weak",
      "Played without rhythm",
      "Skipped"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A good beginner stroke should sound:",
    "options": [
      "Clear and even",
      "Broken and unclear",
      "Harsh always",
      "Silent always"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'When playing repeated "Ta Ki Ta," the hands should:',
    "options": [
      "Return to ready position after each stroke",
      "Become tense",
      "Move away from the instrument",
      "Stop after every syllable"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The fingers should not collapse flat on the drum because it may:",
    "options": [
      "Reduce clarity",
      "Improve speed automatically",
      "Replace practice",
      "Create perfect tala automatically"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "In basic fingering, the student should avoid:",
    "options": [
      "Excessive force",
      "Correct hand position",
      "Slow practice",
      "Listening to tone"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The sound becomes better when the student uses:",
    "options": [
      "Correct contact point",
      "Random hitting",
      "Shoulder pressure",
      "Knee movement only"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "For basic Mridangam lessons, the student should keep the palm:",
    "options": [
      "Relaxed and controlled",
      "Very tight always",
      "Completely away from the drum",
      "Moving without purpose"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The hand should not block the sound unnecessarily because it can:",
    "options": [
      "Reduce resonance",
      "Improve clarity always",
      "Make the drum louder automatically",
      "Replace tala"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A student should observe the teacher's fingering carefully to learn:",
    "options": [
      "Correct stroke shape",
      "Stage costume only",
      "Song lyrics only",
      "Audience reaction only"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "While playing basic sollus, the student should listen to:",
    "options": [
      "Tone, timing, and clarity",
      "Only the loudness",
      "Only the speed",
      "Only the appearance"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The best way to correct a weak stroke is to:",
    "options": [
      "Slow down and adjust the finger position",
      "Play faster",
      "Ignore the mistake",
      "Stop learning"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'When practising "Ta Ka," both syllables should be:',
    "options": [
      "Even and clear",
      "Uneven and rushed",
      "Silent",
      "Played only with the shoulder"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": '"Ta Ka" contains:',
    "options": [
      "Two rhythmic actions",
      "One random hit",
      "Three silent beats",
      "No fingering"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The student should practise "Ta Ka" by first saying:',
    "options": [
      "Ta Ka clearly",
      "Any random word",
      "Only the tala name",
      "Nothing"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The fingering for "Ta Ka" should show:',
    "options": [
      "Controlled alternation or clear stroke difference",
      "Confused hand movement",
      "Only full-arm hitting",
      "No rhythmic structure"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'If "Ta Ka" sounds uneven, the student should correct:',
    "options": [
      "Timing and finger clarity",
      "The room light",
      "The instrument colour",
      "The notebook cover"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'When playing "Ta Ka" repeatedly, the student should avoid:',
    "options": [
      "Unequal spacing",
      "Clear counting",
      "Relaxed wrist",
      "Good listening"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The sound of "Ta" and "Ka" should be balanced because:',
    "options": [
      "Both syllables must be heard clearly",
      "Only one syllable matters",
      "The teacher cannot hear mistakes",
      "Tala is not needed"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "In a basic stroke, the index and middle fingers may be used depending on:",
    "options": [
      "The teacher's fingering method",
      "The student's favourite colour",
      "The size of the classroom",
      "The number of chairs"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "While playing basic lessons, the elbows should be:",
    "options": [
      "Relaxed and naturally placed",
      "Raised high always",
      "Locked tightly",
      "Moving wildly"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A beginner should not lift the hand too high because it may cause:",
    "options": [
      "Loss of control",
      "Better tala automatically",
      "Perfect tone immediately",
      "No need for practice"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The fingers should be close enough to the playing area to allow:",
    "options": [
      "Quick and controlled response",
      "Slow confusion",
      "Random hitting",
      "Unwanted movement"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The correct stroke should come mainly from:",
    "options": [
      "Finger and wrist control",
      "Shoulder force only",
      "Full body movement",
      "Foot pressure"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Why is relaxation important in fingering?",
    "options": [
      "It improves speed, tone, and control gradually",
      "It removes the need for lessons",
      "It makes all mistakes disappear",
      "It avoids listening"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "When playing the bass side, the left hand should produce:",
    "options": [
      "Deep and controlled sound",
      "Keyboard melody",
      "Vocal pitch only",
      "Violin sound"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "If the bass side sounds dull, the student should check:",
    "options": [
      "Hand position and pressure",
      "The student's handwriting",
      "The class timetable only",
      "The room door"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The left-hand bass stroke should not be pressed too long unless instructed because it may:",
    "options": [
      "Mute the sound",
      "Make tala unnecessary",
      "Improve all strokes automatically",
      "Replace right-hand practice"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The right-hand playing area should be approached with:",
    "options": [
      "Accuracy and neatness",
      "Roughness only",
      "Random finger landing",
      "No attention"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A beginner should practise slowly to build:",
    "options": [
      "Muscle memory",
      "Stage fame immediately",
      "Loud sound only",
      "Fast mistakes"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The phrase "Ta Ki Ta" trains the student to understand:',
    "options": [
      "Three-syllable rhythmic flow",
      "Only melody",
      "Only lyrics",
      "Only decoration"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'When playing "Ta Ki Ta," the hand movement should be:',
    "options": [
      "Small, controlled, and clear",
      "Big and uncontrolled",
      "Random and rushed",
      "Completely stiff"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "In basic practice, the student should keep the fingers:",
    "options": [
      "Alert and naturally curved",
      "Completely loose without control",
      "Hidden under the drum",
      "Pressed on the floor"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The main reason for practising fingering slowly is to:",
    "options": [
      "Build correct habit",
      "Waste time",
      "Avoid rhythm",
      "Make the lesson boring"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "If a student learns wrong fingering, it may later affect:",
    "options": [
      "Speed and clarity",
      "Only the notebook",
      "The colour of the drum",
      "The teacher's chair"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A correct basic stroke should not depend on:",
    "options": [
      "Excessive arm force",
      "Finger control",
      "Listening",
      "Steady timing"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The student should repeat the same stroke many times to develop:",
    "options": [
      "Consistency",
      "Confusion",
      "Fear",
      "Randomness"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'When playing "Ki Ta Ta Ka," the student should focus on:',
    "options": [
      "Clear syllable grouping",
      "Skipping the middle syllables",
      "Playing without tala",
      "Only looking at others"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": '"Ki Ta Ta Ka" contains:',
    "options": [
      "Four syllables",
      "Two syllables",
      "Three syllables",
      "Six syllables"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'In "Ki Ta Ta Ka," each syllable should receive:',
    "options": [
      "Equal time value at beginner level",
      "Random time",
      "No sound",
      "Only clapping"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The repeated "Ta" in "Ki Ta Ta Ka" should be played:',
    "options": [
      "Clearly without becoming lazy",
      "Silently",
      "Without counting",
      "Only once"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The final "Ka" in "Ki Ta Ta Ka" should be:',
    "options": [
      "Clean and controlled",
      "Ignored",
      "Rushed always",
      "Played after a long random pause"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "While playing four-syllable patterns, the student should count:",
    "options": [
      "1 2 3 4 evenly",
      "1 4 2 8 randomly",
      "Only 1",
      "Nothing"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'In "Ki Ta Ta Ka," the finger movement should match:',
    "options": [
      "The spoken solkattu",
      "The student's walking speed",
      "The background noise",
      "The colour of the book"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "If the hand becomes tired quickly, the student may be using:",
    "options": [
      "Too much tension",
      "Perfect relaxation",
      "Correct breathing only",
      "Enough control always"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Good fingering requires:",
    "options": [
      "Patience and repetition",
      "Rushing and guessing",
      "Avoiding correction",
      "Playing only loudly"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "When the teacher corrects the finger, the student should:",
    "options": [
      "Observe, adjust, and repeat",
      "Argue and rush",
      "Stop practising",
      "Ignore the correction"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "In Mridangam, playing methodology means:",
    "options": [
      "The correct way of using posture, fingers, hands, rhythm, and listening",
      "Only buying the instrument",
      "Only wearing stage dress",
      "Only memorising names"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A beginner should avoid playing with nails because it may:",
    "options": [
      "Affect tone or damage the surface",
      "Improve all strokes",
      "Make tala perfect",
      "Increase voice pitch"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Fingertips should be used carefully to produce:",
    "options": [
      "Controlled sound",
      "Random noise",
      "No rhythm",
      "Keyboard tone"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The student should not drag the fingers across the head unless instructed because it may:",
    "options": [
      "Disturb clarity",
      "Create perfect speed",
      "Replace lessons",
      "Improve posture automatically"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The basic playing hand should remain:",
    "options": [
      "Close, neat, and controlled",
      "Far, loose, and careless",
      "Very high always",
      "Behind the body"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A beginner should practise in front of the teacher to correct:",
    "options": [
      "Fingering mistakes early",
      "Costume colour",
      "Notebook brand",
      "Room decoration"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "When practising at home, the student should remember the teacher's:",
    "options": [
      "Stroke demonstration",
      "Walking style",
      "Bag colour",
      "Phone ringtone"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The first priority in "Ta Ki Ta" practice is:',
    "options": [
      "Correct fingering and equal timing",
      "Maximum speed",
      "Loudness only",
      "Playing without saying"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The first priority in "Ta Ka" practice is:',
    "options": [
      "Two clear strokes",
      "Three random strokes",
      "No sound",
      "One long pause"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The first priority in "Ta Ri Ki Ta" practice is:',
    "options": [
      "Four clear syllables",
      "Only the first syllable",
      "Random hand movement",
      "No counting"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": '"Ta Ri Ki Ta" contains:',
    "options": [
      "Four syllables",
      "Two syllables",
      "Three syllables",
      "Five syllables"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": '"Ta Ri Ki Ta" should be played with:',
    "options": [
      "Even flow",
      "Unplanned gaps",
      "Only one hand randomly",
      "No tala"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The "Ri" syllable in "Ta Ri Ki Ta" should not be:',
    "options": [
      "Swallowed or unclear",
      "Counted",
      "Heard",
      "Practised slowly"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "In four-syllable patterns, the student should avoid:",
    "options": [
      "Rushing the last two syllables",
      "Saying clearly",
      "Counting evenly",
      "Relaxing the wrist"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The pattern "Ta Ri Ki Ta" helps develop:',
    "options": [
      "Fingering coordination and rhythm flow",
      "Only singing melody",
      "Instrument decoration",
      "Stage lighting"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'When playing "Ta Ri Ki Ta," the student should make sure that all four syllables:',
    "options": [
      "Are equally clear",
      "Are hidden",
      "Are skipped",
      "Are played without timing"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "If the second syllable is weak, the student should:",
    "options": [
      "Practise that finger movement slowly",
      "Play faster to hide it",
      "Ignore it",
      "Stop saying solkattu"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "If the last syllable is late, the student should improve:",
    "options": [
      "Timing control",
      "Instrument colour",
      "Sitting height only",
      "Loud speaking"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Finger control improves when practice is:",
    "options": [
      "Regular",
      "Rare and random",
      "Always rushed",
      "Done without listening"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'When repeating "Ta Ri Ki Ta," the student should maintain:',
    "options": [
      "Same tempo",
      "Random tempo",
      "No tempo",
      "Only hand movement without sound"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A correct beginner stroke should be:",
    "options": [
      "Neat, clear, and controlled",
      "Rough, rushed, and unclear",
      "Silent always",
      "Only decorative"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The student should not press the playing surface too hard because it may:",
    "options": [
      "Stop natural vibration",
      "Improve clarity always",
      "Remove need for tala",
      "Create keyboard notes"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "When playing the right side, the fingers should land on the correct area to produce:",
    "options": [
      "Proper tonal clarity",
      "Random bass noise",
      "Voice melody",
      "No sound"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "In beginner lessons, the student should use the teacher's fingering system because:",
    "options": [
      "It builds proper foundation",
      "Any random method is better",
      "Fingering does not matter",
      "Tala will fix everything"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The phrase "Ta Ka Ta Ri Ki Ta" contains:',
    "options": [
      "Six syllables",
      "Four syllables",
      "Three syllables",
      "Eight syllables"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": '"Ta Ka Ta Ri Ki Ta" should be learnt by:',
    "options": [
      "Breaking it into smaller groups first",
      "Playing only the last syllable",
      "Skipping counting",
      "Rushing from the beginning"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'A useful way to practise "Ta Ka Ta Ri Ki Ta" is:',
    "options": [
      "Say slowly, clap, then play",
      "Play loudly without saying",
      "Ignore the teacher's count",
      "Change the order always"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "In six-syllable patterns, the student must be careful not to lose:",
    "options": [
      "Pulse and clarity",
      "Instrument colour",
      "Notebook margin",
      "Stage costume"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The "Ta Ka" part in "Ta Ka Ta Ri Ki Ta" should be:',
    "options": [
      "Clean before continuing",
      "Skipped",
      "Slower randomly",
      "Silent"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The "Ta Ri Ki Ta" part in "Ta Ka Ta Ri Ki Ta" should flow:',
    "options": [
      'Evenly after "Ta Ka"',
      "With confusion",
      "Without counting",
      "Only in the mind"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'If "Ta Ka Ta Ri Ki Ta" sounds messy, the student should:',
    "options": [
      "Practise each group separately",
      "Immediately increase speed",
      "Stop saying solkattu",
      "Ignore the mistake"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The best method for joining two rhythm groups is to:",
    "options": [
      "Keep a steady pulse",
      "Change speed suddenly",
      "Hit randomly",
      "Avoid listening"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "While playing longer basic patterns, the fingers should not:",
    "options": [
      "Lose shape and control",
      "Stay relaxed",
      "Follow the solkattu",
      "Return after each stroke"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The main challenge in "Ta Ka Ta Ri Ki Ta" is keeping:',
    "options": [
      "All six syllables even",
      "Only the first syllable loud",
      "The left hand silent always",
      "The drum moving"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The correct practice method for six-syllable lessons is:",
    "options": [
      "Slow repetition with clear finger control",
      "Fast guessing",
      "Playing once only",
      "Avoiding correction"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": '"Ta Ri Ki Ta Ta Ka" contains:',
    "options": [
      "Six syllables",
      "Four syllables",
      "Five syllables",
      "Three syllables"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'In "Ta Ri Ki Ta Ta Ka," the first four syllables form:',
    "options": [
      "Ta Ri Ki Ta",
      "Ta Ki only",
      "Ka Ta only",
      "One long sound"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The final "Ta Ka" in "Ta Ri Ki Ta Ta Ka" should be:',
    "options": [
      "Clear and not rushed",
      "Skipped",
      "Played without control",
      "Played after stopping completely"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'When moving from "Ta Ri Ki Ta" to "Ta Ka," the student should keep:',
    "options": [
      "Flow and tempo",
      "Silence",
      "Random gaps",
      "Full stop after every syllable"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "If the hand becomes uncontrolled in longer patterns, the student should:",
    "options": [
      "Reduce speed",
      "Increase speed",
      "Stop counting",
      "Hit harder"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Longer patterns help the student build:",
    "options": [
      "Fingering stamina and rhythm memory",
      "Only handwriting skill",
      "Stage decoration",
      "Instrument carrying skill"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The fingers should not become lazy at the end of the pattern because:",
    "options": [
      "The ending must also be clear",
      "Endings are not important",
      "Only beginnings matter",
      "The teacher cannot hear endings"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A beginner must learn to start and end a pattern:",
    "options": [
      "Cleanly",
      "Randomly",
      "Without tala",
      "With confusion"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The ending "Ta Ka" should be practised separately if it is:',
    "options": [
      "Weak or unclear",
      "Too clear",
      "Too steady",
      "Too well counted"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "In all basic lessons, the student should connect speech and hand movement because:",
    "options": [
      "Solkattu guides fingering and rhythm",
      "Speech is unrelated",
      "Hands should move randomly",
      "Tala is not needed"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "If the spoken solkattu is clear but the playing is unclear, the student should improve:",
    "options": [
      "Fingering technique",
      "Lyrics memory only",
      "Sitting decoration",
      "Instrument colour"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "If playing is faster than speaking, the student is likely:",
    "options": [
      "Rushing",
      "Correct always",
      "Too slow",
      "Silent"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "If speaking and playing do not match, the student should practise:",
    "options": [
      "Saying and playing slowly together",
      "Only playing faster",
      "Only hitting the bass side",
      "Ignoring the mismatch"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The teacher may ask the student to say the sollu loudly to check:",
    "options": [
      "Rhythm understanding",
      "Singing beauty only",
      "Instrument polish",
      "Hand size"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A beginner should not hide weak strokes by playing fast because:",
    "options": [
      "Mistakes become habits",
      "Fast playing fixes everything",
      "Fingering is not important",
      "Tala becomes automatic"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Clean fingering means:",
    "options": [
      "Each stroke has proper sound and position",
      "The hand looks fashionable",
      "The drum is shiny",
      "The student plays without listening"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The student should maintain a steady gap between strokes to build:",
    "options": [
      "Layam or rhythmic steadiness",
      "Randomness",
      "Stage fear",
      "Only volume"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'In basic Mridangam, "layam" means:',
    "options": [
      "Rhythm steadiness",
      "Instrument box",
      "Singing lyrics",
      "Stage light"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Fingering and layam are connected because:",
    "options": [
      "Poor control can disturb timing",
      "Fingers do not affect rhythm",
      "Only the voice controls rhythm",
      "The drum plays itself"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The best correction for uneven fingering is:",
    "options": [
      "Slow, repeated, guided practice",
      "Immediate fast playing",
      "Ignoring the teacher",
      "Playing without hands"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "When the teacher demonstrates a stroke, the student should watch:",
    "options": [
      "Which finger, where it lands, and how it returns",
      "Only the teacher's face",
      "Only the wall",
      "Only the book cover"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A beginner should not change fingering without asking because:",
    "options": [
      "It can disturb the learning system",
      "It always improves playing",
      "It makes tala unnecessary",
      "It avoids practice"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The correct amount of force in basic strokes is:",
    "options": [
      "Enough to produce clear sound without strain",
      "Maximum force always",
      "No force at all",
      "Random force"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A relaxed wrist helps the student to play:",
    "options": [
      "More naturally",
      "With more stiffness",
      "Without rhythm",
      "Only loudly"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "If the wrist is too stiff, the sound may become:",
    "options": [
      "Hard or blocked",
      "Perfect automatically",
      "More musical always",
      "Silent forever"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The student should practise with a metronome or tala count only after understanding:",
    "options": [
      "Basic stroke clarity",
      "Stage costume",
      "Instrument colour",
      "Audience reaction"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Before increasing speed, the student must confirm:",
    "options": [
      "Correct fingering and steady rhythm",
      "Only loudness",
      "Only sitting place",
      "Only memorised title"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Speed without clarity is:",
    "options": [
      "Not good practice",
      "The best practice",
      "Always accepted",
      "More important than rhythm"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Clear fingering at slow speed creates:",
    "options": [
      "Strong foundation",
      "Bad habit",
      "No improvement",
      "Confusion only"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The hand should return after each stroke to prepare for:",
    "options": [
      "The next stroke",
      "Closing the class",
      "Stopping rhythm",
      "Changing instrument"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The student should not keep extra tension in the fingers because it can:",
    "options": [
      "Slow down movement",
      "Improve all strokes instantly",
      "Replace tala",
      "Create melody automatically"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A beginner should practise basic patterns daily for:",
    "options": [
      "Hand memory",
      "Forgetting lessons",
      "Decoration",
      "Random speed"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The best home-practice method is:",
    "options": [
      "Short, regular, focused practice",
      "Rare, long, careless practice",
      "Only watching videos",
      "Only carrying the drum"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'When practising "Ta Ki Ta," the student may count:',
    "options": [
      "1 2 3",
      "1 2 3 4 5",
      "1 only",
      "No counting"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'When practising "Ta Ka," the student may count:',
    "options": [
      "1 2",
      "1 2 3 4",
      "1 2 3",
      "1 2 3 4 5 6"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'When practising "Ta Ri Ki Ta," the student may count:',
    "options": [
      "1 2 3 4",
      "1 2",
      "1 2 3",
      "1 2 3 4 5"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'When practising "Ta Ka Ta Ri Ki Ta," the student may count:',
    "options": [
      "1 2 3 4 5 6",
      "1 2 3",
      "1 2 3 4",
      "1 only"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Counting while playing helps to keep:",
    "options": [
      "Proper spacing",
      "Random speed",
      "Confusion",
      "Silence"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The student should use both ears and hands because Mridangam learning needs:",
    "options": [
      "Listening and playing together",
      "Only movement",
      "Only reading",
      "Only memorising"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The sound of each stroke should be checked for:",
    "options": [
      "Clarity, tone, and timing",
      "Colour, size, and weight",
      "Costume, light, and stage",
      "Paper, pencil, and bag"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "If the right-hand stroke is too soft, the student should adjust:",
    "options": [
      "Finger strength and position",
      "Voice pitch only",
      "Drum colour",
      "Room temperature"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "If the left-hand bass is too heavy, the student should reduce:",
    "options": [
      "Excess pressure",
      "Counting",
      "Listening",
      "Teacher guidance"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The student should not play on the wooden shell because:",
    "options": [
      "Lessons are meant for the playing heads",
      "The wood creates all correct sounds",
      "It improves fingering",
      "It is the only playing area"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The black central patch helps in producing:",
    "options": [
      "Tonal resonance",
      "Only decoration",
      "Keyboard effect",
      "Violin effect"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "When playing near the correct area, the stroke becomes:",
    "options": [
      "More defined",
      "More confused",
      "Always silent",
      "Unrelated to tone"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A beginner should learn the difference between open and closed sound because:",
    "options": [
      "It improves tone understanding",
      "It is not useful",
      "It avoids rhythm",
      "It replaces fingering"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "An open sound usually allows the head to:",
    "options": [
      "Vibrate more freely",
      "Stop immediately always",
      "Become silent",
      "Lose tala"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A closed or muted sound usually happens when the hand:",
    "options": [
      "Controls or stops vibration",
      "Never touches the drum",
      "Plays the keyboard",
      "Sings the note"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "In basic lessons, the student should know whether the stroke is supposed to be:",
    "options": [
      "Open, closed, bass, or clear treble",
      "Only loud",
      "Only fast",
      "Only decorative"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": `The teacher's correction on "where to strike" is important because:`,
    "options": [
      "Different areas produce different sound quality",
      "All areas sound exactly the same",
      "It does not affect playing",
      "It only changes appearance"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The student should not rush when changing from one fingering to another because:",
    "options": [
      "Control may be lost",
      "It always improves",
      "Mistakes disappear",
      "Counting is not needed"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A clean transition means:",
    "options": [
      "Moving from one stroke to the next without breaking rhythm",
      "Stopping after every syllable",
      "Changing speed randomly",
      "Losing hand position"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The phrase "Ta Ki Ta" trains:',
    "options": [
      "Three-count coordination",
      "Only six-count rhythm",
      "Only melody notes",
      "Only left-hand silence"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The phrase "Ki Ta Ta Ka" trains:',
    "options": [
      "Four-count control",
      "Only one stroke",
      "Only singing pitch",
      "No finger movement"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The phrase "Ta Ka Ta Ri Ki Ta" trains:',
    "options": [
      "Six-count flow",
      "Only two counts",
      "Only writing skill",
      "Only stage posture"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The phrase "Ta Ri Ki Ta Ta Ka" trains:',
    "options": [
      "Combining four-count and two-count flow",
      "Only one random sound",
      "Only left-hand force",
      "Only silence"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Before performing a basic lesson in front of others, the student should ensure:",
    "options": [
      "Clear fingering and steady tala",
      "Only a loud sound",
      "Only a fast speed",
      "Only a nice costume"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The student should practise difficult patterns by:",
    "options": [
      "Breaking them into smaller parts",
      "Avoiding them forever",
      "Playing them fast",
      "Guessing the fingers"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The biggest danger for beginner fingering is:",
    "options": [
      "Repeating wrong habits",
      "Practising slowly",
      "Listening carefully",
      "Asking questions"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The best sign of good basic Mridangam fingering is:",
    "options": [
      "Clear sound, relaxed hand, steady rhythm",
      "Loud noise, stiff hand, rushing",
      "Fast speed without clarity",
      "Random hitting with confidence"
    ],
    "correctIndex": 0,
    "classification": "Practical"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Mridangam is mainly used in:",
    "options": [
      "Carnatic music",
      "Football",
      "Painting",
      "Cooking"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Mridangam belongs to the family of:",
    "options": [
      "Percussion instruments",
      "Wind instruments",
      "String instruments only",
      "Electronic screens"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The two sides of the Mridangam are used to produce:",
    "options": [
      "Different tonal colours",
      "Only one silent sound",
      "Only keyboard notes",
      "Only vocal lyrics"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The smaller right side is commonly called:",
    "options": [
      "Valanthalai",
      "Violin",
      "Flute",
      "Tambura"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The larger left side is commonly called:",
    "options": [
      "Thoppi",
      "Keyboard",
      "Veena bridge",
      "Shruti box"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Solkattu means:",
    "options": [
      "Rhythmic syllables spoken for percussion learning",
      "A type of costume",
      "A kind of food",
      "A songbook only"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Which of these is a solkattu pattern?",
    "options": [
      "Ta Ki Ta",
      "Do Re Mi",
      "ABC",
      "One Two Go"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": '"Ta Ki Ta" has:',
    "options": [
      "Three syllables",
      "Four syllables",
      "Five syllables",
      "Six syllables"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": '"Ta Ka" has:',
    "options": [
      "Two syllables",
      "Three syllables",
      "Four syllables",
      "Six syllables"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": '"Ta Ri Ki Ta" has:',
    "options": [
      "Four syllables",
      "Two syllables",
      "Three syllables",
      "Five syllables"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": '"Ta Ka Ta Ri Ki Ta" has:',
    "options": [
      "Six syllables",
      "Three syllables",
      "Four syllables",
      "Eight syllables"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": '"Ta Ri Ki Ta Ta Ka" has:',
    "options": [
      "Six syllables",
      "Four syllables",
      "Two syllables",
      "Nine syllables"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The purpose of solkattu is to help students understand:",
    "options": [
      "Rhythm before playing",
      "Only lyrics",
      "Only pitch",
      "Only handwriting"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Tala means:",
    "options": [
      "Rhythmic time cycle",
      "A type of chair",
      "A melodic raga",
      "A drum cover only"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Practising with tala helps a student develop:",
    "options": [
      "Time sense",
      "Random speed",
      "Confusion",
      "Only loudness"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A beginner should clap or count tala to improve:",
    "options": [
      "Rhythm stability",
      "Instrument colour",
      "Costume selection",
      "Voice beauty only"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Layam means:",
    "options": [
      "Steady rhythmic flow",
      "A wooden stick",
      "A type of song lyric",
      "A stage decoration"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The student should say solkattu clearly because unclear speech may lead to:",
    "options": [
      "Unclear playing",
      "Better fingering automatically",
      "Perfect speed",
      "No mistakes"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Which is the best order for learning a new basic pattern?",
    "options": [
      "Listen, say, count, play",
      "Play fast, stop, forget",
      "Guess, rush, hide mistakes",
      "Hit, shout, skip"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The most important quality in basic Mridangam learning is:",
    "options": [
      "Patience",
      "Showing off",
      "Rushing",
      "Carelessness"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A beginner should practise daily because it builds:",
    "options": [
      "Rhythm discipline",
      "Random mistakes",
      "Stage fear",
      "Laziness"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Short daily practice is better than rare practice because it improves:",
    "options": [
      "Consistency",
      "Forgetfulness",
      "Confusion",
      "Only volume"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "When a mistake happens, the student should:",
    "options": [
      "Stop, understand, correct, and repeat",
      "Hide it by playing faster",
      "Ignore it",
      "Blame the instrument"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The teacher's role is to guide:",
    "options": [
      "Fingering, rhythm, posture, and clarity",
      "Only costume colour",
      "Only stage lights",
      "Only sitting place"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The student's role is to:",
    "options": [
      "Practise sincerely and follow correction",
      "Avoid practice",
      "Rush every lesson",
      "Ignore tala"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A good Mridangam student should listen to:",
    "options": [
      "Teacher, tala, and own sound",
      "Only background noise",
      "Only phone sounds",
      "Only audience talking"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Which of these is a good beginner habit?",
    "options": [
      "Practising slowly with clear counting",
      "Playing fast without clarity",
      "Skipping solkattu",
      "Ignoring fingering"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Which of these is a poor beginner habit?",
    "options": [
      "Rushing before learning clearly",
      "Saying solkattu",
      "Listening carefully",
      "Practising slowly"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The purpose of basic lessons is to build:",
    "options": [
      "Foundation",
      "Confusion",
      "Only speed",
      "Only loudness"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A student should not compare too much with others because:",
    "options": [
      "Each student progresses with practice and correction",
      "Comparison improves fingering automatically",
      "It removes the need for practice",
      "It makes tala unnecessary"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Before class, the student should be ready with:",
    "options": [
      "Mridangam, notebook, focus, and respect",
      "Only snacks",
      "Only phone games",
      "Only stage costume"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "After class, the student should revise:",
    "options": [
      "The lesson taught by the teacher",
      "Only unrelated songs",
      "Only the title page",
      "Nothing"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The student should ask questions when:",
    "options": [
      "Fingering or rhythm is unclear",
      "Everything is already clear",
      "The class is over forever",
      "The drum is not visible"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Correct posture prevents:",
    "options": [
      "Unnecessary strain",
      "Perfect mistakes",
      "Automatic speed",
      "Loss of all rhythm"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The Mridangam should be handled with:",
    "options": [
      "Respect and care",
      "Carelessness",
      "Rough throwing",
      "Random knocking"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The student should not place heavy items on the Mridangam because:",
    "options": [
      "It may affect the instrument",
      "It improves tone",
      "It increases speed",
      "It teaches tala"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The basic goal of learning until "Ta Ki Ta" and "Ta Ri Ki Ta" level is:',
    "options": [
      "Clear strokes, steady rhythm, and confidence",
      "Only advanced tani avartanam",
      "Only stage performance immediately",
      "Only loud playing"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A student is ready to move forward when they can play basic patterns with:",
    "options": [
      "Clarity, control, and steady count",
      "Random speed",
      "Unclear sound",
      "No solkattu"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The most respectful way to learn Mridangam is to:",
    "options": [
      "Follow the teacher, practise regularly, and value the instrument",
      "Rush and ignore corrections",
      "Play without listening",
      "Avoid basic lessons"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The foundation of good Mridangam playing is:",
    "options": [
      "Correct fingering, steady tala, clear solkattu, and disciplined practice",
      "Only speed",
      "Only loudness",
      "Only memorising names"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Which instrument family does the Mridangam belong to?",
    "options": [
      "String instrument",
      "Wind instrument",
      "Percussion instrument",
      "Keyboard instrument"
    ],
    "correctIndex": 2,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The Mridangam is mainly used in which classical music tradition?",
    "options": [
      "Western classical music",
      "Carnatic music",
      "Chinese opera",
      "Jazz music"
    ],
    "correctIndex": 1,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "How many main playing sides does a Mridangam have?",
    "options": [
      "One",
      "Two",
      "Three",
      "Four"
    ],
    "correctIndex": 1,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The smaller side of the Mridangam usually produces a:",
    "options": [
      "Higher-pitched sound",
      "Very silent sound",
      "Guitar sound",
      "Flute sound"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The larger side of the Mridangam usually produces a:",
    "options": [
      "Higher treble sound only",
      "Bass or deeper sound",
      "Violin sound",
      "Keyboard sound"
    ],
    "correctIndex": 1,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "When sitting to play Mridangam, the student should keep the body:",
    "options": [
      "Bent and stiff",
      "Relaxed and upright",
      "Lying down",
      "Twisted sideways"
    ],
    "correctIndex": 1,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Why should the shoulders be relaxed while playing Mridangam?",
    "options": [
      "To make the face serious",
      "To avoid tension and improve control",
      "To play louder only",
      "To avoid listening to tala"
    ],
    "correctIndex": 1,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The right-hand fingers should strike the Mridangam with:",
    "options": [
      "Heavy force always",
      "Controlled and clear movement",
      "Random hitting",
      "Closed fist only"
    ],
    "correctIndex": 1,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The left hand is mainly used to create:",
    "options": [
      "Bass effect and support",
      "Violin bowing",
      "Keyboard chord sound",
      "Singing pitch"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "In basic Mridangam practice, clarity is more important than:",
    "options": [
      "Speed",
      "Sitting posture",
      "Listening",
      "Counting"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The syllable "Ta" in basic practice should be played with:',
    "options": [
      "A careless strike",
      "A clear and controlled stroke",
      "A closed-eye movement",
      "A random hand movement"
    ],
    "correctIndex": 1,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "What is the purpose of saying solkattu before playing?",
    "options": [
      "To memorize lyrics",
      "To understand rhythm before playing",
      "To avoid using the hands",
      "To make the lesson shorter"
    ],
    "correctIndex": 1,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": '"Ta Ki Ta" contains how many syllables?',
    "options": [
      "Two",
      "Three",
      "Four",
      "Five"
    ],
    "correctIndex": 1,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": '"Ta Ka" contains how many syllables?',
    "options": [
      "One",
      "Two",
      "Three",
      "Four"
    ],
    "correctIndex": 1,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": '"Ta Ri Ki Ta" contains how many syllables?',
    "options": [
      "Two",
      "Three",
      "Four",
      "Six"
    ],
    "correctIndex": 2,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'While playing "Ta Ki Ta," the student should maintain:',
    "options": [
      "Uneven speed",
      "Equal spacing between syllables",
      "Sudden stopping",
      "Random volume"
    ],
    "correctIndex": 1,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "In basic fingering, the wrist should be:",
    "options": [
      "Locked tightly",
      "Flexible and relaxed",
      "Completely still always",
      "Hidden behind the drum"
    ],
    "correctIndex": 1,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Why is finger placement important in Mridangam?",
    "options": [
      "It changes the colour and clarity of sound",
      "It makes the drum look bigger",
      "It changes the student's voice",
      "It removes the need for practice"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The black central area on the playing head helps to produce:",
    "options": [
      "Tuned resonance and tonal quality",
      "Only decoration",
      "A wooden sound",
      "A string sound"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "When practising basic strokes, the student should first aim for:",
    "options": [
      "Speed and showmanship",
      "Clarity and correct fingering",
      "Loudness only",
      "Complicated patterns"
    ],
    "correctIndex": 1,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Which of the following is a basic rhythm syllable used in Mridangam?",
    "options": [
      "Sa",
      "Pa",
      "Ta",
      "Ma"
    ],
    "correctIndex": 2,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "What should a student do before playing a lesson on Mridangam?",
    "options": [
      "Say the solkattu clearly",
      "Play as fast as possible",
      "Avoid counting",
      "Hit both sides randomly"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "When playing basic lessons, both hands should work with:",
    "options": [
      "Confusion",
      "Coordination",
      "Laziness",
      "Tension"
    ],
    "correctIndex": 1,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "If a stroke sounds unclear, the student should check:",
    "options": [
      "Fingering and hand position",
      "The colour of the room",
      "The student's school bag",
      "The teacher's chair"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The purpose of repeating "Ta Ki Ta" many times is to improve:',
    "options": [
      "Rhythm control and hand memory",
      "Drawing skill",
      "Singing lyrics",
      "Instrument decoration"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Which practice method is best for a beginner?",
    "options": [
      "Slow, steady, and clear practice",
      "Fast and careless practice",
      "Practising only once",
      "Skipping difficult parts"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'In Mridangam, "nadai" generally refers to:',
    "options": [
      "Walking style only",
      "Rhythmic subdivision or flow",
      "Instrument colour",
      "Stage costume"
    ],
    "correctIndex": 1,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "A beginner should practise with tala because it helps to develop:",
    "options": [
      "Time sense",
      "Instrument weight",
      "Hand size",
      "Singing volume"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Which of the following is a correct basic solkattu pattern?",
    "options": [
      "Ta Ki Ta",
      "Sa Ri Ga",
      "Do Re Mi",
      "ABCD"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": '"Ta Ka Ta Ri Ki Ta" should be practised with:',
    "options": [
      "Uneven breaks",
      "Equal rhythm and clear pronunciation",
      "No counting",
      "Only left hand randomly"
    ],
    "correctIndex": 1,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "What happens if the student plays with too much force?",
    "options": [
      "The sound may become harsh and uncontrolled",
      "The tala becomes perfect automatically",
      "The Mridangam becomes lighter",
      "The lesson becomes easier without practice"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The fingers should return after each stroke to prepare for:",
    "options": [
      "The next clear stroke",
      "Closing the book",
      "Changing the instrument",
      "Stopping the lesson"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "In beginner practice, why should the student listen carefully to each stroke?",
    "options": [
      "To check clarity, tone, and timing",
      "To ignore mistakes",
      "To avoid counting",
      "To play without rhythm"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "What is the best speed for learning a new Mridangam pattern?",
    "options": [
      "Very fast immediately",
      "Slow and steady first",
      "Random speed",
      "Only maximum speed"
    ],
    "correctIndex": 1,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Which part of the hand should not be stiff while playing?",
    "options": [
      "Wrist",
      "Hair",
      "Shoulder bag",
      "Footwear"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The pattern "Ta Ri Ki Ta" should be counted as:',
    "options": [
      "1 syllable",
      "2 syllables",
      "4 syllables",
      "8 syllables"
    ],
    "correctIndex": 2,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'When practising "Ta Ki Ta," the student should avoid:',
    "options": [
      "Clear counting",
      "Correct fingering",
      "Rushing the rhythm",
      "Listening to sound"
    ],
    "correctIndex": 2,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The main role of the teacher in basic Mridangam fingering is to guide:",
    "options": [
      "Correct hand placement and stroke clarity",
      "Only costume selection",
      "Only stage lighting",
      "Only song lyrics"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Which is a good beginner practice routine?",
    "options": [
      "Say, clap, then play",
      "Run, shout, then hit",
      "Skip, guess, then stop",
      "Talk, laugh, then rush"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Why should a student practise both vocal solkattu and hand strokes?",
    "options": [
      "To connect rhythm knowledge with playing action",
      "To avoid learning rhythm",
      "To replace the instrument",
      "To make the lesson confusing"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The phrase "Ta Ka" should be played with:',
    "options": [
      "Two clear rhythmic actions",
      "One long random sound",
      "No hand movement",
      "Only shaking the drum"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "What should a beginner do if the left-hand bass sound is not clear?",
    "options": [
      "Adjust hand placement and practise slowly",
      "Hit harder without control",
      "Stop learning Mridangam",
      "Ignore the sound completely"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "In basic Mridangam learning, the student's eyes should mainly help with:",
    "options": [
      "Observing hand position and teacher demonstration",
      "Looking away always",
      "Counting ceiling lights",
      "Watching unrelated videos"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Which quality is most important for a beginner Mridangam student?",
    "options": [
      "Patience",
      "Rushing",
      "Carelessness",
      "Laziness"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "What is the correct attitude during basic fingering correction?",
    "options": [
      "Accept correction and repeat patiently",
      "Get angry and stop",
      "Play faster to hide mistakes",
      "Avoid the teacher's advice"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "The Mridangam should be placed in a stable position because:",
    "options": [
      "It helps comfortable and controlled playing",
      "It makes the room brighter",
      "It changes into another instrument",
      "It removes the need for tala"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'What should remain steady when playing basic patterns like "Ta Ki Ta" and "Ta Ka"?',
    "options": [
      "Rhythm and tempo",
      "Random speed",
      "Shoulder tension",
      "Loud shouting"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Which of the following shows a correct beginner learning order?",
    "options": [
      "Listen, say, count, play",
      "Play fast, guess, stop, forget",
      "Hit hard, ignore, rush, finish",
      "Skip basics, play advanced lessons"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": "Why is daily short practice better than rare long practice for beginners?",
    "options": [
      "It builds regular hand memory and rhythm discipline",
      "It makes the Mridangam unnecessary",
      "It avoids learning fingering",
      "It removes the need for tala"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Mridangam",
    "grade": "Grade 1",
    "question": 'The main goal of basic Mridangam lessons up to "Ta Ki Ta" and "Ta Ri Ki Ta" patterns is to build:',
    "options": [
      "Clear fingering, steady rhythm, and basic playing confidence",
      "Only speed",
      "Only loudness",
      "Only stage costume style"
    ],
    "correctIndex": 0,
    "classification": null
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "What is a Kriti?",
    "options": [
      "A basic scale exercise",
      "A mature Carnatic composition",
      "A Tala hand movement",
      "A percussion pattern"
    ],
    "correctIndex": 1,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "A Kriti mainly combines music with:",
    "options": [
      "Exercise and speed only",
      "Devotion, poetry and raga depth",
      "Dance movements only",
      "Instrument tuning only"
    ],
    "correctIndex": 1,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Which composition is generally simpler than a Kriti?",
    "options": [
      "Geetham",
      "Kriti",
      "Charanam",
      "Sangati"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Which composition is mainly used to develop raga, voice and rhythmic control?",
    "options": [
      "Kriti",
      "Varnam",
      "Pallavi",
      "Sahitya"
    ],
    "correctIndex": 1,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "How many main sections are commonly found in a Kriti?",
    "options": [
      "Two",
      "Three",
      "Four",
      "Five"
    ],
    "correctIndex": 1,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Which is the opening section of a Kriti?",
    "options": [
      "Charanam",
      "Anupallavi",
      "Pallavi",
      "Sangati"
    ],
    "correctIndex": 2,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Which section usually follows the Pallavi?",
    "options": [
      "Anupallavi",
      "Geetham",
      "Varnam",
      "Eduppu"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Which section usually contains an expanded or concluding lyrical message?",
    "options": [
      "Pallavi",
      "Charanam",
      "Eduppu",
      "Sangati"
    ],
    "correctIndex": 1,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Which of the following is a major Carnatic composer?",
    "options": [
      "Tyagaraja",
      "Kalidasa",
      "Tansen",
      "Valmiki"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Tyagaraja is especially known for:",
    "options": [
      "Devotional Carnatic compositions",
      "Western orchestral works",
      "Tabla compositions",
      "Dance choreography"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Muthuswami Dikshitar composed many songs in:",
    "options": [
      "English",
      "Sanskrit",
      "French",
      "Arabic"
    ],
    "correctIndex": 1,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Syama Sastri is remembered as:",
    "options": [
      "A major Carnatic composer",
      "A percussion instrument",
      "A Tala movement",
      "A type of Sangati"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Purandaradasa contributed greatly to:",
    "options": [
      "Carnatic music teaching and devotional composition",
      "Western piano technique",
      "Film direction",
      "Instrument manufacturing"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "What does Sahitya mean?",
    "options": [
      "The Tala speed",
      "The lyrics of a composition",
      "The pitch of the Tambura",
      "The ending beat"
    ],
    "correctIndex": 1,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "What is a Sangati?",
    "options": [
      "A melodic variation of a lyrical line",
      "A composer's name",
      "A percussion instrument",
      "A type of posture"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Why should a student understand the Sahitya of a Kriti?",
    "options": [
      "To sing faster",
      "To communicate its meaning and emotion",
      "To avoid keeping Tala",
      "To change the composition"
    ],
    "correctIndex": 1,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Word meaning explains:",
    "options": [
      "The meaning of each word in the lyrics",
      "The speed of the song",
      "The posture of the singer",
      "The number of Sangatis"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Devotional meaning explains:",
    "options": [
      "The deeper spiritual or emotional message",
      "The number of beats",
      "The order of the composers",
      "The volume of the voice"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Why is correct pronunciation important?",
    "options": [
      "It preserves the meaning of the lyrics",
      "It increases the speed automatically",
      "It changes the Tala",
      "It removes the need for Bhava"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "A simple Sangati is:",
    "options": [
      "An easy melodic variation of a line",
      "A completely different song",
      "A Tala cycle",
      "A composer's signature"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "A progressive Sangati:",
    "options": [
      "Gradually develops the melodic line",
      "Removes the original lyrics",
      "Changes the composer",
      "Always begins before the beat"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Controlled variation means:",
    "options": [
      "Singing Sangatis accurately and with discipline",
      "Changing every note freely",
      "Singing without Tala",
      "Singing as loudly as possible"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "What is Eduppu?",
    "options": [
      "The entry point of a composition in relation to Tala",
      "The final word of the Charanam",
      "The composer's name",
      "The meaning of the Sahitya"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "In Samam Eduppu, the composition begins:",
    "options": [
      "Exactly on the main beat",
      "Before the main beat",
      "After the main beat",
      "Without Tala"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "A before-beat Eduppu begins:",
    "options": [
      "Before the main Tala beat",
      "Exactly on the main beat",
      "After the entire composition",
      "Only during the Charanam"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "An after-beat Eduppu begins:",
    "options": [
      "After the main Tala beat",
      "Before the Tala begins",
      "Exactly with the main beat",
      "Without any rhythm"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "The teacher begins the Tala, and the student starts singing exactly on the first beat. This is:",
    "options": [
      "Samam Eduppu",
      "Before-beat Eduppu",
      "After-beat Eduppu",
      "Progressive Sangati"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "The Tala begins first, and the singer enters slightly later. This is:",
    "options": [
      "After-beat Eduppu",
      "Samam Eduppu",
      "Pallavi",
      "Simple Sangati"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "The singer begins the musical phrase just before the main Tala beat. This is:",
    "options": [
      "Before-beat Eduppu",
      "After-beat Eduppu",
      "Samam Eduppu",
      "Charanam"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "What does Bhava mean in Kriti singing?",
    "options": [
      "Expression of meaning and emotion",
      "Singing at maximum speed",
      "Changing the lyrics",
      "Avoiding pronunciation"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Which action shows respect for the composer?",
    "options": [
      "Preserving the lyrics and melody carefully",
      "Changing the words without reason",
      "Ignoring the pronunciation",
      "Singing without understanding"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Which is a quality of confident Kriti delivery?",
    "options": [
      "Clear pronunciation",
      "Careless entry",
      "Uncontrolled variation",
      "Incorrect lyrics"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "A student sings the notes correctly but does not understand the words. What should the student improve?",
    "options": [
      "Sahitya meaning and Bhava",
      "Sitting height only",
      "Instrument tuning",
      "Hand movements"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "What may happen when Sangatis are sung without control?",
    "options": [
      "The melody and lyrics may become unclear",
      "The composer changes",
      "The Kriti becomes a Geetham",
      "The Tala disappears permanently"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "What is the main function of the Charanam?",
    "options": [
      "To expand or complete the lyrical message",
      "To begin the Kriti",
      "To name the Tala",
      "To tune the voice"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "A section introduces the main musical and lyrical idea of a Kriti. Which section is it?",
    "options": [
      "Pallavi",
      "Anupallavi",
      "Charanam",
      "Sahitya"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "A section is sung after the Pallavi and develops its musical idea further. Which section is it?",
    "options": [
      "Anupallavi",
      "Charanam",
      "Geetham",
      "Eduppu"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Which statement correctly compares a Geetham and a Kriti?",
    "options": [
      "A Geetham is simple, while a Kriti has greater musical and lyrical depth",
      "A Kriti is always simpler than a Geetham",
      "Both have no lyrics",
      "A Geetham contains more Sangatis than every Kriti"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Which statement correctly compares a Varnam and a Kriti?",
    "options": [
      "A Varnam develops musical control, while a Kriti gives greater importance to Sahitya and devotion",
      "A Kriti has no raga",
      "A Varnam has no melody",
      "Both are only Tala exercises"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "During a listening test, the same lyrical line is repeated with increasingly developed melodic forms. What is being demonstrated?",
    "options": [
      "Progressive Sangati",
      "Samam Eduppu",
      "Charanam",
      "Word meaning"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Which method is most suitable for identifying the Eduppu of a Kriti?",
    "options": [
      "Keep Tala steadily and observe when the song enters",
      "Ignore the Tala and listen only to volume",
      "Count the number of words",
      "Observe the singer's clothing"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "How can incorrect pronunciation affect Bhava?",
    "options": [
      "It can change the meaning and weaken the expression",
      "It automatically improves the emotion",
      "It creates Samam Eduppu",
      "It changes the Pallavi into a Charanam"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Which student is showing the greatest respect for the composition?",
    "options": [
      "A student who learns the meaning and pronounces the lyrics carefully",
      "A student who changes the melody to appear creative",
      "A student who sings without keeping Tala",
      "A student who ignores the composer"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Which is the best example of dignified Kriti presentation?",
    "options": [
      "Clear lyrics, suitable expression and controlled singing",
      "Loud singing without meaning",
      "Fast singing with incorrect pronunciation",
      "Random melodic changes"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "The lyrics remain the same, but the melody changes in a disciplined manner. This is called:",
    "options": [
      "Sangati",
      "Eduppu",
      "Sahitya",
      "Charanam"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Which option gives the correct order of the three main Kriti sections?",
    "options": [
      "Pallavi, Anupallavi, Charanam",
      "Charanam, Pallavi, Anupallavi",
      "Anupallavi, Charanam, Pallavi",
      "Sangati, Eduppu, Sahitya"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Which is the most complete description of a Kriti?",
    "options": [
      "A mature Carnatic composition containing music, lyrics, devotion, poetry and raga depth",
      "A basic voice-warming exercise without lyrics",
      "A percussion pattern used before a concert",
      "A simple Tala hand movement"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Before learning to present an unfamiliar Kriti, what should a student study?",
    "options": [
      "The lyrics, pronunciation, meaning and structure",
      "Only the final note",
      "Only the volume level",
      "Only the composer's photograph"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "Which composer-description pair is correctly matched?",
    "options": [
      "Muthuswami Dikshitar \u2014 known for many Sanskrit compositions",
      "Tyagaraja \u2014 creator of Western opera",
      "Syama Sastri \u2014 percussion instrument maker",
      "Purandaradasa \u2014 film music director"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  },
  {
    "subject": "Sangeetham (Vocal)",
    "grade": "Grade 8",
    "question": "During an assessment, which group of qualities should the examiner observe in a Kriti presentation?",
    "options": [
      "Pronunciation, Sangati control, Bhava and confidence",
      "Clothing, height, age and handwriting",
      "Speed alone",
      "Loudness alone"
    ],
    "correctIndex": 0,
    "classification": "Theory"
  }
];

// api/_server/data/gradeSyllabus.ts
var VOCAL_CARNATIC = {
  "Grade 1": {
    theory: [
      "Introduction to Music \u2013 basic technical terms: Nada, Sruti, Svara, Sthayi, Janaka and Janya ragas",
      "Tala \u2013 Sapta talas, Shadangas, Chapu tala",
      "Composers \u2013 Purandaradasar and Muthuswami Dikshitar"
    ],
    practical: [
      "Sarali Varisai \u2013 14 (3 speeds)",
      "Janta Varisai \u2013 9 (3 speeds)",
      "Melsthayi Varisai \u2013 5 (3 speeds)",
      "Nottuswarams",
      "Adi Tala basic laya exercises"
    ]
  },
  "Grade 2": {
    theory: [
      "Musical forms \u2013 Abhyasa Ganam: Alankaram, Gitam",
      "Sapta talas and their structure \u2013 5 Jatis, 3 main Angas of Sapta talas and their symbols",
      "The nomenclature of the 16 svaras",
      "Biography of Thirugnanasambanthar and Arunagirinathar"
    ],
    practical: [
      "Dhattu Varisais (3 speeds)",
      "Keezh Sthayi Varisais (3 speeds)",
      "Alankarams (3 speeds)",
      "Any 2 Gitams, one Tevaram and one Thiruppugazh",
      "Laya exercises in Sapta talas"
    ]
  },
  "Grade 3": {
    theory: [
      "Musical forms \u2013 Lakshana Gitam, Swarajathis, Varnams, Kritis and their structure in general",
      "Biography and contribution of Tyagarajar; disciples of Tyagarajar",
      "Technical terms \u2013 Gamaka, Vadi, Samvadi, Vivadi, Anuvadi, Prayogam, Varjya, Vakram, Upanga, Bhashanga, Nishadhantya, Dhaivatantya, Panchamantya, Madhyama shruti"
    ],
    practical: [
      "Lakshana Gitam \u2013 1",
      "Swarajathi \u2013 2",
      "One Adi Tala Varnam",
      "A Kriti of Muthuswami Dikshitar with Samashti Charanam (simple scale raga)",
      "Any 2 Divyanama Keerthanas of Tyagaraja"
    ]
  },
  "Grade 4": {
    theory: [
      "Classification of musical instruments \u2013 string, wind and percussion",
      "Biography and contribution of composers \u2013 Appar, Manickavasagar, Sundarar, Alwars, Annamayya, Badrachala Ramdass",
      "Historical musical references in Tamil treatises such as Silapathikaram"
    ],
    practical: [
      "Any 2 Adi Tala Varnams",
      "Kritis in the ragas Mayamalavagowla, Gambira Nattai, Shanmugapriya, Mohanam \u2014 by Tyagarajar, Muthuthandavar, Uttukadu Venkata Subbaiyer, Swathi Tirunal, Papanasam Sivan or Muthuswami Dikshitar",
      "Alankarams and Dattu Varisais in the ragas Shanmugapriya and Mohanam",
      "One each from: Thiruppavai, Thiruvasakam, Meenakshi Pillai Tamizh, Annamayya, Badrachala Ramdass, patriotic song of Subramanya Bharati",
      "Laya exercises in Rupaka Tala and Kanda Chapu"
    ]
  },
  "Grade 5": {
    theory: [
      "72 Melakarta \u2013 raga classification",
      "Dasavidha Gamakas",
      "Tala Dasa Pranas",
      "Study of the Tambura \u2013 structure, parts, construction and tuning",
      "Historical musical references in Tamil treatises \u2013 Pancha Marabu",
      "Biography and contribution of composers \u2013 Sirgazhi Muvar, Muthuthandavar, Marimuttai Pillai, Arunachala Kavirayar, Gopalakrishna Bharati"
    ],
    practical: [
      "Alankarams and Dattu Varisais in the ragas Pantuvarali, Keeravani, Karaharapriya, Sriranjani, Madhyamavathi",
      "3 Adi Tala Varnams in any of the ragas Saveri, Sahana, Kedaragaula, Darbar, Surutti, Begada",
      "Any 4 Kritis in the ragas Keeravani, Karaharapriya, Madhyamavathi, Sriranjani, Pantuvarali, Sahana \u2014 composers: Trinity, Gopalakrishna Bharati, Arunachala Kavirayar, Ramaswami Sivan, Harikesanallur Muttiah Bhagavathar, Papanasam Sivan",
      "A Pancharatna Kriti of Tyagaraja",
      "Laya exercises in Misra Chapu tala"
    ]
  },
  "Grade 6": {
    theory: [
      "Biography of composers such as Shyama Sastri and his disciples",
      "Folk music \u2013 folk instruments \u2013 contribution of Annamalai Reddiar",
      "Study of musical instruments and their structure \u2013 Violin and Mridangam",
      "Musical references in Panniru Thirumurai, Divya Prabandam and the Chandams of Thiruppugazh",
      "Talas mentioned in Caccatputah Venba and Pancha Marabu"
    ],
    practical: [
      "One Ata Tala Varnam",
      "One Pada Varnam",
      "Any 4 Kritis with decorative angas (Chittaswaram, Swara Sahityam, Madhyamakala Sahityam) in the ragas Kambodhi, Bhairavi, Purvikalyani, Saveri, Dhanyasi, Varali",
      "One each of the musical forms Padam, Javali, Ragamalika",
      "One from: Thiruppugazh in Chanda Talam, Thillana, Kuravanji"
    ]
  },
  "Grade 7": {
    theory: [
      "Musical instruments \u2013 Veena, Flute, Tavil, Nagaswaram",
      "Dasa Vidha Gamakas in the Viriboni Bhairavi Varnam",
      "Musical forms \u2013 Padam, Javali, Ragamalika, Thillana",
      "Overview of the musical treatises tracing the grammar of Carnatic music \u2013 Sangita Ratnakara, Chaturdandi Prakasika, Sangita Sampradaya Pradarshini",
      "Contribution of composers \u2013 Ganam Krishna Iyer, Dharmapuri Subbarayar, Ramaswamy Sivan, Neelakanta Sivan, Papanasam Sivan, Kavikunjara Bharati, Kotiswara Iyer, M.M. Dandapani Desikar, Periyasami Thooran"
    ],
    practical: [
      "One Ata Tala Varnam",
      "Kalpana Swaras in any two of the ragas Mayamalavagowla, Sankarabaranam, Shanmugapriya, Mohanam, Sriranjani, Keeravani, Karaharapriya, Madhyamavathi",
      "One Pancharatna Kriti of Tyagaraja and one Swarajathi of Shyama Shastri",
      "Raga Alapana for any 2 of the ragas Kambodhi, Pantuvarali, Kalyani, Karaharapriya, Purvikalyani, Saveri",
      "Any 4 Tamil Kritis by Neelakanta Sivan, Ramaswamy Sivan, Koteeswara Iyer, M.M. Dandapani Desikar or Periyasami Thooran"
    ]
  },
  "Grade 8": {
    theory: [
      "Sabha Ganam \u2013 Kucheri Paddhati (concert format)",
      "Introduction to Western music, Hindustani music and folk music",
      "The various seats of music in South India that contributed to the growth of Carnatic music",
      "Role of technology and its advancement in the propagation of Carnatic music"
    ],
    practical: [
      "Alankarams in Vivadi ragas \u2013 any 2 of Rasikapriya, Mararanjani, Dhanarupi, Nitimathi, Kanakangi, Gayakapriya",
      "Small Abhiprayams and Korvais for Kalpana Swaras in any 2 ragas (Adi, Rupaka, Kanda Chapu and Misra Chapu talas) from Mohanam, Sankarabaranam, Lalita, Mayamalavagowla, Lathangi, Hamsanadam, Suddha Saveri, Pantuvarali",
      "A Kriti with Raga Alapana and Kalpana Swaram in one Suddha Madhyama raga \u2013 Sankarabaranam, Saveri, Begada, Dhanyasi, Karaharapriya, Thodi, Kambodhi or Keeravani",
      "A Kriti with Raga Alapana and Kalpana Swaram in one Prati Madhyama raga \u2013 Kalyani, Shanmugapriya, Pantuvarali, Purvikalyani, Varali, Simmendra Madhyamam, Lathangi or Subapantuvarali",
      "A Kriti with Raga Alapana and Kalpana Swaram in one Audava/Shadava raga \u2013 Lalitha, Arabhi, Bilahari, Sriranjani, Abhogi, Ritigaula, Madhyamavathi or Hindolam"
    ]
  }
};
var BHARATANATYAM = {
  "Grade 1": {
    theory: [
      "Primary information \u2013 Adavu, Korvai, 3 speeds, Adi talam, Rupaka talam",
      "Technical information \u2013 Siro bhedas, Asamyuta hastas, Viniyogas from Pataka to Arala",
      "Names of classical dances; Nattuvanars \u2013 Meenakshi Sundaram Pillai, Chokalingam Pillai; Legends \u2013 Smt. T. Balasaraswathi, Kalyani Sisters",
      "Texts \u2013 Thirukkural, Abhinayadarpanam, Purananooru"
    ],
    practical: [
      "Adavus \u2013 Thattadavu, Naattadavu, Paraval adavu, Kudithu mettu, Korvai adavu, Paidal adavu",
      "Project \u2013 mime a story with a moral using dance gestures"
    ]
  },
  "Grade 2": {
    theory: [
      "Primary information \u2013 Tirmanam, Nrtta, 4 types of abhinaya, Panchajati, kings who patronised the arts",
      "Technical information \u2013 Drishti bheda, Samyuta hastas, Viniyogas from Katakamukha to Chandrakala",
      "Names of folk dances; Nattuvanars \u2013 Kaatumannar Koil Muthukumara Pillai, Panchapakesa Nattuvanar; Legends \u2013 Smt. M.K. Saroja, Kumari Kamala",
      "Texts \u2013 Tolkappiyam, Silappadikaram, Agananooru"
    ],
    practical: [
      "Adavus \u2013 Kuthadavu, Thattimettu adavu, Sarukkal, Mandi, Ettadavu, Tirmana adavu, Kummi/Kolattam",
      "Project \u2013 Ramayana characters (any two)"
    ]
  },
  "Grade 3": {
    theory: [
      "Primary information \u2013 Nritya, Natya, Alarippu, Kavuthuvam, Sapta Tala",
      "Technical information \u2013 Griva bheda, Devata hastas, Viniyogas from Padmakosha to Chatura hasta",
      "Bharatanatyam; Rukmini Devi; Nattuvanars \u2013 Kandappa Pillai, K.N. Dandayudapani Pillai; Legends \u2013 Yamini Krishnamoorthy, Vyjayanthimala Bali",
      "Texts \u2013 Natyasastra, Manimekhalai, Kurunthogai"
    ],
    practical: [
      "Adavus in Tisram",
      "Compositions \u2013 Alarippu, Kavuthuvam",
      "Project \u2013 Panchasabhai and Panchabhootam"
    ]
  },
  "Grade 4": {
    theory: [
      "Primary information \u2013 Sollukkattu, Jati, Jatiswaram, Shabdam, Tanjore Quartet, Mallari",
      "Technical information \u2013 Mandalas and Sthanakas, Dashavatara hastas, Viniyogas from Bhramara to Trisula hasta",
      "Kathak, Kuchipudi; Nattuvanars \u2013 Pichiah Pillai, Subbaraya Pillai; Legends \u2013 Adyar K. Lakshman, Travancore Sisters",
      "Texts \u2013 Natyasastra, Manimekhalai, Kurunthogai"
    ],
    practical: [
      "Adavus in Misram",
      "Compositions \u2013 Jatiswaram, Shabdam",
      "Project \u2013 Dasavataram"
    ]
  },
  "Grade 5": {
    theory: [
      "Primary information \u2013 Bhava, Rasa, orchestra, Pushpanjali, Kirtanam, Kavadi Chindu",
      "Technical information \u2013 leaps and jumps, Varna bhedas, Bandhava hastas, Samyuta hastas from Anjali to Utsangam",
      "Odissi, Manipuri; Nattuvanars \u2013 Bavu Pillai, Ramaih Pillai; Legends \u2013 Dr. Padma Subrahmanyam, Prof. C.V. Chandrashekar",
      "Texts \u2013 Kutanul, Tevaram, Tiruvasakam, Paripadal"
    ],
    practical: [
      "Adavus in Khandam",
      "Compositions \u2013 Kirtanam/Kriti, Tillana, Kavadi Chindu/Kilikanni",
      "Project \u2013 Aarupadai Veedu"
    ]
  },
  "Grade 6": {
    theory: [
      "Primary information \u2013 Nayaka Nayaki Prakarna, evolution of the Margam, Paadal, Padam, Javali, Thodayam",
      "Technical information \u2013 twirls and turns, Navagraha hastas, Samyuta hastas from Sivalinga to Samputa",
      "Kathakali, Mohiniattam; Nattuvanars \u2013 Mahalingam Pillai, Muthuswamy Pillai; Legends \u2013 Dr. Sudharani Raghupathy, The Dhananjayans",
      "Texts \u2013 Kutanul, Tevaram, Tiruvasakam, Paripadal"
    ],
    practical: [
      "Adavus in Sankeernam",
      "Compositions \u2013 Padal/Bhajan/Abhang, Padam/Javali",
      "Project \u2013 Aarupadai Veedu"
    ]
  },
  "Grade 7": {
    theory: [
      "Primary information \u2013 revival of Bharatanatyam, importance of music and yoga, Pada varnam, Swarajati, Viruttam/slokam, Ashtapadi",
      "Technical information \u2013 gaits, Tala dasa pranas, Marga talas, Viniyogas from Pasa hasta to Bherunda hasta",
      "Sattriya, Chau; Nattuvanars \u2013 Kittappa Pillai, Dakshinamoorthy Pillai; Legends \u2013 Smt. Chitra Visveswaran, Lakshmi Viswanathan",
      "Texts \u2013 Kuravanji, Ainkurunooru"
    ],
    practical: [
      "Pada varnam / Swarajati / Daru varnam or an alternate composition",
      "Project \u2013 Krishna avatara"
    ]
  },
  "Grade 8": {
    theory: [
      "All primary and technical information of the previous grades (cumulative)",
      "All dance forms of the previous grades; Nattuvanars \u2013 Ellappa Pillai, Govindarajan Pillai; Legends \u2013 Smt. Mrinalini Sarabhai, Smt. Krishnaveni Lakshmanan",
      "Texts \u2013 Mahabharata Choodamani, Thoodu, Ula, Kalithogai"
    ],
    practical: [
      "All adavus and compositions of the previous grades (cumulative)",
      "Project \u2013 Mahabharata"
    ],
    notes: "Cumulative grade \u2014 all previous levels are examinable."
  }
};
var MRIDANGAM_EXAM = {
  "Grade 1": {
    theory: [
      "Basic technical terms \u2013 Talam, Avartanam, Aksharam",
      "Mridangam \u2013 its origin and history",
      "Sapta Talas; Jatis; Tala Angas and their symbols"
    ],
    practical: [
      "Adi Tala basic lessons",
      "Introduction to the 5 jatis and basic lessons",
      "Sapta Talas \u2013 thathakaram and basic exercises",
      "Rupaka Tala basic exercises",
      "Express notations of the lessons learnt in writing and orally"
    ]
  },
  "Grade 2": {
    theory: ["Nadais; Nadam; Kalam; Korvai; Theermanam; Mohra", "Life history of Mridangam vidwans"],
    practical: [
      "Adi Tala Tisra Nadai exercises",
      "Rupaka Tala Tisra Nadai exercises",
      "Adi Tala and Rupaka Tala sarvalaghu varieties",
      "Theermanams for Adi and Rupaka Tala",
      "Tani avartanam \u2013 Adi and Rupaka Tala"
    ]
  },
  "Grade 3": {
    theory: [
      "35 Talas; concept of Gathis and the 175 Talas",
      "Five Dasa Pranas of Mridangam",
      "Mridangam \u2013 detailed study of structure, construction, making and maintenance"
    ],
    practical: [
      "Misra Chapu and Kanda Chapu basic exercises",
      "Misra Chapu and Kanda Chapu Tisra Nadai exercises",
      "Misra Chapu and Kanda Chapu sarvalaghu varieties",
      "Misra Chapu and Kanda Chapu theermanams",
      "Tani avartanam \u2013 Misra Chapu and Kanda Chapu"
    ]
  },
  "Grade 4": {
    theory: [
      "Differences between Mathalam, Thavil and Mridangam",
      "Classification of instruments \u2013 string, wind, other percussion"
    ],
    practical: [
      "Advanced exercises in Adi and Rupaka \u2013 Anulomam and Pratilomam",
      "Advanced exercises in Kanda Chapu and Misra Chapu \u2013 Anulomam and Pratilomam",
      "Advanced sarvalaghu patterns for Adi and Rupakam",
      "Advanced sarvalaghu patterns for Kanda Chapu and Misra Chapu",
      "Create and apply theermanams for Adi, Rupakam, Kanda Chapu and Misra Chapu"
    ]
  },
  "Grade 5": {
    theory: [
      "Yathi types; Tala Dasa Pranas",
      "Evolution of the system of notation in Carnatic music",
      "Percussion references in Tamil treatises \u2013 Silapathikaram, Panchamarabu, Tala Samuthiram"
    ],
    practical: [
      "Create korvais for Adi, Rupakam, Kanda Chapu and Misra Chapu (samam to samam)",
      "Create mohras for all 35 talas",
      "Misra kuraippu for Adi Talam and Kanda kuraippu for Rupaka Talam",
      "Tisra kuraippu for Misra Chapu and Sankirna kuraippu for Kanda Chapu",
      "Chatusra kuraippu for Khanda Jathi Triputa tala; write notations for the lessons learnt"
    ]
  },
  "Grade 6": {
    theory: ["108 Talas", "Chandams of Thiruppugazh", "Study of the Upa pakkavadyas"],
    practical: [
      "Adi Tala Varnams \u2013 2",
      "Accompanying kritis in Adi Tala and Rupaka Tala",
      "Accompanying kritis in Misra Chapu and Kanda Chapu",
      "Accompanying Tevaram and Thiruppugazh (Chanda talam)",
      "Accompanying a Thillana"
    ]
  },
  "Grade 7": {
    theory: ["Varieties of percussion instruments of South India", "Hindustani percussion instruments"],
    practical: [
      "Play an Ata Tala Varnam",
      "Create abhiprayam and korvais from samam to edam",
      "Create theermanams for kritis with different eduppu",
      "Tani avartanam in Adi, Rupakam, Kanda Chapu and Misra Chapu with different eduppu",
      "Play a Pancharatna Kriti of Tyagaraja"
    ]
  },
  "Grade 8": {
    theory: ["Seats of music in South India", "Technology and its advancement in Carnatic music"],
    practical: [
      "Handling of Neraval and Kalpana Swaram",
      "Pallavi in Adi Talam",
      "Pallavi in Kanda Jathi Triputa Tala followed by tani avartanam",
      "Pallavi in any nadai with different eduppu followed by tani avartanam",
      "Accompany a full kucheri (1 hour)"
    ]
  }
};
var TABLA_EXAM = {
  "Grade 1": {
    theory: [
      "Construction and parts of Tabla and Dagga",
      "Method of playing the Dashavarnas on Tabla and Dagga",
      "Teen Taal, Jhap Taal, Ek Taal, Dadra, Keherwa and Chow Taal in detail; practice in Dugun and Chowgun laya in Taal-Lipi notation",
      "Taal-Lipi notation systems of Pandit Bhatkhande and Pandit Paluskar"
    ],
    practical: [
      "Bols: Tha, Na, Dha, Dhin, Thin, Ghee, Thraka, Kath, Thirakita, Thakitatha, Dhinagina, Ghidanaga, Theenthinna, Nagathaga",
      "Basic (mool) theka of Teen Taal, Jhap Taal, Ek Taal, Rupak Taal, Dadra, Keherwa, Chow Taal",
      "Oral rendering of those taals in normal, Dugun and Chowgun speeds with matra counting by hand",
      "Two kaydas each in Teen Taal and Jhap Taal with four paltas",
      "Two mukhdas, two tukdas and two tihais in Teen Taal and Jhap Taal"
    ]
  },
  "Grade 2": {
    theory: [
      "Technical terms \u2013 Sangeet, Nada, Swara, Laya (Vilambit, Madhya, Drut), Taal, Bol, Sam, Khali, Bhari, Vibhag, Avartan, Theka, Kayda, Mukhda, Tukda, Tihai, Laggi, Dugun, Tigun, Chowgun",
      "Biographies \u2013 Pandit Kanthe Maharaj, Ustad Alla Rakha, Amir Khusro, Habibuddin Khan"
    ],
    practical: [
      "Four badal thekas in Teen Taal, Jhap Taal, Ek Taal, Rupak Taal, Dadra, Keherwa, Chow Taal",
      "Four badal thekas and four tihais each in Teen Taal, Jhap Taal, Ek Taal and Rupak Taal",
      "Four badal thekas and four laggis in Dadra and Keherwa",
      "Chow Taal bols orally and on Tabla in Vilambit, Dugun and Chowgun",
      "Identify the sam and taal when sung/played by the examiner and execute saath-sangat"
    ]
  },
  "Grade 3": {
    theory: [
      "Classification of Indian musical instruments; history and development of Tabla",
      "Construction of Tabla and Dagga with sketches",
      "Theory of various taals; the five jatis (Chatushra, Tishra, Mishra, Khanda, Sankirna)",
      "Peshkar vs kayda; terms \u2013 Peshkar, Kayda, Tukda, Mukhda, Tihai, Una, Gat, Paran, Laggi, Ladi",
      "Importance of sam, khali, bhari, vibhag and avartan in taal construction"
    ],
    practical: [
      "Sing two swargeets and two lakshangeets and follow them on Tabla (raags such as Bhup, Desh, Khamaj, Bageshri, Durga, Kafi, Brindavani Sarang, Bhimpalasi, Jaunpuri, Bhairavi, Bhairav, Bihag, Tilang, Malkauns, Vibhas, Patdeep)",
      "Thekas of Punjabi, Sul Taal, Tevra, Dhamar, Matt Taal and Sawari",
      "Tabla solo in Teen Taal for 20 minutes",
      "Tabla solo in Jhap Taal for 15 minutes",
      "2 kaydas, 2 mukhdas, 2 tukdas and 3 tihais in Rupak Taal"
    ]
  },
  "Grade 4": {
    theory: [
      "Importance of taal in music; Tabla saath-sangat for singing and accompaniment",
      "Comparative study of Hindustani and Carnatic taal systems",
      "Gharanas of Tabla \u2013 Delhi, Banaras, Purab, Punjab, Ajrada",
      "Writing mukhda, tukda, tihai, gat, paran in Taal-Lipi; duties of a solo Tabla artist; rules of practice",
      "Biographies \u2013 Samta Prasad, Anokhelal Mishra, Nana Panse, Ustad Jahangir Khan, Kishan Maharaj, Amir Hussain Khan"
    ],
    practical: [
      "Kayda and theka in different gharana styles",
      "2 kaydas in Teen Taal in Adi laya",
      "Theka in vilambit laya",
      "Two Adi-laya kaydas in Rupak Taal",
      "Saath-sangat for a vocal rendering with vilambit theka"
    ]
  },
  "Grade 5": {
    theory: [
      "Indian music and rhythm instruments in the Vedic period; development from Mughal times to the present",
      "Position of music in society; tradition of Avanaddha instruments; the Pakhawaj; history of Tabla"
    ],
    practical: [
      "2 mukhdas, 2 tukdas and 3 tihais in Ek Taal",
      "Teen Taal theka in Adi and Kuadi laya",
      "Vilambit theka in Addha Taal for thumri, finishing with laggi",
      "Vilambit theka in Deepchandi Taal, finishing with laggi",
      "One kayda in any taal in Adi laya and Chatushra laya"
    ]
  },
  "Grade 6": {
    theory: [
      "Gharanas of Tabla; Dasha Pranas of taal; layakari; Taal-Lipi system; emotions (rasa) arising from taal and laya",
      "Biographies \u2013 Sharangadeva, Tansen, Amir Khusro, Gopal Nayak, Ram Sahai"
    ],
    practical: [
      "Tabla solo with detailed elaboration in Teen Taal",
      "Tabla solo with detailed elaboration in Jhap Taal",
      "Tabla solo in Ek Taal and Rupak Taal",
      "Tabla solo in Ada Chautaal",
      "Punjabi, Tappa Taal, Sul Taal, Sawari, Matt Taal and Pharodast Taal with explanation"
    ]
  },
  "Grade 7": {
    theory: [
      "Peshkar, Kayda, Gat, Mukhda, Tukda, Paran, Chakradar, Farmaishi, Chakradar tihai (damdar and bedamdar), Uthan, Salami, Mohra",
      "Comparative study of Carnatic and Hindustani taal systems",
      "Saath-sangat for vocal, instrumental and dance; rhythm in classical, folk and film music; discipline of the percussion artist"
    ],
    practical: [
      "Badal theka, laggi, ladi, baant, tihai in Dadra, Keherwa, Dhumali, Deepchandi, Bhajan theka and Khemta",
      "Pleasant vilambit theka in Teen Taal, Ek Taal, Jhap Taal and Tilwada",
      "Basic thekas of Brahma, Shikhar, Rudra, Lakshmi and Pashto Taal",
      "Tabla solo in Matt Taal (9 matra)",
      "Compose and render new mukhda, tukda and tihai"
    ]
  },
  "Grade 8": {
    theory: [
      "Avanaddha instruments in Bharata's Natyashastra, Sangita Ratnakara, Sangita Parijata, Sangita Sara",
      "Making Tabla melodious and effective; biographies \u2013 Kanthe Maharaj, Ustad Natthu Khan, Mehboob Saab, Mirajkar, Ahmed Jan Thirakwa, Samta Prasad",
      "Accompanying with prior knowledge of the raag; national integration through programmes beyond jugalbandi"
    ],
    practical: [
      "Demonstrate with hand signs Chautaal, Dhamar, Sul Taal, Rupak Taal and Jhap Taal in Dugun, Tigun and Chowgun, and render them on Tabla",
      "2 kaydas of Tishra variety in Jhap Taal and Rupak Taal",
      "Teen Taal theka with tukda, paran, chakradar gat and tihai",
      "Laggi, ladi and tihai with special layakari in Keherwa and Dadra",
      "Basic theka in any laya, then vocal rendering of gat, paran, chakradar, farmaishi and playing the same"
    ]
  }
};
var TAVIL_EXAM = {
  "Grade 1": {
    theory: ["Definitions \u2013 Nada, Shruti, Swara, Laya, Raga, Tala, Jati, Gati, Suladi Sapta Talas", "Unique contribution of Tavil vidwans"],
    practical: [
      "Pillaiyar paadam",
      "Introduction to Adi Tala and rendering the lesson orally with talam",
      "3 speeds \u2013 names and exercises",
      "Adi Talam \u2013 Oru Vazhi Paadam, Iru Vazhi Paadam and Nangu Vazhi Paadam",
      "Writing notations for the lessons learnt"
    ]
  },
  "Grade 2": {
    theory: [
      "Construction and techniques of the Thavil; Nadaswaram \u2013 origin, construction and playing technique",
      "Life sketches of Tyagaraja, Muthuswami Dikshitar and Shyama Shastry; a Tavil vidwan and his contribution",
      "Nadaswaram and Thavil as Raja Vadyam and Mangala Vadyam"
    ],
    practical: [
      "Explanation of Adi Tala",
      "Tisram for the basic Adi Tala lessons",
      "The 5 jathis and thathakaram",
      "Introduction to Rupaka Talam and its basics",
      "Mohra in Adi Tala"
    ]
  },
  "Grade 3": {
    theory: [
      "Construction and techniques of the upa pakka vadyas \u2013 Kanjira, Mridangam",
      "Definitions \u2013 Karani, Vettu Thattu, Hechchu, Taggu, Mohra, Korvai, Meettu, Chapu, Arachapu",
      "Musical forms \u2013 Gitam, Swarajathi, Jathiswaram; Tamil composers \u2013 Muthuthandavar, Marimutta Pillai, Arunachala Kavirayar, Gopalakrishna Bharati"
    ],
    practical: [
      "Korvais in Adi Talam for 1, 2 and 4 avartanams",
      "Manodharma in Adi Talam \u2013 uruttu sols, mohra, korvai and arudhi",
      "Rupaka Tala \u2013 Oru/Iru/Nangu Vazhi Paadam and tisram",
      "Korvais for Rupaka Tala",
      "Angas and introduction to the Sapta Talas"
    ]
  },
  "Grade 4": {
    theory: [
      "Lakshana granthas with reference to laya and percussion \u2013 Silapathikaram and Panchamarabu",
      "Composers \u2013 Jayadevar, Narayana Theerthar, Badrachala Ramadasa, Thirugnanasambandar, Appar, Sundarar, Manikkavasagar",
      "Musical forms \u2013 Varnams; upa pakka vadyas \u2013 Ghatam, Morsing"
    ],
    practical: [
      "Kanda Chapu Tala and basic exercises",
      "Korvais for Kanda Chapu",
      "Misra Chapu Tala and basic exercises",
      "Korvais for Misra Chapu",
      "Introduction to the 35 talas"
    ]
  },
  "Grade 5": {
    theory: [
      "Lakshana granthas \u2013 Tala Samuthiram, Chaccatputa Venba, Panniru Thirumurai",
      "Composers \u2013 Arunagirinathar, Oothukadu Venkata Kavi, Purandara Dasa, Annamayya; musical form \u2013 Kriti"
    ],
    practical: [
      "The 35 talas with thathakaram, rendered orally with talam",
      "Study of the 175 talas",
      "Jathis for Adi, Rupaka, Misra Chapu and Kanda Chapu",
      "Nadai sols for Adi Talam",
      "Playing for kucheri in Chatusra Jathi Eka Talam"
    ]
  },
  "Grade 6": {
    theory: [
      "Lakshana granthas \u2013 Sangita Ratnakara, Chaturdandi Prakasika, Sangita Sampradaya Pradarshini",
      "Kucheri paddhati \u2013 Nadaswaram and Tavil in concerts, temples and ritual occasions"
    ],
    practical: [
      "Mohra, korvai and arudi for 2-kalai Adi, Rupakam, Kanda Chapu and Misra Chapu",
      "Concepts of 4, 8, 16 and 32 kandams",
      "Playing for kritis in 2-kalai Adi, Rupaka, Kanda Chapu and Misra Chapu",
      "Creating arudis and korvais for different eduppus",
      "Kuraippu \u2013 Misra (Adi), Kanda (Rupaka), Tisra (Misra Chapu), Sankirna (Kanda Chapu), Chatusra (Sankeerna Chapu) and patterns for the 35 talas"
    ]
  },
  "Grade 7": {
    theory: [
      "Post-Trinity composers; musical forms \u2013 Padam, Javali, Thillana, Ragamalika",
      "Mallari \u2013 structure and handling; Marga and Desi talas; Tala Dasa Pranas; 108 talas with angas and aksharas",
      "Seats of music in South India \u2013 Tanjore, Mysore, Thiruvananthapuram, Chennai"
    ],
    practical: [
      "Tani avartanam \u2013 Adi, Rupakam, Kanda Chapu and Misra Chapu",
      "Applying korvais in different tala structures",
      "Mallaris \u2013 Theerta, Taligai, Ther and playing techniques",
      "Alarippu in Kanda Nadai set in Chatusra Jathi Eka tala",
      "Jathis in Kanda Nadai, sols in different nadais and arudis"
    ]
  },
  "Grade 8": {
    theory: [
      "Evolution of notations; contemporary Tavil luminaries and their styles",
      "Percussion instruments of South India; Hindustani percussion instruments; technology in Carnatic music"
    ],
    practical: [
      "Playing for an Adi Tala Varnam, Ata Tala Varnam, Pancharatna Kriti of Tyagaraja and Thillana",
      "Accompanying Neraval",
      "Ragam Tanam Pallavi with tani avartanam in 2-kalai Adi, Khanda Jathi Triputa and Misra Jathi Triputa talas",
      "Different nadais in Adi Talam \u2013 kanda, tisra, misra, sankeerna \u2013 with korvais",
      "Playing a concert for 1 hour"
    ]
  }
};
var FLUTE_CARNATIC = {
  "Grade 1": {
    theory: VOCAL_CARNATIC["Grade 1"].theory,
    practical: [
      "Sarali Varisai \u2013 14 (3 speeds) in Harikambodhi",
      "Janta Varisai \u2013 9 (3 speeds) in Harikambodhi",
      "Dhattu Varisais (3 speeds) in Harikambodhi",
      "Fingering for Mayamalavagowla \u2013 3 speeds",
      "Blowing and tonguing techniques"
    ],
    notes: "Beginner varisais are taught in Harikambodhi on the flute; Mayamalavagowla is introduced as a fingering exercise."
  },
  "Grade 2": {
    theory: VOCAL_CARNATIC["Grade 2"].theory,
    practical: [
      "Fingering exercises; blowing of long notes",
      "Alankarams with talam on the foot",
      "Keezh sthayi and Mel sthayi varisais",
      "Alankarams in Kalyani, Keeravani, Natabhairavi, Pantuvarali",
      "Any 4 Gitams"
    ]
  },
  "Grade 3": {
    theory: VOCAL_CARNATIC["Grade 3"].theory,
    practical: [
      "Gitam in a vakra raga",
      "Swarajathi",
      "One Adi Tala Varnam (2 speeds)",
      "A simple song/kriti",
      "Laya exercises in Adi Tala \u2013 reckoning in hand and foot"
    ]
  },
  "Grade 4": {
    theory: VOCAL_CARNATIC["Grade 4"].theory,
    practical: [
      "Any 2 Adi Tala Varnams \u2013 one Suddha Madhyamam and one Prati Madhyamam",
      "Kritis in Mayamalavagowla, Gambira Nattai, Shanmugapriya, Mohanam",
      "Alankarams and Dattu Varisais in Sankarabaranam, Mohanam, Pantuvarali",
      "Any 3 from Thiruppavai, Thiruvasakam, Meenakshi Pillai Tamizh, Annamayya, patriotic song of Subramanya Bharati",
      "Laya exercises in Rupaka Tala and Kanda Chapu \u2013 reckoning in hand and foot"
    ]
  },
  "Grade 5": {
    theory: VOCAL_CARNATIC["Grade 5"].theory,
    practical: [
      "Alankarams and Dattu Varisais in Keeravani, Karaharapriya, Sriranjani, Madhyamavathi, Dharmavathi",
      "3 Adi Tala Varnams in Kedaragaula, Darbar or Begada",
      "Any 4 Kritis in Keeravani, Karaharapriya, Madhyamavathi, Dharmavathi, Begada",
      "Pancharatna Kriti of Tyagaraja \u2013 Arabhi",
      "Laya exercises for Misra Chapu \u2013 reckoning in hand and foot"
    ]
  },
  "Grade 6": {
    theory: VOCAL_CARNATIC["Grade 6"].theory,
    practical: [
      "One Ata Tala Varnam",
      "One Pada Varnam",
      "Any 4 Kritis with decorative angas (Chittaswaram, Swara Sahityam, Madhyamakala Sahityam) in Kambodhi, Purvikalyani, Saveri, Dhanyasi, Varali",
      "Tongue technique for Kalpana Swaras in Mayamalavagowla, Sankarabaranam, Mohanam, Keeravani",
      "One Thillana"
    ]
  },
  "Grade 7": {
    theory: VOCAL_CARNATIC["Grade 7"].theory,
    practical: [
      "One Ata Tala Varnam and one Daru Varnam",
      "One Padam and one Ragamalika",
      "One Pancharatna Kriti of Tyagaraja and one Swarajathi of Shyama Shastri",
      "Raga Alapana for any 2 of Kambodhi, Pantuvarali, Karaharapriya, Saveri",
      "Abhiprayams and korvai for Adi Talam and Rupakam with tala on the foot"
    ]
  },
  "Grade 8": {
    theory: VOCAL_CARNATIC["Grade 8"].theory,
    practical: [
      "Tanam blowing techniques",
      "RTP in Adi Talam",
      "A Kriti with Raga Alapana and Kalpana Swaram in one Suddha Madhyama raga \u2013 Sankarabaranam, Saveri, Begada, Dhanyasi, Karaharapriya, Thodi, Kambodhi or Keeravani",
      "A Kriti with Raga Alapana and Kalpana Swaram in one Prati Madhyama raga \u2013 Kalyani, Shanmugapriya, Pantuvarali, Purvikalyani, Varali, Simmendra Madhyamam, Lathangi or Subapantuvarali",
      "A Kriti with Raga Alapana and Kalpana Swaram in one Audava/Shadava raga \u2013 Lalitha, Arabhi, Bilahari, Sriranjani, Abhogi, Ritigaula, Madhyamavathi or Hindolam"
    ]
  }
};
var VIOLIN_CARNATIC = {
  "Grade 1": {
    theory: [
      "Introduction to the various systems of Indian music",
      "Nada and Sruti; pitch and its connotations",
      "Sapta swaras, the twelve swarasthanas and the sixteen-swara nomenclature",
      "Three sthayis; symbols used in basic notation",
      "Technical terms \u2013 Tala, Nadai, Anga, Avartana, Shadangas, Uttaranga and Purvanga"
    ],
    practical: [
      "Pre-Grade foundation \u2013 Sarali Varisais in Mayamalavagowla (plain notes, 3 speeds, with sruti); full/half/quarter bow lengths; Adi and Rupaka Tala in Chatusra Nadai in 3 speeds; a simple devotional song",
      "Janta Varisais in Mayamalavagowla \u2013 plain notes, 3 speeds, with sruti",
      "Dhattu Varisais in Mayamalavagowla \u2013 plain notes, 3 speeds, with sruti",
      "Tara Sthayi Varisais in Mayamalavagowla \u2013 3 speeds",
      "Mandra Sthayi Varisais in Mayamalavagowla \u2013 3 speeds",
      "Alankarams in Mayamalavagowla \u2013 Chatusra Jathi Eka, Chatusra Jathi Rupaka, Tisra Jathi Triputa (3 speeds)"
    ],
    notes: "The official syllabus has a separate Pre-Grade (no theory exam) \u2014 folded in here as the foundation."
  },
  "Grade 2": {
    theory: [
      "Musical forms \u2013 Alankaram and Gitam",
      "The 3 main angas; Sapta Talas; Pancha Jati; Jati Bheda; the 35 talas",
      "Parts of the violin \u2013 body, fingerboard, tailpiece, scroll, bridge, pegs, sound post",
      "The four strings \u2013 nomenclature and tuning",
      "Life sketches \u2013 Purandaradasar; the Trinity (Syama Sastri, Tyagaraja, Muthuswami Dikshitar); Arunagirinathar"
    ],
    practical: [
      "Alankarams in Mayamalavagowla and Sankarabharanam \u2013 Chatusra Jathi Matya, Chatusra Jathi Dhruva, Misra Jathi Jhampa, Khanda Jathi Ata (3 speeds)",
      "Gitams \u2013 any four (2 in Malahari, 2 in any other raga)",
      "Nottuswara Sahityas \u2013 2",
      "Thiruppugazh or devotional song \u2013 1",
      "Sing the above with tala and sahitya"
    ]
  },
  "Grade 3": {
    theory: [
      "Musical forms \u2013 Jatiswaram, Swarajati",
      "Types of Varnams \u2013 Tana, Pada, Chauka, Daru and Ragamalika",
      "Life sketches of the Tevaram Muvar \u2013 Thirugnanasambandar, Thirunavukkarasar, Sundaramurthi Nayanar",
      "Tyagaraja and his disciples",
      "Classification of instruments \u2013 Tata (string), Sushira (wind), Ghana (metallic), Avanaddha (percussion)"
    ],
    practical: [
      "Lakshana Gitam \u2013 1 (any language)",
      "Jatiswaram \u2013 1; Swarajati \u2013 1",
      "Adi Tala Varnam \u2013 1, rendered as swara and sahitya",
      "Divyanama Kirtanam \u2013 1; Tevaram \u2013 1",
      "Reckoning Adi Tala in Chatusra Nadai with shifting eduppu"
    ]
  },
  "Grade 4": {
    theory: [
      "The 12 Alwars and a life sketch of Andal",
      "Muthuswami Dikshitar and his disciples",
      "Baluswami Dikshitar and the adaptation of the violin into Indian music",
      "Raga classification \u2013 Janaka, Janya, Vakra, Varjya, Upanga, Bhashanga",
      "The 72 Mela scheme of Venkatamakhin"
    ],
    practical: [
      "All 7 Alankarams in Kalyani and Karaharapriya in 3 speeds",
      "Any 2 Adi Tala Varnams in 2 speeds from Sankarabharanam, Hamsadhwani, Mohanam, Kalyani",
      "Divya Prabandham \u2013 1; Thiruvasakam or Ramadasar kriti \u2013 1",
      "Thiru Arutpa or Annamacharya kriti \u2013 1; patriotic song \u2013 1",
      "Kirtanam \u2013 any 3 in Mayamalavagowla, Mohanam, Sankarabharanam, Arabhi, Hamsadhwani or Kalyani by Tyagaraja, Swathi Tirunal, Muthu Thandavar, Arunachala Kavirayar or Papanasam Sivan"
    ]
  },
  "Grade 5": {
    theory: [
      "Musical forms \u2013 Kriti, Ragamalika",
      "Study of Tala and the Tala Dasa Pranas",
      "Syama Sastri and his lineage",
      "Introduction to Pann \u2013 the Tamil tradition",
      "Study of instruments \u2013 Nadaswaram and Tavil"
    ],
    practical: [
      "Adi Tala Varnam \u2013 any 2 from Saveri, Kambhoji, Kalyani, Abhogi",
      "Jatiswaram \u2013 Vasanta",
      "Kirtanam \u2013 any 4 in Hamsadhwani, Madhyamavathi, Kalyani, Bilahari, Harikambhoji, Karaharapriya (Tyagaraja, Swathi Tirunal, Muthu Thandavar, Arunachala Kavirayar, Papanasam Sivan, Dikshitar, Syama Sastri, Gopalakrishna Bharathi, Neelakanta Sivan, Ramaswamy Sivan)",
      "Thiruppavai \u2013 1 or Thiruvempavai \u2013 1",
      "Subramanya Bharati or Bharathidasan song \u2013 1"
    ]
  },
  "Grade 6": {
    theory: [
      "Kalpita and Manodharma Sangita; forms \u2013 Raga Alapana, Kalpana Swaram, Neraval, Ragam-Tanam-Pallavi",
      "Raga Lakshana and sancharas \u2013 Mohanam, Abhogi, Kalyani, Sankarabharanam",
      "Life histories \u2013 Jayadeva, Narayana Tirtha, Swathi Tirunal, Oothukadu Venkata Kavi",
      "Study of instruments \u2013 Tanpura, Veena, Violin",
      "Technical terms \u2013 Eduppu, decorative angas, Chittaswaram, Madhyamakala Sahitya, Samashti Charana, Swarakshara"
    ],
    practical: [
      "Adi Tala Varnam \u2013 any 2 from Thodi, Pantuvarali, Sriragam, Begada",
      "Khanda Jati Ata Tala Varnam \u2013 1 (Bhairavi)",
      "Kritis \u2013 2 in Bhairavi, Lathangi, Thodi, Darbar or Sahana (prescribed composers)",
      "Ashtapadi \u2013 1; Kavadi Chindu \u2013 1; Meera Bhajan \u2013 1",
      "Kalpana Swaram in any 5 of Mohanam, Sankarabharanam, Hamsadhwani, Kalyani, Bhairavi, Arabhi, Pantuvarali, Karaharapriya"
    ]
  },
  "Grade 7": {
    theory: [
      "Dasavidha Gamakas",
      "Raga lakshanas of Karaharapriya, Bhairavi, Kambhoji, Thodi, Pantuvarali, Purvikalyani",
      "Musical forms \u2013 Padam, Javali, Thillana, Ragamalika",
      "Study of instruments \u2013 Flute, Mridangam",
      "Kutcheri Paddhati"
    ],
    practical: [
      "Khanda Jathi Ata Tala Varnam \u2013 1 (Kalyani or Kanada)",
      "Ragamalika \u2013 1; Pada Varnam \u2013 1; Thillana \u2013 1",
      "Tyagaraja Pancharatnam \u2013 2 (one Ghana raga and one Kshetra kriti)",
      "Ramadasar kriti or Meenakshi Ammai Pillai Tamil \u2013 1; Abhang or Kavimani Desiga Vinayagam Pillai \u2013 1",
      "Neraval and Kalpana Swaram in any 4 of Mohanam, Sankarabharanam, Hamsadhwani, Kalyani, Bhairavi, Arabhi, Pantuvarali, Karaharapriya, Thodi"
    ]
  },
  "Grade 8": {
    theory: [
      "Group kritis",
      "Introduction to Hindustani music, Western music and folk music",
      "Comparative study of Carnatic and Hindustani ragas",
      "Raga lakshana of Darbar, Bilahari, Kedaragaula, Surutti, Anandabhairavi, Sahana, Saveri",
      "Mathematics in music \u2013 Kovai, Kanakku, Porutham"
    ],
    practical: [
      "Padam \u2013 1; Javali \u2013 1",
      "Syama Sastri Swarajati \u2013 1",
      "Bhajan \u2013 1; group kriti of Muthuswami Dikshitar \u2013 1",
      "Ragam Tanam Pallavi \u2013 1",
      "Raga Alapana, Neraval and Kalpana Swara for any 3 ragas already covered"
    ]
  }
};
var GRADE_SYLLABUS = {
  "Sangeetham (Vocal)": VOCAL_CARNATIC,
  "Mridangam": MRIDANGAM_EXAM,
  "Tabla": TABLA_EXAM,
  "Tavil": TAVIL_EXAM,
  "Flute (Carnatic)": FLUTE_CARNATIC,
  "Violin (Carnatic)": VIOLIN_CARNATIC,
  "Bharatanatyam (Dance)": BHARATANATYAM
};
var getGradeSyllabus = (subject, grade) => GRADE_SYLLABUS[subject]?.[grade] ?? null;
var syllabusToTopics = (entry) => {
  const items = [
    ...entry.practical.map((p) => `Practical \u2013 ${p}`),
    ...entry.theory.map((t) => `Theory \u2013 ${t}`)
  ];
  return items.map((text, i) => `Topic ${i + 1}: ${text}`);
};

// api/_server/routes/generation.ts
var router5 = express5.Router();
var isMockMode = () => process.env.AI_MOCK_MODE === "true";
var formatBankQuestions = (rows, sourceLabel) => rows.map((q) => {
  let options = [];
  try {
    options = JSON.parse(q.options);
  } catch {
    options = ["A", "B", "C", "D"];
  }
  const letterMap = { A: 0, B: 1, C: 2, D: 3 };
  const correctAnswerIndex = letterMap[q.correctAnswer?.toUpperCase()] ?? 0;
  return {
    id: `real-${q.id}`,
    text: q.question,
    options,
    correctAnswerIndex,
    explanation: q.explanation || "No explanation provided.",
    source: q.source || sourceLabel,
    isRealQuestion: true
  };
});
var questionHash = (text) => {
  const norm = text.toLowerCase().replace(/[^a-z0-9஀-௿一-鿿]+/g, " ").trim();
  let h = 2166136261;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0") + norm.length.toString(16);
};
var loadSeenQuestions = async (userId, subject, grade) => {
  try {
    const rows = await db_default.servedQuestion.findMany({
      where: { userId, subject, grade },
      orderBy: { createdAt: "desc" },
      take: 400,
      select: { questionHash: true, questionText: true }
    });
    return { hashes: new Set(rows.map((r) => r.questionHash)), texts: rows.map((r) => r.questionText).reverse() };
  } catch (e) {
    console.warn(`[GEN] Could not load served-question history: ${e.message}`);
    return { hashes: /* @__PURE__ */ new Set(), texts: [] };
  }
};
var recordServedQuestions = async (userId, subject, grade, syllabus, texts) => {
  if (!texts.length) return;
  try {
    await db_default.servedQuestion.createMany({
      data: texts.map((t) => ({ userId, subject, grade, syllabus: syllabus || null, questionHash: questionHash(t), questionText: t.slice(0, 300) })),
      skipDuplicates: true
    });
  } catch (e) {
    console.warn(`[GEN] Could not record served questions: ${e.message}`);
  }
};
var CARNATIC_TECHNIQUE_FOCUS = {
  "Sangeetham (Vocal)": "voice culture, breath control, swara singing, and compositions (Geetham, Varnam, Kriti)",
  "Mridangam": "fingering, strokes (Tha, Dhi, Nam, Thom, Chapu), sollukattu recitation, and tala accompaniment",
  "Veena": "meettu (plucking), fretting, gamaka, and raga playing",
  "Keyboard (Carnatic)": "swara-to-key mapping (always state the selected Sa, e.g. Sa = E), fingering (thumb 1 to little finger 5), and raga playing",
  "Harmonium": "left-hand bellows control, right-hand fingering, and swara-to-key mapping (always state the selected Sa)",
  "Violin (Carnatic)": "seated playing posture, bowing (full/half/quarter bow), left-hand fingering and gamaka slides, varisais and compositions",
  "Flute (Carnatic)": "blowing and tonguing techniques, fingering and half-holing for gamakas, breath control, varisais and compositions",
  "Tavil": "stick (left hand) and finger-cap (right hand) technique, vazhi paadams, mohra, korvai, arudhi and nadaswaram accompaniment",
  "Bharatanatyam (Dance)": "adavus, hastas and their viniyogas, bhedas, abhinaya, tala reckoning, and the margam repertoire"
};
var HINDUSTANI_TECHNIQUE_FOCUS = {
  "Vocal (Hindustani)": "voice culture, sargam singing, alankar practice, and khayal fundamentals (sthayi/antara)",
  "Tabla": "hand technique on dayan and bayan, basic bols (Dha, Dhin, Na, Tin, Ge, Ke), kaida practice, and taal accompaniment",
  "Harmonium": "left-hand bellows control, right-hand fingering, and sargam-to-key mapping (always state the selected Sa)",
  "Sitar": "mizrab strokes (da, ra, diri), fretting, meend (glides), and raag playing"
};
var musicFocusRules = (subject, focus) => {
  if (focus === "Theory") {
    return `- STUDY FOCUS = THEORY: Test concepts, definitions, terminology, notation, structure, history and composers relevant to ${subject}. Avoid pure playing-technique questions.`;
  }
  if (focus === "Aural & Practical") {
    return `- STUDY FOCUS = AURAL & PRACTICAL: Test playing technique, fingering/hand method, posture, practice discipline, and listening scenarios described in words (e.g. "the teacher plays a note higher than Sa \u2014 what should the student notice?"). Avoid pure book-theory questions.`;
  }
  return "- STUDY FOCUS: Mix theory and practical questions.";
};
var referenceExamplesBlock = (subject, grade, focus, count = 6) => {
  let pool = REFERENCE_QUESTIONS.filter((q) => q.subject === subject && q.grade === grade);
  if (pool.length === 0) return "";
  if (focus) {
    const wanted = focus === "Theory" ? "Theory" : "Practical";
    const byFocus = pool.filter((q) => !q.classification || q.classification === wanted);
    if (byFocus.length >= count) pool = byFocus;
  }
  const sample = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
  const rendered = sample.map(
    (q, i) => `Example ${i + 1}: ${q.question}
${q.options.map((o, j) => `${"ABCD"[j]}. ${o}`).join(" | ")} (Correct: ${"ABCD"[q.correctIndex]})`
  ).join("\n");
  return `
OFFICIAL REFERENCE QUESTIONS \u2014 real questions from the Akshara Fine Arts question bank for ${subject} ${grade}. LEARN from their style, difficulty, terminology and topic focus, and write NEW questions of the same standard. Do NOT copy them verbatim, and do NOT imitate their answer-letter positions (randomize your own).
${rendered}
`;
};
var gradeSyllabusBlock = (subject, grade) => {
  const s = getGradeSyllabus(subject, grade);
  if (!s) return "";
  return `
OFFICIAL GRADE EXAM SYLLABUS \u2014 ${subject} ${grade} (the exam board's own scope; every question must fall inside it):
Theory units:
${s.theory.map((t) => `- ${t}`).join("\n")}
Practical units:
${s.practical.map((p) => `- ${p}`).join("\n")}
${s.notes ? `Note: ${s.notes}
` : ""}`;
};
var musicPromptRules = (syllabus, subject, grade, focus) => {
  if (!isMusicSyllabus(syllabus)) return "";
  const curated = getCuratedTopics(syllabus, subject, grade);
  const gradeProtection = curated ? `GRADE PROTECTION \u2014 the official ${grade} scope for ${subject} is EXACTLY these topics:
${curated.map((t) => `- ${t}`).join("\n")}
Test ONLY these topics. NEVER include concepts from higher grades.` : `GRADE PROTECTION: Test only concepts appropriate for ${grade}. NEVER include concepts from higher grades.`;
  const examSyllabus = gradeSyllabusBlock(subject, grade);
  const facts = getInstrumentFacts(subject);
  const factGrounding = facts.length ? `AUTHORITATIVE INSTRUMENT FACTS \u2014 every physical, posture or technique question MUST agree with these:
${facts.map((f) => `- ${f}`).join("\n")}
` : "";
  const factualSafety = `FACTUAL SAFETY: Before finalising each question, verify the marked correct answer is factually true${facts.length ? " and consistent with the authoritative facts above" : ""}. If you are not 100% certain of a physical or factual detail (posture, instrument construction, hand usage), DO NOT test it \u2014 write a question about a concept you are certain of instead. A wrong marked answer is a serious failure.`;
  if (syllabus === "Carnatic Music" || syllabus === "Indian Music") {
    return `
MUSIC SYLLABUS RULES (Carnatic Music):
- This is a ${subject === "Bharatanatyam (Dance)" ? "BHARATANATYAM (South Indian classical DANCE)" : "CARNATIC MUSIC"} examination for ${subject} students of Akshara Fine Arts (Grades 1-10).
- Use authentic Carnatic terminology: swara (Sa Ri Ga Ma Pa Da Ni), shruti, sthayi, tala (Adi, Rupaka, Eka, Misra Chapu, Khanda Chapu), raga, sarali/janta/dhatu varisai, alankaram, geetham, varnam, kriti, sollukattu.
- Anchor beginner content (Grades 1-3) on raga Mayamalavagowla.
- Emphasise ${subject}-specific technique: ${CARNATIC_TECHNIQUE_FOCUS[subject] || "instrument technique and theory"}.
${musicFocusRules(subject, focus)}
- Questions must be answerable in text form without audio or images \u2014 describe sounds and techniques in words.
${factGrounding}${factualSafety}
${examSyllabus}${referenceExamplesBlock(subject, grade, focus)}
${gradeProtection}
`;
  }
  if (syllabus === "Hindustani Music") {
    return `
MUSIC SYLLABUS RULES (Hindustani Music):
- This is a HINDUSTANI (North Indian) CLASSICAL MUSIC examination for ${subject} students of Akshara Fine Arts (Grades 1-10).
- Use authentic Hindustani terminology: sargam (Sa Re Ga Ma Pa Dha Ni), shuddha/komal/tivra swaras, saptak (mandra, madhya, taar), taal (Teentaal 16, Keherwa 8, Dadra 6, Jhaptaal 10), theka, bol, sam, khali, matra, alankar, raag, aaroh/avroh, vadi/samvadi, bandish, alap, gharana awareness.
- Anchor beginner content (Grades 1-3) on raag Bilawal (the natural-note reference) and simple alankar patterns.
- Emphasise ${subject}-specific technique: ${HINDUSTANI_TECHNIQUE_FOCUS[subject] || "instrument technique and theory"}.
${musicFocusRules(subject, focus)}
- Do NOT use Carnatic-specific terms (varnam, kriti, sarali varisai, sollukattu) \u2014 this is the Hindustani tradition.
- Questions must be answerable in text form without audio or images \u2014 describe sounds and techniques in words.
${factGrounding}${factualSafety}
${examSyllabus}${referenceExamplesBlock(subject, grade, focus)}
${gradeProtection}
`;
  }
  return `
MUSIC SYLLABUS RULES (Western Music):
- This is an ABRSM/Trinity-style graded music examination for ${subject}, ${grade} (Grades 1-8).
${subject === "Drums" ? "- Cover grade-appropriate drum kit content: rudiments, grooves and styles, fills, coordination, drum notation reading, timing and dynamics. Drums are unpitched \u2014 do NOT ask about scales, keys or melody." : `- Cover grade-appropriate content: staff notation, note values, time signatures, scales and key signatures, intervals, chords and cadences, musical terms (Italian/German/French), composers and periods${subject !== "Music Theory" ? `, plus ${subject}-specific technique and repertoire knowledge` : ""}.`}
${musicFocusRules(subject, focus)}
- Describe any staff-notation content in WORDS only (e.g. "the note on the second line of the treble clef") \u2014 no images are available.
${factualSafety}
${gradeProtection}
`;
};
var LANG_NAME_MAP = {
  en: "English",
  ms: "Bahasa Melayu",
  zh: "Simplified Chinese (\u7B80\u4F53\u4E2D\u6587)",
  ta: "Tamil (\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD)"
};
var deriveSyllabusLanguage = (subject, syllabus) => {
  const s = (syllabus || "").toLowerCase();
  const sub = (subject || "").toLowerCase();
  if (s.includes("uec")) {
    if (sub.includes("bahasa melayu") || sub.includes("sejarah")) return "Bahasa Melayu (Malay)";
    if (sub.includes("english")) return "English";
    return "Simplified Chinese (\u7B80\u4F53\u4E2D\u6587)";
  }
  if (s.includes("kssr") || s.includes("kssm") || s.includes("malaysian")) {
    if (sub.includes("english")) return "English";
    return "Bahasa Melayu (Malay)";
  }
  return "English";
};
var resolveTargetLanguage = (uiLang, subject, syllabus) => {
  if (uiLang && LANG_NAME_MAP[uiLang]) {
    const sub = (subject || "").toLowerCase();
    if (sub.includes("bahasa melayu")) return "Bahasa Melayu";
    if (sub.includes("english")) return "English";
    return LANG_NAME_MAP[uiLang];
  }
  return deriveSyllabusLanguage(subject, syllabus);
};
var resolveLangCode = (uiLang, subject) => {
  if (uiLang && LANG_NAME_MAP[uiLang]) {
    const sub = (subject || "").toLowerCase();
    if (sub.includes("bahasa melayu")) return "ms";
    if (sub.includes("english")) return "en";
    return uiLang;
  }
  return "en";
};
var generateMockQuestions = (subject, grade, topic, syllabus) => {
  return Array.from({ length: 15 }).map((_, i) => ({
    id: `mock-${Date.now()}-${i}`,
    text: `[Server Mock] ${topic} Question ${i + 1} for ${grade}`,
    options: ["A", "B", "C", "D"],
    correctAnswerIndex: 0,
    explanation: "Server mock explanation."
  }));
};
var generateMockSyllabus = () => {
  return ["Mock Topic 1", "Mock Topic 2", "Mock Topic 3", "Mock Topic 4", "Mock Topic 5"];
};
var superRepairJSON = (text) => {
  let cleaned = text.trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    const startIdx = cleaned.indexOf("{");
    if (startIdx !== -1) {
      cleaned = cleaned.substring(startIdx);
    } else {
      const arrStartIdx = cleaned.indexOf("[");
      if (arrStartIdx !== -1) cleaned = cleaned.substring(arrStartIdx);
      else throw new Error("No JSON start found");
    }
  } else {
    cleaned = jsonMatch[0];
  }
  const stack = [];
  let insideString = false;
  let escape = false;
  let lastValidIdx = cleaned.length;
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      insideString = !insideString;
      continue;
    }
    if (!insideString) {
      if (char === "{" || char === "[") {
        stack.push(char);
      } else if (char === "}" || char === "]") {
        const last = stack.pop();
        if (char === "}" && last !== "{" || char === "]" && last !== "[") {
        }
      }
    }
  }
  if (insideString) cleaned += '"';
  while (stack.length > 0) {
    const last = stack.pop();
    if (last === "{") cleaned += "}";
    if (last === "[") cleaned += "]";
  }
  return JSON.parse(cleaned);
};
router5.post("/quest", authenticateToken, checkExpiredSubscriptions, async (req, res) => {
  const { subject, grade, topic, syllabus, isPastYear, year, language, focus } = req.body;
  const userId = req.user?.id;
  if (userId) {
    try {
      const user = await effectiveSubscription(userId);
      if (user && !user.isSubscribed && user.questsPlayed >= 3) {
        console.log(`[GEN] \u274C Limit reached for user ${userId}`);
        return res.status(403).json({
          error: "Free limit reached. Upgrade to Pro for unlimited quests!",
          code: "USER_LIMIT_REACHED"
        });
      }
      if (user && !user.isSubscribed) {
        await countFreeQuest(userId);
        console.log(`[GEN] Incremented usage for user ${userId}`);
      }
    } catch (error) {
      console.error("[GEN] Error checking/updating user limit:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
  console.log(`[GEN] Request: ${subject} / ${grade} / ${topic || "Full Paper"} / ${syllabus} ${isPastYear ? `(Past Year ${year})` : ""}`);
  if (!isPastYear && typeof syllabus === "string" && isMusicSyllabus(syllabus)) {
    try {
      const QUEST_SIZE = 20;
      let rows = await db_default.questionBank.findMany({
        where: { subject, grade, syllabus }
      });
      if (focus && rows.length > 0) {
        const wanted = focus === "Theory" ? "Theory" : "Practical";
        const byFocus = rows.filter((r) => !r.classification || r.classification === wanted);
        if (byFocus.length >= QUEST_SIZE) rows = byFocus;
      }
      if (topic && topic !== "Full Paper" && rows.length > 0) {
        const t = String(topic).toLowerCase();
        const filtered = rows.filter((r) => r.topic && t.includes(r.topic.toLowerCase()));
        if (filtered.length >= QUEST_SIZE) rows = filtered;
      }
      if (rows.length >= QUEST_SIZE) {
        const seenBank = userId ? await loadSeenQuestions(userId, subject, grade) : { hashes: /* @__PURE__ */ new Set(), texts: [] };
        const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
        const unseen = rows.filter((r) => !seenBank.hashes.has(questionHash(r.question)));
        const seenRows = rows.filter((r) => seenBank.hashes.has(questionHash(r.question)));
        const picked = [...shuffle(unseen), ...shuffle(seenRows)].slice(0, QUEST_SIZE);
        if (userId) await recordServedQuestions(userId, subject, grade, syllabus, picked.map((r) => r.question));
        console.log(`\u2705 [GEN] Serving ${picked.length} official bank questions for ${subject}/${grade} (${syllabus}) \u2014 ${Math.min(unseen.length, QUEST_SIZE)} unseen`);
        return res.json(formatBankQuestions(picked, `${subject} ${grade} \u2014 Akshara Official Bank`));
      }
      console.log(`[GEN] Music bank has only ${rows.length} rows for ${subject}/${grade} \u2014 falling through to AI.`);
    } catch (dbErr) {
      console.error(`\u274C [GEN] Music bank lookup failed: ${dbErr.message} \u2014 falling through to AI.`);
    }
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error("\u274C [GEN] GEMINI_API_KEY is MISSING in environment.");
    return res.status(500).json({
      error: "Gemini API Key is missing. Please add it to your .env file or Vercel environment variables.",
      instruction: "Go to https://aistudio.google.com/app/apikey to get a new key."
    });
  }
  if (isMockMode()) {
    console.warn("\u26A0\uFE0F [GEN] AI_MOCK_MODE is ON. But user requested real questions. Stopping here to prevent mock data.");
    return res.status(403).json({ error: "Mock mode is enabled in .env but real questions were requested." });
  }
  if (isPastYear && year) {
    try {
      const parsedYear = parseInt(String(year).split(" ")[0], 10);
      if (!isNaN(parsedYear)) {
        const acronyms = (syllabus.match(/\b(KSSR|KSSM|IGCSE|SPM|UPSR|PT3|STPM|IB)\b/gi) || []).map((a) => a.toUpperCase());
        const sKeywords = syllabus.split("(")[0].trim();
        const gradeMatch = grade.match(/\d+/);
        const gradeNum = gradeMatch ? gradeMatch[0] : null;
        const gradeVariations = gradeNum ? [
          `Standard ${gradeNum}`,
          `Year ${gradeNum}`,
          `Grade ${gradeNum}`,
          `Form ${gradeNum}`,
          grade
        ] : [grade];
        const realQuestions = await db_default.questionBank.findMany({
          where: {
            subject,
            grade: { in: gradeVariations },
            year: parsedYear,
            OR: [
              { syllabus: { contains: sKeywords, mode: "insensitive" } },
              { syllabus },
              ...acronyms.map((a) => ({ syllabus: { contains: a, mode: "insensitive" } }))
            ]
          },
          orderBy: { createdAt: "asc" }
        });
        if (realQuestions.length > 0) {
          console.log(`\u2705 [GEN] Found ${realQuestions.length} real QuestionBank questions for ${subject}/${grade}/${parsedYear} (Variations: ${gradeVariations.join(", ")})`);
          const formatted = formatBankQuestions(realQuestions, `${subject} ${year}`);
          return res.json(formatted.sort(() => Math.random() - 0.5).slice(0, 50));
        } else {
          console.warn(`\u274C [GEN] No Questions Found in Bank for ${subject} ${grade} ${parsedYear}.`);
          return res.status(404).json({
            error: "No questions found in the official bank for this year.",
            instruction: "Administrator: Please use the 'AI Generate & Import' tool in the Admin Dashboard to add these questions."
          });
        }
      }
    } catch (dbErr) {
      console.error(`\u274C [GEN] DB lookup failed: ${dbErr.message}`);
      return res.status(500).json({ error: "Failed to retrieve questions from database." });
    }
  }
  try {
    console.log("\u{1F916} [GEN] Generating questions with Gemini...");
    let prompt = "";
    if (isPastYear) {
      const examName = (() => {
        const s = syllabus.toLowerCase();
        const g = grade.toLowerCase();
        if (s.includes("uec")) return "UEC (Unified Examination Certificate)";
        if (s.includes("kssr") || s.includes("kssm") || s.includes("malaysian")) {
          if (g.includes("form 5")) return "SPM (Sijil Pelajaran Malaysia)";
          if (g.includes("form 3")) return "PT3 (Pentaksiran Tingkatan 3)";
          if (g.includes("standard 6")) return "UPSR (Ujian Pencapaian Sekolah Rendah)";
          if (g.includes("form 6")) return "STPM (Sijil Tinggi Persekolahan Malaysia)";
          return "Malaysian National Exam";
        }
        if (s.includes("igcse") || s.includes("cambridge")) return "Cambridge IGCSE";
        if (s.includes("singapore") || s.includes("moe")) return "Singapore GCE O-Level";
        if (s.includes("ib")) return "IB (International Baccalaureate)";
        return syllabus;
      })();
      const targetLanguage = resolveTargetLanguage(language, subject, syllabus);
      prompt = `You are an expert exam question compiler with comprehensive knowledge of official past year exam papers.

TASK: Reproduce 22-25 actual multiple-choice questions from the official ${examName} ${year} paper for ${subject} at ${grade} level.

CRITICAL RULES \u2014 READ CAREFULLY:
1. LANGUAGE: The entire question, options, and explanation MUST be written in ${targetLanguage}. This is strict.
2. RECALL REAL QUESTIONS: You were trained on official ${examName} past year papers published before your cutoff. Reproduce questions that genuinely appeared in or are extremely representative of the actual ${year} ${subject} paper. Do NOT invent generic revision questions.
3. CORRECT ANSWERS MUST BE 100% ACCURATE: Every correctAnswerIndex must be provably correct based on the official answer scheme. Wrong answers here are a serious failure.
4. REALISTIC DISTRACTORS: The wrong options must be the same plausible misconceptions that students commonly choose in the real exam \u2014 not obviously wrong choices.
5. YEAR-SPECIFIC EMPHASIS: Reflect the specific topics stressed in the ${year} paper.
6. FULL PAPER COVERAGE: Distribute questions across the main chapters/topics of ${subject} at ${grade} level.
7. DIFFICULTY SPREAD: Include approximately 8 easy, 10 medium, and 7 challenging questions.

Syllabus-specific rules:
${syllabus.toLowerCase().includes("kssr") || syllabus.toLowerCase().includes("malaysian") ? `- Follow Malaysian DSKP standards exactly.
- Use correct Malaysian terminology.
- SPM Paper 1 is all MCQ.` : ""}
${syllabus.toLowerCase().includes("uec") ? `- Follow Dong Zong (UEC) standards and terminology for ${grade}.
- Use official UEC subject naming conventions.` : ""}
${syllabus.toLowerCase().includes("igcse") || syllabus.toLowerCase().includes("cambridge") ? `- Use the official Cambridge ${subject} syllabus code.
- Match Cambridge command words exactly (state, describe, explain).` : ""}

`;
    } else {
      const targetLanguage = resolveTargetLanguage(language, subject, syllabus);
      prompt = `Generate a set of high-quality multiple-choice questions for:
            - Subject: ${subject}
            - Grade: ${grade}
            - Topic: ${topic}
            - Syllabus: ${syllabus}
            - Target Language: ${targetLanguage}
            
            CRITICAL INSTRUCTIONS:
            1. Language: Write the entire output (questions, options, explanations) in ${targetLanguage}.
            2. Format: ${grade} level, ${syllabus} standards
            3. Content: 4 options (A-D), correct index (0-3)
            ${musicPromptRules(syllabus, subject, grade, focus)}`;
    }
    prompt += `
        GENERAL QUALITY RULES:
        1. QUANTITY: Generate 22-25 questions. No fewer than 22.
        2. RANDOMIZED ANSWERS: Ensure the correct answer (correctAnswerIndex) is evenly distributed among 0, 1, 2, and 3 across the entire set of questions. For example, in a set of 20 questions, roughly 5 should have index 0 (A), 5 should have index 1 (B), 5 should have index 2 (C), and 5 should have index 3 (D). Do NOT put the correct answer in the same position for every question.
        3. Simplicity: Use ONLY basic alphanumeric characters and standard punctuation. AVOID complex nesting or unusual symbols.
        4. Explanation Quality: Each explanation MUST be specific to the question. It must:
           - Directly state WHY the correct answer is right (cite the specific law, formula, fact, or rule)
           - Briefly explain why a common wrong choice is misleading
           - Be 2-3 sentences maximum. Do NOT write generic study notes.
           - GOOD example: "The correct answer is chlorophyll because it is the pigment that absorbs light energy for photosynthesis. Option B (glucose) is wrong because glucose is the product of photosynthesis, not the absorber."
           - BAD example: "This is an important topic in biology." \u2014 This is not acceptable.

        JSON SPECIFICATION:
        Return ONLY a valid JSON object with this exact structure:
        {"questions": [{"question": "...", "options": ["...", "...", "...", "..."], "correctAnswerIndex": 0, "explanation": "..."}]}
        `;
    try {
      const MIN_QUESTIONS = 20;
      const MAX_ATTEMPTS = 3;
      const seen = userId ? await loadSeenQuestions(userId, subject, grade) : { hashes: /* @__PURE__ */ new Set(), texts: [] };
      const avoidList = (extra) => {
        const all = [...seen.texts, ...extra].slice(-80);
        return all.length ? `

ALREADY ASKED TO THIS STUDENT \u2014 do NOT repeat or lightly reword any of these:
${all.map((t) => `- ${t}`).join("\n")}` : "";
      };
      const TIME_BUDGET_MS = 4e4;
      const startedAt = Date.now();
      const collected = [];
      const seenText = /* @__PURE__ */ new Set();
      for (let attempt = 1; attempt <= MAX_ATTEMPTS && collected.length < MIN_QUESTIONS; attempt++) {
        if (attempt > 1 && Date.now() - startedAt > TIME_BUDGET_MS) {
          console.warn(`\u26A0\uFE0F [GEN] Time budget exhausted before attempt ${attempt}; serving ${collected.length} questions`);
          break;
        }
        console.log(`\u{1F916} [GEN] Requesting Gemini (attempt ${attempt}/${MAX_ATTEMPTS}, have ${collected.length})...`);
        const attemptPrompt = attempt === 1 ? `${prompt}${avoidList([])}` : `${prompt}

IMPORTANT: Generate a FRESH set of 22-25 DIFFERENT questions.${avoidList(collected.map((q) => q.text))}`;
        let responseText = null;
        try {
          responseText = await generateAIContent(attemptPrompt, PRIMARY_MODEL, "application/json");
        } catch (apiErr) {
          if (attempt === MAX_ATTEMPTS && collected.length === 0) throw apiErr;
          console.warn(`\u26A0\uFE0F [GEN] Attempt ${attempt} API error: ${apiErr.message}`);
          continue;
        }
        if (!responseText) {
          console.warn(`\u26A0\uFE0F [GEN] Attempt ${attempt}: empty response`);
          continue;
        }
        console.log(`\u2705 [GEN] Received response (${responseText.length} chars). Parsing...`);
        let aiQuestions = null;
        try {
          const parsed = superRepairJSON(responseText);
          aiQuestions = parsed.questions || (Array.isArray(parsed) ? parsed : null);
        } catch (parseError) {
          console.warn(`\u26A0\uFE0F [GEN] Attempt ${attempt} JSON failure: ${parseError.message}`);
          continue;
        }
        if (!Array.isArray(aiQuestions)) continue;
        for (const q of aiQuestions) {
          const text = String(q?.question || q?.text || "").trim();
          const options = Array.isArray(q?.options) ? q.options.map((o) => String(o)) : [];
          const idx = Number(q?.correctAnswerIndex ?? q?.correctAnswer);
          if (!text || options.length < 2 || !Number.isInteger(idx) || idx < 0 || idx >= options.length) continue;
          const key2 = text.toLowerCase();
          if (seenText.has(key2)) continue;
          if (seen.hashes.has(questionHash(text))) continue;
          seenText.add(key2);
          collected.push({
            id: `ai-${Date.now()}-${collected.length}`,
            text,
            options,
            correctAnswerIndex: idx,
            explanation: q?.explanation || "No explanation provided"
          });
        }
        console.log(`[GEN] Attempt ${attempt}: ${aiQuestions.length} returned, ${collected.length} valid so far`);
      }
      if (collected.length === 0) {
        console.error("\u274C [GEN] No valid questions after all attempts, using mock");
        return res.json(generateMockQuestions(subject, grade, topic, syllabus));
      }
      if (collected.length < MIN_QUESTIONS) {
        console.warn(`\u26A0\uFE0F [GEN] Only ${collected.length} valid questions after ${MAX_ATTEMPTS} attempts \u2014 serving what we have`);
      }
      const formattedQuestions = collected.slice(0, 20);
      if (userId) await recordServedQuestions(userId, subject, grade, syllabus, formattedQuestions.map((q) => q.text));
      console.log(`\u2705 [GEN] Generated ${formattedQuestions.length} questions with Gemini`);
      const randomizedQuestions = formattedQuestions.map((q) => {
        const options = [...q.options];
        const correctOptionText = options[q.correctAnswerIndex];
        for (let i = options.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [options[i], options[j]] = [options[j], options[i]];
        }
        const newCorrectIndex = options.indexOf(correctOptionText);
        return {
          ...q,
          options,
          correctAnswerIndex: newCorrectIndex !== -1 ? newCorrectIndex : q.correctAnswerIndex
        };
      });
      return res.json(randomizedQuestions);
    } catch (error) {
      console.error("\u274C [GEN] Error:", error.message);
      return res.status(500).json({
        error: `AI Generation failed: ${error.message}`,
        details: "Check your GEMINI_API_KEY in .env. If it's expired, you must renew it at Google AI Studio."
      });
    }
  } catch (error) {
    console.error("\u274C [GEN] Outer Error:", error.message);
    console.error(error.stack);
    res.status(500).json({ error: "Generation Failed", details: error.message });
  }
});
router5.post("/syllabus", async (req, res) => {
  const { subject, grade, syllabus, forceRefresh, language } = req.body;
  const targetLanguage = resolveTargetLanguage(language, subject, syllabus);
  const langCode = resolveLangCode(language, subject);
  console.log(`[SYLLABUS] Request: ${subject} / ${grade} / ${syllabus} [lang=${langCode}]${forceRefresh ? " (FORCE REFRESH)" : ""}`);
  if (typeof syllabus === "string" && isMusicSyllabus(syllabus)) {
    const curated = getCuratedTopics(syllabus, subject, grade);
    if (curated) {
      console.log(`\u2705 [SYLLABUS] Serving curated music topics for ${subject} / ${grade}`);
      return res.json(curated);
    }
    const exam = getGradeSyllabus(subject, grade);
    if (exam) {
      console.log(`\u2705 [SYLLABUS] Serving grade-exam syllabus topics for ${subject} / ${grade}`);
      return res.json(syllabusToTopics(exam));
    }
  }
  if (isMockMode()) {
    console.log(`\u2705 [SYLLABUS] Using mock mode, returning mock data`);
    return res.json(generateMockSyllabus());
  }
  try {
    if (!forceRefresh) {
      const cached = await db_default.courseSyllabus.findUnique({
        where: {
          subject_grade_syllabus_language: { subject, grade, syllabus, language: langCode }
        }
      });
      if (cached) {
        console.log(`\u2705 [SYLLABUS] Found cached syllabus`);
        return res.json(JSON.parse(cached.topics));
      }
    } else {
      console.log(`[SYLLABUS] Bypassing cache due to forceRefresh`);
    }
    console.log(`\u{1F916} [SYLLABUS] Generating syllabus with Gemini for: ${subject} ${grade} (JSON Mode)`);
    const prompt = `Generate a comprehensive list of syllabus topics for:
        - Subject: ${subject}
        - Grade Level: ${grade}
        - Syllabus/Curriculum: ${syllabus}

        INSTRUCTIONS:
        1. Base this on the OFFICIAL current curriculum.
        2. For KSSR/KSSM (Malaysian), align with latest DSKP standards.
        3. For IGCSE, align with Cambridge curriculum.
        4. For UEC, align with Dong Zong standards.
        5. Include 10-20 key topics to ensure full coverage. 
        6. STRICT FORMATTING: Each topic MUST start with "Topic X: " (e.g., Topic 1, Topic 2).
        7. DETAILED STRUCTURE: Include the main sub-topics in parentheses.
           Example: "Topic 1: Quadratic Functions (Graphs, Roots, Completing the Square)"
        8. UNIVERSAL APPLICABILITY: This must work for ANY subject (Mathematics, Computer Science, Biology, Languages, etc.).
        9. LANGUAGE: The topic names MUST be written in ${targetLanguage}.
        ${typeof syllabus === "string" && isMusicSyllabus(syllabus) ? syllabus === "Carnatic Music" || syllabus === "Indian Music" ? `10. CARNATIC MUSIC: This is the Akshara Fine Arts Carnatic curriculum for ${subject}. Use authentic Carnatic terminology (swara, shruti, tala, raga, sarali/janta/dhatu varisai, alankaram, geetham, varnam, kriti, sollukattu). Topics must fit ${grade} only \u2014 never include higher-grade concepts.` : syllabus === "Hindustani Music" ? `10. HINDUSTANI MUSIC: This is the Akshara Fine Arts Hindustani (North Indian) curriculum for ${subject}. Use authentic Hindustani terminology (sargam, saptak, taal, theka, bol, alankar, raag, aaroh/avroh, bandish, alap). Do NOT use Carnatic terms. Topics must fit ${grade} only \u2014 never include higher-grade concepts.` : `10. WESTERN MUSIC: Follow ABRSM/Trinity graded standards for ${subject} at ${grade}. Cover notation, scales, intervals, chords, musical terms, composers and instrument technique appropriate to this grade only.` : ""}

        JSON SPECIFICATION:
        Return ONLY a JSON object with a "topics" key containing a flat array of strings.
        Example:
        {"topics": ["Topic 1: Topic Name (Subtopic A, Subtopic B)", "Topic 2: Topic Name (Subtopic C)"]}
        `;
    let responseText;
    try {
      responseText = await generateAIContent(prompt, PRIMARY_MODEL, "application/json");
    } catch (apiError) {
      console.error(`\u274C [SYLLABUS] Gemini API Error: ${apiError.message}`);
      return res.status(500).json({
        error: `Syllabus generation failed: ${apiError.message}`,
        instruction: "Please check your GEMINI_API_KEY in .env."
      });
    }
    if (!responseText) {
      console.error("\u274C [SYLLABUS] Empty AI response");
      return res.json(generateMockSyllabus());
    }
    console.log(`\u2705 [SYLLABUS] Received response (${responseText.length} chars). Parsing...`);
    let topics = [];
    try {
      const parsed = superRepairJSON(responseText);
      topics = parsed.topics || (Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      console.error(`\u274C [SYLLABUS] JSON Critical Failure: ${e.message}`);
      console.log(`[SYLLABUS] Full Response for Debug: ${responseText}`);
      return res.status(500).json({ error: "AI returned invalid JSON. Please try again." });
    }
    if (topics.length === 0) {
      console.warn("\u26A0\uFE0F [SYLLABUS] No topics parsed");
      return res.status(500).json({ error: "AI failed to generate topics." });
    }
    console.log(`\u2705 [SYLLABUS] Generated ${topics.length} topics with Gemini`);
    await db_default.courseSyllabus.upsert({
      where: {
        subject_grade_syllabus_language: { subject, grade, syllabus, language: langCode }
      },
      update: { topics: JSON.stringify(topics) },
      create: { subject, grade, syllabus, topics: JSON.stringify(topics), language: langCode }
    });
    return res.json(topics);
  } catch (error) {
    console.error("\u274C [SYLLABUS] Unexpected Error:", error.message);
    return res.status(500).json({ error: "Unexpected error during syllabus generation." });
  }
});
router5.post("/study-plan", authenticateToken, checkExpiredSubscriptions, async (req, res) => {
  const { subject, subjects: subjectsRaw, grade, syllabus, timeframe, hoursPerDay, goals, language } = req.body;
  const userId = req.user?.id;
  const targetLanguage = language && LANG_NAME_MAP[language] ? LANG_NAME_MAP[language] : "English";
  const subjects = Array.isArray(subjectsRaw) && subjectsRaw.length > 0 ? subjectsRaw.filter((s) => typeof s === "string" && s.trim().length > 0) : typeof subject === "string" && subject.trim().length > 0 ? [subject] : [];
  const subjectsLabel = subjects.join(", ");
  console.log(`[STUDY-PLAN] Request: ${subjectsLabel} / ${grade} / ${syllabus} - ${timeframe} - ${hoursPerDay}h/day`);
  if (userId) {
    try {
      const user = await effectiveSubscription(userId);
      if (user && !user.isSubscribed && user.questsPlayed >= 5) {
        console.log(`[STUDY-PLAN] \u274C Limit reached for user ${userId}`);
        return res.status(403).json({
          error: "Free AI generation limit reached. Upgrade to Pro for unlimited features!",
          code: "USER_LIMIT_REACHED"
        });
      }
      if (user && !user.isSubscribed) {
        await countFreeQuest(userId);
      }
    } catch (error) {
      console.error("[STUDY-PLAN] Error checking/updating user limit:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "Gemini API Key is missing." });
  }
  if (isMockMode()) {
    console.log(`\u2705 [STUDY-PLAN] Using mock mode`);
    return res.json({
      title: `Study Plan: ${subjectsLabel} (${grade})`,
      overview: "A mock study plan for testing.",
      weeks: [
        {
          weekNumber: 1,
          focus: "Foundational Concepts",
          days: [
            {
              day: "Day 1",
              tasks: [
                { title: "Review Chapter 1: Real Numbers", topicSearch: "Real Numbers" },
                { title: "Complete 10 MCQs on Fractions", topicSearch: "Fractions" }
              ]
            },
            {
              day: "Day 2",
              tasks: [
                { title: "Practice Algebra basics", topicSearch: "Algebra" }
              ]
            }
          ]
        }
      ],
      tips: ["Stay hydrated", "Take short breaks"]
    });
  }
  try {
    console.log(`\u{1F916} [STUDY-PLAN] Generating with Gemini...`);
    const prompt = `Act as an expert academic tutor and create a highly effective, personalized study plan.

        STUDENT PROFILE:
        - Subjects: ${subjectsLabel}
        - Grade Level: ${grade}
        - Syllabus/Curriculum: ${syllabus}
        - Timeframe: ${timeframe}
        - Daily Study Commitment: ${hoursPerDay} hours per day
        - Additional Goals/Focus: ${goals || "General mastery and exam preparation"}

        - Commitment: ${hoursPerDay} hours per day
        ${goals ? `- Specific Goals: ${goals}` : ""}

        MULTI-SUBJECT: Build ONE combined weekly plan that covers ALL of these subjects: ${subjectsLabel}.
        Distribute the subjects across the days and weeks and balance study time between them \u2014 do NOT
        produce a separate plan per subject. Each task's "topicSearch" must be a topic within one of these subjects.

        LANGUAGE: The plan's title, overview, weekly focus, task titles and tips MUST be written in ${targetLanguage}. However, every "topicSearch" value MUST remain in English so the topic deep-links into quest generation still work.

        IMPORTANT: Keep it simple and clean. Use MINIMAL words.
        - Title should be very short (max 5 words).
        - Overview should be max 2 sentences.
        - Task titles should be extremely concise (max 4-5 words).
        - Provide max 3 high-impact tips.

        Return ONLY a JSON object with this structure:
        {
          "title": "Short Course Title",
          "overview": "Brief 1-2 sentence strategy.",
          "weeks": [
            {
              "weekNumber": 1,
              "focus": "Short Weekly Focus",
              "days": [
                {
                  "day": "Day 1",
                  "tasks": [
                    { "title": "Concise task description", "topicSearch": "Exact topic name for practice" }
                  ]
                }
              ]
            }
          ],
        }
        
        CRITICAL: 
        1. Each task MUST be an object with "title" and "topicSearch".
        2. "topicSearch" should be a 1-3 word keyword that represents the mathematical or academic topic (e.g., "Algebra", "Calculus", "Probability", "Human Rights", "Volcanoes"). topicSearch values must be in English. This will be used to deep-link the student to specific practice questions.
        3. Give tasks like "Complete 10 MCQ questions on [Topic]", "Review [Topic] theory", etc.
        `;
    let responseText;
    try {
      responseText = await generateAIContent(prompt, PRIMARY_MODEL, "application/json");
    } catch (apiError) {
      console.error(`\u274C [STUDY-PLAN] Gemini API Error: ${apiError.message}`);
      return res.status(500).json({ error: `AI generation failed: ${apiError.message}` });
    }
    if (!responseText) {
      return res.status(500).json({ error: "Empty response from AI" });
    }
    let planData;
    try {
      planData = superRepairJSON(responseText);
    } catch (e) {
      console.error(`\u274C [STUDY-PLAN] JSON parse failed: ${e.message}`);
      return res.status(500).json({ error: "AI returned invalid JSON." });
    }
    if (userId && planData.weeks) {
      try {
        await db_default.studyPlan.deleteMany({
          where: { userId }
        });
        const createdPlan = await db_default.studyPlan.create({
          data: {
            userId,
            title: planData.title,
            overview: planData.overview,
            subject: subjectsLabel,
            // free-text column stores the comma-joined subjects
            grade,
            syllabus,
            timeframe,
            tasks: {
              create: planData.weeks.flatMap(
                (week) => week.days.flatMap(
                  (day) => day.tasks.map((task) => ({
                    weekNumber: parseInt(String(week.weekNumber)),
                    day: day.day,
                    title: task.title,
                    topicSearch: task.topicSearch
                  }))
                )
              )
            }
          }
        });
        console.log(`\u2705 [STUDY-PLAN] Saved to DB (ID: ${createdPlan.id})`);
        planData.id = createdPlan.id;
      } catch (dbErr) {
        console.error("\u274C [STUDY-PLAN] DB Save Error:", dbErr);
      }
    }
    console.log(`\u2705 [STUDY-PLAN] Generated successfully`);
    return res.json(planData);
  } catch (error) {
    console.error("\u274C [STUDY-PLAN] Error:", error.message);
    return res.status(500).json({ error: "Failed to generate study plan." });
  }
});
var generation_default = router5;

// api/_server/routes/test.ts
import express6 from "express";
var router6 = express6.Router();
router6.get("/ai-check", async (req, res) => {
  try {
    console.log("[TEST] Checking Gemini API (Direct Fetch)...");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ status: "error", message: "GEMINI_API_KEY is not set" });
    }
    const text = await generateAIContent("Reply with only the word 'OK'", "gemini-2.5-flash");
    console.log(`[TEST] Gemini Response: ${text}`);
    res.json({
      status: "ok",
      message: "AI generation successful (Central Utility)",
      response: text,
      model: "gemini-2.5-flash"
    });
  } catch (error) {
    console.error("[TEST] AI Check Failed:", error);
    res.status(500).json({
      status: "error",
      message: "AI generation failed",
      error: error.message,
      stack: error.stack,
      details: error
    });
  }
});
router6.get("/db-check", async (req, res) => {
  try {
    console.log("[TEST] Checking DB connection...");
    const userCount = await db_default.user.count();
    console.log(`[TEST] DB Connection Successful. User count: ${userCount}`);
    const envCheck = {
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      JWT_SECRET_SET: !!process.env.JWT_SECRET,
      GEMINI_API_KEY_SET: !!process.env.GEMINI_API_KEY
    };
    res.json({
      status: "ok",
      message: "Database connection successful",
      userCount,
      env: envCheck
    });
  } catch (error) {
    console.error("[TEST] DB Connection Failed:", error);
    res.status(500).json({
      status: "error",
      message: "Database connection failed",
      error: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });
  }
});
router6.get("/test-expiration", authenticateToken, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const user = await db_default.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isSubscribed: true,
        subscriptionEndDate: true,
        cancelAtPeriodEnd: true
      }
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const now = /* @__PURE__ */ new Date();
    const endDate = user.subscriptionEndDate;
    console.log("\n=== MANUAL EXPIRATION TEST ===");
    console.log(`User: ${user.email}`);
    console.log(`isSubscribed: ${user.isSubscribed}`);
    console.log(`subscriptionEndDate: ${endDate?.toISOString() || "null"}`);
    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Is expired? ${endDate && now > endDate ? "YES" : "NO"}`);
    if (user.isSubscribed && endDate && now > endDate) {
      console.log("\u26A0\uFE0F EXPIRING SUBSCRIPTION NOW...");
      await db_default.user.update({
        where: { id: userId },
        data: {
          isSubscribed: false,
          cancelAtPeriodEnd: false
        }
      });
      console.log("\u2705 Subscription cancelled!");
      return res.json({
        message: "Subscription expired and cancelled",
        wasSubscribed: true,
        nowSubscribed: false,
        endDate: endDate.toISOString(),
        currentTime: now.toISOString()
      });
    }
    return res.json({
      message: "Subscription is still active or already expired",
      isSubscribed: user.isSubscribed,
      endDate: endDate?.toISOString() || null,
      currentTime: now.toISOString(),
      daysRemaining: endDate ? Math.floor((endDate.getTime() - now.getTime()) / (1e3 * 60 * 60 * 24)) : null
    });
  } catch (error) {
    console.error("Test expiration error:", error);
    res.status(500).json({ error: error.message });
  }
});
var test_default = router6;

// api/_server/routes/webhooks.ts
import express7 from "express";
import Stripe2 from "stripe";
var router7 = express7.Router();
var stripe2 = new Stripe2(process.env.STRIPE_SECRET_KEY || "");
router7.post("/stripe-webhook", express7.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn("\u26A0\uFE0F STRIPE_WEBHOOK_SECRET not set, skipping webhook verification");
    return res.status(400).send("Webhook secret not configured");
  }
  let event;
  try {
    event = stripe2.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`\u26A0\uFE0F Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  console.log(`[WEBHOOK] Received event: ${event.type}`);
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      await handleCheckoutSessionCompleted(session);
      break;
    }
    case "invoice.payment_succeeded": {
      const invoice = event.data.object;
      await handlePaymentSucceeded(invoice);
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      await handleSubscriptionUpdated(subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await handleSubscriptionDeleted(subscription);
      break;
    }
    default:
      console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
  }
  res.json({ received: true });
});
async function handlePaymentSucceeded(invoice) {
  console.log(`[WEBHOOK] Payment succeeded for invoice: ${invoice.id}`);
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!subscriptionId) {
    console.log("[WEBHOOK] No subscription ID in invoice, skipping");
    return;
  }
  try {
    const subscription = await stripe2.subscriptions.retrieve(subscriptionId);
    if ("deleted" in subscription && subscription.deleted) {
      console.log("[WEBHOOK] Subscription is deleted, skipping");
      return;
    }
    const user = await db_default.user.findFirst({
      where: { stripeCustomerId: customerId }
    });
    if (!user) {
      console.warn(`[WEBHOOK] User not found for customer: ${customerId}`);
      return;
    }
    const sub = subscription;
    const startDate = new Date(sub.current_period_start * 1e3);
    const endDate = new Date(sub.current_period_end * 1e3);
    const interval = sub.items?.data[0]?.price?.recurring?.interval || "month";
    console.log(`[WEBHOOK] Renewing subscription for user: ${user.email}`);
    console.log(`[WEBHOOK] New period: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    await db_default.user.update({
      where: { id: user.id },
      data: {
        isSubscribed: true,
        subscriptionInterval: interval,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        cancelAtPeriodEnd: sub.cancel_at_period_end
      }
    });
    await settleReferralGrant(user.id);
    console.log(`[WEBHOOK] \u2705 Subscription renewed for user: ${user.email}`);
  } catch (error) {
    console.error("[WEBHOOK] Error handling payment succeeded:", error.message);
  }
}
async function handleSubscriptionUpdated(subscription) {
  console.log(`[WEBHOOK] Subscription updated: ${subscription.id}`);
  const customerId = subscription.customer;
  try {
    const user = await db_default.user.findFirst({
      where: { stripeCustomerId: customerId }
    });
    if (!user) {
      console.warn(`[WEBHOOK] User not found for customer: ${customerId}`);
      return;
    }
    await db_default.user.update({
      where: { id: user.id },
      data: {
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      }
    });
    if (subscription.cancel_at_period_end) {
      console.log(`[WEBHOOK] \u23F0 Subscription scheduled for cancellation: ${user.email}`);
    } else {
      console.log(`[WEBHOOK] \u2705 Subscription reactivated: ${user.email}`);
    }
  } catch (error) {
    console.error("[WEBHOOK] Error handling subscription updated:", error.message);
  }
}
async function handleSubscriptionDeleted(subscription) {
  console.log(`[WEBHOOK] Subscription deleted: ${subscription.id}`);
  const customerId = subscription.customer;
  try {
    const user = await db_default.user.findFirst({
      where: { stripeCustomerId: customerId }
    });
    if (!user) {
      console.warn(`[WEBHOOK] User not found for customer: ${customerId}`);
      return;
    }
    await db_default.user.update({
      where: { id: user.id },
      data: {
        isSubscribed: false,
        cancelAtPeriodEnd: false
      }
    });
    console.log(`[WEBHOOK] \u274C Subscription cancelled for user: ${user.email}`);
  } catch (error) {
    console.error("[WEBHOOK] Error handling subscription deleted:", error.message);
  }
}
async function handleCheckoutSessionCompleted(session) {
  if (session.payment_status !== "paid") return;
  const userId = session.client_reference_id || session.metadata?.userId;
  const interval = session.metadata?.interval || "month";
  if (!userId) {
    console.warn("[WEBHOOK] No userId found in checkout session");
    return;
  }
  try {
    const startDate = /* @__PURE__ */ new Date();
    const endDate = /* @__PURE__ */ new Date();
    endDate.setDate(endDate.getDate() + 30);
    await db_default.user.update({
      where: { id: userId },
      data: {
        isSubscribed: true,
        subscriptionInterval: interval,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        subscriptionSeats: await seatCountFor(userId),
        cancelAtPeriodEnd: false
      }
    });
    console.log(`[WEBHOOK] \u2705 Subscription activated via checkout for user: ${userId}`);
  } catch (error) {
    console.error("[WEBHOOK] Error handling checkout session completed:", error.message);
  }
}
var webhooks_default = router7;

// api/_server/routes/admin.ts
import express8 from "express";
import bcrypt2 from "bcryptjs";
import crypto from "crypto";

// api/_server/utils/curriculumGrades.ts
var STANDARDS = ["Standard 1", "Standard 2", "Standard 3", "Standard 4", "Standard 5", "Standard 6"];
var FORMS = ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6 (STPM)"];
var YEARS = [
  "Year 1",
  "Year 2",
  "Year 3",
  "Year 4",
  "Year 5",
  "Year 6",
  "Year 7",
  "Year 8",
  "Year 9",
  "Year 10",
  "Year 11",
  "Year 12",
  "Year 13"
];
var SECONDARIES = ["Secondary 1", "Secondary 2", "Secondary 3", "Secondary 4", "Secondary 5"];
var MUSIC_GRADES_WESTERN = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8"
];
var MUSIC_GRADES_INDIAN = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10"
];
var SYLLABUSES = [
  "Malaysia National Curriculum",
  "Singapore National Curriculum",
  "Cambridge IGCSE",
  "Unified Examination Certificate (UEC)",
  "International Baccalaureate (IB)",
  "Western Music",
  "Carnatic Music",
  "Hindustani Music",
  "Indian Music"
];
var isValidSyllabus = (syllabus) => typeof syllabus === "string" && SYLLABUSES.includes(syllabus);
var gradesForSyllabus = (syllabus) => {
  switch (syllabus) {
    case "Cambridge IGCSE":
    case "International Baccalaureate (IB)":
      return [...YEARS];
    case "Singapore National Curriculum":
      return [...STANDARDS, ...SECONDARIES];
    case "Unified Examination Certificate (UEC)":
      return [...FORMS];
    case "Western Music":
      return [...MUSIC_GRADES_WESTERN];
    case "Carnatic Music":
    case "Hindustani Music":
    case "Indian Music":
      return [...MUSIC_GRADES_INDIAN];
    case "Malaysia National Curriculum":
    default:
      return [...STANDARDS, ...FORMS];
  }
};
var isValidGradeForSyllabus = (syllabus, grade) => typeof grade === "string" && gradesForSyllabus(syllabus).includes(grade);

// api/_server/routes/admin.ts
var router8 = express8.Router();
var requireAdmin = async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const user = await db_default.user.findUnique({ where: { id: userId } });
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  } catch {
    res.status(500).json({ error: "Server error" });
  }
};
router8.use(authenticateToken, requireAdmin);
router8.get("/stats", async (_req, res) => {
  try {
    const [studentCount, totalCoins, totalXP, performance] = await Promise.all([
      db_default.user.count({ where: { role: "student" } }),
      db_default.user.aggregate({ where: { role: "student" }, _sum: { coins: true } }),
      db_default.user.aggregate({ where: { role: "student" }, _sum: { xp: true } }),
      db_default.result.aggregate({
        where: { user: { role: "student" } },
        _sum: {
          totalQuestions: true,
          correctAnswers: true
        }
      })
    ]);
    const season = await getActiveSeason(/* @__PURE__ */ new Date());
    let activeThisSeason = 0;
    if (season) {
      const scores = await seasonScores(season.startDate, season.endDate);
      activeThisSeason = scores.filter((s) => s.points > 0).length;
    }
    res.json({
      users: studentCount,
      totalStudents: studentCount,
      totalCoins: totalCoins._sum.coins || 0,
      totalXP: totalXP._sum.xp || 0,
      totalQuestions: performance._sum.totalQuestions || 0,
      totalCorrect: performance._sum.correctAnswers || 0,
      averageAccuracy: performance._sum.totalQuestions ? Math.round((performance._sum.correctAnswers || 0) / performance._sum.totalQuestions * 100) : 0,
      activeThisSeason,
      seasonName: season ? season.name : null,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("[ADMIN] Stats error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});
router8.get("/users", async (_req, res) => {
  try {
    const users = await db_default.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        xp: true,
        coins: true,
        isAdmin: true,
        isSubscribed: true,
        questsPlayed: true,
        parentId: true,
        archivedAt: true,
        subscriptionSeats: true,
        parent: { select: { email: true, name: true } },
        results: {
          select: {
            totalQuestions: true,
            correctAnswers: true,
            subject: true
          }
        }
      },
      orderBy: { xp: "desc" }
    });
    const usersWithStats = users.map((u) => {
      const totalQ = u.results.reduce((sum, r) => sum + r.totalQuestions, 0);
      const totalC = u.results.reduce((sum, r) => sum + r.correctAnswers, 0);
      const subjects = Array.from(new Set(u.results.map((r) => r.subject).filter(Boolean))).sort();
      return {
        ...u,
        totalQuestions: totalQ,
        totalCorrect: totalC,
        accuracy: totalQ ? Math.round(totalC / totalQ * 100) : 0,
        subjectsDone: subjects,
        // Family profiles: child rows point at the parent account that logs in.
        parentEmail: u.parent?.email ?? null,
        parentAccountName: u.parent?.name ?? null,
        isArchived: !!u.archivedAt,
        parent: void 0,
        archivedAt: void 0,
        results: void 0
      };
    });
    res.json(usersWithStats);
  } catch (error) {
    console.error("[ADMIN] Users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});
var csvEscape = (v) => {
  const s = v === null || v === void 0 ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
var isoDay = (d) => d ? new Date(d).toISOString().slice(0, 10) : "";
var parseBirthdayStr = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (isNaN(date.getTime()) || date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
};
var TEMP_PW_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
var tempPassword = () => {
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, (b) => TEMP_PW_ALPHABET[b % TEMP_PW_ALPHABET.length]).join("");
};
router8.get("/users/export", async (_req, res) => {
  try {
    const users = await db_default.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        name: true,
        email: true,
        role: true,
        grade: true,
        gradeSyllabus: true,
        birthday: true,
        createdAt: true,
        parentName: true,
        parentPhone: true,
        parentEmail: true,
        children: true,
        xp: true,
        coins: true,
        isSubscribed: true,
        subscriptionLevel: true,
        subscribedSyllabus: true,
        subscriptionEndDate: true,
        isVerified: true,
        isAdmin: true,
        referralCode: true,
        referralCreditCents: true,
        subscriptionSeats: true,
        archivedAt: true,
        parent: { select: { email: true } }
      }
    });
    const header = [
      "name",
      "email",
      "role",
      "grade",
      "syllabus",
      "birthday",
      "dateJoined",
      "parentName",
      "parentPhone",
      "parentEmail",
      "children",
      "xp",
      "coins",
      "isSubscribed",
      "subscriptionLevel",
      "subscribedSyllabus",
      "subscriptionEndDate",
      "subscriptionSeats",
      "isVerified",
      "isAdmin",
      "referralCode",
      "referralCreditRM",
      "parentAccountEmail",
      "archived"
    ];
    const lines = [header.join(",")];
    for (const u of users) {
      lines.push([
        u.name,
        u.parent ? "" : u.email,
        u.role,
        u.grade,
        u.gradeSyllabus,
        isoDay(u.birthday),
        isoDay(u.createdAt),
        u.parentName,
        u.parentPhone,
        u.parentEmail,
        u.children,
        u.xp,
        u.coins,
        u.isSubscribed ? "yes" : "no",
        u.subscriptionLevel,
        u.subscribedSyllabus,
        isoDay(u.subscriptionEndDate),
        u.subscriptionSeats,
        u.isVerified ? "yes" : "no",
        u.isAdmin ? "yes" : "no",
        u.referralCode,
        ((u.referralCreditCents ?? 0) / 100).toFixed(2),
        u.parent?.email ?? "",
        u.archivedAt ? "yes" : "no"
      ].map(csvEscape).join(","));
    }
    const csv = "\uFEFF" + lines.join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="akshara-students-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error("[ADMIN] Users export error:", error);
    res.status(500).json({ error: "Failed to export users" });
  }
});
router8.post("/users/import", async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) return res.status(400).json({ error: "rows must be an array" });
  if (rows.length > 2e3) return res.status(400).json({ error: "Import at most 2000 rows at a time" });
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const summary = { created: 0, updated: 0, failed: [], details: [] };
  const seen = /* @__PURE__ */ new Set();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? {};
    const rowNo = i + 1;
    const str = (v) => v === null || v === void 0 ? "" : String(v).trim();
    const email = str(r.email).toLowerCase();
    const fail = (reason) => summary.failed.push({ row: rowNo, email, reason });
    if (!emailRegex.test(email)) {
      fail("Invalid or missing email");
      continue;
    }
    if (seen.has(email)) {
      fail("Duplicate email within this file");
      continue;
    }
    seen.add(email);
    const name = str(r.name);
    const syllabus = str(r.syllabus);
    const grade = str(r.grade);
    const birthday = str(r.birthday);
    const parentName = str(r.parentName), parentPhone = str(r.parentPhone), parentEmail = str(r.parentEmail);
    if (syllabus && !isValidSyllabus(syllabus)) {
      fail(`Unknown syllabus "${syllabus}"`);
      continue;
    }
    if (parentEmail && !emailRegex.test(parentEmail)) {
      fail("Invalid parent email");
      continue;
    }
    let birthdayDate = null;
    if (birthday) {
      birthdayDate = parseBirthdayStr(birthday);
      if (!birthdayDate) {
        fail("Birthday must be YYYY-MM-DD");
        continue;
      }
      const age = schoolAge(birthdayDate, /* @__PURE__ */ new Date());
      if (age < 4 || age > 100) {
        fail("Birthday gives an unrealistic age");
        continue;
      }
    }
    try {
      const existing = await db_default.user.findUnique({ where: { email } });
      if (existing) {
        const effSyllabus = syllabus || existing.gradeSyllabus || "";
        if (grade && (!effSyllabus || !isValidGradeForSyllabus(effSyllabus, grade))) {
          fail(`Grade "${grade}" is not valid for syllabus "${effSyllabus || "(none)"}"`);
          continue;
        }
        const data = {};
        if (name) data.name = name;
        if (syllabus) data.gradeSyllabus = syllabus;
        if (grade) data.grade = grade;
        if (parentName) data.parentName = parentName;
        if (parentPhone) data.parentPhone = parentPhone;
        if (parentEmail) data.parentEmail = parentEmail;
        if (birthdayDate && !existing.birthday) data.birthday = birthdayDate;
        await db_default.user.update({ where: { id: existing.id }, data });
        summary.updated++;
        summary.details.push({ row: rowNo, email, action: "updated" });
      } else {
        if (!name) {
          fail("Name is required for a new student");
          continue;
        }
        if (grade && (!syllabus || !isValidGradeForSyllabus(syllabus, grade))) {
          fail(`Grade "${grade}" needs a valid syllabus`);
          continue;
        }
        await db_default.pendingUser.deleteMany({ where: { email } });
        const pw = tempPassword();
        const hashed = await bcrypt2.hash(pw, 10);
        await db_default.user.create({
          data: {
            name,
            email,
            password: hashed,
            role: "student",
            isVerified: true,
            gradeSyllabus: syllabus || null,
            grade: grade || null,
            birthday: birthdayDate,
            parentName: parentName || null,
            parentPhone: parentPhone || null,
            parentEmail: parentEmail || null
          }
        });
        const emailSent = await sendWelcomeEmail(email, name, pw);
        summary.created++;
        summary.details.push({ row: rowNo, email, action: "created", emailSent });
      }
    } catch (err) {
      console.error(`[ADMIN] Import row ${rowNo} (${email}) failed:`, err);
      fail(err?.message || "Database error");
    }
  }
  console.log(`[ADMIN] CSV import: ${summary.created} created, ${summary.updated} updated, ${summary.failed.length} failed`);
  res.json(summary);
});
router8.post("/create-teacher", async (req, res) => {
  const { name, email, password } = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Please provide a valid email address" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await db_default.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(400).json({ error: "A user with this email already exists" });
    }
    await db_default.pendingUser.deleteMany({ where: { email: normalizedEmail } });
    const hashedPassword = await bcrypt2.hash(password, 10);
    const teacher = await db_default.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: "teacher",
        isVerified: true
      },
      select: { id: true, name: true, email: true, role: true }
    });
    console.log(`[ADMIN] Created teacher account: ${teacher.email}`);
    res.json({ success: true, teacher });
  } catch (error) {
    console.error("[ADMIN] Create teacher error:", error);
    res.status(500).json({ error: "Failed to create teacher account" });
  }
});
router8.patch("/users/:id/role", async (req, res) => {
  const { id } = req.params;
  const { role, isAdmin } = req.body;
  if (role !== void 0 && role !== "student" && role !== "teacher") {
    return res.status(400).json({ error: "role must be 'student' or 'teacher'" });
  }
  if (isAdmin !== void 0 && typeof isAdmin !== "boolean") {
    return res.status(400).json({ error: "isAdmin must be a boolean" });
  }
  if (role === void 0 && isAdmin === void 0) {
    return res.status(400).json({ error: "Nothing to update" });
  }
  if (isAdmin === false && id === req.user?.id) {
    return res.status(400).json({ error: "You cannot revoke your own admin access" });
  }
  try {
    const data = {};
    if (role !== void 0) data.role = role;
    if (isAdmin !== void 0) data.isAdmin = isAdmin;
    const updated = await db_default.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isAdmin: true }
    });
    console.log(`[ADMIN] Updated access for ${updated.email}: role=${updated.role}, isAdmin=${updated.isAdmin}`);
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error("[ADMIN] Update role error:", error);
    res.status(500).json({ error: "Failed to update user role" });
  }
});
router8.get("/users/:userId/performance", async (req, res) => {
  const { userId } = req.params;
  try {
    const results = await db_default.result.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      select: {
        date: true,
        totalQuestions: true,
        correctAnswers: true
      }
    });
    const dailyStats = {};
    results.forEach((r) => {
      const day = r.date.toISOString().split("T")[0];
      if (!dailyStats[day]) {
        dailyStats[day] = { answered: 0, correct: 0 };
      }
      dailyStats[day].answered += r.totalQuestions;
      dailyStats[day].correct += r.correctAnswers;
    });
    const formattedStats = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      ...stats,
      accuracy: stats.answered ? Math.round(stats.correct / stats.answered * 100) : 0
    })).sort((a, b) => b.date.localeCompare(a.date));
    res.json(formattedStats);
  } catch (error) {
    console.error("[ADMIN] Performance error:", error);
    res.status(500).json({ error: "Failed to fetch performance data" });
  }
});
router8.get("/rewards", async (_req, res) => {
  try {
    const rewards = await db_default.reward.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json(rewards);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rewards" });
  }
});
router8.post("/rewards", async (req, res) => {
  try {
    const { title, description, coinCost, icon, stock } = req.body;
    const reward = await db_default.reward.create({
      data: { title, description, coinCost: parseInt(coinCost), icon, stock: stock ? parseInt(stock) : null }
    });
    res.json(reward);
  } catch (error) {
    res.status(500).json({ error: "Failed to create reward" });
  }
});
router8.put("/rewards/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = req.body;
    const reward = await db_default.reward.update({
      where: { id },
      data
    });
    res.json(reward);
  } catch (error) {
    res.status(500).json({ error: "Failed to update reward" });
  }
});
router8.delete("/rewards/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db_default.redemption.deleteMany({ where: { rewardId: id } });
    await db_default.reward.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error("[ADMIN] Delete reward error:", error);
    res.status(500).json({ error: "Failed to delete reward" });
  }
});
router8.get("/redemptions", async (_req, res) => {
  try {
    const redemptions = await db_default.redemption.findMany({
      include: {
        user: { select: { name: true, email: true } },
        reward: { select: { title: true } }
      },
      orderBy: { redeemedAt: "desc" }
    });
    res.json(redemptions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch redemptions" });
  }
});
router8.patch("/redemptions/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const redemption = await db_default.redemption.update({
      where: { id },
      data: { status }
    });
    res.json(redemption);
  } catch (error) {
    res.status(500).json({ error: "Failed to update redemption" });
  }
});
router8.get("/referral-tiers", async (_req, res) => {
  try {
    res.json({ tiered: await isTieredEnabled(), tiers: await getTiers(), defaults: DEFAULT_TIERS });
  } catch (error) {
    console.error("[ADMIN] Referral tiers error:", error);
    res.status(500).json({ error: "Failed to load referral tiers" });
  }
});
router8.put("/referral-tiers", async (req, res) => {
  const { tiered, tiers } = req.body ?? {};
  if (!Array.isArray(tiers) || tiers.length === 0) return res.status(400).json({ error: "At least one tier is required." });
  const cleaned = [];
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i] ?? {};
    const minCount = i === 0 ? 1 : Number(t.minCount);
    const rawMax = t.maxCount;
    const maxCount = rawMax === null || rawMax === void 0 || rawMax === "" ? null : Number(rawMax);
    const amountCents = Math.round(Number(t.amountCents));
    const splitMonths = Math.max(1, Math.round(Number(t.splitMonths) || 1));
    if (!Number.isInteger(minCount) || minCount < 1) return res.status(400).json({ error: `Tier ${i + 1}: invalid "from" value.` });
    if (maxCount !== null && (!Number.isInteger(maxCount) || maxCount < minCount)) return res.status(400).json({ error: `Tier ${i + 1}: "up to" must be at least "from".` });
    if (!Number.isFinite(amountCents) || amountCents < 0) return res.status(400).json({ error: `Tier ${i + 1}: invalid amount.` });
    if (i > 0) {
      const prev = cleaned[i - 1];
      if (prev.maxCount === null) return res.status(400).json({ error: "Only the last tier can be open-ended." });
      if (minCount !== prev.maxCount + 1) return res.status(400).json({ error: `Tier ${i + 1} must start at ${prev.maxCount + 1}.` });
    }
    cleaned.push({ minCount, maxCount, amountCents, splitMonths, sortOrder: i });
  }
  try {
    await db_default.$transaction([
      db_default.referralTier.deleteMany({}),
      db_default.referralTier.createMany({ data: cleaned }),
      db_default.appSetting.upsert({
        where: { key: "referral.tiered" },
        update: { value: String(!!tiered) },
        create: { key: "referral.tiered", value: String(!!tiered) }
      })
    ]);
    res.json({ tiered: !!tiered, tiers: cleaned });
  } catch (error) {
    console.error("[ADMIN] Save referral tiers error:", error);
    res.status(500).json({ error: "Failed to save referral tiers" });
  }
});
router8.get("/referrals", async (_req, res) => {
  try {
    const referred = await db_default.user.findMany({
      where: { referredById: { not: null } },
      select: { id: true, name: true, email: true, referredById: true, referralRewardGranted: true }
    });
    const byReferrer = /* @__PURE__ */ new Map();
    for (const u of referred) {
      const key2 = u.referredById;
      if (!byReferrer.has(key2)) byReferrer.set(key2, []);
      byReferrer.get(key2).push({ id: u.id, name: u.name, email: u.email, paid: u.referralRewardGranted });
    }
    const referrerIds = Array.from(byReferrer.keys());
    const [referrers, earnings, tiers, tiered] = await Promise.all([
      db_default.user.findMany({
        where: { id: { in: referrerIds } },
        select: { id: true, name: true, email: true, referralCode: true, referralCreditCents: true }
      }),
      db_default.referralEarning.findMany({ where: { referrerId: { in: referrerIds } }, include: { instalments: true } }),
      getTiers(),
      isTieredEnabled()
    ]);
    const referrerMap = new Map(referrers.map((r) => [r.id, r]));
    const earningsBy = /* @__PURE__ */ new Map();
    for (const e of earnings) {
      if (!earningsBy.has(e.referrerId)) earningsBy.set(e.referrerId, []);
      earningsBy.get(e.referrerId).push(e);
    }
    const report = referrerIds.map((referrerId) => {
      const r = referrerMap.get(referrerId);
      const referredUsers = byReferrer.get(referrerId);
      const mine = earningsBy.get(referrerId) ?? [];
      let totalEarnedCents = 0, creditedCents = 0, pendingCents = 0;
      let nextDue = null;
      for (const e of mine) {
        totalEarnedCents += e.tierAmountCents;
        for (const inst of e.instalments) {
          if (inst.creditedAt) creditedCents += inst.amountCents;
          else {
            pendingCents += inst.amountCents;
            if (!nextDue || inst.dueDate < nextDue) nextDue = inst.dueDate;
          }
        }
      }
      const paidReferrals = mine.length;
      return {
        referrer: {
          id: referrerId,
          name: r?.name || "Unknown",
          email: r?.email || "\u2014",
          referralCode: r?.referralCode || null,
          referralCreditCents: r?.referralCreditCents ?? 0
        },
        count: referredUsers.length,
        paidReferrals,
        tier: tierFor(tiers, tiered, paidReferrals + 1),
        totalEarnedCents,
        creditedCents,
        pendingCents,
        nextDue,
        referred: referredUsers
      };
    }).sort((a, b) => b.paidReferrals - a.paidReferrals || b.count - a.count);
    res.json(report);
  } catch (error) {
    console.error("[ADMIN] Referrals error:", error);
    res.status(500).json({ error: "Failed to fetch referrals" });
  }
});
var resolveExamName = (syllabus, grade) => {
  const s = syllabus.toLowerCase();
  const g = grade.toLowerCase();
  if (s.includes("kssr") || s.includes("kssm") || s.includes("malaysian")) {
    if (g.includes("form 5")) return "SPM (Sijil Pelajaran Malaysia)";
    if (g.includes("form 3")) return "PT3 (Pentaksiran Tingkatan 3)";
    if (g.includes("standard 6")) return "UPSR (Ujian Pencapaian Sekolah Rendah)";
    if (g.includes("form 6")) return "STPM (Sijil Tinggi Persekolahan Malaysia)";
    return "Malaysian National Exam";
  }
  if (s.includes("igcse") || s.includes("cambridge")) return "Cambridge IGCSE";
  if (s.includes("singapore") || s.includes("moe")) return "Singapore GCE O-Level";
  if (s.includes("ib")) return "IB (International Baccalaureate)";
  return syllabus;
};
var repairJSON = (text) => {
  let cleaned = text.trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  } else {
    const start = cleaned.indexOf("{") !== -1 ? cleaned.indexOf("{") : cleaned.indexOf("[");
    if (start !== -1) cleaned = cleaned.substring(start);
    else throw new Error("No JSON found in response");
  }
  const stack = [];
  let inStr = false, esc = false;
  for (const char of cleaned) {
    if (esc) {
      esc = false;
      continue;
    }
    if (char === "\\") {
      esc = true;
      continue;
    }
    if (char === '"') {
      inStr = !inStr;
      continue;
    }
    if (!inStr) {
      if (char === "{" || char === "[") stack.push(char);
      else if (char === "}" || char === "]") stack.pop();
    }
  }
  if (inStr) cleaned += '"';
  while (stack.length) cleaned += stack.pop() === "{" ? "}" : "]";
  return JSON.parse(cleaned);
};
router8.post("/question-bank/ai-generate", async (req, res) => {
  const { syllabus, grade, subject, year, count = 25 } = req.body;
  if (!syllabus || !grade || !subject || !year) {
    return res.status(400).json({ error: "syllabus, grade, subject, and year are required" });
  }
  const parsedYear = parseInt(String(year), 10);
  if (isNaN(parsedYear)) {
    return res.status(400).json({ error: "year must be a valid number" });
  }
  const examName = resolveExamName(syllabus, grade);
  const numQ = Math.min(Math.max(parseInt(String(count), 10) || 25, 5), 40);
  const prompt = `You are an expert exam question compiler with comprehensive knowledge of official past year exam papers.

TASK: Generate ${numQ} multiple-choice questions representative of the official ${examName} ${parsedYear} paper for ${subject} at ${grade} level.

REQUIREMENTS:
1. Each question must have exactly 4 options as full answer text (not just A/B/C/D labels).
2. correctAnswer must be EXACTLY one of: "A", "B", "C", or "D".
3. Include the topic/chapter name for each question.
4. Include a 2-3 sentence explanation for each answer.
5. Include difficulty: "Easy", "Medium", or "Hard".
6. Include source like "${subject} ${examName} ${parsedYear} Paper 1".
7. Cover diverse topics from the full ${subject} syllabus.
8. Difficulty spread: ~30% Easy, ~45% Medium, ~25% Hard.
9. THE RESPONSE MUST BE EXACTLY ${numQ} QUESTIONS. DO NOT RETURN FEWER.
${syllabus.toLowerCase().includes("kssr") || syllabus.toLowerCase().includes("kssm") || syllabus.toLowerCase().includes("malaysian") ? "10. Follow Malaysian DSKP standard terminology." : ""}
${syllabus.toLowerCase().includes("igcse") || syllabus.toLowerCase().includes("cambridge") ? "10. Follow Cambridge syllabus. Use command words: state, describe, explain, calculate, suggest." : ""}

Return ONLY a valid JSON object (no other text):
{
  "questions": [
    {
      "question": "Full question text?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": "A",
      "topic": "Chapter/topic name",
      "difficulty": "Medium",
      "explanation": "Why the answer is correct...",
      "source": "${subject} ${examName} ${parsedYear}"
    }
  ]
}`;
  try {
    console.log(`\u{1F916} [QB-AI] Generating ${numQ} questions for ${syllabus}/${grade}/${subject}/${parsedYear}`);
    const responseText = await generateAIContent(prompt, "gemini-2.5-flash", "application/json");
    if (!responseText) {
      return res.status(500).json({ error: "AI returned empty response. Please try again." });
    }
    let parsed;
    try {
      parsed = repairJSON(responseText);
    } catch (e) {
      console.error("[QB-AI] JSON parse failure:", e.message);
      return res.status(500).json({ error: "AI returned malformed JSON. Please try again." });
    }
    const rawQuestions = parsed.questions || (Array.isArray(parsed) ? parsed : []);
    if (rawQuestions.length < Math.min(numQ, 5)) {
      return res.status(500).json({ error: `AI returned too few questions (${rawQuestions.length}/${numQ}). Please try again.` });
    }
    const created = await db_default.$transaction(
      rawQuestions.map(
        (q) => db_default.questionBank.create({
          data: {
            subject,
            grade,
            syllabus,
            year: parsedYear,
            topic: q.topic || "General",
            subtopic: q.subtopic || null,
            question: q.question || q.text || "",
            options: JSON.stringify(Array.isArray(q.options) ? q.options : ["A", "B", "C", "D"]),
            correctAnswer: String(q.correctAnswer || "A").toUpperCase().charAt(0),
            explanation: q.explanation || "",
            difficulty: q.difficulty || "Medium",
            source: q.source || `${subject} ${examName} ${parsedYear}`
          }
        })
      )
    );
    console.log(`\u2705 [QB-AI] Saved ${created.length} questions to QuestionBank`);
    res.json({ uploaded: created.length, message: `Successfully generated and imported ${created.length} questions!` });
  } catch (error) {
    console.error("[QB-AI] Error:", error);
    res.status(500).json({ error: "AI generation failed", details: error.message });
  }
});
router8.post("/question-bank", async (req, res) => {
  try {
    const { syllabus, grade, subject, year, questions } = req.body;
    if (!syllabus || !grade || !subject || !year) {
      return res.status(400).json({ error: "syllabus, grade, subject, and year are required" });
    }
    const parsedYear = parseInt(String(year), 10);
    if (isNaN(parsedYear)) {
      return res.status(400).json({ error: "year must be a valid number" });
    }
    const rawList = Array.isArray(questions) ? questions : [questions];
    if (!rawList.length) {
      return res.status(400).json({ error: "No questions provided" });
    }
    const created = await db_default.$transaction(
      rawList.map(
        (q) => db_default.questionBank.create({
          data: {
            subject,
            grade,
            syllabus,
            year: parsedYear,
            topic: q.topic || "General",
            subtopic: q.subtopic || null,
            question: q.question,
            options: JSON.stringify(q.options),
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || "",
            difficulty: q.difficulty || "Medium",
            source: q.source || null
          }
        })
      )
    );
    console.log(`[QB] \u2705 Uploaded ${created.length} questions for ${syllabus} / ${grade} / ${subject} / ${parsedYear}`);
    res.json({ uploaded: created.length, ids: created.map((q) => q.id) });
  } catch (error) {
    console.error("[QB] Upload error:", error);
    res.status(500).json({ error: "Failed to upload questions", details: error.message });
  }
});
router8.get("/question-bank", async (req, res) => {
  try {
    const { syllabus, grade, subject, year } = req.query;
    const where = {};
    if (syllabus) where.syllabus = syllabus;
    if (grade) where.grade = grade;
    if (subject) where.subject = subject;
    if (year) where.year = parseInt(year, 10);
    const questions = await db_default.questionBank.findMany({
      where,
      orderBy: [{ year: "desc" }, { createdAt: "desc" }]
    });
    res.json(questions);
  } catch (error) {
    console.error("[QB] List error:", error);
    res.status(500).json({ error: "Failed to fetch questions" });
  }
});
router8.delete("/question-bank/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db_default.questionBank.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error("[QB] Delete error:", error);
    res.status(500).json({ error: "Failed to delete question" });
  }
});
router8.delete("/question-bank", async (req, res) => {
  const { syllabus, grade, subject, year } = req.query;
  try {
    const where = {};
    if (syllabus) where.syllabus = syllabus;
    if (grade) where.grade = grade;
    if (subject) where.subject = subject;
    if (year) where.year = parseInt(year, 10);
    const result = await db_default.questionBank.deleteMany({ where });
    res.json({ deleted: result.count });
  } catch (error) {
    console.error("[QB] Bulk delete error:", error);
    res.status(500).json({ error: "Failed to bulk delete questions" });
  }
});
var admin_default = router8;

// api/_server/routes/rewards.ts
import express9 from "express";
var router9 = express9.Router();
router9.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const rewards = await db_default.reward.findMany({
      where: { isActive: true },
      orderBy: { coinCost: "asc" }
    });
    res.json(rewards);
  } catch (error) {
    console.error("[REWARDS] Error fetching rewards:", error);
    res.status(500).json({ error: "Failed to fetch rewards" });
  }
});
router9.get("/all", authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const user = await db_default.user.findUnique({ where: { id: userId } });
    const isAdmin = user?.isAdmin || false;
    const whereClause = isAdmin ? {} : { creatorId: userId };
    const rewards = await db_default.reward.findMany({
      where: whereClause,
      orderBy: { coinCost: "asc" }
    });
    res.json(rewards);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rewards" });
  }
});
router9.post("/", authenticateToken, async (req, res) => {
  const { title, description, icon, coinCost, stock, imageUrl } = req.body;
  const userId = req.user?.id;
  if (!title || !description || coinCost === void 0) {
    return res.status(400).json({ error: "title, description and coinCost are required" });
  }
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const reward = await db_default.reward.create({
      data: {
        title,
        description,
        icon: icon || "\u{1F381}",
        coinCost: parseInt(coinCost),
        stock: stock !== void 0 && stock !== "" ? parseInt(stock) : null,
        imageUrl: imageUrl || null,
        isActive: true,
        creatorId: userId
      }
    });
    res.json(reward);
  } catch (error) {
    console.error("[REWARDS] Create error:", error);
    res.status(500).json({ error: "Failed to create reward" });
  }
});
router9.put("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, description, icon, coinCost, stock, imageUrl, isActive } = req.body;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const current = await db_default.reward.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: "Reward not found" });
    const user = await db_default.user.findUnique({ where: { id: userId } });
    if (current.creatorId !== userId && !user?.isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const reward = await db_default.reward.update({
      where: { id },
      data: {
        ...title !== void 0 && { title },
        ...description !== void 0 && { description },
        ...icon !== void 0 && { icon },
        ...coinCost !== void 0 && { coinCost: parseInt(coinCost) },
        ...stock !== void 0 && { stock: stock === "" || stock === null ? null : parseInt(stock) },
        ...imageUrl !== void 0 && { imageUrl: imageUrl || null },
        ...isActive !== void 0 && { isActive }
      }
    });
    res.json(reward);
  } catch (error) {
    console.error("[REWARDS] Update error:", error);
    res.status(500).json({ error: "Failed to update reward" });
  }
});
router9.patch("/:id/toggle", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const current = await db_default.reward.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: "Reward not found" });
    const user = await db_default.user.findUnique({ where: { id: userId } });
    if (current.creatorId !== userId && !user?.isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const updated = await db_default.reward.update({ where: { id }, data: { isActive: !current.isActive } });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle reward" });
  }
});
router9.delete("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const current = await db_default.reward.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: "Reward not found" });
    const user = await db_default.user.findUnique({ where: { id: userId } });
    if (current.creatorId !== userId && !user?.isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await db_default.reward.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error("[REWARDS] Delete error:", error);
    res.status(500).json({ error: "Failed to delete reward" });
  }
});
router9.post("/redeem/:rewardId", authenticateToken, async (req, res) => {
  const userId = req.user?.id;
  const { rewardId } = req.params;
  const { receiverName, receiverPhone, receiverAddress } = req.body;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [reward, user] = await Promise.all([
      db_default.reward.findUnique({ where: { id: rewardId } }),
      db_default.user.findUnique({ where: { id: userId } })
    ]);
    if (!reward) return res.status(404).json({ error: "Reward not found" });
    if (!reward.isActive) return res.status(400).json({ error: "This reward is no longer available" });
    if (reward.stock !== null && reward.stock <= 0) {
      return res.status(400).json({ error: "This reward is out of stock" });
    }
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.coins < reward.coinCost) {
      return res.status(400).json({ error: `Not enough coins. You need ${reward.coinCost} coins but have ${user.coins}.` });
    }
    const [redemption] = await db_default.$transaction([
      db_default.redemption.create({
        data: { userId, rewardId, receiverName, receiverPhone, receiverAddress }
      }),
      db_default.user.update({
        where: { id: userId },
        data: { coins: { decrement: reward.coinCost } }
      }),
      ...reward.stock !== null ? [db_default.reward.update({ where: { id: rewardId }, data: { stock: { decrement: 1 } } })] : []
    ]);
    res.json({ success: true, redemption, coinsSpent: reward.coinCost });
  } catch (error) {
    console.error("[REWARDS] Redemption error:", error);
    res.status(500).json({ error: "Failed to redeem reward" });
  }
});
router9.get("/my-redemptions", authenticateToken, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const redemptions = await db_default.redemption.findMany({
      where: { userId },
      include: { reward: true },
      orderBy: { redeemedAt: "desc" }
    });
    res.json(redemptions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch redemptions" });
  }
});
var rewards_default = router9;

// api/questionBank.ts
import express10 from "express";
var router10 = express10.Router();
router10.get("/count", async (req, res) => {
  const { syllabus, grade, subject } = req.query;
  if (!syllabus || !grade || !subject) {
    return res.status(400).json({ error: "syllabus, grade, and subject query params are required" });
  }
  try {
    const grouped = await db_default.questionBank.groupBy({
      by: ["year"],
      where: { syllabus, grade, subject },
      _count: { id: true },
      orderBy: { year: "desc" }
    });
    const counts = {};
    for (const row of grouped) {
      counts[String(row.year)] = row._count.id;
    }
    res.json(counts);
  } catch (error) {
    console.error("[QB-COUNT] Error:", error);
    res.status(500).json({ error: "Failed to get question counts" });
  }
});
var questionBank_default = router10;

// api/_server/routes/paperFiles.ts
import express11 from "express";
var router11 = express11.Router();
var requireAdmin2 = async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const user = await db_default.user.findUnique({ where: { id: userId } });
    if (!user?.isAdmin) return res.status(403).json({ error: "Admin access required" });
    next();
  } catch {
    res.status(500).json({ error: "Server error" });
  }
};
router11.post("/upload", authenticateToken, requireAdmin2, async (req, res) => {
  const { syllabus, grade, subject, year, files } = req.body;
  if (!syllabus || !grade || !subject || !year || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "syllabus, grade, subject, year, and files[] are required" });
  }
  const parsedYear = parseInt(String(year), 10);
  if (isNaN(parsedYear)) return res.status(400).json({ error: "year must be a number" });
  try {
    const created = await db_default.$transaction(
      files.map(
        (f) => db_default.paperFile.create({
          data: {
            syllabus,
            grade,
            subject,
            year: parsedYear,
            label: f.label || `${subject} ${parsedYear} Paper`,
            fileData: f.fileData,
            fileSize: f.fileSize
          }
        })
      )
    );
    res.json({ uploaded: created.length, ids: created.map((f) => f.id) });
  } catch (error) {
    console.error("[PAPER-FILES] Upload error:", error);
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
});
router11.get("/", async (req, res) => {
  const { syllabus, grade, subject, year } = req.query;
  const where = {};
  if (syllabus) where.syllabus = syllabus;
  if (grade) where.grade = grade;
  if (subject) where.subject = subject;
  if (year) where.year = parseInt(year, 10);
  try {
    const files = await db_default.paperFile.findMany({
      where,
      select: { id: true, syllabus: true, grade: true, subject: true, year: true, label: true, fileSize: true, createdAt: true },
      orderBy: [{ year: "desc" }, { createdAt: "desc" }]
    });
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch paper files" });
  }
});
router11.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const file = await db_default.paperFile.findUnique({ where: { id } });
    if (!file) return res.status(404).json({ error: "File not found" });
    const base64 = file.fileData.includes(",") ? file.fileData.split(",")[1] : file.fileData;
    const buffer = Buffer.from(base64, "base64");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${file.label.replace(/[^a-z0-9]/gi, "_")}.pdf"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: "Failed to serve file" });
  }
});
router11.delete("/:id", authenticateToken, requireAdmin2, async (req, res) => {
  const { id } = req.params;
  try {
    await db_default.paperFile.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error("[PAPER-FILES] Delete error:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
});
var paperFiles_default = router11;

// api/_server/routes/studyPlans.ts
import express12 from "express";
var router12 = express12.Router();
router12.use(authenticateToken);
router12.get("/current", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    console.log(`[STUDY-PLAN] Fetching plan for user: ${userId}`);
    const plan = await db_default.studyPlan.findFirst({
      where: { userId },
      include: {
        tasks: {
          orderBy: [
            { weekNumber: "asc" },
            { day: "asc" }
          ]
        }
      },
      orderBy: { createdAt: "desc" }
    });
    if (!plan) {
      console.log(`[STUDY-PLAN] No plan found for user: ${userId}`);
      return res.status(404).json({ error: "No study plan found" });
    }
    console.log(`[STUDY-PLAN] Successfully fetched plan: ${plan.id}`);
    res.json(plan);
  } catch (error) {
    console.error("[STUDY-PLAN] Fetch error detail:", {
      message: error.message,
      stack: error.stack,
      userId
    });
    res.status(500).json({ error: "Failed to fetch study plan", details: error.message });
  }
});
router12.patch("/tasks/:taskId", async (req, res) => {
  const userId = req.user?.id;
  const { taskId } = req.params;
  const { isCompleted } = req.body;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const task = await db_default.studyTask.findFirst({
      where: {
        id: taskId,
        studyPlan: { userId }
      }
    });
    if (!task) {
      return res.status(404).json({ error: "Task not found or access denied" });
    }
    const updatedTask = await db_default.studyTask.update({
      where: { id: taskId },
      data: {
        isCompleted,
        completedAt: isCompleted ? /* @__PURE__ */ new Date() : null
      }
    });
    res.json(updatedTask);
  } catch (error) {
    console.error("[STUDY-PLAN] Task update error:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});
router12.delete("/:planId", async (req, res) => {
  const userId = req.user?.id;
  const { planId } = req.params;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const plan = await db_default.studyPlan.findFirst({
      where: { id: planId, userId }
    });
    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }
    await db_default.studyPlan.delete({
      where: { id: planId }
    });
    res.json({ success: true, message: "Study plan deleted" });
  } catch (error) {
    console.error("[STUDY-PLAN] Delete error:", error);
    res.status(500).json({ error: "Failed to delete study plan" });
  }
});
var studyPlans_default = router12;

// api/_server/routes/classrooms.ts
import express13 from "express";
import { PrismaClient as PrismaClient2 } from "@prisma/client";
var router13 = express13.Router();
var prisma2 = new PrismaClient2();
var generateJoinCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};
router13.post("/", authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Classroom name is required" });
    }
    let joinCode = generateJoinCode();
    let isUnique = false;
    while (!isUnique) {
      const existing = await prisma2.classroom.findUnique({ where: { joinCode } });
      if (!existing) {
        isUnique = true;
      } else {
        joinCode = generateJoinCode();
      }
    }
    const classroom = await prisma2.classroom.create({
      data: {
        name,
        joinCode,
        teacherId: req.user.id
      }
    });
    res.json(classroom);
  } catch (error) {
    console.error("Failed to create classroom:", error);
    res.status(500).json({ error: "Failed to create classroom" });
  }
});
router13.post("/join", authenticateToken, async (req, res) => {
  try {
    const { joinCode } = req.body;
    if (!joinCode) {
      return res.status(400).json({ error: "Join code is required" });
    }
    const classroom = await prisma2.classroom.findUnique({
      where: { joinCode: joinCode.toUpperCase() }
    });
    if (!classroom) {
      return res.status(404).json({ error: "Invalid join code" });
    }
    await prisma2.classroom.update({
      where: { id: classroom.id },
      data: {
        students: {
          connect: { id: req.user.id }
        }
      }
    });
    res.json({ success: true, classroom });
  } catch (error) {
    console.error("Failed to join classroom:", error);
    res.status(500).json({ error: "Failed to join classroom" });
  }
});
router13.get("/", authenticateToken, async (req, res) => {
  try {
    const teachingClassrooms = await prisma2.classroom.findMany({
      where: { teacherId: req.user.id },
      include: {
        _count: {
          select: { students: true, assignments: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    const studentClassrooms = await prisma2.classroom.findMany({
      where: {
        students: {
          some: { id: req.user.id }
        }
      },
      include: {
        teacher: { select: { name: true } },
        _count: { select: { assignments: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json({
      teaching: teachingClassrooms,
      enrolled: studentClassrooms
    });
  } catch (error) {
    console.error("Failed to fetch classrooms:", error);
    res.status(500).json({ error: "Failed to fetch classrooms" });
  }
});
router13.get("/:id", authenticateToken, async (req, res) => {
  try {
    const classroom = await prisma2.classroom.findUnique({
      where: { id: req.params.id },
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        students: { select: { id: true, name: true, email: true } },
        assignments: {
          include: {
            submissions: {
              where: { studentId: req.user.id }
            }
          },
          orderBy: { createdAt: "desc" }
        }
      }
    });
    if (!classroom) {
      return res.status(404).json({ error: "Classroom not found" });
    }
    res.json(classroom);
  } catch (error) {
    console.error("Failed to fetch classroom details:", error);
    res.status(500).json({ error: "Failed to fetch classroom details" });
  }
});
router13.get("/:id/submissions", authenticateToken, async (req, res) => {
  try {
    const classroom = await prisma2.classroom.findUnique({
      where: { id: req.params.id }
    });
    if (!classroom || classroom.teacherId !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized or not found" });
    }
    const assignments = await prisma2.assignment.findMany({
      where: { classroomId: req.params.id },
      include: {
        submissions: {
          include: {
            student: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json(assignments);
  } catch (error) {
    console.error("Failed to fetch submissions:", error);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});
var classrooms_default = router13;

// api/_server/routes/assignments.ts
import express14 from "express";
import { PrismaClient as PrismaClient3 } from "@prisma/client";
var router14 = express14.Router();
var prisma3 = new PrismaClient3();
router14.post("/", authenticateToken, async (req, res) => {
  try {
    const { classroomId, title, description, questId, dueDate } = req.body;
    if (!classroomId || !title) return res.status(400).json({ error: "Missing required fields" });
    const classroom = await prisma3.classroom.findUnique({
      where: { id: classroomId },
      include: { students: true }
    });
    if (!classroom || classroom.teacherId !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
    const assignment = await prisma3.assignment.create({
      data: { classroomId, title, description, questId, dueDate: dueDate ? new Date(dueDate) : null }
    });
    if (classroom.students?.length > 0) {
      await prisma3.assignmentSubmission.createMany({
        data: classroom.students.map((s) => ({ assignmentId: assignment.id, studentId: s.id, status: "pending" }))
      });
    }
    res.json(assignment);
  } catch (error) {
    console.error("Failed to create assignment:", error);
    res.status(500).json({ error: "Failed to create assignment" });
  }
});
router14.post("/:id/submit", authenticateToken, async (req, res) => {
  try {
    const { score, proofUrl } = req.body;
    const status = proofUrl ? "submitted" : "completed";
    const submission = await prisma3.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: req.user.id } }
    });
    if (!submission) {
      await prisma3.assignmentSubmission.create({
        data: { assignmentId: req.params.id, studentId: req.user.id, status, score: score || null, proofUrl: proofUrl || null, completedAt: /* @__PURE__ */ new Date() }
      });
    } else {
      await prisma3.assignmentSubmission.update({
        where: { id: submission.id },
        data: { status, score: score !== void 0 ? score : submission.score, proofUrl: proofUrl || submission.proofUrl, completedAt: /* @__PURE__ */ new Date() }
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to submit assignment:", error);
    res.status(500).json({ error: "Failed to submit assignment" });
  }
});
router14.post("/:id/grade", authenticateToken, async (req, res) => {
  try {
    const { studentId, score } = req.body;
    if (!studentId || score === void 0) return res.status(400).json({ error: "Missing studentId or score" });
    const submission = await prisma3.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId: req.params.id, studentId } }
    });
    if (!submission) return res.status(404).json({ error: "Submission not found" });
    const updated = await prisma3.assignmentSubmission.update({
      where: { id: submission.id },
      data: { score: parseInt(score), status: "completed" }
    });
    res.json(updated);
  } catch (error) {
    console.error("Failed to grade submission:", error);
    res.status(500).json({ error: "Failed to grade submission" });
  }
});
router14.delete("/submissions/:submissionId", authenticateToken, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const submission = await prisma3.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: { assignment: { include: { classroom: true } } }
    });
    if (!submission) return res.status(404).json({ error: "Submission not found" });
    if (submission.assignment.classroom.teacherId !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
    await prisma3.assignmentSubmission.delete({ where: { id: submissionId } });
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete submission:", error);
    res.status(500).json({ error: "Failed to delete submission" });
  }
});
var assignments_default = router14;

// api/_server/routes/leaderboard.ts
import express15 from "express";
import jwt3 from "jsonwebtoken";
var router15 = express15.Router();
var levelFor = (xp) => Math.floor(xp / 1e3) + 1;
var ORDER = [
  { xp: "desc" },
  { name: "asc" },
  { id: "asc" }
];
var ROW_SELECT = {
  id: true,
  name: true,
  xp: true,
  avatar: true,
  grade: true
};
var rankOf = (u) => db_default.user.count({
  where: {
    role: "student",
    archivedAt: null,
    OR: [
      { xp: { gt: u.xp } },
      { xp: u.xp, name: { lt: u.name } },
      { xp: u.xp, name: u.name, id: { lt: u.id } }
    ]
  }
}).then((n) => n + 1);
var shape = (u, rank) => ({
  id: u.id,
  name: u.name,
  xp: u.xp,
  avatar: u.avatar ?? null,
  grade: u.grade ?? null,
  level: levelFor(u.xp),
  rank
});
router15.get("/", async (req, res) => {
  try {
    const rawQ = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 50) : "";
    const q = rawQ.length > 0 ? rawQ : null;
    const parsedLimit = parseInt(String(req.query.limit ?? ""), 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, parsedLimit)) : 100;
    let leaderboard;
    if (q) {
      const matches = await db_default.user.findMany({
        // @ts-ignore
        where: { role: "student", archivedAt: null, name: { contains: q, mode: "insensitive" } },
        select: ROW_SELECT,
        orderBy: ORDER,
        take: 20
      });
      const ranks = await Promise.all(matches.map((m) => rankOf(m)));
      leaderboard = matches.map((m, i) => shape(m, ranks[i]));
    } else {
      const top = await db_default.user.findMany({
        where: { role: "student", archivedAt: null },
        select: ROW_SELECT,
        orderBy: ORDER,
        take: limit
      });
      leaderboard = top.map((u, i) => shape(u, i + 1));
    }
    let me = null;
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token) {
      try {
        const secret = process.env.JWT_SECRET || "supersecretkeyshouldbeenv";
        const payload = jwt3.verify(token, secret);
        const userId = payload?.id;
        if (userId) {
          const self = await db_default.user.findUnique({
            where: { id: userId },
            select: { ...ROW_SELECT, role: true, archivedAt: true }
          });
          if (self && self.role === "student" && !self.archivedAt) {
            me = shape(self, await rankOf(self));
          }
        }
      } catch {
      }
    }
    const total = await db_default.user.count({ where: { role: "student", archivedAt: null } });
    res.json({ leaderboard, me, total });
  } catch (error) {
    console.error("[LEADERBOARD] Error fetching leaderboard:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});
var leaderboard_default = router15;

// api/_server/routes/profile.ts
import express16 from "express";
import crypto2 from "crypto";
var router16 = express16.Router();
var REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var generateReferralCode = () => {
  const bytes = crypto2.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += REFERRAL_ALPHABET[bytes[i] % REFERRAL_ALPHABET.length];
  }
  return code;
};
var parseBirthday2 = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (isNaN(date.getTime())) return null;
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
};
var shapeProfile = (user) => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    parentId: user.parentId ?? null,
    isChildProfile: !!user.parentId,
    grade: user.grade,
    gradeSyllabus: user.gradeSyllabus,
    birthday: user.birthday ? new Date(user.birthday).toISOString().slice(0, 10) : null,
    // The standard the student's XP is actually judged at (null for music / no birthday).
    expectedGrade: user.birthday ? expectedGradeFor(user.gradeSyllabus, new Date(user.birthday), /* @__PURE__ */ new Date()) : null,
    avatar: user.avatar,
    parentName: user.parentName,
    parentPhone: user.parentPhone,
    parentEmail: user.parentEmail,
    children: parseChildren(user.children),
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString().slice(0, 10) : null,
    profileCompleted: user.profileCompleted,
    referralCreditCents: user.referralCreditCents ?? 0,
    language: user.language ?? null
  };
};
var parseChildren = (raw) => {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((c) => c && typeof c.name === "string").map((c) => ({ name: c.name, birthday: typeof c.birthday === "string" ? c.birthday : "" })) : [];
  } catch {
    return [];
  }
};
var SUPPORTED_LANGUAGES = ["en", "ms", "zh", "ta"];
router16.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const user = await db_default.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(shapeProfile(user));
  } catch (error) {
    console.error("[PROFILE] GET error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router16.put("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { name, avatar, grade, gradeSyllabus, birthday } = req.body;
    const data = {};
    if (name !== void 0) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Name must be a non-empty string" });
      }
      data.name = name.trim();
    }
    if (avatar !== void 0) {
      if (typeof avatar !== "string" || !avatar.startsWith("data:")) {
        return res.status(400).json({ error: "Avatar must be a data URL image" });
      }
      if (avatar.length > 4e5) {
        return res.status(400).json({ error: "Avatar image is too large. Please choose a smaller image." });
      }
      data.avatar = avatar;
    }
    if (gradeSyllabus !== void 0) {
      if (!isValidSyllabus(gradeSyllabus)) {
        return res.status(400).json({ error: "Unknown syllabus" });
      }
      data.gradeSyllabus = gradeSyllabus;
    }
    if (grade !== void 0) {
      const existing = await db_default.user.findUnique({
        where: { id: userId },
        select: { gradeSyllabus: true }
      });
      const effectiveSyllabus = data.gradeSyllabus ?? existing?.gradeSyllabus ?? null;
      if (!effectiveSyllabus || !isValidSyllabus(effectiveSyllabus)) {
        return res.status(400).json({ error: "Please choose a syllabus before selecting a standard" });
      }
      if (!isValidGradeForSyllabus(effectiveSyllabus, grade)) {
        return res.status(400).json({ error: "That standard is not available for the selected syllabus" });
      }
      data.grade = grade;
    }
    if (birthday !== void 0) {
      const current = await db_default.user.findUnique({
        where: { id: userId },
        select: { birthday: true }
      });
      if (current?.birthday) {
        return res.status(400).json({
          error: "Your date of birth is already on file and cannot be changed here. Please contact your teacher or Akshara staff to correct it."
        });
      }
      if (typeof birthday !== "string") {
        return res.status(400).json({ error: "Date of birth must be in YYYY-MM-DD format" });
      }
      const parsed = parseBirthday2(birthday);
      if (!parsed) {
        return res.status(400).json({ error: "Date of birth must be a valid date in YYYY-MM-DD format" });
      }
      const age = schoolAge(parsed, /* @__PURE__ */ new Date());
      if (age < 4 || age > 100) {
        return res.status(400).json({ error: "Please enter a valid date of birth" });
      }
      data.birthday = parsed;
    }
    const user = await db_default.user.update({ where: { id: userId }, data });
    res.json(shapeProfile(user));
  } catch (error) {
    console.error("[PROFILE] PUT error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router16.put("/language", authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { language } = req.body;
    if (typeof language !== "string" || !SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).json({ error: "Unsupported language" });
    }
    await db_default.user.update({ where: { id: userId }, data: { language } });
    res.json({ success: true, language });
  } catch (error) {
    console.error("[PROFILE] PUT /language error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router16.get("/referral-code", authenticateToken, requireParentSession, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const user = await db_default.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.referralCode) {
      return res.json({ code: user.referralCode });
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateReferralCode();
      try {
        const updated = await db_default.user.update({
          where: { id: userId },
          data: { referralCode: code }
        });
        return res.json({ code: updated.referralCode });
      } catch (err) {
        if (err?.code === "P2002") continue;
        throw err;
      }
    }
    return res.status(500).json({ error: "Could not generate a referral code. Please try again." });
  } catch (error) {
    console.error("[PROFILE] GET /referral-code error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router16.post("/season-seen", authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { seasonId } = req.body;
    if (typeof seasonId !== "string" || seasonId.trim().length === 0) {
      return res.status(400).json({ error: "seasonId must be a non-empty string" });
    }
    await db_default.user.update({
      where: { id: userId },
      data: { lastSeenSeasonId: seasonId.trim() }
    });
    res.json({ success: true });
  } catch (error) {
    console.error("[PROFILE] POST /season-seen error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router16.put("/family", authenticateToken, requireParentSession, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { parentName, parentPhone, parentEmail, children } = req.body;
    const data = {};
    if (parentName !== void 0) {
      if (typeof parentName !== "string" || !parentName.trim()) {
        return res.status(400).json({ error: "Parent name cannot be empty." });
      }
      data.parentName = parentName.trim();
    }
    if (parentPhone !== void 0) {
      if (typeof parentPhone !== "string" || !parentPhone.trim()) {
        return res.status(400).json({ error: "Parent phone cannot be empty." });
      }
      data.parentPhone = parentPhone.trim();
    }
    if (parentEmail !== void 0) {
      if (parentEmail !== null && parentEmail !== "" && (typeof parentEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail))) {
        return res.status(400).json({ error: "Parent email looks invalid." });
      }
      data.parentEmail = parentEmail ? String(parentEmail).trim() : null;
    }
    if (children !== void 0) {
      if (!Array.isArray(children)) {
        return res.status(400).json({ error: "children must be an array." });
      }
      const cleaned = [];
      for (const c of children) {
        const name = typeof c?.name === "string" ? c.name.trim() : "";
        const birthday = typeof c?.birthday === "string" ? c.birthday.trim() : "";
        if (!name) return res.status(400).json({ error: "Each child needs a name." });
        if (!parseBirthday2(birthday)) {
          return res.status(400).json({ error: `Invalid date of birth for ${name}.` });
        }
        cleaned.push({ name, birthday });
      }
      data.children = JSON.stringify(cleaned);
    }
    const current = await db_default.user.findUnique({ where: { id: userId } });
    if (!current) return res.status(404).json({ error: "User not found" });
    const finalName = data.parentName ?? current.parentName;
    const finalPhone = data.parentPhone ?? current.parentPhone;
    const finalChildren = data.children !== void 0 ? data.children : current.children;
    let hasChild = false;
    try {
      hasChild = Array.isArray(JSON.parse(finalChildren || "[]")) && JSON.parse(finalChildren || "[]").length > 0;
    } catch {
    }
    if (finalName && finalPhone && hasChild) data.profileCompleted = true;
    const user = await db_default.user.update({ where: { id: userId }, data });
    res.json(shapeProfile(user));
  } catch (error) {
    console.error("[PROFILE] PUT /family error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router16.get("/referral-stats", authenticateToken, requireParentSession, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    await releaseDueInstalments(userId);
    const [stats, u, tiers] = await Promise.all([
      referralStatsFor(userId),
      db_default.user.findUnique({ where: { id: userId }, select: { referralCreditCents: true } }),
      getTiers()
    ]);
    res.json({ ...stats, tiers, creditBalanceCents: u?.referralCreditCents ?? 0 });
  } catch (error) {
    console.error("[PROFILE] referral-stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
var profile_default = router16;

// api/_server/routes/seasons.ts
import express17 from "express";

// api/_server/utils/optionalAuth.ts
import jwt4 from "jsonwebtoken";
var optionalUserId = (req) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return null;
  try {
    const secret = process.env.JWT_SECRET || "supersecretkeyshouldbeenv";
    const payload = jwt4.verify(token, secret);
    return payload?.id || null;
  } catch {
    return null;
  }
};

// api/_server/routes/seasons.ts
var router17 = express17.Router();
var nonNegInt = (v) => Math.max(0, parseInt(String(v ?? 0), 10) || 0);
var requireAdmin3 = async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const user = await db_default.user.findUnique({ where: { id: userId } });
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  } catch {
    res.status(500).json({ error: "Server error" });
  }
};
var hydrateUsers = async (rows, includeGrade = false) => {
  const ids = rows.map((r) => r.userId);
  const users = await db_default.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, avatar: true, grade: includeGrade }
  });
  const map = new Map(users.map((u) => [u.id, u]));
  return rows.map((r, i) => {
    const u = map.get(r.userId);
    return {
      userId: r.userId,
      points: r.points,
      rank: i + 1,
      name: u?.name || "Unknown",
      avatar: u?.avatar || null,
      ...includeGrade ? { grade: u?.grade ?? null } : {}
    };
  });
};
var hydrateWinners = async (seasonId) => {
  const winners = await db_default.seasonWinner.findMany({
    where: { seasonId },
    orderBy: { rank: "asc" },
    include: { user: { select: { name: true, avatar: true } } }
  });
  return winners.map((w) => ({
    rank: w.rank,
    userId: w.userId,
    points: w.points,
    awardedPoints: w.awardedPoints,
    prizeTitle: w.prizeTitle,
    name: w.user?.name || "Unknown",
    avatar: w.user?.avatar || null
  }));
};
var publicSeasonShape = (s, now) => ({
  id: s.id,
  name: s.name,
  description: s.description,
  prizeTitle: s.prizeTitle,
  prizeDetails: s.prizeDetails,
  secondPlacePoints: s.secondPlacePoints,
  thirdPlacePoints: s.thirdPlacePoints,
  secondPrizeTitle: s.secondPrizeTitle,
  thirdPrizeTitle: s.thirdPrizeTitle,
  firstPrizeCoins: s.firstPrizeCoins,
  secondPrizeCoins: s.secondPrizeCoins,
  thirdPrizeCoins: s.thirdPrizeCoins,
  startDate: s.startDate,
  endDate: s.endDate,
  status: effectiveStatus(s, now)
});
router17.get("/current", async (_req, res) => {
  try {
    const now = /* @__PURE__ */ new Date();
    const all = await db_default.season.findMany({ orderBy: { startDate: "asc" } });
    const active = all.find((s) => effectiveStatus(s, now) === "active") || null;
    const upcoming = all.filter((s) => effectiveStatus(s, now) === "upcoming").sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0] || null;
    const chosen = active || upcoming;
    let top3 = [];
    if (active) {
      const scores = await seasonScores(active.startDate, active.endDate);
      top3 = await hydrateUsers(scores.slice(0, 3));
    }
    const finalized = all.filter((s) => s.status === "finalized").sort((a, b) => b.endDate.getTime() - a.endDate.getTime())[0] || null;
    let lastFinalized = null;
    if (finalized) {
      lastFinalized = {
        ...publicSeasonShape(finalized, now),
        winners: await hydrateWinners(finalized.id)
      };
    }
    res.json({
      season: chosen ? publicSeasonShape(chosen, now) : null,
      top3,
      lastFinalized
    });
  } catch (error) {
    console.error("[SEASONS] current error:", error);
    res.status(500).json({ error: "Failed to fetch current season" });
  }
});
router17.get("/history", async (_req, res) => {
  try {
    const now = /* @__PURE__ */ new Date();
    const finalized = await db_default.season.findMany({
      where: { status: "finalized" },
      orderBy: { endDate: "desc" }
    });
    const seasons = await Promise.all(
      finalized.map(async (s) => ({
        ...publicSeasonShape(s, now),
        winners: await hydrateWinners(s.id)
      }))
    );
    res.json(seasons);
  } catch (error) {
    console.error("[SEASONS] history error:", error);
    res.status(500).json({ error: "Failed to fetch season history" });
  }
});
router17.get("/list", async (_req, res) => {
  try {
    const now = /* @__PURE__ */ new Date();
    const all = await db_default.season.findMany({ orderBy: { startDate: "desc" } });
    const visible = all.filter((s) => effectiveStatus(s, now) !== "upcoming");
    const withRows = await db_default.seasonStanding.findMany({
      where: { seasonId: { in: visible.map((s) => s.id) }, rank: 1 },
      select: { seasonId: true }
    });
    const snapshotIds = new Set(withRows.map((r) => r.seasonId));
    res.json(visible.map((s) => ({
      id: s.id,
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
      status: effectiveStatus(s, now),
      isSnapshot: s.status === "finalized" && snapshotIds.has(s.id)
    })));
  } catch (error) {
    console.error("[SEASONS] list error:", error);
    res.status(500).json({ error: "Failed to fetch season list" });
  }
});
router17.get("/latest-finalized", authenticateToken, async (_req, res) => {
  try {
    const now = /* @__PURE__ */ new Date();
    const finalized = await db_default.season.findMany({
      where: { status: "finalized" },
      orderBy: { endDate: "desc" },
      take: 1
    });
    if (finalized.length === 0) return res.json({ season: null });
    const s = finalized[0];
    res.json({
      season: {
        ...publicSeasonShape(s, now),
        winners: await hydrateWinners(s.id)
      }
    });
  } catch (error) {
    console.error("[SEASONS] latest-finalized error:", error);
    res.status(500).json({ error: "Failed to fetch latest finalized season" });
  }
});
router17.get("/current/leaderboard", async (req, res) => {
  try {
    const now = /* @__PURE__ */ new Date();
    const season = await getActiveSeason(now);
    if (!season) {
      return res.json({ season: null, leaderboard: [], me: null });
    }
    const scores = await seasonScores(season.startDate, season.endDate);
    const top20 = await hydrateUsers(scores.slice(0, 20), true);
    let me = null;
    const userId = optionalUserId(req);
    if (userId) {
      const idx = scores.findIndex((s) => s.userId === userId);
      if (idx >= 20) {
        const hydrated = await hydrateUsers([scores[idx]], true);
        me = { ...hydrated[0], rank: idx + 1 };
      } else if (idx >= 0) {
        me = top20[idx];
      }
    }
    res.json({
      season: publicSeasonShape(season, now),
      leaderboard: top20,
      me
    });
  } catch (error) {
    console.error("[SEASONS] current/leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch current season leaderboard" });
  }
});
router17.get("/:id/leaderboard", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const now = /* @__PURE__ */ new Date();
    const season = await db_default.season.findUnique({ where: { id } });
    if (!season) return res.status(404).json({ error: "Season not found" });
    const scores = await seasonScores(season.startDate, season.endDate);
    const top10 = await hydrateUsers(scores.slice(0, 10), true);
    let me = null;
    const userId = req.user?.id;
    if (userId) {
      const idx = scores.findIndex((s) => s.userId === userId);
      if (idx >= 10) {
        const hydrated = await hydrateUsers([scores[idx]], true);
        me = { ...hydrated[0], rank: idx + 1 };
      } else if (idx >= 0) {
        me = top10[idx];
      }
    }
    res.json({
      season: publicSeasonShape(season, now),
      leaderboard: top10,
      me
    });
  } catch (error) {
    console.error("[SEASONS] leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch season leaderboard" });
  }
});
router17.get("/:id/standings", async (req, res) => {
  try {
    const { id } = req.params;
    const now = /* @__PURE__ */ new Date();
    const parsed = parseInt(String(req.query.limit ?? ""), 10);
    const limit = Math.min(100, Math.max(1, isNaN(parsed) ? 100 : parsed));
    const season = await db_default.season.findUnique({ where: { id } });
    if (!season) return res.status(404).json({ error: "Season not found" });
    const userId = optionalUserId(req);
    if (season.status === "finalized") {
      const rows = await db_default.seasonStanding.findMany({
        where: { seasonId: id },
        orderBy: { rank: "asc" },
        take: limit
      });
      if (rows.length > 0) {
        const liveUsers = await db_default.user.findMany({
          where: { id: { in: rows.map((r) => r.userId) } },
          select: { id: true, avatar: true }
        });
        const liveAvatar = new Map(liveUsers.map((u) => [u.id, u.avatar]));
        const toRow = (r) => ({
          userId: r.userId,
          points: r.points,
          rank: r.rank,
          name: r.name,
          avatar: liveAvatar.has(r.userId) ? liveAvatar.get(r.userId) : r.avatar,
          grade: r.grade
        });
        let me2 = null;
        if (userId) {
          const mine = await db_default.seasonStanding.findFirst({
            where: { seasonId: id, userId }
          });
          if (mine) {
            if (!liveAvatar.has(mine.userId)) {
              const self = await db_default.user.findUnique({ where: { id: mine.userId }, select: { avatar: true } });
              if (self) liveAvatar.set(mine.userId, self.avatar);
            }
            me2 = toRow(mine);
          }
        }
        return res.json({
          season: publicSeasonShape(season, now),
          source: "snapshot",
          leaderboard: rows.map(toRow),
          me: me2
        });
      }
    }
    const scores = await seasonScores(season.startDate, season.endDate);
    const top = await hydrateUsers(scores.slice(0, limit), true);
    let me = null;
    if (userId) {
      const idx = scores.findIndex((s) => s.userId === userId);
      if (idx >= limit) {
        const hydrated = await hydrateUsers([scores[idx]], true);
        me = { ...hydrated[0], rank: idx + 1 };
      } else if (idx >= 0) {
        me = top[idx];
      }
    }
    res.json({
      season: publicSeasonShape(season, now),
      source: "live",
      leaderboard: top,
      me
    });
  } catch (error) {
    console.error("[SEASONS] standings error:", error);
    res.status(500).json({ error: "Failed to fetch season standings" });
  }
});
router17.get("/admin/all", authenticateToken, requireAdmin3, async (_req, res) => {
  try {
    const now = /* @__PURE__ */ new Date();
    const all = await db_default.season.findMany({ orderBy: { startDate: "desc" } });
    const seasons = await Promise.all(
      all.map(async (s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        prizeTitle: s.prizeTitle,
        prizeDetails: s.prizeDetails,
        secondPlacePoints: s.secondPlacePoints,
        thirdPlacePoints: s.thirdPlacePoints,
        secondPrizeTitle: s.secondPrizeTitle,
        thirdPrizeTitle: s.thirdPrizeTitle,
        firstPrizeCoins: s.firstPrizeCoins,
        secondPrizeCoins: s.secondPrizeCoins,
        thirdPrizeCoins: s.thirdPrizeCoins,
        startDate: s.startDate,
        endDate: s.endDate,
        rawStatus: s.status,
        status: effectiveStatus(s, now),
        createdAt: s.createdAt,
        winners: s.status === "finalized" ? await hydrateWinners(s.id) : []
      }))
    );
    res.json(seasons);
  } catch (error) {
    console.error("[SEASONS] admin/all error:", error);
    res.status(500).json({ error: "Failed to fetch seasons" });
  }
});
router17.post("/admin", authenticateToken, requireAdmin3, async (req, res) => {
  try {
    const {
      name,
      description,
      prizeTitle,
      prizeDetails,
      secondPlacePoints,
      thirdPlacePoints,
      secondPrizeTitle,
      thirdPrizeTitle,
      firstPrizeCoins,
      secondPrizeCoins,
      thirdPrizeCoins,
      startDate,
      endDate
    } = req.body;
    if (!name || !prizeTitle || !startDate || !endDate) {
      return res.status(400).json({ error: "name, prizeTitle, startDate and endDate are required" });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid start or end date" });
    }
    if (end <= start) {
      return res.status(400).json({ error: "End date must be after start date" });
    }
    const others = await db_default.season.findMany({ where: { status: { not: "finalized" } } });
    const overlaps = others.some((o) => start <= o.endDate && end >= o.startDate);
    if (overlaps) {
      return res.status(400).json({ error: "This date range overlaps an existing active or upcoming season" });
    }
    const season = await db_default.season.create({
      data: {
        name: String(name).trim(),
        description: description ? String(description) : null,
        prizeTitle: String(prizeTitle).trim(),
        prizeDetails: prizeDetails ? String(prizeDetails) : null,
        secondPlacePoints: nonNegInt(secondPlacePoints),
        thirdPlacePoints: nonNegInt(thirdPlacePoints),
        secondPrizeTitle: secondPrizeTitle ? String(secondPrizeTitle).trim() : null,
        thirdPrizeTitle: thirdPrizeTitle ? String(thirdPrizeTitle).trim() : null,
        firstPrizeCoins: nonNegInt(firstPrizeCoins),
        secondPrizeCoins: nonNegInt(secondPrizeCoins),
        thirdPrizeCoins: nonNegInt(thirdPrizeCoins),
        startDate: start,
        endDate: end
      }
    });
    res.json(season);
  } catch (error) {
    console.error("[SEASONS] create error:", error);
    res.status(500).json({ error: "Failed to create season" });
  }
});
router17.put("/admin/:id", authenticateToken, requireAdmin3, async (req, res) => {
  try {
    const { id } = req.params;
    const now = /* @__PURE__ */ new Date();
    const existing = await db_default.season.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Season not found" });
    const status = effectiveStatus(existing, now);
    if (status === "finalized") {
      return res.status(400).json({ error: "A finalized season cannot be edited" });
    }
    const {
      name,
      description,
      prizeTitle,
      prizeDetails,
      secondPlacePoints,
      thirdPlacePoints,
      secondPrizeTitle,
      thirdPrizeTitle,
      firstPrizeCoins,
      secondPrizeCoins,
      thirdPrizeCoins,
      startDate,
      endDate
    } = req.body;
    const start = startDate !== void 0 ? new Date(startDate) : existing.startDate;
    const end = endDate !== void 0 ? new Date(endDate) : existing.endDate;
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid start or end date" });
    }
    if (end <= start) {
      return res.status(400).json({ error: "End date must be after start date" });
    }
    const sameMinute = (a, b) => Math.floor(a.getTime() / 6e4) === Math.floor(b.getTime() / 6e4);
    const startChanged = !sameMinute(start, existing.startDate);
    const endChanged = !sameMinute(end, existing.endDate);
    const prizeNumbers = [
      [secondPlacePoints, existing.secondPlacePoints],
      [thirdPlacePoints, existing.thirdPlacePoints],
      [firstPrizeCoins, existing.firstPrizeCoins],
      [secondPrizeCoins, existing.secondPrizeCoins],
      [thirdPrizeCoins, existing.thirdPrizeCoins]
    ];
    const prizeValuesChanged = prizeNumbers.some(
      ([incoming, current]) => incoming !== void 0 && nonNegInt(incoming) !== current
    );
    if (status === "ended") {
      if (startChanged || endChanged || prizeValuesChanged) {
        return res.status(400).json({
          error: "A season that has ended can no longer have its dates or prizes changed \u2014 finalize it instead"
        });
      }
    } else if (status === "active") {
      if (startChanged && now >= existing.startDate) {
        return res.status(400).json({
          error: "A season that has already started cannot have its start date changed"
        });
      }
      if (endChanged && end <= now) {
        return res.status(400).json({
          error: "The end date of a running season can only be moved to a future date"
        });
      }
    }
    const others = await db_default.season.findMany({
      where: { status: { not: "finalized" }, id: { not: id } }
    });
    const overlaps = others.some((o) => start <= o.endDate && end >= o.startDate);
    if (overlaps) {
      return res.status(400).json({ error: "This date range overlaps an existing active or upcoming season" });
    }
    const data = { startDate: start, endDate: end };
    if (name !== void 0) data.name = String(name).trim();
    if (description !== void 0) data.description = description ? String(description) : null;
    if (prizeTitle !== void 0) data.prizeTitle = String(prizeTitle).trim();
    if (prizeDetails !== void 0) data.prizeDetails = prizeDetails ? String(prizeDetails) : null;
    if (secondPlacePoints !== void 0) data.secondPlacePoints = nonNegInt(secondPlacePoints);
    if (thirdPlacePoints !== void 0) data.thirdPlacePoints = nonNegInt(thirdPlacePoints);
    if (secondPrizeTitle !== void 0) data.secondPrizeTitle = secondPrizeTitle ? String(secondPrizeTitle).trim() : null;
    if (thirdPrizeTitle !== void 0) data.thirdPrizeTitle = thirdPrizeTitle ? String(thirdPrizeTitle).trim() : null;
    if (firstPrizeCoins !== void 0) data.firstPrizeCoins = nonNegInt(firstPrizeCoins);
    if (secondPrizeCoins !== void 0) data.secondPrizeCoins = nonNegInt(secondPrizeCoins);
    if (thirdPrizeCoins !== void 0) data.thirdPrizeCoins = nonNegInt(thirdPrizeCoins);
    const season = await db_default.season.update({ where: { id }, data });
    res.json(season);
  } catch (error) {
    console.error("[SEASONS] update error:", error);
    res.status(500).json({ error: "Failed to update season" });
  }
});
router17.post("/admin/:id/finalize", authenticateToken, requireAdmin3, async (req, res) => {
  try {
    const { id } = req.params;
    const now = /* @__PURE__ */ new Date();
    const season = await db_default.season.findUnique({ where: { id } });
    if (!season) return res.status(404).json({ error: "Season not found" });
    if (season.status === "finalized") {
      return res.status(400).json({ error: "Season is already finalized" });
    }
    if (now <= season.endDate) {
      return res.status(400).json({ error: "Season has not ended yet" });
    }
    const scores = await seasonScores(season.startDate, season.endDate);
    const top3 = scores.slice(0, 3);
    const top100 = scores.slice(0, 100);
    const hydrated = await hydrateUsers(top100, true);
    await db_default.$transaction(async (tx) => {
      for (let i = 0; i < top3.length; i++) {
        const rank = i + 1;
        const coins = rank === 1 ? season.firstPrizeCoins : rank === 2 ? season.secondPrizeCoins : season.thirdPrizeCoins;
        const prizeTitle = rank === 1 ? season.prizeTitle : rank === 2 ? season.secondPrizeTitle || "" : season.thirdPrizeTitle || "";
        await tx.seasonWinner.create({
          data: {
            seasonId: season.id,
            userId: top3[i].userId,
            rank,
            points: top3[i].points,
            awardedPoints: coins,
            // reused column now means "coins awarded"
            prizeTitle
          }
        });
        if (coins > 0) {
          await tx.user.update({
            where: { id: top3[i].userId },
            data: { coins: { increment: coins } }
          });
        }
      }
      if (hydrated.length > 0) {
        await tx.seasonStanding.createMany({
          data: hydrated.map((h, i) => ({
            seasonId: season.id,
            userId: h.userId,
            rank: i + 1,
            points: h.points,
            name: h.name,
            avatar: h.avatar ?? null,
            grade: h.grade ?? null
          })),
          skipDuplicates: true
        });
      }
      await tx.season.update({
        where: { id: season.id },
        data: { status: "finalized", finalizedAt: now }
      });
    }, {
      // Prisma's default interactive-transaction timeout is 5s. 100 standing
      // inserts plus the winner/coin writes against a pooled Neon connection can
      // comfortably exceed that, so give it real headroom.
      timeout: 15e3,
      maxWait: 1e4
    });
    res.json({
      success: true,
      season: { ...publicSeasonShape({ ...season, status: "finalized" }, now) },
      winners: await hydrateWinners(season.id)
    });
  } catch (error) {
    console.error("[SEASONS] finalize error:", error);
    res.status(500).json({ error: "Failed to finalize season" });
  }
});
var seasons_default = router17;

// api/_server/routes/polls.ts
import express18 from "express";
var router18 = express18.Router();
var requireAdmin4 = async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const user = await db_default.user.findUnique({ where: { id: userId } });
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  } catch {
    res.status(500).json({ error: "Server error" });
  }
};
var parseOptions = (raw) => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};
var tallyVotes = (votes, optionCount) => {
  const optionCounts = new Array(optionCount).fill(0);
  let suggestionsCount = 0;
  for (const v of votes) {
    if (typeof v.optionIndex === "number" && v.optionIndex >= 0 && v.optionIndex < optionCount) {
      optionCounts[v.optionIndex]++;
    } else if (v.suggestion) {
      suggestionsCount++;
    }
  }
  return { optionCounts, suggestionsCount };
};
var parseSuggestedMeta = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => e && typeof e.index === "number").map((e) => ({
      index: e.index,
      text: String(e.text ?? ""),
      userId: String(e.userId ?? ""),
      userName: String(e.userName ?? "Unknown"),
      createdAt: String(e.createdAt ?? "")
    }));
  } catch {
    return [];
  }
};
var parseRemoved = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((n) => parseInt(String(n), 10)).filter((n) => Number.isInteger(n) && n >= 0);
  } catch {
    return [];
  }
};
var normalizeText = (s) => String(s).trim().replace(/\s+/g, " ");
router18.get("/active", authenticateToken, async (req, res) => {
  try {
    const poll = await db_default.poll.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" }
    });
    if (!poll) return res.json({ poll: null });
    const options = parseOptions(poll.options);
    const meta = parseSuggestedMeta(poll.suggestedMeta);
    const removed = new Set(parseRemoved(poll.removedOptions));
    const votes = await db_default.pollVote.findMany({
      where: { pollId: poll.id },
      select: { optionIndex: true, suggestion: true, userId: true }
    });
    const { optionCounts } = tallyVotes(votes, options.length);
    const optionList = options.map((text, index) => ({
      index,
      text,
      count: optionCounts[index] || 0,
      suggestedByName: meta.find((m) => m.index === index)?.userName || null
    })).filter((o) => !removed.has(o.index));
    const mine = votes.find((v) => v.userId === req.user?.id) || null;
    const myVote = mine ? { optionIndex: mine.optionIndex, suggestion: mine.suggestion } : null;
    res.json({
      poll: {
        id: poll.id,
        question: poll.question,
        description: poll.description,
        allowSuggestions: poll.allowSuggestions,
        seasonId: poll.seasonId,
        options: optionList
      },
      myVote,
      totalVotes: votes.length
    });
  } catch (error) {
    console.error("[POLLS] active error:", error);
    res.status(500).json({ error: "Failed to fetch active poll" });
  }
});
router18.post("/:id/vote", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { optionIndex, suggestion } = req.body;
    const hasOption = optionIndex !== void 0 && optionIndex !== null;
    const hasSuggestion = suggestion !== void 0 && suggestion !== null && String(suggestion).trim() !== "";
    if (hasOption === hasSuggestion) {
      return res.status(400).json({ error: "Provide exactly one of optionIndex or suggestion" });
    }
    const poll = await db_default.poll.findUnique({ where: { id } });
    if (!poll) return res.status(404).json({ error: "Poll not found" });
    if (!poll.isActive) return res.status(400).json({ error: "This poll is no longer active" });
    if (hasOption) {
      const options = parseOptions(poll.options);
      const removed = new Set(parseRemoved(poll.removedOptions));
      const idx = parseInt(String(optionIndex), 10);
      if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
        return res.status(400).json({ error: "Invalid option selected" });
      }
      if (removed.has(idx)) {
        return res.status(400).json({ error: "That option is no longer available" });
      }
      await db_default.pollVote.upsert({
        where: { pollId_userId: { pollId: id, userId } },
        create: { pollId: id, userId, optionIndex: idx, suggestion: null },
        update: { optionIndex: idx, suggestion: null }
      });
      return res.json({ success: true, optionIndex: idx });
    }
    if (!poll.allowSuggestions) {
      return res.status(400).json({ error: "This poll does not accept suggestions" });
    }
    const norm = normalizeText(String(suggestion)).slice(0, 200);
    if (norm.length === 0) {
      return res.status(400).json({ error: "Suggestion cannot be empty" });
    }
    const voter = await db_default.user.findUnique({ where: { id: userId }, select: { name: true } });
    const voterName = voter?.name || "Unknown";
    const resolvedIndex = await db_default.$transaction(async (tx) => {
      try {
        await tx.$queryRaw`SELECT id FROM "Poll" WHERE id = ${id} FOR UPDATE`;
      } catch {
      }
      const fresh = await tx.poll.findUnique({ where: { id } });
      if (!fresh) throw new Error("Poll disappeared mid-transaction");
      const options = parseOptions(fresh.options);
      const removedSet = new Set(parseRemoved(fresh.removedOptions));
      const target = norm.toLowerCase();
      let idx = -1;
      for (let i = 0; i < options.length; i++) {
        if (removedSet.has(i)) continue;
        if (normalizeText(options[i]).toLowerCase() === target) {
          idx = i;
          break;
        }
      }
      if (idx === -1) {
        idx = options.length;
        const meta = parseSuggestedMeta(fresh.suggestedMeta);
        meta.push({
          index: idx,
          text: norm,
          userId,
          userName: voterName,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        await tx.poll.update({
          where: { id },
          data: {
            options: JSON.stringify([...options, norm]),
            suggestedMeta: JSON.stringify(meta)
          }
        });
      }
      await tx.pollVote.upsert({
        where: { pollId_userId: { pollId: id, userId } },
        create: { pollId: id, userId, optionIndex: idx, suggestion: null },
        update: { optionIndex: idx, suggestion: null }
      });
      return idx;
    });
    res.json({ success: true, optionIndex: resolvedIndex });
  } catch (error) {
    console.error("[POLLS] vote error:", error);
    res.status(500).json({ error: "Failed to record vote" });
  }
});
router18.get("/admin/all", authenticateToken, requireAdmin4, async (_req, res) => {
  try {
    const polls = await db_default.poll.findMany({ orderBy: { createdAt: "desc" } });
    const withCounts = await Promise.all(
      polls.map(async (p) => {
        const options = parseOptions(p.options);
        const votes = await db_default.pollVote.findMany({
          where: { pollId: p.id },
          select: { optionIndex: true, suggestion: true }
        });
        const { optionCounts } = tallyVotes(votes, options.length);
        return {
          id: p.id,
          question: p.question,
          description: p.description,
          options,
          allowSuggestions: p.allowSuggestions,
          isActive: p.isActive,
          seasonId: p.seasonId,
          createdAt: p.createdAt,
          optionCounts,
          // Now means "number of student-suggested OPTIONS" (they are real
          // options after auto-promotion), not "number of free-text votes".
          suggestionsCount: parseSuggestedMeta(p.suggestedMeta).length,
          totalVotes: votes.length
        };
      })
    );
    res.json(withCounts);
  } catch (error) {
    console.error("[POLLS] admin/all error:", error);
    res.status(500).json({ error: "Failed to fetch polls" });
  }
});
router18.post("/admin", authenticateToken, requireAdmin4, async (req, res) => {
  try {
    const { question, description, options, allowSuggestions, seasonId } = req.body;
    if (!question || String(question).trim() === "") {
      return res.status(400).json({ error: "Question is required" });
    }
    const allowSug = !!allowSuggestions;
    const optsRaw = Array.isArray(options) ? options.map((o) => String(o).trim()).filter(Boolean) : [];
    if (optsRaw.length < 2 && !allowSug) {
      return res.status(400).json({ error: "Provide at least 2 options (or enable suggestions)" });
    }
    const poll = await db_default.poll.create({
      data: {
        question: String(question).trim(),
        description: description ? String(description) : null,
        options: JSON.stringify(optsRaw),
        allowSuggestions: allowSug,
        seasonId: seasonId ? String(seasonId) : null
      }
    });
    res.json(poll);
  } catch (error) {
    console.error("[POLLS] create error:", error);
    res.status(500).json({ error: "Failed to create poll" });
  }
});
router18.put("/admin/:id", authenticateToken, requireAdmin4, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db_default.poll.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Poll not found" });
    const { question, description, options, allowSuggestions, isActive, seasonId } = req.body;
    const data = {};
    if (isActive !== void 0) data.isActive = !!isActive;
    if (question !== void 0) data.question = String(question).trim();
    if (description !== void 0) data.description = description ? String(description) : null;
    if (allowSuggestions !== void 0) data.allowSuggestions = !!allowSuggestions;
    if (seasonId !== void 0) data.seasonId = seasonId ? String(seasonId) : null;
    if (options !== void 0) {
      const optsRaw = Array.isArray(options) ? options.map((o) => String(o).trim()).filter(Boolean) : [];
      const allowSug = allowSuggestions !== void 0 ? !!allowSuggestions : existing.allowSuggestions;
      if (optsRaw.length < 2 && !allowSug) {
        return res.status(400).json({ error: "Provide at least 2 options (or enable suggestions)" });
      }
      data.options = JSON.stringify(optsRaw);
    }
    const poll = await db_default.poll.update({ where: { id }, data });
    res.json(poll);
  } catch (error) {
    console.error("[POLLS] update error:", error);
    res.status(500).json({ error: "Failed to update poll" });
  }
});
var buildAdminOptions = (poll, optionCounts) => {
  const options = parseOptions(poll.options);
  const meta = parseSuggestedMeta(poll.suggestedMeta);
  const removed = new Set(parseRemoved(poll.removedOptions));
  return options.map((text, index) => {
    const m = meta.find((e) => e.index === index);
    return {
      index,
      text,
      count: optionCounts[index] || 0,
      suggestedByName: m?.userName || null,
      suggestedByUserId: m?.userId || null,
      removed: removed.has(index)
    };
  });
};
router18.get("/admin/:id/results", authenticateToken, requireAdmin4, async (req, res) => {
  try {
    const { id } = req.params;
    const poll = await db_default.poll.findUnique({ where: { id } });
    if (!poll) return res.status(404).json({ error: "Poll not found" });
    const options = parseOptions(poll.options);
    const votes = await db_default.pollVote.findMany({
      where: { pollId: id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" }
    });
    const { optionCounts } = tallyVotes(votes, options.length);
    const legacySuggestions = votes.filter((v) => v.suggestion).map((v) => ({
      suggestion: v.suggestion,
      userName: v.user?.name || "Unknown",
      createdAt: v.createdAt
    }));
    res.json({
      poll: {
        id: poll.id,
        question: poll.question,
        allowSuggestions: poll.allowSuggestions
      },
      options: buildAdminOptions(poll, optionCounts),
      legacySuggestions,
      totalVotes: votes.length
    });
  } catch (error) {
    console.error("[POLLS] results error:", error);
    res.status(500).json({ error: "Failed to fetch poll results" });
  }
});
router18.patch("/admin/:id/options/:index", authenticateToken, requireAdmin4, async (req, res) => {
  try {
    const { id, index } = req.params;
    const { removed } = req.body;
    if (typeof removed !== "boolean") {
      return res.status(400).json({ error: 'Body must include boolean "removed"' });
    }
    const poll = await db_default.poll.findUnique({ where: { id } });
    if (!poll) return res.status(404).json({ error: "Poll not found" });
    const options = parseOptions(poll.options);
    const idx = parseInt(String(index), 10);
    if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
      return res.status(400).json({ error: "Invalid option index" });
    }
    const current = new Set(parseRemoved(poll.removedOptions));
    if (removed) current.add(idx);
    else current.delete(idx);
    const updated = await db_default.poll.update({
      where: { id },
      data: { removedOptions: JSON.stringify([...current].sort((a, b) => a - b)) }
    });
    const votes = await db_default.pollVote.findMany({
      where: { pollId: id },
      select: { optionIndex: true, suggestion: true }
    });
    const { optionCounts } = tallyVotes(votes, options.length);
    res.json({ options: buildAdminOptions(updated, optionCounts) });
  } catch (error) {
    console.error("[POLLS] option remove error:", error);
    res.status(500).json({ error: "Failed to update option" });
  }
});
var polls_default = router18;

// api/_server/routes/family.ts
import express19 from "express";
import bcrypt3 from "bcryptjs";
import crypto3 from "crypto";
import jwt5 from "jsonwebtoken";
var router19 = express19.Router();
var JWT_SECRET2 = process.env.JWT_SECRET || "supersecretkeyshouldbeenv";
var parseBirthday3 = (value) => {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (isNaN(date.getTime())) return null;
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
};
var readChildInput = (raw, requireBirthday) => {
  const name = typeof raw?.name === "string" ? raw.name.trim() : "";
  if (!name) return { ok: false, error: "Each profile needs a name." };
  if (name.length > 60) return { ok: false, error: "Name is too long." };
  let birthday = null;
  if (raw?.birthday !== void 0 && raw?.birthday !== null && raw?.birthday !== "") {
    birthday = parseBirthday3(raw.birthday);
    if (!birthday) return { ok: false, error: `Invalid date of birth for ${name}.` };
  } else if (requireBirthday) {
    return { ok: false, error: `Date of birth is required for ${name}.` };
  }
  let gradeSyllabus = null;
  let grade = null;
  if (raw?.gradeSyllabus) {
    if (!isValidSyllabus(raw.gradeSyllabus)) return { ok: false, error: `Unknown syllabus for ${name}.` };
    gradeSyllabus = raw.gradeSyllabus;
    if (raw?.grade) {
      if (!isValidGradeForSyllabus(raw.gradeSyllabus, raw.grade)) {
        return { ok: false, error: `${raw.grade} is not a valid grade for ${raw.gradeSyllabus}.` };
      }
      grade = raw.grade;
    }
  } else if (raw?.grade) {
    return { ok: false, error: `Choose a syllabus for ${name} before a grade.` };
  }
  return { ok: true, value: { name, birthday, grade, gradeSyllabus } };
};
var shapeChild = async (c, index, seats) => {
  const seasonXp = await getUserSeasonXp(c.id, /* @__PURE__ */ new Date());
  return {
    id: c.id,
    name: c.name,
    avatar: c.avatar,
    grade: c.grade,
    gradeSyllabus: c.gradeSyllabus,
    birthday: c.birthday ? c.birthday.toISOString().slice(0, 10) : null,
    xp: c.xp,
    seasonXp,
    level: Math.floor(seasonXp / 1e3) + 1,
    coins: c.coins,
    seatIndex: index,
    seatCovered: index < seats,
    profileCompleted: c.profileCompleted
  };
};
var familyRootFor = async (userId) => {
  const me = await db_default.user.findUnique({ where: { id: userId }, select: { id: true, parentId: true, role: true } });
  if (!me) return null;
  const rootId = me.parentId || me.id;
  return db_default.user.findUnique({ where: { id: rootId } });
};
router19.get("/", authenticateToken, async (req, res) => {
  try {
    const root = await familyRootFor(req.user.id);
    if (!root) return res.status(404).json({ error: "User not found" });
    if (root.role !== "parent") {
      return res.json({ isFamily: false, parent: null, profiles: [], activeProfileId: null, maxProfiles: MAX_PROFILES });
    }
    const children = await activeChildren(root.id);
    const profiles = await Promise.all(children.map((c, i) => shapeChild(c, i, root.subscriptionSeats)));
    res.json({
      isFamily: true,
      parent: {
        id: root.id,
        name: root.name,
        email: root.email,
        avatar: root.avatar,
        subscriptionSeats: root.subscriptionSeats,
        isSubscribed: root.isSubscribed,
        subscriptionLevel: root.subscriptionLevel,
        subscribedSyllabus: root.subscribedSyllabus,
        subscriptionEndDate: root.subscriptionEndDate,
        cancelAtPeriodEnd: root.cancelAtPeriodEnd
      },
      profiles,
      activeProfileId: req.user.act === "child" ? req.user.id : null,
      maxProfiles: MAX_PROFILES
    });
  } catch (error) {
    console.error("[FAMILY] GET error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router19.post("/setup", authenticateToken, requireParentSession, async (req, res) => {
  try {
    const current = await db_default.user.findUnique({ where: { id: req.user.id } });
    if (!current) return res.status(404).json({ error: "User not found" });
    if (current.parentId) return res.status(400).json({ error: "This is already a child profile." });
    if (current.role === "parent") return res.status(400).json({ error: "Family profiles are already set up." });
    if (current.role !== "student") return res.status(400).json({ error: "Only student accounts can be converted into family accounts." });
    const rawChildren = Array.isArray(req.body?.children) ? req.body.children : [];
    const extra = [];
    for (const raw of rawChildren) {
      const r = readChildInput(raw, true);
      if (!r.ok) return res.status(400).json({ error: r.error });
      extra.push(r.value);
    }
    if (1 + extra.length > MAX_PROFILES) {
      return res.status(400).json({ error: `A family can have at most ${MAX_PROFILES} profiles.` });
    }
    const firstName = typeof req.body?.firstProfileName === "string" && req.body.firstProfileName.trim() ? req.body.firstProfileName.trim().slice(0, 60) : current.name;
    const parentDisplayName = typeof req.body?.parentName === "string" && req.body.parentName.trim() ? req.body.parentName.trim().slice(0, 60) : current.parentName || current.name;
    const parentId = crypto3.randomUUID();
    const childPasswordHash = await bcrypt3.hash(crypto3.randomBytes(24).toString("hex"), 10);
    await db_default.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: current.id },
        data: {
          email: childEmailFor(current.id),
          name: firstName,
          referralCode: null,
          referredById: null,
          referralCreditCents: 0,
          referralRewardGranted: false,
          stripeCustomerId: null,
          isSubscribed: false,
          subscriptionInterval: null,
          subscriptionStartDate: null,
          subscriptionEndDate: null,
          subscriptionLevel: null,
          subscribedSyllabus: null,
          cancelAtPeriodEnd: false,
          isAdmin: false,
          questsPlayed: 0,
          questsCreated: 0,
          profileCompleted: true
        }
      });
      await tx.user.create({
        data: {
          id: parentId,
          email: current.email,
          password: current.password,
          name: parentDisplayName,
          role: "parent",
          parentName: current.parentName || parentDisplayName,
          parentPhone: current.parentPhone,
          parentEmail: current.parentEmail,
          children: current.children,
          profileCompleted: true,
          isVerified: true,
          isAdmin: current.isAdmin,
          createdAt: current.createdAt,
          stripeCustomerId: current.stripeCustomerId,
          isSubscribed: current.isSubscribed,
          subscriptionInterval: current.subscriptionInterval,
          subscriptionStartDate: current.subscriptionStartDate,
          subscriptionEndDate: current.subscriptionEndDate,
          subscriptionLevel: current.subscriptionLevel,
          subscribedSyllabus: current.subscribedSyllabus,
          cancelAtPeriodEnd: current.cancelAtPeriodEnd,
          subscriptionSeats: 1,
          questsPlayed: current.questsPlayed,
          questsCreated: 0,
          referralCode: current.referralCode,
          referredById: current.referredById,
          referralCreditCents: current.referralCreditCents,
          referralRewardGranted: current.referralRewardGranted,
          language: current.language,
          lastSeenSeasonId: current.lastSeenSeasonId
        }
      });
      await tx.user.update({ where: { id: current.id }, data: { parentId } });
      await tx.user.updateMany({ where: { referredById: current.id }, data: { referredById: parentId } });
      await tx.referralEarning.updateMany({ where: { referrerId: current.id }, data: { referrerId: parentId } });
      await tx.referralEarning.updateMany({ where: { referredUserId: current.id }, data: { referredUserId: parentId } });
      for (const c of extra) {
        const id = crypto3.randomUUID();
        await tx.user.create({
          data: {
            id,
            email: childEmailFor(id),
            password: childPasswordHash,
            name: c.name,
            role: "student",
            grade: c.grade,
            gradeSyllabus: c.gradeSyllabus,
            birthday: c.birthday,
            parentId,
            parentName: current.parentName || parentDisplayName,
            parentPhone: current.parentPhone,
            parentEmail: current.parentEmail,
            isVerified: true,
            profileCompleted: true,
            language: current.language
          }
        });
      }
    });
    const token = jwt5.sign({ id: parentId, role: "parent" }, JWT_SECRET2, { expiresIn: "7d" });
    console.log(`[FAMILY] Converted ${current.email} into a parent account with ${1 + extra.length} profile(s)`);
    res.json({ token, parentId, profiles: 1 + extra.length });
  } catch (error) {
    console.error("[FAMILY] setup error:", error);
    res.status(500).json({ error: "Could not set up family profiles" });
  }
});
var requireParentAccount = async (req, res, next) => {
  const me = await db_default.user.findUnique({ where: { id: req.user.id }, select: { role: true } });
  if (!me || me.role !== "parent") return res.status(403).json({ error: "Family profiles are not set up on this account." });
  next();
};
router19.post("/children", authenticateToken, requireParentSession, requireParentAccount, async (req, res) => {
  try {
    const parentId = req.user.id;
    const r = readChildInput(req.body, true);
    if (!r.ok) return res.status(400).json({ error: r.error });
    const count = await db_default.user.count({ where: { parentId, archivedAt: null } });
    if (count >= MAX_PROFILES) return res.status(400).json({ error: `A family can have at most ${MAX_PROFILES} profiles.` });
    const parent = await db_default.user.findUnique({ where: { id: parentId } });
    const id = crypto3.randomUUID();
    const created = await db_default.user.create({
      data: {
        id,
        email: childEmailFor(id),
        password: await bcrypt3.hash(crypto3.randomBytes(24).toString("hex"), 10),
        name: r.value.name,
        role: "student",
        grade: r.value.grade,
        gradeSyllabus: r.value.gradeSyllabus,
        birthday: r.value.birthday,
        parentId,
        parentName: parent?.parentName || parent?.name,
        parentPhone: parent?.parentPhone,
        parentEmail: parent?.parentEmail,
        isVerified: true,
        profileCompleted: true,
        language: parent?.language
      }
    });
    const children = await activeChildren(parentId);
    const index = children.findIndex((c) => c.id === created.id);
    res.json(await shapeChild(children[index], index, parent?.subscriptionSeats ?? 1));
  } catch (error) {
    console.error("[FAMILY] add child error:", error);
    res.status(500).json({ error: "Could not add profile" });
  }
});
router19.put("/children/:id", authenticateToken, requireParentSession, requireParentAccount, async (req, res) => {
  try {
    const parentId = req.user.id;
    const child = await db_default.user.findFirst({ where: { id: req.params.id, parentId, archivedAt: null } });
    if (!child) return res.status(404).json({ error: "Profile not found" });
    const data = {};
    if (req.body?.name !== void 0) {
      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      if (!name) return res.status(400).json({ error: "Name cannot be empty." });
      data.name = name.slice(0, 60);
    }
    if (req.body?.avatar !== void 0) {
      const avatar = req.body.avatar;
      if (avatar !== null) {
        if (typeof avatar !== "string" || !avatar.startsWith("data:")) return res.status(400).json({ error: "Avatar must be a data URL image" });
        if (avatar.length > 4e5) return res.status(400).json({ error: "Avatar image is too large." });
      }
      data.avatar = avatar;
    }
    if (req.body?.gradeSyllabus !== void 0 || req.body?.grade !== void 0) {
      const syllabus = req.body.gradeSyllabus ?? child.gradeSyllabus;
      const grade = req.body.grade ?? child.grade;
      if (syllabus && !isValidSyllabus(syllabus)) return res.status(400).json({ error: "Unknown syllabus." });
      if (grade && (!syllabus || !isValidGradeForSyllabus(syllabus, grade))) {
        return res.status(400).json({ error: `${grade} is not a valid grade for ${syllabus || "this syllabus"}.` });
      }
      data.gradeSyllabus = syllabus || null;
      data.grade = grade || null;
    }
    if (req.body?.birthday !== void 0 && req.body.birthday !== "" && req.body.birthday !== null) {
      if (child.birthday) return res.status(400).json({ error: "Date of birth cannot be changed once set." });
      const b = parseBirthday3(req.body.birthday);
      if (!b) return res.status(400).json({ error: "Invalid date of birth." });
      data.birthday = b;
    }
    await db_default.user.update({ where: { id: child.id }, data });
    const parent = await db_default.user.findUnique({ where: { id: parentId }, select: { subscriptionSeats: true } });
    const children = await activeChildren(parentId);
    const index = children.findIndex((c) => c.id === child.id);
    res.json(await shapeChild(children[index], index, parent?.subscriptionSeats ?? 1));
  } catch (error) {
    console.error("[FAMILY] edit child error:", error);
    res.status(500).json({ error: "Could not update profile" });
  }
});
router19.delete("/children/:id", authenticateToken, requireParentSession, requireParentAccount, async (req, res) => {
  try {
    const parentId = req.user.id;
    const child = await db_default.user.findFirst({ where: { id: req.params.id, parentId, archivedAt: null } });
    if (!child) return res.status(404).json({ error: "Profile not found" });
    const count = await db_default.user.count({ where: { parentId, archivedAt: null } });
    if (count <= 1) return res.status(400).json({ error: "A family needs at least one profile." });
    await db_default.user.update({ where: { id: child.id }, data: { archivedAt: /* @__PURE__ */ new Date() } });
    res.json({ success: true });
  } catch (error) {
    console.error("[FAMILY] archive child error:", error);
    res.status(500).json({ error: "Could not remove profile" });
  }
});
router19.post("/switch/:id", authenticateToken, requireParentSession, requireParentAccount, async (req, res) => {
  try {
    const parentId = req.user.id;
    const child = await db_default.user.findFirst({
      where: { id: req.params.id, parentId, archivedAt: null },
      select: { id: true, name: true }
    });
    if (!child) return res.status(404).json({ error: "Profile not found" });
    const token = jwt5.sign({ id: child.id, role: "student", parentId, act: "child" }, JWT_SECRET2, { expiresIn: "7d" });
    res.json({ token, profileId: child.id, name: child.name });
  } catch (error) {
    console.error("[FAMILY] switch error:", error);
    res.status(500).json({ error: "Could not switch profile" });
  }
});
var family_default = router19;

// api/index.ts
dotenv2.config();
var envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv2.config({ path: envLocalPath, override: true });
}
var key = process.env.GEMINI_API_KEY || "";
console.log(`[BOOT] GEMINI_API_KEY loaded. Ending in: "...${key.substring(key.length - 6)}"`);
var app = express20();
console.log("[VERCEL] Starting serverless function...");
app.use(cors());
app.use("/api/webhooks", webhooks_default);
app.use(express20.json({ limit: "150mb" }));
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});
app.use("/api/auth", auth_default);
app.use("/api/quests", quests_default);
app.use("/api/results", results_default);
app.use("/api/subscription", subscription_default);
app.use("/api/generate", generation_default);
app.use("/api/test", test_default);
app.use("/api/admin", admin_default);
app.use("/api/rewards", rewards_default);
app.use("/api/question-bank", questionBank_default);
app.use("/api/paper-files", paperFiles_default);
app.use("/api/study-plans", studyPlans_default);
app.use("/api/classrooms", classrooms_default);
app.use("/api/assignments", assignments_default);
app.use("/api/leaderboard", leaderboard_default);
app.use("/api/profile", profile_default);
app.use("/api/seasons", seasons_default);
app.use("/api/polls", polls_default);
app.use("/api/family", family_default);
app.get("/api/geolocation", async (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.headers["x-real-ip"];
    const apiUrl = ip ? `https://freeipapi.com/api/json/${ip}` : "https://freeipapi.com/api/json";
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`Geolocation API returned ${response.status}`);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(200).json({ countryCode: "MY", countryName: "Malaysia" });
  }
});
app.get("/api", (req, res) => {
  res.send("Akshara LearnQuest API is running");
});
var index_default = app;
export {
  index_default as default
};
