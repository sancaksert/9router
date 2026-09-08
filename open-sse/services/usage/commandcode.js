/**
<<<<<<< HEAD
 * Command Code usage — billing credits + 5h/weekly rate windows.
 * Mirrors ~/cc-usage.mjs: whoami → credits + subscriptions.
=======
 * Command Code usage — undocumented endpoints the official CLI uses for its
 * /usage overlay (extracted from dist/cli.mjs v1.39.3):
 * GET /alpha/billing/credits + /alpha/usage/summary + /alpha/billing/subscriptions
 * Auth: Bearer <apiKey> (key starts with user_...)
>>>>>>> de0c2f6f (feat(usage): CommandCode real quota tracking (5h/weekly/monthly))
 */

import { proxyAwareFetch } from "../../utils/proxyFetch.js";
import { parseResetTime, toFiniteNumber } from "./shared.js";

<<<<<<< HEAD
const BASE = (process.env.COMMAND_CODE_API_BASE_URL || "https://api.commandcode.ai").replace(/\/$/, "");

const PLAN_NAMES = {
  "individual-go": "Go",
  "individual-goat": "GOAT",
  "individual-pro": "Pro",
  "individual-pro-v1": "Pro",
  "individual-provider": "Provider",
  "individual-max": "Max",
  "individual-ultra": "Ultra",
  "teams-pro": "Teams Pro",
};

const PLAN_CAPS = {
  "individual-go": 10,
  "individual-goat": 70,
  "individual-pro": 30,
  "individual-pro-v1": 80,
  "individual-provider": 15,
  "individual-max": 150,
  "individual-ultra": 300,
  "teams-pro": 40,
};

function qs(route, params) {
  const s = new URLSearchParams(
    Object.entries(params || {}).filter(([, v]) => v != null),
  ).toString();
  return s ? `${route}?${s}` : route;
}

function windowQuota(win) {
  if (!win || typeof win !== "object") return null;
  const used = toFiniteNumber(win.used, 0);
  const total = toFiniteNumber(win.cap, 0);
  if (total <= 0 && used <= 0) return null;
  return {
    used,
    total,
    remaining: Math.max(0, total - used),
    unlimited: false,
    resetAt: parseResetTime(win.resetAt),
  };
}

/**
 * @param {string|null|undefined} apiKey
 * @param {object|null} proxyOptions
 */
