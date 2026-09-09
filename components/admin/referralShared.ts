// Types and helpers shared by the admin Referrals report and the Referral Tiers settings tab.

export interface Tier {
    minCount: number;
    maxCount: number | null;
    amountCents: number;
    splitMonths: number;
}

export interface AdminTokenProps {
    token: string;
}

export const rm = (cents: number) => `RM${(cents / 100).toFixed(2)}`;
