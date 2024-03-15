// utils
export const formatPrice = (cents, options = {}) => {
  if (cents == null || isNaN(cents)) return "n/a";
  const minDigits = options.minDigits ?? 2;
  return cents > 100
    ? `$${(cents / 100).toFixed(minDigits)}`
    : `¢${cents.toFixed(
      cents > 0.01 || cents === 0
        ? minDigits
        : Math.min(
          Math.max(0, Math.min(-Math.floor(Math.log10(cents))), minDigits - 2),
          100
        )
    )}`;
};

export const parseSqArray = (obj) => {
  if (Array.isArray(obj)) return obj; // this happens on subsequent sqUpdate calls

  const arr = new Array(
    Math.max(
      0,
      Math.max(
        ...Object.keys(obj)
          .map((k) => parseInt(k))
          .filter((i) => !isNaN(i))
      )
    )
  );
  for (const [k, v] of Object.entries(obj)) {
    if (!isNaN(parseInt(k))) arr[k - 1] = v;
  }
  return arr;
};