export async function getCommandCodeUsage(apiKey, proxyOptions = null) {
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
    return { message: "Command Code API key not available. Add a key to view usage." };
  }

  const headers = {
    Authorization: `Bearer ${apiKey.trim()}`,
    Accept: "application/json",
  };

  const get = async (route) => {
    const response = await proxyAwareFetch(
      BASE + route,
      { method: "GET", headers },
      proxyOptions,
    );
    return response;
  };

  try {
    const whoamiRes = await get(qs("/alpha/whoami", { limits: "1" }));
    if (whoamiRes.status === 401 || whoamiRes.status === 403) {
      return { plan: "Command Code", message: "Command Code authentication failed. Check the API key." };
    }
    if (!whoamiRes.ok) {
      return { plan: "Command Code", message: `Command Code usage API error (${whoamiRes.status})` };
    }
    const whoami = await whoamiRes.json().catch(() => ({}));
    const orgId = whoami?.org?.id ?? null;

    const [creditsRes, subsRes] = await Promise.all([
      get(qs("/alpha/billing/credits", { orgId })),
      get(qs("/alpha/billing/subscriptions", { orgId })),
    ]);

    if (creditsRes.status === 401 || creditsRes.status === 403 || subsRes.status === 401 || subsRes.status === 403) {
      return { plan: "Command Code", message: "Command Code authentication failed. Check the API key." };
    }
    if (!creditsRes.ok) {
      return { plan: "Command Code", message: `Command Code credits API error (${creditsRes.status})` };
    }
    if (!subsRes.ok) {
      return { plan: "Command Code", message: `Command Code subscriptions API error (${subsRes.status})` };
    }

    const creditsBody = await creditsRes.json().catch(() => ({}));
    const subsBody = await subsRes.json().catch(() => ({}));
    const planId = subsBody?.data?.planId ?? null;
    const plan = (planId && PLAN_NAMES[planId]) || planId || "Command Code";
    const cap = planId ? (PLAN_CAPS[planId] || 0) : 0;
    const c = creditsBody?.credits || {};
    const remaining =
      toFiniteNumber(c.monthlyCredits, 0) +
      toFiniteNumber(c.purchasedCredits, 0) +
      toFiniteNumber(c.freeCredits, 0);
    const used = cap > 0 ? Math.max(0, cap - remaining) : 0;
    const total = cap > 0 ? cap : remaining;

    const quotas = {};
    quotas.Credits = {
      used,
      total,
      remaining,
      unlimited: cap <= 0,
      resetAt: parseResetTime(subsBody?.data?.currentPeriodEnd),
    };

    const fiveHour = windowQuota(creditsBody?.windowLimits?.fiveHour);
    if (fiveHour) quotas["Session (5h)"] = fiveHour;
    const weekly = windowQuota(creditsBody?.windowLimits?.weekly);
    if (weekly) quotas.Weekly = weekly;

    return { plan, quotas };
  } catch (error) {
    return { message: `Command Code error: ${error.message}` };
=======
const COMMANDCODE_BASE = "https://api.commandcode.ai";
const COMMANDCODE_HEADERS = {
  "User-Agent": "cli",
  "x-cli-environment": "production",
  "x-command-code-version": "1.39.3",
};

async function commandCodeGet(path, apiKey, proxyOptions) {
  const response = await proxyAwareFetch(`${COMMANDCODE_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...COMMANDCODE_HEADERS,
    },
  }, proxyOptions);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json().catch(() => null);
}

function commandCodeWindow(name, w) {
  if (!w || typeof w !== "object") return null;
  const total = toFiniteNumber(w.cap, 0);
  if (total <= 0) return null;
  return {
    // resetAt 0 = window idle → null hides the countdown instead of lying.
    used: toFiniteNumber(w.used, 0),
    total,
    resetAt: w.resetAt ? parseResetTime(w.resetAt) : null,
  };
}

export async function getCommandCodeUsage(apiKey = null, proxyOptions = null) {
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
    return { message: "Command Code API key not available." };
  }

  try {
    const credits = await commandCodeGet("/alpha/billing/credits", apiKey.trim(), proxyOptions);
    // Best-effort extras: without summary there is no Monthly cap to show.
    const [summary, subscription] = await Promise.all([
      commandCodeGet("/alpha/usage/summary", apiKey.trim(), proxyOptions).catch(() => null),
      commandCodeGet("/alpha/billing/subscriptions", apiKey.trim(), proxyOptions).catch(() => null),
    ]);

    const quotas = {};
    const windows = credits?.windowLimits || {};
    const fiveHour = commandCodeWindow("5-hour", windows.fiveHour);
    const weekly = commandCodeWindow("Weekly", windows.weekly);
    if (fiveHour) quotas["5-hour"] = fiveHour;
    if (weekly) quotas["Weekly"] = weekly;

    // monthlyCredits is REMAINING, not a cap. No cap is exposed upstream, so
    // the Monthly row is reconstructed as remaining + spent-in-period.
    const monthlyRemaining = toFiniteNumber(credits?.credits?.monthlyCredits, -1);
    const spent = toFiniteNumber(summary?.totalCost, 0);
    if (monthlyRemaining >= 0 && spent > 0) {
      quotas["Monthly"] = {
        used: spent,
        total: monthlyRemaining + spent,
        resetAt: parseResetTime(subscription?.data?.currentPeriodEnd) || null,
      };
    }

    if (Object.keys(quotas).length === 0) {
      return { plan: "Command Code", message: "Command Code connected. No quota data reported." };
    }

    return { plan: "Command Code", quotas };
  } catch (error) {
    if (error.message === "HTTP 401") {
      return { message: "Command Code API key invalid or expired." };
    }
    return { message: `Command Code connected. Unable to fetch usage: ${error.message}` };
>>>>>>> de0c2f6f (feat(usage): CommandCode real quota tracking (5h/weekly/monthly))
  }
}
