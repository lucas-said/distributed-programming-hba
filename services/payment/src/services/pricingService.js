export const CAB_MULTIPLIERS = {
  Economic:  1,
  Premium:   1.2,
  Executive: 1.4,
};

function daytimeMultiplier(dateTime) {
  const hour = new Date(dateTime).getUTCHours();
  return hour >= 0 && hour < 8 ? 1.2 : 1;
}

function passengersMultiplier(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('numberOfPassengers must be a positive integer');
  }
  if (n > 8) {
    throw new Error('numberOfPassengers > 8 is not allowed');
  }
  return n <= 4 ? 1 : 2;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

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
