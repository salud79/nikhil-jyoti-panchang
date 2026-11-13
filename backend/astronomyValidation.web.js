// Wix Backend → astronomyValidation.web.js
// दोनों कार्य केवल Wix साइट व्यवस्थापक चला सकते हैं।
import { Permissions, webMethod } from 'wix-web-module';
import { validateAstronomy, validateAstronomyBatch } from './astronomyValidation';

export const runAstronomyValidation = webMethod(
  Permissions.Admin,
  async (options = {}, reference = {}) => validateAstronomy(options, reference)
);

export const runAstronomyBatchValidation = webMethod(
  Permissions.Admin,
  async (cases) => validateAstronomyBatch(cases)
);
