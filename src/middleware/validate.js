const HttpError = require('../utils/httpError');
function requiredString(value, field, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new HttpError(400, `${field} is required and must be at most ${max} characters`);
  return value.trim();
}
module.exports = { requiredString };
