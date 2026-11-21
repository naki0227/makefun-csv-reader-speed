// Fast drop-in replacement for csv-reader 1.0.0: run(input) returns exactly csv-reader's
// {columns, rows, errors} for every input, but reads with slice-based runs instead of a
// character at a time. The control flow mirrors the reference reader record by record and
// field by field, so every error ({code, line, row}, plus fields/extra on short_row/long_row)
// comes out in the same order with the same values.
//
// Reading notes, matching the reference policy:
//   - a U+FEFF at the very start is dropped; blank lines (LF or CRLF only) are no records;
//   - an unquoted field ends at a comma, LF or CRLF; a CR not followed by LF is dropped
//     (stray_cr) and the field goes on;
//   - a quoted field runs to the next quote that is not doubled; CRLF and lone CR inside it
//     read as LF; what follows the closing quote up to the next comma or line break is
//     appended as it stands (quote_junk when anything was appended, after any stray_cr met
//     while reading it); a quote that never closes is a literal character and the text after
//     it is read again as unquoted (unterminated_quote);
//   - the first record sets the width; later records are padded (short_row) or cut
//     (long_row) to it; with header, the first record is columns instead of a row.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xFEFF) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The last field read: its value, and how many characters the last unquoted read appended
  // (the closing-quote junk check needs that count).
  let fval = '';
  let fadded = 0;

  // Counts the LFs in text[a..b).
  function countLF(a, b) {
    let cnt = 0;
    let i = text.indexOf('\n', a);
    while (i !== -1 && i < b) {
      cnt += 1;
      i = text.indexOf('\n', i + 1);
    }
    return cnt;
  }

  // Reads unquoted characters onto `prefix` up to the next comma or line break: a CR not
  // followed by LF is dropped (stray_cr). Sets fval/fadded; returns COMMA, LINE_BREAK or END.
  function readUnquoted(prefix) {
    let parts = null; // slices kept when a stray CR splits the field
    let added = 0;
    let segStart = pos;
    for (;;) {
      let i = pos;
      while (i < n) {
        const c = text.charCodeAt(i);
        if (c === 44 || c === 10 || c === 13) break;
        i += 1;
      }
      if (i >= n) {
        added += i - segStart;
        fval = parts === null ? prefix + text.slice(segStart, i) : parts.join('') + text.slice(segStart, i);
        fadded = added;
        pos = n;
        return END;
      }
      const c = text.charCodeAt(i);
      if (c === 44) {
        added += i - segStart;
        fval = parts === null ? prefix + text.slice(segStart, i) : parts.join('') + text.slice(segStart, i);
        fadded = added;
        pos = i + 1;
        return COMMA;
      }
      if (c === 10) {
        added += i - segStart;
        fval = parts === null ? prefix + text.slice(segStart, i) : parts.join('') + text.slice(segStart, i);
        fadded = added;
        pos = i + 1;
        line += 1;
        return LINE_BREAK;
      }
      // c === 13: CRLF ends the field; a lone CR is dropped and the field goes on.
      if (text.charCodeAt(i + 1) === 10) {
        added += i - segStart;
        fval = parts === null ? prefix + text.slice(segStart, i) : parts.join('') + text.slice(segStart, i);
        fadded = added;
        pos = i + 2;
        line += 1;
        return LINE_BREAK;
      }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      if (parts === null) parts = [prefix, text.slice(segStart, i)];
      else parts.push(text.slice(segStart, i));
      added += i - segStart;
      pos = i + 1;
      segStart = pos;
    }
  }

  // Reads a quoted field whose opening quote is at pos. Sets fval; returns how the field ended.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    let value = '';
    let dLine = 0; // line breaks met inside the quotes, committed only if the field closes
    for (;;) {
      const qi = text.indexOf('"', pos);
      if (qi === -1) {
        // The quote never closes: it is a literal character, and the text after it is read
        // again as unquoted, from the start, with the line count as it was at the quote.
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        return readUnquoted('"');
      }
      const ri = text.indexOf('\r', pos);
      if (ri !== -1 && ri < qi) {
        // A CR before the next quote: the run before it is plain (its LFs count), and the CR
        // itself (CRLF or lone) reads as one LF.
        dLine += countLF(pos, ri) + 1;
        value += text.slice(pos, ri) + '\n';
        pos = ri + (text.charCodeAt(ri + 1) === 10 ? 2 : 1);
        continue;
      }
      // The run up to the quote holds no CR; its LFs count.
      dLine += countLF(pos, qi);
      if (text.charCodeAt(qi + 1) === 34) {
        // A doubled quote is one quote in the value.
        value += text.slice(pos, qi) + '"';
        pos = qi + 2;
        continue;
      }
      // The closing quote.
      value += text.slice(pos, qi);
      pos = qi + 1;
      line = openLine + dLine;
      if (pos >= n) {
        fval = value;
        return END;
      }
      const c = text.charCodeAt(pos);
      if (c === 44) {
        pos += 1;
        fval = value;
        return COMMA;
      }
      if (c === 10) {
        pos += 1;
        line += 1;
        fval = value;
        return LINE_BREAK;
      }
      if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        fval = value;
        return LINE_BREAK;
      }
      // What follows the closing quote is appended as it stands, up to the next comma or
      // line break (quote_junk when anything was appended).
      const ended = readUnquoted(value);
      if (fadded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      return ended;
    }
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let ended;
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === 34;
      ended = quoted ? readQuoted() : readUnquoted('');
      fields.push(fval);
    } while (ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr
    // errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
