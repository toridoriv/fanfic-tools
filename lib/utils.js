/**
 * Coerces a value to a specified type.
 *
 * @template T     - The type to coerce the value to.
 * @param    {unknown} value - The value to coerce.
 * @returns  {T}       The coerced value.
 */
export function coerce(value) {
  // eslint-disable-next-line prettier/prettier
  return /** @type {T} */ (value);
}

/**
 * Returns the value if it is defined, otherwise returns the fallback value.
 *
 * @template T        - The type of the value and fallback.
 * @param    {T | undefined} value    - The value to return if defined.
 * @param    {T}             fallback - The fallback value to return if value is
 *                                    undefined.
 * @returns  {T}             The value if defined, otherwise the fallback.
 */
export function getValueOrDefault(value, fallback) {
  return value || fallback;
}
