import { describe, expect, it } from 'vitest';
import { COURSE360_PRICES, course360StripeCents, course360AnnualSavings } from '../shared/course360Pricing';
import { PLAN_LIMITS } from './stripePlans';

const approved = [
  ['starter',39.97,399.97], ['builder',99.97,999.97], ['pro',199.97,1999.97],
  ['studio_web',39.97,299.97], ['studio_desktop',49.97,399.97], ['studio_bundle',69.97,599.97],
  ['creator_web',99.97,899.97], ['creator_desktop',119.97,999.97], ['creator_bundle',149.97,1299.97],
  ['quiz_creator_web',39.97,299.97], ['quiz_creator_desktop',49.97,399.97], ['quiz_creator_bundle',69.97,599.97],
] as const;

describe('owner-approved Course360 dollar catalog', () => {
  it.each(approved)('%s keeps exact approved monthly and annual dollars', (key,monthly,annual) => {
    expect(COURSE360_PRICES[key].monthly).toBe(monthly);
    expect(COURSE360_PRICES[key].annual).toBe(annual);
    expect(course360StripeCents(monthly)).toBe(Number(monthly.toFixed(2).replace('.','')));
    expect(course360StripeCents(annual)).toBe(Number(annual.toFixed(2).replace('.','')));
    const saving = course360AnnualSavings(key);
    expect(saving.amount).toBe((course360StripeCents(monthly)*12-course360StripeCents(annual))/100);
    expect(saving.effectiveMonthly).toBe(annual/12);
  });
  it('preserves existing Free accounts and Pro-only white label', () => {
    expect(PLAN_LIMITS.free.monthlyPrice).toBe(0);
    expect(PLAN_LIMITS.builder.whiteLabel).toBe(false);
    expect(PLAN_LIMITS.pro.whiteLabel).toBe(true);
    for(const key of ['starter','builder','pro'] as const) {
      expect(PLAN_LIMITS[key].monthlyPrice).toBe(course360StripeCents(COURSE360_PRICES[key].monthly));
      expect(PLAN_LIMITS[key].annualPrice).toBe(course360StripeCents(COURSE360_PRICES[key].annual));
    }
  });
  it.each([NaN,Infinity,-1,1.001,Number.MAX_VALUE])('rejects invalid boundary amount %s', value => {
    expect(()=>course360StripeCents(value)).toThrow();
  });
  it('accepts ordinary zero and whole-dollar values at the boundary', () => {
    expect(course360StripeCents(0)).toBe(0);
    expect(course360StripeCents(2)).toBe(200);
  });
});
