import { validate, schemas, validateField, validateAsync } from './schemas.js';
import { toastError } from '../components/Toast.js';

/**
 * Validates data against a schema and throws if invalid
 * @param {string} schemaKey - Key from schemas map (e.g., 'championship.create')
 * @param {object} data - Data to validate
 * @returns {object} Validated data
 */
export function validated(schemaKey, data) {
  const [namespace, action] = schemaKey.split('.');
  const schema = schemas[namespace]?.[action];
  
  if (!schema) {
    throw new Error(`Schema not found: ${schemaKey}`);
  }
  
  const result = validate(schema, data);
  if (!result.ok) {
    const error = new Error(result.errors);
    error.name = 'ValidationError';
    error.fieldErrors = result.fieldErrors;
    throw error;
  }
  return result.data;
}

/**
 * Validates a single field for real-time form validation
 * @param {string} schemaKey - Key from schemas map
 * @param {string} fieldName - Field name
 * @param {any} value - Field value
 * @returns {object} { ok: boolean, error?: string }
 */
export function validateFieldValue(schemaKey, fieldName, value) {
  const [namespace, action] = schemaKey.split('.');
  const schema = schemas[namespace]?.[action];
  
  if (!schema) {return { ok: false, error: 'Schema não encontrado' };}
  
  return validateField(schema, fieldName, value);
}

/**
 * Creates a validated version of a store mutation
 * @param {Function} mutation - Store mutation function
 * @param {string} schemaKey - Schema key for validation
 * @returns {Function} Wrapped mutation that validates before executing
 */
export function withValidation(mutation, schemaKey) {
  return async (...args) => {
    // If first arg is the data object to validate
    const data = args[0];
    if (data && typeof data === 'object') {
      const [namespace, action] = schemaKey.split('.');
      const schema = schemas[namespace]?.[action];
      
      if (schema) {
        const result = validate(schema, data);
        if (!result.ok) {
          toastError(result.errors);
          return { ok: false, errors: result.errors, fieldErrors: result.fieldErrors };
        }
        // Replace first arg with validated data
        args[0] = result.data;
      }
    }
    return mutation(...args);
  };
}

/**
 * Creates a form validator hook for React-like validation
 * @param {string} schemaKey - Schema key
 * @returns {object} { validateField, validateAll, errors }
 */
export function createFormValidator(schemaKey) {
  const [namespace, action] = schemaKey.split('.');
  const schema = schemas[namespace]?.[action];
  
  const errors = {};
  const touched = {};
  
  const validateField = (fieldName, value) => {
    if (!schema) {return { ok: false, error: 'Schema não encontrado' };}
    
    const fieldSchema = schema.shape[fieldName];
    if (!fieldSchema) {return { ok: true };}
    
    const result = fieldSchema.safeParse(value);
    if (result.success) {
      delete errors[fieldName];
      return { ok: true };
    } else {
      const error = result.error.flatten().formErrors[0] || 'Valor inválido';
      errors[fieldName] = error;
      return { ok: false, error };
    }
  };
  
  const validateAll = (data) => {
    if (!schema) {return { ok: false, errors: { form: 'Schema não encontrado' } };}
    
    const result = schema.safeParse(data);
    if (result.success) {
      Object.keys(errors).forEach(k => delete errors[k]);
      return { ok: true, data: result.data };
    }
    
    const fieldErrors = result.error.flatten().fieldErrors;
    Object.entries(fieldErrors).forEach(([field, msgs]) => {
      errors[field] = msgs[0];
    });
    
    return { ok: false, errors: fieldErrors, message: Object.values(fieldErrors).flat().join('; ') };
  };
  
  const clearErrors = () => {
    Object.keys(errors).forEach(k => delete errors[k]);
  };
  
  const setTouched = (fieldName) => {
    touched[fieldName] = true;
  };
  
  const isFieldValid = (fieldName) => !errors[fieldName];
  
  const isFormValid = (data) => {
    if (!schema) {return false;}
    const result = schema.safeParse(data);
    return result.success;
  };
  
  return {
    validateField,
    validateAll,
    clearErrors,
    setTouched,
    isFieldValid,
    isFormValid,
    getErrors: () => ({ ...errors }),
    getTouched: () => ({ ...touched }),
    hasErrors: () => Object.keys(errors).length > 0,
  };
}

/**
 * Validates data for server-side (Firebase Functions)
 * Returns standardized error response
 */
export function validateForServer(schemaKey, data) {
  const [namespace, action] = schemaKey.split('.');
  const schema = schemas[namespace]?.[action];
  
  if (!schema) {
    return { ok: false, error: 'Schema não encontrado', code: 'INTERNAL_ERROR' };
  }
  
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: 'Dados inválidos',
      code: 'VALIDATION_ERROR',
      details: result.error.flatten().fieldErrors,
    };
  }
  
  return { ok: true, data: result.data };
}

export { validate, validateField, validateAsync, schemas };

