/**
 * Convert Markdown to plain, readable text.
 * - Removes all formatting.
 * - Turns links/images into "title: url".
 *
 * @param {string} md Markdown-formatted string
 * @returns {string} Clean plain-text string
 */
export function stripMarkdown(md = '') {
    return md
        // images ![alt](src "t")
        .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '$1: $2')
        // links [text](url "t")
        .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '$1: $2')
        // bold / italic / strike
        .replace(/(\*\*|__|\*|_|~~)(.*?)\1/g, '$2')
        // inline code `code`
        .replace(/`([^`]+)`/g, '$1')
        // fenced code blocks ```lang\ncode\n```
        .replace(/```[\s\S]*?```/g, m => m.replace(/```/g, ''))
        // headings ##
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')
        // blockquotes >
        .replace(/^\s{0,3}>\s?/gm, '')
        // unordered list markers -, +, *
        .replace(/^\s*[-+*]\s+/gm, '')
        // ordered list markers 1.
        .replace(/^\s*\d+\.\s+/gm, '')
        // horizontal rules *** --- ___
        .replace(/^[*\-_]{3,}$/gm, '')
        // HTML tags
        .replace(/<\/?[^>]+>/g, '')
        // escapes like \* \[
        .replace(/\\([\\`*{}\[\]()#+\-.!_>])/g, '$1')
        // tidy whitespace
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
