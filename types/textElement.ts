/**
 * Represents a text element with optional color.
 * @example
 * const item: TextElement = { id: '1', title: 'Note', text: 'Hello', color: '#ff0000' };
 */
export type TextElement = {
  /** Unique identifier for the text element */
  id: string;
  /** Title of the text element */
  title: string;
  /** Main text content */
  text: string;
  /** Optional color in hex format */
  color?: string;
}; 