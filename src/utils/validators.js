// Validation helpers

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export const validateGSTIN = (gstin) => {
  const re = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
  return re.test(gstin)
}

export const validatePhone = (phone) => {
  const re = /^[6-9][0-9]{9}$/
  return re.test(phone)
}

export const validatePassword = (password) => {
  return password && password.length >= 6
}

export const validateSignupForm = (data) => {
  const errors = {}
  if (!data.shopName?.trim()) errors.shopName = 'Shop name is required'
  if (!validateGSTIN(data.gstin)) errors.gstin = 'Invalid GSTIN format (e.g. 27ABCDE1234F1Z5)'
  if (!validatePhone(data.mobile)) errors.mobile = 'Enter a valid 10-digit mobile number'
  if (!validateEmail(data.email)) errors.email = 'Enter a valid email address'
  if (!validatePassword(data.password)) errors.password = 'Password must be at least 6 characters'
  if (data.password !== data.confirmPassword) errors.confirmPassword = 'Passwords do not match'
  return errors
}

export const validateLoginForm = (data) => {
  const errors = {}
  if (!validateEmail(data.email)) errors.email = 'Enter a valid email address'
  if (!data.password) errors.password = 'Password is required'
  return errors
}
