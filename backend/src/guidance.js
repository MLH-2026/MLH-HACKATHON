import { ApiError } from './errors.js';

export const guidanceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['observation', 'message', 'needs_more_context', 'context_question'],
  properties: {
    observation: { type: 'string', minLength: 1, maxLength: 1200 },
    message: { type: 'string', minLength: 1, maxLength: 6000 },
    needs_more_context: { type: 'boolean' },
    context_question: { anyOf: [{ type: 'string', maxLength: 500 }, { type: 'null' }] },
  },
};

export function validateGuidance(value) {
  const fail = () => { throw new ApiError(502, 'gemini_invalid_response', 'Gemini returned invalid guidance. Please try again.'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  const keys = Object.keys(value);
  if (keys.length !== 4 || guidanceSchema.required.some(key => !Object.hasOwn(value, key))) fail();
  for (const [field, max] of [['observation', 1200], ['message', 6000]]) {
    if (typeof value[field] !== 'string' || !value[field].trim() || value[field].trim().length > max) fail();
  }
  if (typeof value.needs_more_context !== 'boolean') fail();
  if (value.needs_more_context) {
    if (typeof value.context_question !== 'string' || !value.context_question.trim() || value.context_question.trim().length > 500) fail();
  } else if (value.context_question !== null) fail();
  return {
    observation: value.observation.trim(),
    message: value.message.trim(),
    needs_more_context: value.needs_more_context,
    context_question: value.context_question?.trim() ?? null,
  };
}
