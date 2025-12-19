export function isValidName(str) {
  return /^[A-Za-z ]{2,}$/.test(str);
}

export function isValidCityOrState(str) {
  return /^[A-Za-z ]{2,}$/.test(str);
}

export function isSequential(str) {
  const nums = str.split("").map(Number);
  let asc = true, desc = true;

  for (let i = 1; i < nums.length; i++) {
    if (nums[i] !== nums[i - 1] + 1) asc = false;
    if (nums[i] !== nums[i - 1] - 1) desc = false;
  }
  return asc || desc;
}

export function isValidPhone(str) {
  return (
    /^[6-9]\d{9}$/.test(str) &&
    !/^(\d)\1{9}$/.test(str) &&
    !isSequential(str)
  );
}

export function isValidPincode(str) {
  return (
    /^\d{6}$/.test(str) &&
    !/^(\d)\1{5}$/.test(str) &&
    !isSequential(str)
  );
}
