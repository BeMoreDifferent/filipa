/**
 * Cleans a model name by removing content in parentheses and truncating to a max length.
 * @param name The original model name
 * @param maxLength The maximum length for the result (default 20)
 * @returns The cleaned and truncated model name
 * @example
 *   cleanAndTruncateModelName('GPT-4 (Preview)', 10) // 'GPT-4'
 */
export function cleanAndTruncateModelName(name: string, maxLength = 20): string {
  const noParens = name.replace(/\s*\([^)]*\)/g, '').trim();
  return noParens.length > maxLength ? noParens.slice(0, maxLength - 1) + '…' : noParens;
} 