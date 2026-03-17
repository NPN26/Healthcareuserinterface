/**
 * Comprehensive Input Validation and Sanitization Utility
 * Prevents SQL injection, XSS, command injection, and unsafe file uploads
 */

// ============================================================================
// CONSTANTS AND PATTERNS
// ============================================================================

// Strict patterns for validation
const PATTERNS = {
  // Email: RFC 5322 compliant (simplified)
  EMAIL: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/,

  // Name: letters, spaces, hyphens, apostrophes only (supports international names)
  NAME: /^[\p{L}\p{M}'\-\s]{1,100}$/u,

  // Phone: digits, spaces, plus, hyphens, parentheses
  PHONE: /^[\d\s+\-()]{7,20}$/,

  // Alphanumeric with common punctuation (for device names, titles)
  ALPHANUMERIC_EXTENDED: /^[\p{L}\p{N}\s\-_.,!?()'"]{1,200}$/u,

  // UUID v4 pattern
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,

  // Date patterns
  DATE_ISO: /^\d{4}-\d{2}-\d{2}$/,
  DATETIME_LOCAL: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,

  // Numeric (includes decimals and negatives)
  NUMERIC: /^-?\d+(\.\d+)?$/,

  // Integer only
  INTEGER: /^-?\d+$/,

  // Positive integer only
  POSITIVE_INTEGER: /^\d+$/,
} as const;

// Dangerous patterns to detect and block
const DANGEROUS_PATTERNS = {
  // SQL injection patterns
  SQL_INJECTION: [
    /('|"|;|--|\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b)/i,
    /(\bOR\b|\bAND\b)\s*['"]?\s*\d+\s*['"]?\s*=\s*['"]?\s*\d+/i,
    /'\s*(OR|AND)\s*'[^']*'\s*[=<>]/i,
    /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP)/i,
  ],

  // Command injection patterns
  COMMAND_INJECTION: [
    /[;&|`$(){}[\]<>\\]/,
    /\b(sudo|rm|chmod|chown|kill|eval|exec|system)\b/i,
    /\$\([^)]*\)/,
    /`[^`]*`/,
  ],

  // Script injection / XSS patterns
  XSS: [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /<[\s\S]*?on\w+\s*=/gi,
    /javascript:/gi,
    /data:\s*text\/html/gi,
    /<iframe[\s\S]*?>/gi,
    /<object[\s\S]*?>/gi,
    /<embed[\s\S]*?>/gi,
    /<link[\s\S]*?>/gi,
    /<style[\s\S]*?>[\s\S]*?<\/style>/gi,
    /expression\s*\(/gi,
    /url\s*\(\s*['"]?\s*javascript:/gi,
  ],

  // Path traversal patterns
  PATH_TRAVERSAL: [
    /\.\.\//g,
    /\.\.%2[fF]/g,
    /%2e%2e%2f/gi,
    /\.\.%5c/gi,
  ],
} as const;

// Allowed file types for uploads
const ALLOWED_FILE_TYPES = {
  images: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  documents: {
    mimeTypes: ['application/pdf', 'text/plain'],
    extensions: ['.pdf', '.txt'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  healthData: {
    mimeTypes: ['application/json', 'text/csv', 'text/plain'],
    extensions: ['.json', '.csv', '.txt'],
    maxSize: 2 * 1024 * 1024, // 2MB
  },
} as const;

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

/**
 * HTML entity encoding to prevent XSS
 */
export function escapeHtml(input: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };

  return input.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Remove all HTML tags from input
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize text input - removes dangerous patterns and normalizes whitespace
 */
export function sanitizeText(input: string, options: {
  maxLength?: number;
  allowNewlines?: boolean;
  escapeHtml?: boolean;
} = {}): string {
  const { maxLength = 1000, allowNewlines = false, escapeHtml: shouldEscape = true } = options;

  let sanitized = input.trim();

  // Remove null bytes and control characters (except newlines/tabs if allowed)
  if (allowNewlines) {
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  } else {
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, ' ');
  }

  // Normalize whitespace
  sanitized = allowNewlines
    ? sanitized.replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    : sanitized.replace(/\s+/g, ' ');

  // Escape HTML if requested
  if (shouldEscape) {
    sanitized = escapeHtml(sanitized);
  }

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize name input - letters, spaces, hyphens, apostrophes only
 */
export function sanitizeName(input: string): string {
  let sanitized = input.trim();

  // Remove any characters that aren't letters, spaces, hyphens, or apostrophes
  sanitized = sanitized.replace(/[^\p{L}\p{M}'\-\s]/gu, '');

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Limit length
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }

  return sanitized;
}

/**
 * Sanitize email input
 */
export function sanitizeEmail(input: string): string {
  return input.trim().toLowerCase().substring(0, 254);
}

/**
 * Sanitize phone number
 */
export function sanitizePhone(input: string): string {
  // Keep only digits, plus, hyphens, parentheses, and spaces
  let sanitized = input.replace(/[^\d\s+\-()]/g, '');
  return sanitized.substring(0, 20);
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(input: string | number): number | null {
  const str = String(input).trim();

  if (!PATTERNS.NUMERIC.test(str)) {
    return null;
  }

  const num = parseFloat(str);

  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  return num;
}

/**
 * Sanitize integer input
 */
export function sanitizeInteger(input: string | number): number | null {
  const num = sanitizeNumber(input);

  if (num === null) {
    return null;
  }

  return Math.floor(num);
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue?: string | number;
}

/**
 * Check for dangerous patterns (SQL injection, XSS, command injection)
 */
export function containsDangerousPatterns(input: string): { dangerous: boolean; type?: string } {
  for (const pattern of DANGEROUS_PATTERNS.SQL_INJECTION) {
    if (pattern.test(input)) {
      return { dangerous: true, type: 'SQL injection attempt detected' };
    }
  }

  for (const pattern of DANGEROUS_PATTERNS.COMMAND_INJECTION) {
    if (pattern.test(input)) {
      return { dangerous: true, type: 'Command injection attempt detected' };
    }
  }

  for (const pattern of DANGEROUS_PATTERNS.XSS) {
    if (pattern.test(input)) {
      return { dangerous: true, type: 'Script injection attempt detected' };
    }
  }

  for (const pattern of DANGEROUS_PATTERNS.PATH_TRAVERSAL) {
    if (pattern.test(input)) {
      return { dangerous: true, type: 'Path traversal attempt detected' };
    }
  }

  return { dangerous: false };
}

/**
 * Validate email address
 */
export function validateEmail(input: string): ValidationResult {
  const sanitized = sanitizeEmail(input);

  if (!sanitized) {
    return { isValid: false, error: 'Email is required' };
  }

  if (sanitized.length > 254) {
    return { isValid: false, error: 'Email is too long' };
  }

  if (!PATTERNS.EMAIL.test(sanitized)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  const dangerCheck = containsDangerousPatterns(sanitized);
  if (dangerCheck.dangerous) {
    return { isValid: false, error: dangerCheck.type };
  }

  return { isValid: true, sanitizedValue: sanitized };
}

/**
 * Validate name (person's name)
 */
export function validateName(input: string, options: {
  minLength?: number;
  maxLength?: number;
  required?: boolean;
} = {}): ValidationResult {
  const { minLength = 1, maxLength = 100, required = true } = options;

  const sanitized = sanitizeName(input);

  if (!sanitized && required) {
    return { isValid: false, error: 'Name is required' };
  }

  if (!sanitized && !required) {
    return { isValid: true, sanitizedValue: '' };
  }

  if (sanitized.length < minLength) {
    return { isValid: false, error: `Name must be at least ${minLength} characters` };
  }

  if (sanitized.length > maxLength) {
    return { isValid: false, error: `Name must be less than ${maxLength} characters` };
  }

  if (!PATTERNS.NAME.test(sanitized)) {
    return { isValid: false, error: 'Name contains invalid characters' };
  }

  return { isValid: true, sanitizedValue: sanitized };
}

/**
 * Validate phone number
 */
export function validatePhone(input: string, options: {
  required?: boolean;
} = {}): ValidationResult {
  const { required = false } = options;

  const sanitized = sanitizePhone(input);

  if (!sanitized && required) {
    return { isValid: false, error: 'Phone number is required' };
  }

  if (!sanitized && !required) {
    return { isValid: true, sanitizedValue: '' };
  }

  if (!PATTERNS.PHONE.test(sanitized)) {
    return { isValid: false, error: 'Invalid phone number format' };
  }

  if (sanitized.replace(/\D/g, '').length < 7) {
    return { isValid: false, error: 'Phone number is too short' };
  }

  return { isValid: true, sanitizedValue: sanitized };
}

/**
 * Validate password with configurable requirements
 */
export function validatePassword(input: string, options: {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumber?: boolean;
  requireSpecial?: boolean;
} = {}): ValidationResult {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumber = true,
    requireSpecial = true,
  } = options;

  if (!input) {
    return { isValid: false, error: 'Password is required' };
  }

  if (input.length < minLength) {
    return { isValid: false, error: `Password must be at least ${minLength} characters` };
  }

  if (input.length > 128) {
    return { isValid: false, error: 'Password is too long' };
  }

  if (requireUppercase && !/[A-Z]/.test(input)) {
    return { isValid: false, error: 'Password must contain at least one uppercase letter' };
  }

  if (requireLowercase && !/[a-z]/.test(input)) {
    return { isValid: false, error: 'Password must contain at least one lowercase letter' };
  }

  if (requireNumber && !/\d/.test(input)) {
    return { isValid: false, error: 'Password must contain at least one number' };
  }

  if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(input)) {
    return { isValid: false, error: 'Password must contain at least one special character' };
  }

  return { isValid: true };
}

/**
 * Validate numeric input with range
 */
export function validateNumber(input: string | number, options: {
  min?: number;
  max?: number;
  required?: boolean;
  allowDecimal?: boolean;
} = {}): ValidationResult {
  const { min, max, required = true, allowDecimal = true } = options;

  const sanitized = allowDecimal ? sanitizeNumber(input) : sanitizeInteger(input);

  if (sanitized === null) {
    if (required) {
      return { isValid: false, error: 'A valid number is required' };
    }
    return { isValid: true, sanitizedValue: undefined };
  }

  if (min !== undefined && sanitized < min) {
    return { isValid: false, error: `Value must be at least ${min}` };
  }

  if (max !== undefined && sanitized > max) {
    return { isValid: false, error: `Value must be at most ${max}` };
  }

  return { isValid: true, sanitizedValue: sanitized };
}

/**
 * Validate text input with length and content restrictions
 */
export function validateText(input: string, options: {
  minLength?: number;
  maxLength?: number;
  required?: boolean;
  allowNewlines?: boolean;
  allowHtml?: boolean;
  pattern?: RegExp;
  patternError?: string;
} = {}): ValidationResult {
  const {
    minLength = 0,
    maxLength = 1000,
    required = false,
    allowNewlines = false,
    allowHtml = false,
    pattern,
    patternError,
  } = options;

  const sanitized = sanitizeText(input, {
    maxLength,
    allowNewlines,
    escapeHtml: !allowHtml,
  });

  // Check for dangerous patterns on original input
  const dangerCheck = containsDangerousPatterns(input);
  if (dangerCheck.dangerous) {
    return { isValid: false, error: dangerCheck.type };
  }

  if (!sanitized && required) {
    return { isValid: false, error: 'This field is required' };
  }

  if (!sanitized && !required) {
    return { isValid: true, sanitizedValue: '' };
  }

  if (sanitized.length < minLength) {
    return { isValid: false, error: `Must be at least ${minLength} characters` };
  }

  if (pattern && !pattern.test(sanitized)) {
    return { isValid: false, error: patternError || 'Invalid format' };
  }

  return { isValid: true, sanitizedValue: sanitized };
}

/**
 * Validate date string
 */
export function validateDate(input: string, options: {
  required?: boolean;
  minDate?: Date;
  maxDate?: Date;
} = {}): ValidationResult {
  const { required = false, minDate, maxDate } = options;

  const trimmed = input.trim();

  if (!trimmed && required) {
    return { isValid: false, error: 'Date is required' };
  }

  if (!trimmed && !required) {
    return { isValid: true, sanitizedValue: '' };
  }

  // Check for dangerous patterns
  const dangerCheck = containsDangerousPatterns(trimmed);
  if (dangerCheck.dangerous) {
    return { isValid: false, error: dangerCheck.type };
  }

  // Validate format
  const isISODate = PATTERNS.DATE_ISO.test(trimmed);
  const isDateTimeLocal = PATTERNS.DATETIME_LOCAL.test(trimmed);

  if (!isISODate && !isDateTimeLocal) {
    return { isValid: false, error: 'Invalid date format' };
  }

  const date = new Date(trimmed);

  if (isNaN(date.getTime())) {
    return { isValid: false, error: 'Invalid date' };
  }

  if (minDate && date < minDate) {
    return { isValid: false, error: `Date must be after ${minDate.toLocaleDateString()}` };
  }

  if (maxDate && date > maxDate) {
    return { isValid: false, error: `Date must be before ${maxDate.toLocaleDateString()}` };
  }

  return { isValid: true, sanitizedValue: trimmed };
}

/**
 * Validate UUID
 */
export function validateUUID(input: string): ValidationResult {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return { isValid: false, error: 'ID is required' };
  }

  if (!PATTERNS.UUID.test(trimmed)) {
    return { isValid: false, error: 'Invalid ID format' };
  }

  return { isValid: true, sanitizedValue: trimmed };
}

/**
 * Validate select/enum value against allowed options
 */
export function validateEnum<T extends string>(
  input: string,
  allowedValues: readonly T[],
  options: { required?: boolean } = {}
): ValidationResult {
  const { required = true } = options;

  const trimmed = input.trim() as T;

  if (!trimmed && required) {
    return { isValid: false, error: 'Selection is required' };
  }

  if (!trimmed && !required) {
    return { isValid: true, sanitizedValue: '' };
  }

  if (!allowedValues.includes(trimmed)) {
    return { isValid: false, error: 'Invalid selection' };
  }

  return { isValid: true, sanitizedValue: trimmed };
}

// ============================================================================
// FILE UPLOAD VALIDATION
// ============================================================================

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedFileName?: string;
}

/**
 * Sanitize filename - remove dangerous characters and path components
 */
export function sanitizeFileName(filename: string): string {
  // Remove path components
  let sanitized = filename.split(/[/\\]/).pop() || '';

  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*]/g, '');

  // Remove leading dots (hidden files) and spaces
  sanitized = sanitized.replace(/^[\s.]+/, '');

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    const name = sanitized.substring(0, 255 - ext.length);
    sanitized = name + ext;
  }

  return sanitized || 'unnamed_file';
}

/**
 * Validate uploaded file
 */
export function validateFile(
  file: File,
  fileType: keyof typeof ALLOWED_FILE_TYPES
): FileValidationResult {
  const config = ALLOWED_FILE_TYPES[fileType];

  if (!config) {
    return { isValid: false, error: 'Unknown file type category' };
  }

  // Check file size
  if (file.size > config.maxSize) {
    const maxMB = config.maxSize / (1024 * 1024);
    return { isValid: false, error: `File size must be less than ${maxMB}MB` };
  }

  if (file.size === 0) {
    return { isValid: false, error: 'File is empty' };
  }

  // Sanitize filename
  const sanitizedName = sanitizeFileName(file.name);

  // Check extension
  const ext = sanitizedName.substring(sanitizedName.lastIndexOf('.')).toLowerCase();
  if (!config.extensions.includes(ext)) {
    return {
      isValid: false,
      error: `Invalid file type. Allowed: ${config.extensions.join(', ')}`
    };
  }

  // Check MIME type
  if (!config.mimeTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `Invalid file type. File must be: ${config.extensions.join(', ')}`
    };
  }

  return { isValid: true, sanitizedFileName: sanitizedName };
}

/**
 * Check if file content appears to be of the expected type (magic bytes)
 */
export async function validateFileContent(file: File): Promise<FileValidationResult> {
  const MAGIC_BYTES: Record<string, number[]> = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/gif': [0x47, 0x49, 0x46],
    'application/pdf': [0x25, 0x50, 0x44, 0x46],
  };

  const expectedBytes = MAGIC_BYTES[file.type];

  // Skip magic byte check for text files
  if (!expectedBytes) {
    return { isValid: true, sanitizedFileName: sanitizeFileName(file.name) };
  }

  try {
    const buffer = await file.slice(0, expectedBytes.length).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    for (let i = 0; i < expectedBytes.length; i++) {
      if (bytes[i] !== expectedBytes[i]) {
        return {
          isValid: false,
          error: 'File content does not match declared type'
        };
      }
    }

    return { isValid: true, sanitizedFileName: sanitizeFileName(file.name) };
  } catch {
    return { isValid: false, error: 'Failed to validate file content' };
  }
}

// ============================================================================
// QUERY PARAMETER VALIDATION
// ============================================================================

/**
 * Safely parse and validate URL query parameters
 */
export function validateQueryParams(
  searchParams: URLSearchParams,
  schema: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'enum';
    required?: boolean;
    allowedValues?: readonly string[];
    min?: number;
    max?: number;
    maxLength?: number;
  }>
): { isValid: boolean; errors: Record<string, string>; values: Record<string, unknown> } {
  const errors: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  for (const [key, config] of Object.entries(schema)) {
    const value = searchParams.get(key);

    if (!value && config.required) {
      errors[key] = `${key} is required`;
      continue;
    }

    if (!value) {
      continue;
    }

    // Check for dangerous patterns
    const dangerCheck = containsDangerousPatterns(value);
    if (dangerCheck.dangerous) {
      errors[key] = dangerCheck.type || 'Invalid input';
      continue;
    }

    switch (config.type) {
      case 'string':
        if (config.maxLength && value.length > config.maxLength) {
          errors[key] = `${key} is too long`;
        } else {
          values[key] = sanitizeText(value, { maxLength: config.maxLength || 200 });
        }
        break;

      case 'number':
        const num = sanitizeNumber(value);
        if (num === null) {
          errors[key] = `${key} must be a number`;
        } else if (config.min !== undefined && num < config.min) {
          errors[key] = `${key} must be at least ${config.min}`;
        } else if (config.max !== undefined && num > config.max) {
          errors[key] = `${key} must be at most ${config.max}`;
        } else {
          values[key] = num;
        }
        break;

      case 'boolean':
        values[key] = value === 'true' || value === '1';
        break;

      case 'enum':
        if (config.allowedValues && !config.allowedValues.includes(value)) {
          errors[key] = `${key} must be one of: ${config.allowedValues.join(', ')}`;
        } else {
          values[key] = value;
        }
        break;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    values,
  };
}

// ============================================================================
// CONVENIENCE WRAPPER FOR FORM VALIDATION
// ============================================================================

export interface FormField {
  value: string | number;
  type: 'email' | 'name' | 'phone' | 'password' | 'text' | 'number' | 'date' | 'enum';
  required?: boolean;
  options?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    allowNewlines?: boolean;
    allowedValues?: readonly string[];
    pattern?: RegExp;
    patternError?: string;
  };
}

export function validateForm(
  fields: Record<string, FormField>
): { isValid: boolean; errors: Record<string, string>; sanitizedValues: Record<string, unknown> } {
  const errors: Record<string, string> = {};
  const sanitizedValues: Record<string, unknown> = {};

  for (const [fieldName, field] of Object.entries(fields)) {
    let result: ValidationResult;

    switch (field.type) {
      case 'email':
        result = validateEmail(String(field.value));
        break;

      case 'name':
        result = validateName(String(field.value), {
          minLength: field.options?.minLength,
          maxLength: field.options?.maxLength,
          required: field.required,
        });
        break;

      case 'phone':
        result = validatePhone(String(field.value), { required: field.required });
        break;

      case 'password':
        result = validatePassword(String(field.value));
        break;

      case 'text':
        result = validateText(String(field.value), {
          minLength: field.options?.minLength,
          maxLength: field.options?.maxLength,
          required: field.required,
          allowNewlines: field.options?.allowNewlines,
          pattern: field.options?.pattern,
          patternError: field.options?.patternError,
        });
        break;

      case 'number':
        result = validateNumber(field.value, {
          min: field.options?.min,
          max: field.options?.max,
          required: field.required,
        });
        break;

      case 'date':
        result = validateDate(String(field.value), { required: field.required });
        break;

      case 'enum':
        result = validateEnum(
          String(field.value),
          field.options?.allowedValues || [],
          { required: field.required }
        );
        break;

      default:
        result = { isValid: true, sanitizedValue: field.value };
    }

    if (!result.isValid) {
      errors[fieldName] = result.error || 'Invalid input';
    } else {
      sanitizedValues[fieldName] = result.sanitizedValue ?? field.value;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedValues,
  };
}

// ============================================================================
// EXPORTS FOR COMMON USE CASES
// ============================================================================

export const InputValidation = {
  // Sanitizers
  sanitizeText,
  sanitizeName,
  sanitizeEmail,
  sanitizePhone,
  sanitizeNumber,
  sanitizeInteger,
  sanitizeFileName,
  escapeHtml,
  stripHtml,

  // Validators
  validateEmail,
  validateName,
  validatePhone,
  validatePassword,
  validateNumber,
  validateText,
  validateDate,
  validateUUID,
  validateEnum,
  validateFile,
  validateFileContent,
  validateQueryParams,
  validateForm,

  // Security checks
  containsDangerousPatterns,

  // Patterns (readonly)
  PATTERNS,
  ALLOWED_FILE_TYPES,
};

export default InputValidation;
