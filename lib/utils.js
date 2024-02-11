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
