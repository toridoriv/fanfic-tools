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

/**
 * Picks a specific property from an object and returns its value.
 *
 * @template {Object}  O
 * @template {keyof O} K
 * @param    {O}       obj The input object from which to pick a property.
 * @param    {K}       key The key of the property to be picked.
 * @returns  The value of the specified property.
 */
export function pick(obj, key) {
  return lazyPick(obj)(key);
}

/**
 * Creates a partial function for picking properties from an object.
 *
 * @template {Object}  O
 * @template {keyof O} K
 * @param    {O}       obj The input object for which to create a partial picking
 *                         function.
 * @returns  A partial function that can be used to pick specific properties
 *           from the input object.
 */
export function lazyPick(obj) {
  /**
   * @param   {K}    key
   * @returns {O[K]}
   */
  function pick(key) {
    return obj[key];
  }

  return pick;
}
