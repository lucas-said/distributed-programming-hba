/**
 * Implements Task 3's fare formula:
 *
 *   Total = cab_fare × cab_multiplier × daytime_multiplier × passengers_multiplier × discount
 *
 * This module is deliberately a pure function: no I/O, no database calls,
 * no logging. That makes it trivially unit-testable and keeps the
 * route/event glue separate from the business rule.
 */

export const CAB_MULTIPLIERS = {
  Economic:  1,
  Premium:   1.2,
  Executive: 1.4,
};

/**
 * Daytime multiplier per Task 3:
 *   Between 8:00 AM and 11:59 PM -> 1
 *   Between 12:00 AM and 8:00 AM -> 1.2
 *
 * We use UTC for predictability. The frontend should send dateTime as an
 * ISO string with explicit timezone so the user's intended local time is
 * preserved on the wire.
 */
function daytimeMultiplier(dateTime) {
  const hour = new Date(dateTime).getUTCHours();
  return hour >= 0 && hour < 8 ? 1.2 : 1;
}

/**
 * Passenger multiplier per Task 3:
 *   1-4 -> 1
 *   5-8 -> 2
 *   > 8 -> NOT ALLOWED (we throw rather than return a magic value)
 */
function passengersMultiplier(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('numberOfPassengers must be a positive integer');
  }
  if (n > 8) {
    throw new Error('numberOfPassengers > 8 is not allowed');
  }
  return n <= 4 ? 1 : 2;
}

/**
 * Round to 2 decimal places. Pricing is currency, decimals matter.
 */
function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Compute the price breakdown.
 *
 * @param {object} input
 * @param {number} input.cab_fare           - From the Fare service
 * @param {string} input.cabType            - "Economic" | "Premium" | "Executive"
 * @param {string|Date} input.dateTime      - When the ride is scheduled
 * @param {number} input.numberOfPassengers - 1..8
 * @param {number} [input.discount=1]       - 1 = no discount, 0.9 = 10% off etc.
 *
 * @returns {object} breakdown including total
 *
 * @throws {Error} when inputs violate Task 3 rules
 */
export function calculatePrice({
  cab_fare,
  cabType,
  dateTime,
  numberOfPassengers,
  discount = 1,
}) {
  if (!Number.isFinite(cab_fare) || cab_fare < 0) {
    throw new Error('cab_fare must be a non-negative number');
  }

  const cab_multiplier = CAB_MULTIPLIERS[cabType];
  if (cab_multiplier === undefined) {
    throw new Error(`Unknown cabType "${cabType}"`);
  }

  const daytime_multiplier    = daytimeMultiplier(dateTime);
  const passengers_multiplier = passengersMultiplier(numberOfPassengers);

  if (!Number.isFinite(discount) || discount <= 0 || discount > 1) {
    // discount > 1 would mean a *surcharge*, which would be a bug.
    throw new Error('discount must be a positive number <= 1');
  }

  const total =
    cab_fare *
    cab_multiplier *
    daytime_multiplier *
    passengers_multiplier *
    discount;

  return {
    cab_fare:              round2(cab_fare),
    cab_multiplier,
    daytime_multiplier,
    passengers_multiplier,
    discount,
    total: round2(total),
  };
}
