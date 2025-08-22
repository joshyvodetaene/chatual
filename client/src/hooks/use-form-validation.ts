import { useState, useCallback, useEffect } from 'react'

export interface ValidationRule<T = any> {
  validate: (value: T, allValues?: Record<string, any>) => boolean | Promise<boolean>
  message: string
}

export interface FieldConfig<T = any> {
  rules?: ValidationRule<T>[]
  required?: boolean
  requiredMessage?: string
  debounce?: number
}

export interface FormConfig {
  [fieldName: string]: FieldConfig
}

export interface FieldError {
  message: string
  rule?: string
}

export interface FormState {
  values: Record<string, any>
  errors: Record<string, FieldError | null>
  touched: Record<string, boolean>
  isValidating: Record<string, boolean>
  isValid: boolean
  isDirty: boolean
  isSubmitting: boolean
}

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  config: FormConfig,
  options: {
    validateOnChange?: boolean
    validateOnBlur?: boolean
    persistKey?: string
  } = {}
) {
  const { validateOnChange = true, validateOnBlur = true, persistKey } = options

  // Load persisted values
  const getPersistedValues = useCallback(() => {
    if (!persistKey) return initialValues
    
    try {
      const saved = localStorage.getItem(persistKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        return { ...initialValues, ...parsed }
      }
    } catch (error) {
      console.warn('Failed to load persisted form values:', error)
    }
    return initialValues
  }, [initialValues, persistKey])

  const [formState, setFormState] = useState<FormState>(() => {
    const values = getPersistedValues()
    return {
      values,
      errors: {},
      touched: {},
      isValidating: {},
      isValid: true,
      isDirty: false,
      isSubmitting: false
    }
  })

  // Persist values to localStorage
  const persistValues = useCallback((values: Record<string, any>) => {
    if (!persistKey) return
    
    try {
      localStorage.setItem(persistKey, JSON.stringify(values))
    } catch (error) {
      console.warn('Failed to persist form values:', error)
    }
  }, [persistKey])

  // Validate a single field
  const validateField = useCallback(async (
    fieldName: string,
    value: any,
    allValues: Record<string, any>
  ): Promise<FieldError | null> => {
    const fieldConfig = config[fieldName]
    if (!fieldConfig) return null

    // Check required
    if (fieldConfig.required && (value === undefined || value === null || value === '')) {
      return {
        message: fieldConfig.requiredMessage || `${fieldName} is required`,
        rule: 'required'
      }
    }

    // Run validation rules
    if (fieldConfig.rules) {
      for (const rule of fieldConfig.rules) {
        try {
          const isValid = await rule.validate(value, allValues)
          if (!isValid) {
            return {
              message: rule.message,
              rule: 'custom'
            }
          }
        } catch (error) {
          return {
            message: rule.message,
            rule: 'custom'
          }
        }
      }
    }

    return null
  }, [config])

  // Validate all fields
  const validateForm = useCallback(async (values: Record<string, any>): Promise<Record<string, FieldError | null>> => {
    const errors: Record<string, FieldError | null> = {}
    
    for (const fieldName of Object.keys(config)) {
      const error = await validateField(fieldName, values[fieldName], values)
      errors[fieldName] = error
    }

    return errors
  }, [config, validateField])

  // Update form state helper
  const updateFormState = useCallback((updates: Partial<FormState>) => {
    setFormState(prev => {
      const newState = { ...prev, ...updates }
      
      // Calculate isValid
      if (updates.errors) {
        newState.isValid = Object.values(updates.errors).every(error => error === null)
      }
      
      // Calculate isDirty
      if (updates.values) {
        newState.isDirty = JSON.stringify(updates.values) !== JSON.stringify(initialValues)
      }
      
      return newState
    })
  }, [initialValues])

  // Set field value
  const setValue = useCallback(async (fieldName: string, value: any) => {
    const newValues = { ...formState.values, [fieldName]: value }
    
    updateFormState({
      values: newValues,
      touched: { ...formState.touched, [fieldName]: true }
    })

    // Persist values
    persistValues(newValues)

    // Validate on change if enabled
    if (validateOnChange) {
      updateFormState({
        isValidating: { ...formState.isValidating, [fieldName]: true }
      })

      const error = await validateField(fieldName, value, newValues)
      
      updateFormState({
        errors: { ...formState.errors, [fieldName]: error },
        isValidating: { ...formState.isValidating, [fieldName]: false }
      })
    }
  }, [formState, validateOnChange, validateField, updateFormState, persistValues])

  // Set multiple values
  const setValues = useCallback(async (values: Partial<T>) => {
    const newValues = { ...formState.values, ...values }
    const newTouched = { ...formState.touched }
    
    // Mark all updated fields as touched
    Object.keys(values).forEach(key => {
      newTouched[key] = true
    })

    updateFormState({
      values: newValues,
      touched: newTouched
    })

    // Persist values
    persistValues(newValues)

    // Validate if enabled
    if (validateOnChange) {
      const errors = await validateForm(newValues)
      updateFormState({ errors })
    }
  }, [formState, validateOnChange, validateForm, updateFormState, persistValues])

  // Handle field blur
  const onBlur = useCallback(async (fieldName: string) => {
    if (!validateOnBlur) return

    updateFormState({
      touched: { ...formState.touched, [fieldName]: true },
      isValidating: { ...formState.isValidating, [fieldName]: true }
    })

    const error = await validateField(fieldName, formState.values[fieldName], formState.values)
    
    updateFormState({
      errors: { ...formState.errors, [fieldName]: error },
      isValidating: { ...formState.isValidating, [fieldName]: false }
    })
  }, [validateOnBlur, formState, validateField, updateFormState])

  // Submit form
  const handleSubmit = useCallback(async (onSubmit: (values: T) => Promise<void> | void) => {
    updateFormState({ isSubmitting: true })

    try {
      // Validate all fields
      const errors = await validateForm(formState.values)
      const hasErrors = Object.values(errors).some(error => error !== null)

      // Mark all fields as touched
      const allTouched = Object.keys(config).reduce((acc, key) => {
        acc[key] = true
        return acc
      }, {} as Record<string, boolean>)

      updateFormState({
        errors,
        touched: allTouched,
        isSubmitting: false
      })

      if (!hasErrors) {
        await onSubmit(formState.values as T)
        return true
      }
      
      return false
    } catch (error) {
      updateFormState({ isSubmitting: false })
      throw error
    }
  }, [formState.values, validateForm, config, updateFormState])

  // Reset form
  const reset = useCallback((values?: Partial<T>) => {
    const resetValues = values ? { ...initialValues, ...values } : initialValues
    
    updateFormState({
      values: resetValues,
      errors: {},
      touched: {},
      isValidating: {},
      isValid: true,
      isDirty: false,
      isSubmitting: false
    })

    // Clear persisted values
    if (persistKey) {
      localStorage.removeItem(persistKey)
    }
  }, [initialValues, persistKey, updateFormState])

  // Clear persisted data
  const clearPersistedData = useCallback(() => {
    if (persistKey) {
      localStorage.removeItem(persistKey)
    }
  }, [persistKey])

  return {
    // State
    values: formState.values as T,
    errors: formState.errors,
    touched: formState.touched,
    isValidating: formState.isValidating,
    isValid: formState.isValid,
    isDirty: formState.isDirty,
    isSubmitting: formState.isSubmitting,

    // Actions
    setValue,
    setValues,
    onBlur,
    handleSubmit,
    reset,
    clearPersistedData,

    // Utilities
    getFieldProps: (fieldName: string) => ({
      value: formState.values[fieldName] || '',
      onChange: (value: any) => setValue(fieldName, value),
      onBlur: () => onBlur(fieldName),
      error: formState.errors[fieldName]?.message,
      isValidating: formState.isValidating[fieldName] || false,
      touched: formState.touched[fieldName] || false
    })
  }
}

// Common validation rules
export const validationRules = {
  required: (message = 'This field is required'): ValidationRule => ({
    validate: (value) => value !== undefined && value !== null && value !== '',
    message
  }),

  email: (message = 'Please enter a valid email address'): ValidationRule => ({
    validate: (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(value)
    },
    message
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    validate: (value) => typeof value === 'string' && value.length >= min,
    message: message || `Must be at least ${min} characters long`
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    validate: (value) => typeof value === 'string' && value.length <= max,
    message: message || `Must be no more than ${max} characters long`
  }),

  pattern: (regex: RegExp, message = 'Invalid format'): ValidationRule => ({
    validate: (value) => regex.test(value),
    message
  }),

  custom: (validator: (value: any) => boolean | Promise<boolean>, message: string): ValidationRule => ({
    validate: validator,
    message
  })
}