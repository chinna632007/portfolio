/* =========================================================
   portfolioGenerator.js - dynamic portfolio renderer
   ---------------------------------------------------------
   Renders the analyzed resume as a polished, single-page
   portfolio that MIRRORS the uploaded resume structure:
   - same sections, same EXACT original titles, same order
   - every content line preserved verbatim (no rewriting)
   - visual templates per section type (cards / timeline /
     chips / paragraphs) never touch the underlying data.
   FALLBACK: any unrecognized section renders as a generic
   card section keeping the original title + text.
   ========================================================= */
'use strict';

const PortfolioGenerator = (function () {

    function esc(value) { return window.App ? App.escapeHtml(value) : String(value == null ? '' : value); }

    /* Clean url for links; returns '' if empty. */
    function linkHref(v) {
        const s = String(v || '').trim();
        if (!s) return '';
        return /^https?:\/\//i.test(s) ? s : 'https://' + s.replace(/^\/+/, '');
    }

    /* Stable DOM id for a section anchor ("pf-s01-skills" style). */
    function sectionId(idx, title) {
        const slug = String(title || 'section').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
        return 'pf-s' + String(idx + 1).padStart(2, '0') + '-' + slug;
    }

    /* Short label for navigation (first two words, ellipsis if longer). */
    function sectionLabel(title) {
        const words = String(title || '').trim().split(/\s+/);
        return words.length <= 2 ? words.join(' ') : words.slice(0, 2).join(' ') + '…';
    }

    /* Decorative icon per section type (keeps original data intact). */
    function typeIcon(type) {
        switch (type) {
            case 'summary':       return '&#9733;';        /* star */
            case 'education':     return '&#127891;';      /* grad cap */
            case 'experience':    return '&#128188;';      /* briefcase */
            case 'internships':   return '&#128295;';      /* wrench */
            case 'projects':      return '&#128193;';      /* folder */
            case 'skills':        return '&#9889;';        /* bolt */
            case 'languages':     return '&#127760;';      /* globe */
            case 'hobbies':       return '&#127912;';      /* palette */
            case 'certificates':
            case 'certifications':return '&#127942;';      /* medal */
            case 'achievements':
            case 'awards':        return '&#127865;';      /* trophy */
            case 'contact':       return '&#9993;';        /* envelope */
            default:              return '&#10022;';       /* sparkle */
        }
    }

/* ---------- map a section type to a visual template ---------- */
    /* Section types that read as a one-liner list: every line becomes its
       own compact card (certifications, awards, activities, ...). */
    const LIST_TYPES = ['certifications', 'certificate', 'certificates', 'achievements', 'awards', 'activities', 'links'];
    function isListType(type) { return LIST_TYPES.indexOf(type) !== -1; }

    function templateFor(type) {
        switch (type) {
            case 'summary':
            case 'declaration':
            case 'references': return 'text';
            case 'skills': return 'skills';
            case 'languages': return 'chips';
            case 'hobbies': return 'chips';
            case 'contact': return 'chips';
            default: return 'entries';
        }
    }

    /* Group raw content lines into visual entries.  The analyzer keeps the
       resume *text* only (blank separators are dropped), so entries are
       found structurally: a new entry starts at a title-like line that
       follows a finished sentence, a date/score row or a bullet run.
       `perLine` sections (certifications, awards, links, activities...)
       build one compact entry per line.  A leading bullet glyph becomes a
       real <li> and every line's wording is preserved exactly. */
    const BULLET_RE = /^[\u2022\u25cf\u25aa\u25a0\u25b6\u25e6\u00b7\-*]\s+(.*)$/;
    function isBulletLine(line) { return BULLET_RE.test(String(line == null ? '' : line)); }
    function stripBullet(line) {
        const raw = String(line == null ? '' : line);
        const m = raw.match(BULLET_RE);
        return (m ? m[1] : raw).trim();
    }

    /* Words that are never capitalised to start a sentence. */
    const STOP_WORDS = ['and', 'or', 'of', 'for', 'in', 'on', 'at', 'to', 'the', 'a', 'an',
        'with', 'by', 'as', 'from', 'using', 'via', 'my', 'per', 'into', 'over', 'a', 'amp'];
    /* Verbs / participles that typically START a description line - such a
       line is prose, never the title of a new entry. */
    const SENTENCE_STARTS = ['built', 'create', 'created', 'crafted', 'design', 'designed', 'develop',
        'developed', 'deployed', 'deliver', 'delivered', 'earned', 'engineered', 'generated', 'handled',
        'helped', 'implemented', 'improved', 'improving', 'integrated', 'learned', 'led', 'leading',
        'maintained', 'managed', 'mentor', 'mentored', 'mentoring', 'migrated', 'optimized', 'organized',
        'participated', 'performed', 'presented', 'published', 'reduced', 'redesigned', 'responsible',
        'secured', 'selected', 'spearheaded', 'tested', 'trained', 'used', 'volunteered', 'won', 'worked',
        'wrote', 'assisted', 'collaborated', 'completed', 'conducted', 'achieved', 'received', 'awarded',
        'ranked', 'currently', 'seeking', 'passionate', 'adapted', 'automated', 'maintaining', 'building'];

    /* A line that reads like the title of a new entry: short, no sentence
       punctuation, and either structured (Title Case) or carrying an
       explicit separator (dates, " - ", "|", "@"). */
    function titleLike(text) {
        const t = String(text == null ? '' : text).trim();
        if (!t || t.length > 90) return false;
        if (/[.!?]$/.test(t)) return false;
        if (isMetaLine(t)) return false;
        /* a trailing "(Jan 2023 - Present)" is a date, not a word */
        const core = t.replace(/\s*\([^)]*\)\s*$/, '').trim();
        const words = core.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
        if (!words.length || words.length > 8) return false;
        const first = words[0].toLowerCase().replace(/[^a-z]/g, '');
        if (SENTENCE_STARTS.indexOf(first) !== -1) return false;
        if (/\s[\u2013\u2014]\s|\s-\s|\s@\s|\|/.test(t)) return true;
        return words.every((w) => {
            const clean = w.replace(/^[^A-Za-z0-9]+/, '');
            if (!clean) return true;
            if (STOP_WORDS.indexOf(clean.toLowerCase()) !== -1) return true;
            return /^[A-Z0-9]/.test(clean);
        });
    }

    function groupEntries(lines, perLine) {
        const entries = [];
        let current = [];
        const push = () => { if (current.length) { entries.push(current); current = []; } };
        lines.forEach((line) => {
            const raw = String(line == null ? '' : line);
            const text = stripBullet(raw);
            if (!text) { push(); return; }
            const bullet = isBulletLine(raw);
            if (perLine) { entries.push([{ text: text, bullet: bullet }]); return; }
            if (current.length) {
                const prev = current[current.length - 1].text;
                const finished = endsSentence(prev) || isMetaLine(prev) || current.some((it) => it.bullet);
                if (!bullet && titleLike(text) && finished) push();
            }
            current.push({ text: text, bullet: bullet });
        });
        push();
        return entries.filter((e) => e.length);
    }

    /* ============ technical skills: real category structure ============
       A resume lists skills either as free text ("JavaScript, Python") or as
       labelled groups ("Languages: Java, Python").  Labelled lines become a
       titled category card with one chip per value, so the skills section
       reads as an ordered grid instead of one endless chip cloud.  Nothing
       is renamed or dropped: every label and every value is kept verbatim,
       and each card keeps its original line(s) in data-source-line. */
    function cleanToken(part) {
        return String(part == null ? '' : part)
            .replace(/^[\-*\u00b7\u2022\u25aa\s]+/, '')
            .replace(/[\s\u2022\u00b7*]+$/, '')
            .trim();
    }

    /* Split a value blob on separators - but never inside brackets, so
       "AWS (EC2, S3, Lambda)" stays one skill instead of three. */
    function splitValues(text) {
        const raw = String(text == null ? '' : text);
        const parts = [];
        let buf = '', depth = 0;
        for (let i = 0; i < raw.length; i++) {
            const ch = raw.charAt(i);
            if (ch === '(' || ch === '[' || ch === '{') depth++;
            else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
            else if (depth === 0 && (ch === ',' || ch === ';' || ch === '|' ||
                ch === '\u2022' || ch === '\u25aa' || ch === '\u00b7')) { parts.push(buf); buf = ''; continue; }
            buf += ch;
        }
        parts.push(buf);
        return parts.map(cleanToken).filter(Boolean);
    }

    /* Chips for the simple chip sections (languages / hobbies / contact). */
    function tokenize(blob) {
        const tokens = [];
        blob.forEach((line) => splitValues(line).forEach((t) => tokens.push(t)));
        return tokens;
    }

    /* "Languages: Java, Python, Go" -> { label: 'Languages', value: '...' }.
       Returns null when the line is a plain list with no category label. */
    function splitLabelled(line) {
        const t = String(line == null ? '' : line).trim().replace(/^[\-*\u00b7\u2022\u25aa]\s*/, '');
        const colon = t.match(/^([A-Za-z][^:,;|]{1,34}?)\s*[:\u2013\u2014]\s*(\S.*)$/);
        const dash = colon ? null : t.match(/^([A-Za-z][^:,;|]{1,34}?)\s+-\s+(\S.*)$/);
        const m = colon || dash;
        if (!m) return null;
        const label = m[1].replace(/[\s\u2022\u00b7]+$/, '').trim();
        const value = m[2].trim();
        if (!label || !value) return null;
        if (label.split(/\s+/).length > 4) return null;
        if (/\d/.test(label)) return null;
        if (/^(https?|http|www|ftp)$/i.test(label)) return null;
        return { label: label, value: value };
    }

    /* Merge only adjacent matching categories so repeated labels never move
       later values ahead of intervening resume content. */
    function skillGroups(lines) {
        const groups = [];
        lines.forEach((raw) => {
            const line = String(raw == null ? '' : raw).trim();
            if (!line) return;
            const labelled = splitLabelled(line);
            const label = labelled ? labelled.label : '';
            let group = groups[groups.length - 1];
            if (!group || group.label.toLowerCase() !== label.toLowerCase()) {
                group = { label: label, values: [], sources: [] };
                groups.push(group);
            }
            group.sources.push(line);
            group.values.push(...splitValues(labelled ? labelled.value : line));
        });
        return groups.filter((group) => group.values.length);
    }

    /* Skills section markup: category cards that hold skill chips. */
    function renderSkillGroups(section) {
        const groups = skillGroups(section.lines);
        if (!groups.length) return '';
        const html = ['<div class="pf-skills">'];
        let chip = 0;
        groups.forEach((g, gi) => {
            html.push('<div class="pf-skill-group reveal" data-source-line="' + esc(g.sources.join(' ')) +
                '" style="transition-delay:' + (gi * 90) + 'ms">');
            if (g.label) {
                html.push('<div class="pf-skill-group-head">' +
                    '<span class="pf-skill-group-label">' + esc(g.label) + '</span>' +
                    '<span class="pf-skill-group-count">' + g.values.length + '</span>' +
                    '<span class="pf-skill-group-rule"></span>' +
                '</div>');
            }
            html.push('<div class="pf-chips">');
            g.values.forEach((v) => {
                html.push('<span class="pf-chip reveal" style="transition-delay:' + (chip * 40) + 'ms">' + esc(v) + '</span>');
                chip++;
            });
            html.push('</div></div>');
        });
        html.push('</div>');
        return html.join('');
    }

    /* A line that reads like a date/score meta row:
       "2021 - 2025 | CGPA: 8.7 / 10", "(Jan 2023 - Present)" */
    function isMetaLine(line) {
        const t = String(line || '').trim();
        if (!t) return false;
        if (/(19|20)\d{2}\s*(-|\u2013|to|\/)\s*((19|20)\d{2}|Present|present)/i.test(t)) return true;
        if (/\((19|20)\d{2}[^)]*\)/.test(t) && t.length < 60) return true;
        if (/^(19|20)\d{2}\b/.test(t) && /(CGPA|GPA|Percentage|aggregate|score)/i.test(t)) return true;
        return false;
    }

/* Build one resume entry as a structured card.  The reading order is
       always the same: title -> subtitle -> date/score badges ->
       highlights -> description.  Lines only ever move between these
       slots; the wording itself is never rewritten or dropped. */
    function endsSentence(text) { return /[.!?:;]$/.test(String(text == null ? '' : text).trim()); }

    function looksLikeSubtitle(text, entryLen) {
        const t = String(text == null ? '' : text).trim();
        if (!t || entryLen <= 2) return false;
        if (isMetaLine(t)) return false;
        if (/[.!?]$/.test(t)) return false;
        if (t.split(/\s+/).length > 8) return false;
        return true;
    }

    /* Merge wrapped source lines back into one flowing block.  The join is a
       plain space, so every original line stays readable in the block
       exactly as it was written in the resume. */
    function mergeBlocks(lines) {
        const blocks = [];
        let pending = '';
        lines.forEach((line) => {
            const t = String(line == null ? '' : line).trim();
            if (!t) { if (pending) { blocks.push(pending); pending = ''; } return; }
            pending = pending ? pending + ' ' + t : t;
            if (endsSentence(t)) { blocks.push(pending); pending = ''; }
        });
        if (pending) blocks.push(pending);
        return blocks;
    }

    function entryHtml(entry, delayMs) {
        const style = delayMs ? ' style="transition-delay:' + delayMs + 'ms"' : '';
        let title = '', sub = '';
        const metas = [];
        const items = [];
        let pending = '';
        const flush = () => {
            const t = pending.trim();
            if (t) items.push({ text: t, bullet: false });
            pending = '';
        };
        let header = true;
        entry.forEach((item) => {
            const t = item.text;
            if (item.bullet) { flush(); items.push({ text: t, bullet: true }); header = false; return; }
            if (header) {
                if (!title) { title = t; return; }
                if (!sub && looksLikeSubtitle(t, entry.length)) { sub = t; return; }
                if (isMetaLine(t)) { metas.push(t); return; }
                header = false;
            }
            pending = pending ? pending + ' ' + t : t;
            if (endsSentence(t)) flush();
        });
        flush();

        const single = items.length === 1 && !items[0].bullet;
        const compact = !items.length && !metas.length && !sub;
        let html = '<div class="pf-entry reveal' + (compact ? ' is-compact' : '') +
            '" data-shape="' + (compact ? 'line' : 'card') + '"' + style + '>';
        if (title) {
            html += '<div class="pf-entry-top"><h3 class="pf-entry-title">' + esc(title) + '</h3>' +
                (sub ? '<span class="pf-entry-sub">' + esc(sub) + '</span>' : '') + '</div>';
        }
        if (metas.length) {
            html += '<div class="pf-entry-metas">';
            metas.forEach((m) => { html += '<span class="pf-entry-meta">' + esc(m) + '</span>'; });
            html += '</div>';
        }
        if (single) {
            html += '<p class="pf-entry-text">' + esc(items[0].text) + '</p>';
        } else if (items.length) {
            html += '<ul class="pf-entry-list">';
            items.forEach((it, i) => {
                html += '<li class="reveal' + (it.bullet ? '' : ' pf-li-plain') +
                    '" style="transition-delay:' + (delayMs + 40 + i * 50) + 'ms">' + esc(it.text) + '</li>';
            });
            html += '</ul>';
        }
        return html + '</div>';
    }

    /* Projects have their own reading hierarchy, not an employment timeline.
       Only explicit technology labels and URLs become metadata; prose is
       never guessed into a company/subtitle slot. */
    function projectField(text) {
        return text.match(/^(technologies(?: used)?|tech stack|technology stack|tools(?: used)?|built with|stack)\s*:\s*(.+)$/i);
    }

    function projectEntries(section) {
        const entries = [];
        let current = [], afterBlank = false;
        const push = () => { if (current.length) entries.push(current); current = []; };
        (section.lines || []).forEach((line, index) => {
            const text = stripBullet(line);
            if (!text) { afterBlank = true; return; }
            const field = projectField(text);
            const url = /https?:\/\/|www\.|github\.com\//i.test(text);
            const explicitTitle = /^(?:project\s*\d*\s*[:.)-]|\d+[.)]\s)/i.test(text);
            const separated = afterBlank || (section.breakBefore || []).indexOf(index) !== -1;
            afterBlank = false;
            const candidate = !field && !url && !isMetaLine(text) &&
                (explicitTitle || titleLike(text) || (separated && text.length < 100 && !/[.!?:;]$/.test(text) &&
                    SENTENCE_STARTS.indexOf(text.split(/\s+/)[0].toLowerCase()) === -1));
            if (current.length && candidate && (!isBulletLine(line) || explicitTitle || separated) &&
                (explicitTitle || separated || current.length > 1)) push();
            current.push({ text: text, bullet: isBulletLine(line) });
        });
        push();
        return entries;
    }

    /* Keep every field and description in its source position, not fixed slots. */
    function projectHtml(entry, index) {
        const blocks = [];
        let pending = null;
        const flush = () => { if (pending) blocks.push(pending); pending = null; };
        entry.slice(1).forEach((item) => {
            const field = projectField(item.text);
            if (field) { flush(); blocks.push({ field: field }); return; }
            if (isMetaLine(item.text)) { flush(); blocks.push({ date: item.text }); return; }
            if (item.bullet) { flush(); pending = { text: item.text, bullet: true }; return; }
            if (pending && !endsSentence(pending.text)) pending.text += ' ' + item.text;
            else { flush(); pending = { text: item.text, bullet: false }; }
        });
        flush();
        let html = '<article class="pf-entry reveal pf-project" style="transition-delay:' + Math.min(index * 80, 320) + 'ms">' +
            '<header class="pf-project-head"><span class="pf-project-number" aria-hidden="true">' +
            String(index + 1).padStart(2, '0') + '</span><h3 class="pf-entry-title">' + esc(entry[0].text) + '</h3></header>';
        let listOpen = false, descriptionOpen = false;
        const closeDescription = () => {
            if (listOpen) { html += '</ul>'; listOpen = false; }
            if (descriptionOpen) { html += '</div>'; descriptionOpen = false; }
        };
        blocks.forEach((block) => {
            if (block.field || block.date) {
                closeDescription();
                if (block.date) html += '<div class="pf-entry-metas"><span class="pf-entry-meta">' + esc(block.date) + '</span></div>';
                else html += '<dl class="pf-project-tech"><div><dt>' + esc(block.field[1]) + '</dt><dd class="pf-chips">' +
                    splitValues(block.field[2]).map((v) => '<span class="pf-chip">' + esc(v) + '</span>').join('') + '</dd></div></dl>';
                return;
            }
            if (!descriptionOpen) { html += '<div class="pf-project-description">'; descriptionOpen = true; }
            if (block.bullet && !listOpen) { html += '<ul class="pf-entry-list">'; listOpen = true; }
            if (!block.bullet && listOpen) { html += '</ul>'; listOpen = false; }
            html += block.bullet ? '<li>' + linkedText(block.text) + '</li>' : '<p class="pf-entry-text">' + linkedText(block.text) + '</p>';
        });
        closeDescription();
        return html + '</article>';
    }

    /* Link only detected web addresses, escaping all surrounding resume text. */
    function linkedText(text) {
        const re = /(?:https?:\/\/|www\.|github\.com\/)[^\s<>"']+/gi;
        let html = '', offset = 0, match;
        while ((match = re.exec(text))) {
            const url = match[0].replace(/[.,;!?)]+$/, '');
            html += esc(text.slice(offset, match.index)) + '<a class="pf-content-link" href="' +
                esc(linkHref(url)) + '" target="_blank" rel="noopener noreferrer">' + esc(url) + '</a>';
            offset = match.index + url.length;
        }
        return html + esc(text.slice(offset));
    }

    /* Supporting sections are not a separate card for each PDF line.
       Keep issuer/date rows and wrapped descriptions with the item above. */
    function supportingEntries(section) {
        const entries = [];
        let current = [], afterBlank = false;
        const push = () => { if (current.length) entries.push(current); current = []; };
        (section.lines || []).forEach((line, index) => {
            const text = stripBullet(line);
            if (!text) { afterBlank = true; return; }
            const separated = afterBlank || (section.breakBefore || []).indexOf(index) !== -1;
            afterBlank = false;
            const previous = current.length ? current[current.length - 1].text : '';
            const metadata = /^(?:issued by|issuer|organization|provider|date|duration|credential(?: id)?|certificate id|score)\s*:/i.test(text) ||
                /^(?:\d{4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})(?:\s*[-|–].*)?$/i.test(text);
            const continuation = metadata || /^(?:and|with|for|of|in|to|using|by|from)\b/.test(text) ||
                (previous && !endsSentence(previous) && /^[a-z]/.test(text));
            if (current.length && (separated || (!continuation && (isBulletLine(line) || titleLike(text) || endsSentence(previous))))) push();
            current.push({ text: text, bullet: isBulletLine(line) });
        });
        push();
        return entries;
    }

    /* Personal labels are recognized conservatively; unfamiliar lines remain visible. */
    function personalRows(section) {
        const label = /^(Name|Full Name|Date of Birth|DOB|Gender|Father[’']s Name|Mother[’']s Name|Nationality|Languages Known|Marital Status|Address|Phone|Mobile|Email)\s*(?::\s*|\s+)(.+)$/i;
        return '<dl class="pf-details">' + (section.lines || []).map((raw, i) => {
            const parts = String(raw).split(/\s+[—|]\s+(?=[^A-Za-z]*Email\s*:)/i);
            return parts.map((part) => {
                const text = stripBullet(part).replace(/^[^A-Za-z]+(?=(?:Phone|Email)\s*:)/i, '');
                const match = text.match(label);
                const source = ' data-source-line="' + esc(raw) + '"';
                if (!match) return '<div class="pf-detail-row reveal"' + source + '><dd class="pf-detail-unlabelled">' + esc(part) + '</dd></div>';
                return '<div class="pf-detail-row reveal"' + source + ' style="transition-delay:' + Math.min(i * 50, 250) + 'ms"><dt>' +
                    esc(match[1]) + '</dt><dd>' + esc(match[2]) + '</dd></div>';
            }).join('');
        }).join('') + '</dl>';
    }

    function declarationHtml(section) {
        const prose = [], rows = [], signature = [];
        const lines = section.lines || [];
        /* Only separate a PDF's fused right column when both cues exist.
           Otherwise leave uncertain wording in its original field. */
        const fused = lines.some((line) => /^Place\s*:\s*.+\s+Signature\s*$/i.test(line)) &&
            lines.some((line) => /^Date\s*:\s*\d{1,4}[\/.-]\d{1,2}[\/.-]\d{2,4}\s+\S/i.test(line));
        lines.forEach((raw) => {
            const text = String(raw).trim();
            const field = text.match(/^(Date|Place)\s*:\s*(.*)$/i);
            if (field) {
                let value = field[2];
                if (fused && /^date$/i.test(field[1])) {
                    const pair = value.match(/^(\d{1,4}[\/.-]\d{1,2}[\/.-]\d{2,4})\s+(.+)$/);
                    if (pair) { value = pair[1]; signature.push('<span class="pf-signature-name">' + esc(pair[2]) + '</span>'); }
                }
                if (fused && /^place$/i.test(field[1])) {
                    const pair = value.match(/^(.*?)\s+(Signature)\s*$/i);
                    if (pair) { value = pair[1]; signature.push('<span>' + esc(pair[2]) + '</span>'); }
                }
                rows.push('<div class="pf-detail-row" data-source-line="' + esc(raw) + '"><dt>' + esc(field[1]) + '</dt><dd>' + esc(value) + '</dd></div>');
            } else if (/^Signature\s*(?::|$)/i.test(text)) {
                signature.push('<span>' + esc(text) + '</span>');
            } else prose.push(raw);
        });
        let html = '<div class="pf-declaration"><div class="pf-lines">' + mergeBlocks(prose).map((text) =>
            '<p class="pf-text reveal">' + esc(text) + '</p>').join('') + '</div>';
        if (rows.length || signature.length) html += '<div class="pf-declaration-footer reveal">' +
            (rows.length ? '<dl class="pf-details">' + rows.join('') + '</dl>' : '') +
            (signature.length ? '<div class="pf-signature">' + signature.join('') + '</div>' : '') + '</div>';
        return html + '</div>';
    }


    function renderSectionContent(section) {
        const type = templateFor(section.type);
        const html = [];

        if (section.type === 'declaration') {
            html.push(declarationHtml(section));
        } else if (/^personal\s+(?:details|information)\s*:?$/i.test(section.original || '')) {
            html.push(personalRows(section));
        } else if (/^soft\s+skills\s*:?$/i.test(section.original || '')) {
            html.push('<ul class="pf-soft-skills">' + tokenize(section.lines).map((text, i) =>
                '<li class="reveal" style="transition-delay:' + Math.min(i * 50, 250) + 'ms">' + esc(text) + '</li>').join('') + '</ul>');
        } else if (section.type === 'projects') {
            const entries = projectEntries(section);
            html.push('<div class="pf-project-grid">');
            entries.forEach((entry, i) => html.push(projectHtml(entry, i)));
            html.push('</div>');
        } else if (type === 'skills') {
            /* structured skills: one titled category card per group */
            const skills = renderSkillGroups(section);
            if (skills) html.push(skills);
        } else if (type === 'chips') {
            const tokens = tokenize(section.lines);
            if (tokens.length) {
                html.push('<div class="pf-chips">');
                tokens.forEach((t, i) => html.push('<span class="pf-chip reveal" style="transition-delay:' + (i * 45) + 'ms">' + esc(t) + '</span>'));
                html.push('</div>');
            }
        } else if (type === 'text') {
            /* wrapped resume lines are rejoined into real paragraphs */
            const blocks = mergeBlocks(section.lines);
            html.push('<div class="pf-lines">');
            blocks.forEach((b, i) => html.push('<p class="pf-text reveal" style="transition-delay:' + (i * 55) + 'ms">' + esc(b) + '</p>'));
            html.push('</div>');
        } else if (section.type === 'links') {
            /* Social/profile links: one compact card per line keeps each
               labelled URL readable instead of merging them together. */
            const entries = groupEntries(section.lines, true);
            html.push('<div class="pf-entries-grid">');
            entries.forEach((entry, i) => { if (entry.length) html.push(entryHtml(entry, i * 70)); });
            html.push('</div>');
        } else if (isListType(section.type)) {
            /* one-line-per-item sections (certifications, awards, ...)
               become a tidy card grid instead of one long paragraph */
            const entries = supportingEntries(section);
            html.push('<div class="pf-entries-grid">');
            entries.forEach((entry, i) => { if (entry.length) html.push(entryHtml(entry, i * 70)); });
            html.push('</div>');
        } else {
            /* Resume-style structured entries, kept in resume order */
            const entries = groupEntries(section.lines, false);
            html.push('<div class="pf-timeline">');
            entries.forEach((entry, i) => {
                if (!entry.length) return;
                html.push(entryHtml(entry, i * 80));
            });
            html.push('</div>');
        }
        return html.join('');
    }

    function renderSectionBlock(sec, idx, custom) {
        const hidden = (custom && custom.hidden) || [];
        if (hidden.indexOf(sec.original) !== -1) return '';
        const id = sectionId(idx, sec.original);
        const headHtml = sec.original
            ? '<div class="pf-section-head reveal">' +
                '<span class="pf-section-icon">' + typeIcon(sec.type) + '</span>' +
                '<span class="pf-index">' + String(idx + 1).padStart(2, '0') + '</span>' +
                '<h2 class="pf-section-title">' + esc(sec.original) + '</h2>' +
              '</div>'
            : '';
        const stacked = ['skills', 'projects', 'certifications', 'certificate', 'certificates'].indexOf(sec.type) !== -1;
        return '<section class="pf-section' + (stacked ? ' pf-stack' : '') + '" id="' + id + '">' +
            headHtml +
            '<div class="pf-section-body">' + renderSectionContent(sec) + '</div>' +
        '</section>';
    }

    function visibleSections(data, custom) {
        const hidden = (custom && custom.hidden) || [];
        return (data.sections || []).filter((s) => hidden.indexOf(s.original) === -1);
    }

/* ---------- hero: shows ONLY data that exists in the resume ---------- */
    function buildHero(data, custom) {
        const p = data.personalInfo || {};
        const intro = (data.sections || []).find((s) => s.type === 'summary');
        const introText = intro && intro.lines.length ? intro.lines.join(' ') : '';

        /* initials avatar (A.S. for "Anjali Sharma") — decorative only */
        function initials(name) {
            const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
            let out = '';
            for (let i = 0; i < Math.min(parts.length, 2); i++) {
                const ch = parts[i].charAt(0);
                if (ch && /[a-zA-Z0-9]/.test(ch)) out += ch.toUpperCase();
            }
            return out || '&#9993;';
        }
        let avatar = '';
        if (p.name) avatar = '<div class="pf-hero-avatar" aria-hidden="true">' + initials(p.name) + '</div>';

        let contact = '';
        const pills = [];
        if (p.email) pills.push('<a class="pf-pill pf-pill-accent" href="mailto:' + esc(p.email) + '">&#9993; ' + esc(p.email) + '</a>');
        if (p.phone) pills.push('<a class="pf-pill" href="tel:' + esc(p.phone.replace(/[^+\d]/g, '')) + '">&#9742; ' + esc(p.phone) + '</a>');
        if (p.location) pills.push('<span class="pf-pill">&#128205; ' + esc(p.location) + '</span>');
        if (p.linkedin) pills.push('<a class="pf-pill" target="_blank" rel="noopener" href="' + esc(linkHref(p.linkedin)) + '">in&thinsp;&#8599;</a>');
        if (p.github) pills.push('<a class="pf-pill" target="_blank" rel="noopener" href="' + esc(linkHref(p.github)) + '">GitHub &#8599;</a>');
        if (p.website) pills.push('<a class="pf-pill" target="_blank" rel="noopener" href="' + esc(linkHref(p.website)) + '">&#128279; ' + esc(p.website) + '</a>');
        if (pills.length) contact = '<div class="pf-hero-pills">' + pills.join('') + '</div>';

        let nameBlock = '';
        if (p.name) nameBlock += '<h1 class="pf-hero-name reveal">' + esc(p.name) + '</h1>';
        if (p.title) nameBlock += '<p class="pf-hero-role reveal d-1">' + esc(p.title) + '</p>';
        if (introText) nameBlock += '<p class="pf-hero-intro reveal d-2">' + esc(introText) + '</p>';

        return '<div class="pf-hero">' +
            '<div class="pf-hero-bg"><span></span><span></span><span></span></div>' +
            '<div class="pf-hero-inner">' + avatar + nameBlock + contact + '</div>' +
        '</div>';
    }

    /* ---------- dynamic navigation (brand + visible sections) ---------- */
    function buildNav(data, custom) {
        const p = data.personalInfo || {};
        let brand = '&#10070;';
        if (p.name) {
            const parts = String(p.name).trim().split(/\s+/).filter(Boolean);
            brand = '';
            for (let i = 0; i < Math.min(parts.length, 2); i++) {
                const ch = parts[i].charAt(0);
                if (ch && /[a-zA-Z0-9]/.test(ch)) brand += ch.toUpperCase();
            }
            brand = brand || '&#10070;';
        }
        const items = [];
        items.push('<li><a href="#pf-top" class="active"><span class="pf-nav-brand">' + brand + '</span><span class="pf-nav-name">' + esc(p.name || 'Portfolio') + '</span></a></li>');
        visibleSections(data, custom).forEach((s, i) => {
            if (!s.original) return;
            const id = sectionId(i, s.original);
            items.push('<li><a href="#' + id + '">' + esc(sectionLabel(s.original)) + '</a></li>');
        });
        return '<nav class="pf-nav" id="pf-top"><div class="pf-nav-inner"><ul>' + items.join('') + '</ul>' +
            '<div class="pf-progress" aria-hidden="true"><span></span></div></div></nav>';
    }

    /* ---------- the single accent-color registry ----------
       One definition drives the sidebar swatches, the live preview CSS and
       the exported CSS. A color therefore can never be offered in the UI
       without a matching rule behind it (that drift is exactly what made
       swatches look "dead" before). */
    function hexToRgba(hex, alpha) {
        const raw = String(hex || '').replace('#', '');
        const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw;
        const n = parseInt(full, 16);
        if (!full || isNaN(n)) return 'rgba(99,102,241,' + alpha + ')';
        return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
    }

    const COLORS = [
        { id: 'indigo',  name: 'Indigo',  accent: '#6366f1', accent2: '#8b5cf6' },
        { id: 'blue',    name: 'Blue',    accent: '#3b82f6', accent2: '#2563eb' },
        { id: 'sky',     name: 'Sky',     accent: '#0ea5e9', accent2: '#0284c7' },
        { id: 'cyan',    name: 'Cyan',    accent: '#06b6d4', accent2: '#0891b2' },
        { id: 'teal',    name: 'Teal',    accent: '#14b8a6', accent2: '#0d9488' },
        { id: 'emerald', name: 'Emerald', accent: '#10b981', accent2: '#059669' },
        { id: 'lime',    name: 'Lime',    accent: '#65a30d', accent2: '#4d7c0f' },
        { id: 'amber',   name: 'Amber',   accent: '#f59e0b', accent2: '#d97706', soft: 0.16 },
        { id: 'orange',  name: 'Orange',  accent: '#f97316', accent2: '#ea580c', soft: 0.15 },
        { id: 'rose',    name: 'Rose',    accent: '#f43f5e', accent2: '#e11d48' },
        { id: 'red',     name: 'Red',     accent: '#ef4444', accent2: '#dc2626' },
        { id: 'pink',    name: 'Pink',    accent: '#ec4899', accent2: '#db2777' },
        { id: 'purple',  name: 'Purple',  accent: '#8b5cf6', accent2: '#7c3aed' },
        { id: 'violet',  name: 'Violet',  accent: '#7c3aed', accent2: '#6d28d9' },
        { id: 'slate',   name: 'Slate',   accent: '#475569', accent2: '#334155' }
    ];
    const COLOR_IDS = COLORS.map((c) => c.id);

    /* Generated theme tokens: the light/dark surfaces plus every accent,
       with a stronger tint in dark mode so the color stays visible.
       This is injected into the shared layout CSS, which is used by BOTH
       the live preview and the downloaded file. */
    const THEME_CSS = [
        '.pf-root{--pf-bg:#f8fafc;--pf-surface:#ffffff;--pf-text:#0f172a;--pf-muted:#64748b;--pf-border:#e2e8f0;--pf-radius:16px;--pf-shadow:0 10px 30px rgba(15,23,42,.08);}',
        '.pf-root.pf-dark{--pf-bg:#0b1220;--pf-surface:#141c30;--pf-text:#e6edf7;--pf-muted:#94a3b8;--pf-border:#26334d;}'
    ].concat(COLORS.map((c) => {
        const soft = typeof c.soft === 'number' ? c.soft : 0.13;
        return '.pf-root.pf-' + c.id + '{--pf-accent:' + c.accent + ';--pf-accent-2:' + c.accent2 + ';' +
            '--pf-accent-soft:' + hexToRgba(c.accent, soft) + ';}' +
            '.pf-root.pf-dark.pf-' + c.id + '{--pf-accent-soft:' + hexToRgba(c.accent, Math.min(0.34, soft + 0.11)) + ';}';
    })).join('\n');

    /* ---------- the single template registry ----------
       Drives the sidebar radios, the Templates gallery page and the
       exported file, so a template can never be listed in one place
       and missing from another. Designs themselves are pure CSS
       (see PORTFOLIO_LAYOUT_CSS) and never replace resume content. */
    const TEMPLATES = [
        {
            id: 'modern', name: 'Modern', tagline: 'Centered hero & rounded cards',
            blurb: 'A centered hero with a gradient name treatment and soft rounded cards. The safe, friendly default for any resume.',
            tags: ['Centered hero', 'Gradient name', 'Rounded cards'],
            featured: true
        },
        {
            id: 'minimal', name: 'Minimal', tagline: 'Clean typography & simple lines',
            blurb: 'Left aligned, flat and quiet: square corners, hairline dividers and no shadows, so the writing does the talking.',
            tags: ['Flat & square', 'No shadows', 'Typography first'],
            featured: true
        },
        {
            id: 'professional', name: 'Professional', tagline: 'Accent banner & rule headers',
            blurb: 'A left hero with an accent banner and section headers marked by an accent rule. Built for formal applications.',
            tags: ['Accent banner', 'Rule headers', 'Formal'],
            featured: true
        },
        {
            id: 'elegant', name: 'Elegant', tagline: 'Serif display & centered rules',
            blurb: 'Serif headings, generous whitespace and a thin centered rule under every section title. Calm and editorial.',
            tags: ['Serif headings', 'Centered rules', 'Editorial']
        },
        {
            id: 'bold', name: 'Bold', tagline: 'Oversized type & thick accent bars',
            blurb: 'Heavy uppercase headings and thick accent blocks on the hero and every card. Maximum visual impact.',
            tags: ['Uppercase type', 'Thick bars', 'High impact']
        },
        {
            id: 'creative', name: 'Creative', tagline: 'Soft gradients & playful shapes',
            blurb: 'Large rounded corners, a soft gradient wash behind the hero and a slowly rotating accent ring around the avatar.',
            tags: ['Big radii', 'Gradient wash', 'Playful']
        },
        {
            id: 'magazine', name: 'Magazine', tagline: 'Editorial columns & big numbers',
            blurb: 'An editorial cover treatment: oversized section numbering, serif overlines and running text set in real magazine columns.',
            tags: ['Two columns', 'Editorial', 'Serif overlines']
        },
        {
            id: 'terminal', name: 'Terminal', tagline: 'Monospace prompts & thin rules',
            blurb: 'Monospace type, zero rounding and prompt-marked headings - a developer portfolio that reads like a well-kept shell session.',
            tags: ['Monospace', 'Prompt marks', 'Zero radius']
        },
        {
            id: 'glass', name: 'Glass', tagline: 'Frosted cards & soft light',
            blurb: 'Translucent frosted cards floating over a soft gradient mesh, with hairline borders and gentle depth. Modern and airy.',
            tags: ['Frosted cards', 'Blurred surfaces', 'Gradient mesh']
        },
        {
            id: 'retro', name: 'Retro', tagline: 'Hard shadows & thick outlines',
            blurb: 'Neo-brutalist blocks: thick outlines, hard offset shadows and no rounding at all. Confident, printed-poster energy.',
            tags: ['Hard shadows', 'Thick outlines', 'No rounding']
        },
        {
            id: 'neon', name: 'Neon', tagline: 'Glowing edges & deep canvas',
            blurb: 'Dark panels with accent-lit borders, soft glows and a luminous name treatment - built to shine on a dark screen.',
            tags: ['Glow effects', 'Lit borders', 'Dark canvas']
        },
        {
            id: 'pastel', name: 'Pastel', tagline: 'Soft tints & extra-round cards',
            blurb: 'Washed tints, very round corners and generous breathing room. Calm, friendly and easy on the eye.',
            tags: ['Soft tints', 'Extra round', 'Very airy']
        },
        {
            id: 'compact', name: 'Compact', tagline: 'Dense one-column resume sheet',
            blurb: 'Tight, single column and print-friendly: small type, narrow measure and no decoration competing with the content.',
            tags: ['Dense layout', 'Print friendly', 'Single column']
        },
        {
            id: 'split', name: 'Split', tagline: 'Sticky rail & content column',
            blurb: 'Each section keeps its heading pinned in a left rail while the content scrolls beside it. Structured and very scannable.',
            tags: ['Sticky headings', 'Two columns', 'Scannable']
        },
        {
            id: 'aurora', name: 'Aurora', tagline: 'Living gradient & glassy chips',
            blurb: 'A slow shifting aurora gradient washes the hero, dividers and chips. Colour that moves without ever distracting.',
            tags: ['Animated gradient', 'Glassy chips', 'Colour wash']
        }
    ];
    const TEMPLATE_IDS = TEMPLATES.map((t) => t.id);
    /* The sidebar deliberately offers only the three safest all-round
       designs; every other template stays one click away in the gallery. */
    const FEATURED_TEMPLATES = TEMPLATES.filter((t) => t.featured);
    const FEATURED_IDS = FEATURED_TEMPLATES.map((t) => t.id);

    /* One class builder for live appearance updates and exported portfolios. */
    function appearanceClasses(custom) {
        const pick = (value, allowed) => allowed.includes(value) ? value : allowed[0];
        return 'pf-root pf-' + pick(custom.theme, ['light', 'dark']) +
            ' pf-' + pick(custom.color, COLOR_IDS) +
            ' pf-' + pick(custom.layout, TEMPLATE_IDS);
    }

    /* ---------- full preview HTML ---------- */
    function buildPortfolioHtml(data, custom) {
        custom = custom || {};
        const parts = [];
        parts.push('<div class="' + appearanceClasses(custom) + '">');
        parts.push('<style>' + PORTFOLIO_LAYOUT_CSS + '</style>');
        parts.push(buildNav(data, custom));
        parts.push('<div class="pf-hero-wrap">' + buildHero(data, custom) + '</div>');
        visibleSections(data, custom).forEach((s, i) => parts.push(renderSectionBlock(s, i, custom)));
        parts.push('<footer class="pf-footer"><div class="pf-footer-inner">' +
            '<p class="pf-footer-brand">' + typeIcon('summary') + ' &nbsp;' + esc((data.personalInfo || {}).name || 'Portfolio') + '</p>' +
            '<p class="pf-footer-meta">Crafted from your resume &middot; every section &middot; every line preserved</p>' +
            '<a class="pf-scroll-top" href="#pf-top">&#8593; Back to top</a>' +
        '</div></footer>');
        parts.push('</div>');
        return parts.join('');
    }

/* ---------- content-integrity validation ---------- */
    function validate(data) {
        const report = { total: 0, empty: [], missingFromNav: [] };
        const s = (data && data.sections) || [];
        report.total = s.length;
        s.forEach((sec) => {
            if (!sec.lines.length) report.empty.push(sec.original);
        });
        return report;
    }

    /* ---------- download a standalone HTML file ---------- */
    function buildStandalone(data, custom) {
        custom = custom || {};
        const body = buildPortfolioHtml(data, custom);
        const name = ((data.personalInfo || {}).name || 'portfolio').toLowerCase().replace(/\s+/g, '-');
        return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
            '<title>' + esc((data.personalInfo || {}).name || 'Portfolio') + ' &middot; Portfolio</title>' +
            '<style>' + STANDALONE_CSS + '</style></head><body>' + body +
            '<script>document.addEventListener("DOMContentLoaded",function(){try{' +
            'var root=document.querySelector(".pf-preview-scroll");' +
            'var reveals=Array.prototype.slice.call(document.querySelectorAll(".reveal"));' +
            'var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;' +
            'if(reduce||!("IntersectionObserver" in window)){reveals.forEach(function(el){el.classList.add("visible");});}' +
            'else{var io=new IntersectionObserver(function(list){list.forEach(function(en){' +
            'if(en.isIntersecting){en.target.classList.add("visible");io.unobserve(en.target);}});},{threshold:.12,rootMargin:"0px 0px -30px 0px"});' +
            'reveals.forEach(function(el){io.observe(el);});}' +
            'var bar=document.querySelector(".pf-progress span");' +
            'function paintProgress(){if(!bar){return;}var d=document.scrollingElement||document.documentElement;' +
            'var max=Math.max(1,d.scrollHeight-window.innerHeight);var y=window.pageYOffset||d.scrollTop||0;' +
            'bar.style.width=(Math.min(1,Math.max(0,y/max))*100).toFixed(2)+"%";}' +
            'window.addEventListener("scroll",paintProgress);window.addEventListener("resize",paintProgress);paintProgress();' +
            'document.querySelectorAll("a[href^=\\"#pf-\\"]").forEach(function(a){a.addEventListener("click",function(e){' +
            'var t=document.querySelector(a.getAttribute("href"));if(!t){return;}e.preventDefault();' +
            'if(root){root.scrollTo({top:t.offsetTop-70,behavior:"smooth"});}else{window.scrollTo({top:t.offsetTop-70,behavior:"smooth"});}});});' +
            '}catch(e){}});<\/script></body></html>';
    }

    /* Shared refinements travel with the markup: preview and offline export
       use exactly the same responsive project/section design. */
    const PORTFOLIO_LAYOUT_CSS = THEME_CSS + `
.pf-root *, .pf-root *::before, .pf-root *::after { box-sizing: border-box; }
.pf-root { overflow-wrap: anywhere; background: var(--pf-bg); color: var(--pf-text); line-height: 1.6; min-height: 100vh; }
.pf-root.pf-light { color-scheme: light; }
.pf-root.pf-dark { color-scheme: dark; }
.pf-root .pf-section { padding-top: 40px; padding-bottom: 40px; scroll-margin-top: 85px; }
.pf-root .pf-section + .pf-section { border-top: 1px solid var(--pf-border); }
.pf-root .pf-section-head { flex-wrap: wrap; }
.pf-root .pf-section-title { flex: 1; min-width: 0; line-height: 1.3; }
.pf-root .pf-entry-top { display: grid; gap: 7px; }
.pf-root .pf-entry-title { line-height: 1.4; }
.pf-root .pf-entry-text { color: var(--pf-text); opacity: .88; line-height: 1.8; }
.pf-root .pf-lines { max-width: 78ch; }
.pf-root .pf-skills { grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); }
.pf-root .pf-project-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 22px; align-items: stretch; }
.pf-root .pf-project { margin: 0; padding: 26px; display: flex; flex-direction: column; min-width: 0; border-top: 3px solid var(--pf-accent); }
.pf-root .pf-project::before { display: none; }
.pf-root .pf-project-head { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 8px; }
.pf-root .pf-project-head .pf-entry-title { font-size: 1.2rem; margin: 0; }
.pf-root .pf-project-number { flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: var(--pf-accent-soft); color: var(--pf-accent); font-size: .8rem; font-weight: 800; }
.pf-root .pf-project-description { flex: 1; }
.pf-root .pf-project-tech { border-top: 1px solid var(--pf-border); padding-top: 18px; margin: 22px 0 0; display: grid; gap: 14px; }
.pf-root .pf-project-tech dt { color: var(--pf-muted); font-size: .76rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 9px; }
.pf-root .pf-project-tech dd { margin: 0; }
.pf-root .pf-project-tech .pf-chip { padding: 5px 10px; border-radius: 8px; font-size: .78rem; box-shadow: none; }
.pf-root .pf-content-link { color: var(--pf-accent); text-underline-offset: 4px; }
.pf-root a:focus-visible { outline: 3px solid var(--pf-accent); outline-offset: 4px; border-radius: 4px; }
.pf-root .pf-entries-grid { grid-template-columns: repeat(auto-fit, minmax(min(100%, 270px), 1fr)); }
.pf-root .pf-chip, .pf-root .pf-pill { max-width: 100%; }
/* Resume-order layouts, shared by preview and offline export. */
.pf-root .pf-stack .pf-skills, .pf-root .pf-stack .pf-project-grid, .pf-root .pf-stack .pf-entries-grid { grid-template-columns: minmax(0, 1fr); }
.pf-root .pf-project-tech { margin: 12px 0; padding: 14px 0; border-top: 0; border-bottom: 1px solid var(--pf-border); }
.pf-root .pf-project-description { flex: none; }
.pf-root .pf-soft-skills { display: grid; gap: 10px; list-style: none; padding: 0; margin: 0; }
.pf-root .pf-soft-skills li { padding: 14px 18px; border-left: 3px solid var(--pf-accent); border-radius: 0 10px 10px 0; background: var(--pf-surface); box-shadow: var(--pf-shadow); }
.pf-root .pf-details { margin: 0; min-width: 0; }
.pf-root .pf-detail-row { display: grid; grid-template-columns: minmax(120px, 180px) minmax(0, 1fr); gap: 10px 24px; padding: 14px 0; border-bottom: 1px solid var(--pf-border); }
.pf-root .pf-detail-row dt { font-weight: 600; color: var(--pf-muted); }
.pf-root .pf-detail-row dt, .pf-root .pf-detail-row dd { min-width: 0; overflow-wrap: anywhere; }
.pf-root .pf-detail-row dd { margin: 0; color: var(--pf-text); }
.pf-root .pf-detail-row .pf-detail-unlabelled { grid-column: 1 / -1; }
.pf-root .pf-declaration-footer { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: end; gap: 24px; margin-top: 26px; }
.pf-root .pf-signature { display: grid; gap: 8px; text-align: right; color: var(--pf-muted); padding: 14px 0; }
.pf-root .pf-signature-name { font-weight: 600; color: var(--pf-text); }
@media (hover:hover) and (prefers-reduced-motion:no-preference) {
.pf-root .pf-soft-skills li.visible:hover { transform: translateX(4px); }
}
@media(max-width:480px) {
.pf-root .pf-detail-row, .pf-root .pf-declaration-footer { grid-template-columns: minmax(0, 1fr); }
.pf-root .pf-signature { text-align: left; }
}
@media(max-width:640px) {
.pf-root .pf-declaration-footer { grid-template-columns: minmax(0, 1fr); }
.pf-root .pf-signature { text-align: left; }
.pf-root .pf-project-grid, .pf-root .pf-skills { grid-template-columns: minmax(0, 1fr); }
.pf-root .pf-project { padding: 20px; }
.pf-root .pf-section { padding: 28px 16px; }
.pf-root .pf-section-head { gap: 8px; }
.pf-root .pf-section-title { font-size: 1.35rem; }
}
/* Distinct templates share all content and never override the chosen palette. */
.pf-root.pf-minimal { --pf-radius: 4px; --pf-shadow: none; }
.pf-root.pf-minimal .pf-hero { text-align: left; background: var(--pf-surface); border-bottom: 1px solid var(--pf-border); padding: 40px 24px; }
.pf-root.pf-minimal .pf-hero-bg { display: none; }
.pf-root.pf-minimal .pf-hero-inner { max-width: 772px; margin: auto; }
.pf-root.pf-minimal .pf-hero-avatar { margin-left: 0; width: 54px; height: 54px; border-radius: 4px; box-shadow: none; }
.pf-root.pf-minimal .pf-hero-name { background: none; color: var(--pf-text); -webkit-text-fill-color: currentColor; animation: none; font-size: clamp(1.8rem, 4vw, 2.5rem); }
.pf-root.pf-minimal .pf-hero-pills { justify-content: flex-start; }
.pf-root.pf-minimal .pf-hero-intro { margin-left: 0; }
.pf-root.pf-minimal .pf-entry, .pf-root.pf-minimal .pf-skill-group { box-shadow: none; border-radius: 4px; }
.pf-root.pf-minimal .pf-section-title { font-size: 1.25rem; font-weight: 600; }
.pf-root.pf-professional { --pf-radius: 8px; }
.pf-root.pf-professional .pf-hero { text-align: left; padding: 44px 24px; border-top: 8px solid var(--pf-accent); border-bottom: 1px solid var(--pf-border); background: var(--pf-accent-soft); }
.pf-root.pf-professional .pf-hero-bg { display: none; }
.pf-root.pf-professional .pf-hero-inner { max-width: 832px; margin: auto; }
.pf-root.pf-professional .pf-hero-avatar { margin-left: 0; border-radius: 8px; }
.pf-root.pf-professional .pf-hero-name { background: none; color: var(--pf-text); -webkit-text-fill-color: currentColor; animation: none; }
.pf-root.pf-professional .pf-hero-intro { margin-left: 0; }
.pf-root.pf-professional .pf-hero-pills { justify-content: flex-start; }
.pf-root.pf-professional .pf-section-head { padding: 14px; border-left: 4px solid var(--pf-accent); background: var(--pf-accent-soft); }
.pf-root.pf-professional .pf-entry, .pf-root.pf-professional .pf-skill-group { border-radius: 8px; box-shadow: none; }
.pf-root.pf-professional .pf-section-title { font-size: 1.25rem; }
/* Elegant - serif display, centered rules, editorial whitespace. */
.pf-root.pf-elegant { --pf-radius: 3px; --pf-shadow: none; }
.pf-root.pf-elegant .pf-hero { text-align: center; padding: 78px 24px 62px; background: var(--pf-surface); border-bottom: 1px solid var(--pf-border); }
.pf-root.pf-elegant .pf-hero-bg { display: none; }
.pf-root.pf-elegant .pf-hero-inner { max-width: 780px; }
.pf-root.pf-elegant .pf-hero-avatar { width: 66px; height: 66px; border-radius: 50%; background: none; border: 1px solid var(--pf-accent); color: var(--pf-accent); box-shadow: none; font-size: 1.05rem; letter-spacing: .08em; }
.pf-root.pf-elegant .pf-hero-name { font-family: Georgia, 'Times New Roman', serif; font-weight: 400; letter-spacing: .07em; text-transform: uppercase; font-size: clamp(1.55rem, 3.6vw, 2.35rem); background: none; color: var(--pf-text); -webkit-text-fill-color: currentColor; animation: none; }
.pf-root.pf-elegant .pf-hero-role { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 400; letter-spacing: .03em; }
.pf-root.pf-elegant .pf-hero-intro { max-width: 620px; }
.pf-root.pf-elegant .pf-section { max-width: 800px; }
.pf-root.pf-elegant .pf-section-head { flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.pf-root.pf-elegant .pf-section-icon { width: auto; height: auto; background: none; box-shadow: none; color: var(--pf-accent); font-size: 1.05rem; }
.pf-root.pf-elegant .pf-section-title { font-family: Georgia, 'Times New Roman', serif; font-weight: 400; text-transform: uppercase; letter-spacing: .16em; font-size: 1.02rem; }
.pf-root.pf-elegant .pf-section-title::after { width: 64px; height: 1px; background: var(--pf-accent); margin-left: auto; margin-right: auto; }
.pf-root.pf-elegant .pf-section-head.visible .pf-section-title::after { width: 64px; }
.pf-root.pf-elegant .pf-entry, .pf-root.pf-elegant .pf-skill-group { background: none; border-color: transparent; border-bottom: 1px solid var(--pf-border); border-radius: 3px; box-shadow: none; padding-left: 0; padding-right: 0; }
.pf-root.pf-elegant .pf-entry::before { display: none; }
.pf-root.pf-elegant .pf-timeline { padding-left: 0; }
.pf-root.pf-elegant .pf-timeline::before { display: none; }
.pf-root.pf-elegant .pf-project { border-top-width: 1px; }
/* Bold - oversized uppercase type and thick accent bars. */
.pf-root.pf-bold { --pf-radius: 10px; }
.pf-root.pf-bold .pf-hero { text-align: left; padding: 60px 24px 52px; background: var(--pf-surface); border-bottom: 6px solid var(--pf-accent); }
.pf-root.pf-bold .pf-hero-bg { display: none; }
.pf-root.pf-bold .pf-hero-inner { max-width: 940px; }
.pf-root.pf-bold .pf-hero-avatar { margin-left: 0; margin-right: 0; border-radius: 6px; background: var(--pf-accent); box-shadow: none; font-size: 2rem; }
.pf-root.pf-bold .pf-hero-name { font-weight: 900; text-transform: uppercase; letter-spacing: -.03em; line-height: 1.05; font-size: clamp(2rem, 5.4vw, 3.3rem); background: none; color: var(--pf-text); -webkit-text-fill-color: currentColor; animation: none; }
.pf-root.pf-bold .pf-hero-role { text-transform: uppercase; letter-spacing: .18em; font-size: .86rem; font-weight: 800; }
.pf-root.pf-bold .pf-hero-intro { max-width: 660px; margin-left: 0; }
.pf-root.pf-bold .pf-hero-pills { justify-content: flex-start; }
.pf-root.pf-bold .pf-section-icon { width: 52px; height: 52px; border-radius: 4px; font-size: 1.35rem; }
.pf-root.pf-bold .pf-section-title { text-transform: uppercase; font-weight: 900; letter-spacing: -.01em; font-size: 1.7rem; }
.pf-root.pf-bold .pf-section-title::after { width: 72px; height: 7px; border-radius: 0; }
.pf-root.pf-bold .pf-section-head.visible .pf-section-title::after { width: 132px; }
.pf-root.pf-bold .pf-index { font-size: 1rem; }
.pf-root.pf-bold .pf-entry { border-left: 8px solid var(--pf-accent); padding-left: 22px; }
.pf-root.pf-bold .pf-entry::before { display: none; }
.pf-root.pf-bold .pf-project { border-top-width: 8px; }
.pf-root.pf-bold .pf-project-number { border-radius: 4px; font-weight: 900; }
/* Creative - big radii, gradient wash and a slowly spinning accent ring. */
.pf-root.pf-creative { --pf-radius: 26px; }
.pf-root.pf-creative .pf-hero { border-radius: 0 0 40px 40px; background: linear-gradient(150deg, var(--pf-accent-soft), transparent 58%), var(--pf-surface); border-bottom: 1px solid var(--pf-border); }
.pf-root.pf-creative .pf-hero-bg span { opacity: .4; }
.pf-root.pf-creative .pf-hero-avatar { border-radius: 50%; position: relative; font-size: 1.45rem; }
.pf-root.pf-creative .pf-hero-avatar::after { content: ""; position: absolute; inset: -7px; border-radius: 50%; border: 2px dashed var(--pf-accent); opacity: .55; animation: pfSpin 14s linear infinite; }
.pf-root.pf-creative .pf-entry, .pf-root.pf-creative .pf-skill-group { border-radius: 26px; }
.pf-root.pf-creative .pf-project { border-top: 0; border-left: 5px solid var(--pf-accent); }
.pf-root.pf-creative .pf-chip, .pf-root.pf-creative .pf-section-title::after { border-radius: 999px; }
@keyframes pfSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
/* Magazine - editorial cover, oversized numbering and real text columns. */
.pf-root.pf-magazine { --pf-radius: 2px; }
.pf-root.pf-magazine .pf-hero { text-align: left; padding: 62px 24px 46px; background: none; border-bottom: 3px double var(--pf-text); }
.pf-root.pf-magazine .pf-hero-bg { display: none; }
.pf-root.pf-magazine .pf-hero-avatar { margin: 0 0 16px; border-radius: 0; background: none; border: 2px solid var(--pf-text); color: var(--pf-text); box-shadow: none; font-size: 1.4rem; }
.pf-root.pf-magazine .pf-hero-name { font-family: Georgia, 'Times New Roman', serif; font-weight: 400; letter-spacing: -.01em; font-size: clamp(2.1rem, 5.6vw, 3.3rem); background: none; color: var(--pf-text); -webkit-text-fill-color: currentColor; animation: none; }
.pf-root.pf-magazine .pf-hero-role { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 400; font-size: 1.06rem; color: var(--pf-muted); }
.pf-root.pf-magazine .pf-hero-intro { max-width: 60ch; border-left: 3px solid var(--pf-accent); padding-left: 16px; }
.pf-root.pf-magazine .pf-section { max-width: 960px; }
.pf-root.pf-magazine .pf-section-head { align-items: baseline; gap: 14px; border-bottom: 1px solid var(--pf-border); padding-bottom: 10px; }
.pf-root.pf-magazine .pf-section-icon { width: auto; height: auto; background: none; box-shadow: none; color: var(--pf-text); font-size: 1rem; }
.pf-root.pf-magazine .pf-index { font-family: Georgia, 'Times New Roman', serif; font-size: 1.9rem; line-height: 1; letter-spacing: 0; color: var(--pf-accent); }
.pf-root.pf-magazine .pf-section-title { font-family: Georgia, 'Times New Roman', serif; font-weight: 400; letter-spacing: -.005em; }
.pf-root.pf-magazine .pf-section-title::after { width: 100%; height: 1px; border-radius: 0; background: var(--pf-border); }
.pf-root.pf-magazine .pf-section-body { column-count: 2; column-gap: 34px; column-rule: 1px solid var(--pf-border); }
.pf-root.pf-magazine .pf-entries-grid, .pf-root.pf-magazine .pf-project-grid, .pf-root.pf-magazine .pf-skills { grid-template-columns: minmax(0, 1fr); }
.pf-root.pf-magazine .pf-entry, .pf-root.pf-magazine .pf-skill-group, .pf-root.pf-magazine .pf-project { break-inside: avoid; margin: 0 0 14px; padding: 0 0 14px; background: none; border: 0; border-bottom: 1px dotted var(--pf-border); border-radius: 0; box-shadow: none; }
.pf-root.pf-magazine .pf-entry-title { font-family: Georgia, 'Times New Roman', serif; }
.pf-root.pf-magazine .pf-chip, .pf-root.pf-magazine .pf-pill, .pf-root.pf-magazine .pf-entry-meta { border-radius: 2px; box-shadow: none; }
@media(max-width:760px) { .pf-root.pf-magazine .pf-section-body { column-count: 1; } }
/* Terminal - monospace type, prompt marks and hairline rules. */
.pf-root.pf-terminal { --pf-radius: 0; --pf-shadow: none; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace; }
.pf-root.pf-terminal .pf-hero { text-align: left; padding: 54px 24px 46px; background: var(--pf-surface); border-bottom: 1px dashed var(--pf-border); }
.pf-root.pf-terminal .pf-hero-bg { display: none; }
.pf-root.pf-terminal .pf-hero-avatar { margin: 0 0 14px; border-radius: 0; background: none; border: 1px solid var(--pf-accent); color: var(--pf-accent); box-shadow: none; font-size: 1.05rem; }
.pf-root.pf-terminal .pf-hero-name { font-size: clamp(1.6rem, 4.2vw, 2.4rem); font-weight: 700; letter-spacing: -.02em; background: none; color: var(--pf-text); -webkit-text-fill-color: currentColor; animation: none; }
.pf-root.pf-terminal .pf-hero-name::before { content: "$ "; color: var(--pf-accent); }
.pf-root.pf-terminal .pf-hero-role { font-size: .98rem; letter-spacing: 0; }
.pf-root.pf-terminal .pf-hero-role::before { content: "> "; color: var(--pf-accent); }
.pf-root.pf-terminal .pf-section-head { border-bottom: 1px dashed var(--pf-border); padding-bottom: 8px; }
.pf-root.pf-terminal .pf-section-icon { width: auto; height: auto; border-radius: 0; background: none; box-shadow: none; color: var(--pf-accent); font-size: 1rem; }
.pf-root.pf-terminal .pf-section-title { font-weight: 600; letter-spacing: -.01em; }
.pf-root.pf-terminal .pf-section-title::before { content: "# "; color: var(--pf-accent); }
.pf-root.pf-terminal .pf-section-title::after { display: none; }
.pf-root.pf-terminal .pf-entry, .pf-root.pf-terminal .pf-skill-group, .pf-root.pf-terminal .pf-project { border-radius: 0; border-style: dashed; box-shadow: none; }
.pf-root.pf-terminal .pf-entry-list li::before { width: 7px; height: 2px; border-radius: 0; background: var(--pf-accent); transform: none; top: .82em; }
.pf-root.pf-terminal .pf-chip, .pf-root.pf-terminal .pf-pill, .pf-root.pf-terminal .pf-entry-meta { border-radius: 0; box-shadow: none; }
.pf-root.pf-terminal .pf-chip::before { background: none; }
.pf-root.pf-terminal .pf-chip::after { content: ""; flex: none; width: 5px; height: 10px; background: var(--pf-accent); }
.pf-root.pf-terminal .pf-entry-meta { border-color: var(--pf-accent); }
/* Glass - frosted translucent cards over a soft gradient mesh. */
.pf-root.pf-glass { --pf-radius: 22px; }
.pf-root.pf-glass .pf-hero { background: linear-gradient(135deg, var(--pf-accent-soft), transparent 58%), radial-gradient(circle at 82% 18%, var(--pf-accent-soft), transparent 58%), var(--pf-surface); }
.pf-root.pf-glass .pf-hero-bg span { opacity: .45; }
.pf-root.pf-glass .pf-hero-avatar { border-radius: 26px; }
.pf-root.pf-glass .pf-nav { background: rgba(255, 255, 255, .72); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
.pf-root.pf-glass.pf-dark .pf-nav { background: rgba(20, 28, 48, .72); }
.pf-root.pf-glass .pf-entry, .pf-root.pf-glass .pf-skill-group, .pf-root.pf-glass .pf-project { background: rgba(255, 255, 255, .62); border: 1px solid rgba(255, 255, 255, .75); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 18px 42px rgba(15, 23, 42, .12); }
.pf-root.pf-glass.pf-dark .pf-entry, .pf-root.pf-glass.pf-dark .pf-skill-group, .pf-root.pf-glass.pf-dark .pf-project { background: rgba(20, 28, 48, .55); border-color: rgba(255, 255, 255, .12); box-shadow: 0 18px 42px rgba(0, 0, 0, .35); }
.pf-root.pf-glass .pf-project { border-top: 3px solid var(--pf-accent); }
.pf-root.pf-glass .pf-chip { background: rgba(255, 255, 255, .55); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-color: rgba(255, 255, 255, .7); }
.pf-root.pf-glass.pf-dark .pf-chip { background: rgba(20, 28, 48, .5); border-color: rgba(255, 255, 255, .14); }
.pf-root.pf-glass .pf-section-title::after { height: 3px; background: linear-gradient(90deg, var(--pf-accent), transparent); }
/* Retro - neo-brutalist outlines and hard offset shadows. */
.pf-root.pf-retro { --pf-radius: 0; --pf-shadow: 6px 6px 0 var(--pf-text); }
.pf-root.pf-retro .pf-hero { text-align: left; padding: 56px 24px 50px; background: var(--pf-accent-soft); border-bottom: 4px solid var(--pf-text); }
.pf-root.pf-retro .pf-hero-bg { display: none; }
.pf-root.pf-retro .pf-hero-avatar { margin: 0 0 16px; border-radius: 0; background: var(--pf-accent); border: 3px solid var(--pf-text); box-shadow: 5px 5px 0 var(--pf-text); font-size: 1.6rem; }
.pf-root.pf-retro .pf-hero-name { font-weight: 900; text-transform: uppercase; letter-spacing: -.02em; line-height: 1.04; font-size: clamp(1.9rem, 5vw, 3rem); background: none; color: var(--pf-text); -webkit-text-fill-color: currentColor; animation: none; }
.pf-root.pf-retro .pf-hero-role { text-transform: uppercase; letter-spacing: .16em; font-weight: 800; font-size: .84rem; }
.pf-root.pf-retro .pf-section-icon { border-radius: 0; box-shadow: 3px 3px 0 var(--pf-text); }
.pf-root.pf-retro .pf-section-title { text-transform: uppercase; font-weight: 900; letter-spacing: -.01em; }
.pf-root.pf-retro .pf-section-title::after { height: 6px; border-radius: 0; background: var(--pf-text); }
.pf-root.pf-retro .pf-entry, .pf-root.pf-retro .pf-skill-group, .pf-root.pf-retro .pf-project { border: 3px solid var(--pf-text); border-radius: 0; box-shadow: 6px 6px 0 var(--pf-text); }
.pf-root.pf-retro .pf-project { border-top: 3px solid var(--pf-text); }
.pf-root.pf-retro .pf-chip { border: 2px solid var(--pf-text); border-radius: 0; box-shadow: 3px 3px 0 var(--pf-text); background: var(--pf-surface); }
.pf-root.pf-retro .pf-pill:not(.pf-pill-accent) { border-radius: 0; border: 2px solid var(--pf-text); background: transparent; color: var(--pf-text); }
.pf-root.pf-retro .pf-entry-meta { border-radius: 0; border: 2px solid var(--pf-text); background: transparent; color: var(--pf-text); }
/* Neon - accent-lit borders and soft glows on a deeper surface. */
.pf-root.pf-neon { --pf-radius: 14px; }
.pf-root.pf-neon .pf-hero { background: radial-gradient(circle at 50% 0%, var(--pf-accent-soft), transparent 62%), var(--pf-surface); border-bottom: 1px solid var(--pf-accent); }
.pf-root.pf-neon .pf-hero-bg span { opacity: .5; }
.pf-root.pf-neon .pf-hero-avatar { background: transparent; border: 2px solid var(--pf-accent); color: var(--pf-accent); box-shadow: 0 0 22px var(--pf-accent-soft), inset 0 0 18px var(--pf-accent-soft); }
.pf-root.pf-neon .pf-hero-name { text-shadow: 0 0 26px var(--pf-accent-soft); }
.pf-root.pf-neon .pf-section-icon { background: transparent; color: var(--pf-accent); border: 1px solid var(--pf-accent); box-shadow: 0 0 18px var(--pf-accent-soft); }
.pf-root.pf-neon .pf-entry, .pf-root.pf-neon .pf-skill-group, .pf-root.pf-neon .pf-project { border: 1px solid var(--pf-accent); box-shadow: 0 0 0 1px var(--pf-accent-soft), 0 14px 34px var(--pf-accent-soft); }
.pf-root.pf-neon .pf-project { border-top: 3px solid var(--pf-accent); }
.pf-root.pf-neon .pf-chip { background: transparent; border-color: var(--pf-accent); color: var(--pf-accent); box-shadow: 0 0 14px var(--pf-accent-soft); }
.pf-root.pf-neon .pf-section-title::after { background: var(--pf-accent); box-shadow: 0 0 14px var(--pf-accent); }
/* Pastel - washed tints, very round cards and generous spacing. */
.pf-root.pf-pastel { --pf-radius: 28px; --pf-shadow: 0 14px 34px var(--pf-accent-soft); }
.pf-root.pf-pastel .pf-hero { background: linear-gradient(180deg, var(--pf-accent-soft), transparent 78%), var(--pf-surface); border-bottom: 1px solid var(--pf-border); }
.pf-root.pf-pastel .pf-hero-bg span { opacity: .3; filter: blur(80px); }
.pf-root.pf-pastel .pf-hero-avatar { border-radius: 34%; background: var(--pf-accent-soft); color: var(--pf-accent); box-shadow: none; }
.pf-root.pf-pastel .pf-hero-name { animation: none; background: none; color: var(--pf-text); -webkit-text-fill-color: currentColor; font-weight: 800; }
.pf-root.pf-pastel .pf-section { padding-top: 52px; padding-bottom: 52px; }
.pf-root.pf-pastel .pf-entry, .pf-root.pf-pastel .pf-skill-group, .pf-root.pf-pastel .pf-project { border-radius: 28px; border-color: transparent; box-shadow: var(--pf-shadow); }
.pf-root.pf-pastel .pf-project { border-top: 3px solid var(--pf-accent); }
.pf-root.pf-pastel .pf-chip { border-color: transparent; background: var(--pf-accent-soft); }
.pf-root.pf-pastel .pf-section-icon { border-radius: 50%; background: var(--pf-accent-soft); color: var(--pf-accent); box-shadow: none; }
.pf-root.pf-pastel .pf-section-title::after { height: 6px; border-radius: 999px; }
/* Compact - dense single column tuned for printing and quick scanning. */
.pf-root.pf-compact { --pf-radius: 6px; --pf-shadow: none; font-size: .95rem; }
.pf-root.pf-compact .pf-hero { padding: 32px 20px 26px; }
.pf-root.pf-compact .pf-hero-bg { display: none; }
.pf-root.pf-compact .pf-hero-avatar { width: 46px; height: 46px; border-radius: 8px; font-size: 1rem; box-shadow: none; }
.pf-root.pf-compact .pf-hero-name { font-size: clamp(1.4rem, 3.2vw, 1.9rem); }
.pf-root.pf-compact .pf-hero-intro { font-size: .92rem; }
.pf-root.pf-compact .pf-section { max-width: 760px; padding-top: 20px; padding-bottom: 20px; }
.pf-root.pf-compact .pf-section-head { margin-bottom: 12px; }
.pf-root.pf-compact .pf-section-icon { width: 26px; height: 26px; border-radius: 6px; font-size: .8rem; box-shadow: none; }
.pf-root.pf-compact .pf-section-title { font-size: 1.12rem; }
.pf-root.pf-compact .pf-section-title::after { width: 30px; height: 2px; }
.pf-root.pf-compact .pf-entry, .pf-root.pf-compact .pf-skill-group, .pf-root.pf-compact .pf-project { margin: 8px 0; padding: 12px 14px; border-radius: 6px; box-shadow: none; }
.pf-root.pf-compact .pf-entries-grid, .pf-root.pf-compact .pf-project-grid, .pf-root.pf-compact .pf-skills { grid-template-columns: minmax(0, 1fr); }
.pf-root.pf-compact .pf-chip { padding: 4px 10px; font-size: .78rem; box-shadow: none; }
.pf-root.pf-compact .pf-entry-text, .pf-root.pf-compact .pf-lines p { font-size: .9rem; line-height: 1.6; }
/* Split - section headings pinned in a left rail beside their content. */
.pf-root.pf-split { --pf-radius: 12px; }
.pf-root.pf-split .pf-hero { text-align: left; }
.pf-root.pf-split .pf-hero-avatar { margin-left: 0; margin-right: 0; }
.pf-root.pf-split .pf-hero-pills { justify-content: flex-start; }
.pf-root.pf-split .pf-section { display: grid; grid-template-columns: minmax(0, 250px) minmax(0, 1fr); gap: 10px 30px; align-items: start; max-width: 1040px; }
.pf-root.pf-split .pf-section-head { grid-column: 1; grid-row: 1; position: sticky; top: 84px; flex-direction: column; align-items: flex-start; gap: 8px; margin-bottom: 0; padding-right: 18px; border-right: 2px solid var(--pf-accent-soft); }
.pf-root.pf-split .pf-section-body { grid-column: 2; grid-row: 1; }
.pf-root.pf-split .pf-section-body:first-child { grid-column: 1 / -1; }
.pf-root.pf-split .pf-section-title::after { width: 34px; height: 3px; }
@media(max-width:820px) {
.pf-root.pf-split .pf-section { grid-template-columns: minmax(0, 1fr); }
.pf-root.pf-split .pf-section-head { position: static; border-right: 0; padding-right: 0; }
.pf-root.pf-split .pf-section-body { grid-column: 1; grid-row: auto; }
}
/* Aurora - a slow shifting gradient wash over hero, rules and chips. */
.pf-root.pf-aurora { --pf-radius: 18px; }
.pf-root.pf-aurora .pf-hero { background: linear-gradient(115deg, var(--pf-accent-soft), transparent 42%, var(--pf-accent-soft)), var(--pf-surface); background-size: 220% 220%; animation: pfAurora 18s ease-in-out infinite; }
.pf-root.pf-aurora .pf-hero-bg span { opacity: .38; }
.pf-root.pf-aurora .pf-hero-name { text-shadow: 0 6px 26px var(--pf-accent-soft); }
.pf-root.pf-aurora .pf-section-title::after { height: 5px; background: linear-gradient(90deg, var(--pf-accent), var(--pf-accent-2), var(--pf-accent)); background-size: 220% auto; animation: pfShine 8s linear infinite; }
.pf-root.pf-aurora .pf-entry, .pf-root.pf-aurora .pf-skill-group, .pf-root.pf-aurora .pf-project { border-color: transparent; background: linear-gradient(160deg, var(--pf-accent-soft), transparent 55%), var(--pf-surface); box-shadow: 0 16px 36px var(--pf-accent-soft); }
.pf-root.pf-aurora .pf-project { border-top: 3px solid var(--pf-accent); }
.pf-root.pf-aurora .pf-chip { border-color: transparent; background: linear-gradient(120deg, var(--pf-accent-soft), transparent), var(--pf-surface); }
.pf-root.pf-aurora .pf-section-icon { background: linear-gradient(135deg, var(--pf-accent), var(--pf-accent-2)); }
@keyframes pfAurora { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
@media(prefers-reduced-motion:reduce) {
.pf-root *, .pf-root *::before, .pf-root *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
.pf-root .reveal { opacity: 1; transform: none; }
}
@media print {
.pf-root .reveal { opacity: 1; transform: none; }
.pf-root .pf-project-grid { display: block; }
.pf-root .pf-entry { break-inside: avoid; margin-bottom: 16px; }
}
`;

    /* Compact portfolio CSS bundled into standalone downloads so the file
       opens anywhere. Scope mirrors the live preview design system. */
    const STANDALONE_CSS = 'body{margin:0;background:#f8fafc;color:#0f172a;font-family:Inter,system-ui,sans-serif;}' +
        '.pf-root{--pf-bg:#f8fafc;--pf-surface:#ffffff;--pf-text:#0f172a;--pf-muted:#64748b;--pf-border:#e2e8f0;--pf-accent:#6366f1;--pf-accent-2:#8b5cf6;--pf-accent-soft:rgba(99,102,241,.12);--pf-radius:16px;--pf-shadow:0 10px 30px rgba(15,23,42,.08);}' +
        '.pf-root.pf-dark{--pf-bg:#0b1220;--pf-surface:#141c30;--pf-text:#e6edf7;--pf-muted:#94a3b8;--pf-border:#26334d;}' +
        '.pf-nav{position:sticky;top:0;z-index:20;background:var(--pf-surface);border-bottom:1px solid var(--pf-border);}' +
        '.pf-nav-inner{position:relative;max-width:1060px;margin:0 auto;padding:10px 20px;}' +
        '.pf-nav ul{display:flex;flex-wrap:wrap;gap:6px;align-items:center;list-style:none;margin:0;padding:0;}' +
        '.pf-nav a{color:var(--pf-muted);text-decoration:none;padding:7px 13px;border-radius:999px;font-size:.85rem;white-space:nowrap;display:inline-flex;align-items:center;transition:background .18s ease,color .18s ease;}' +
        '.pf-nav a:hover,.pf-nav a.active{background:var(--pf-accent);color:#fff;}' +
        '.pf-nav-brand{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:8px;background:var(--pf-accent);color:#fff;font-weight:800;font-size:.8rem;margin-right:7px;}' +
        '.pf-nav a.active .pf-nav-brand{background:#fff;color:var(--pf-accent);}' +
        '.pf-nav-name{font-weight:700;}' +
        '.pf-progress{position:absolute;left:0;right:0;bottom:-1px;height:3px;overflow:hidden;}' +
        '.pf-progress span{display:block;width:0;height:100%;border-radius:0 99px 99px 0;background:linear-gradient(90deg,var(--pf-accent),var(--pf-accent-2));box-shadow:0 0 12px var(--pf-accent);transition:width .12s linear;}' +
        '.pf-hero{position:relative;overflow:hidden;padding:72px 22px 60px;text-align:center;}' +
        '.pf-hero-bg{position:absolute;inset:0;}' +
        '.pf-hero-bg span{position:absolute;border-radius:50%;filter:blur(70px);opacity:.5;animation:pfFloat 16s ease-in-out infinite;}' +
        '.pf-hero-bg span:nth-child(1){width:360px;height:360px;background:var(--pf-accent-2);top:-80px;left:-60px;}' +
        '.pf-hero-bg span:nth-child(2){width:320px;height:320px;background:var(--pf-accent);bottom:-100px;right:-40px;animation-delay:-5s;}' +
        '.pf-hero-bg span:nth-child(3){width:220px;height:220px;background:var(--pf-accent-2);top:40%;left:55%;animation-delay:-10s;}' +
        '.pf-hero-inner{position:relative;z-index:1;}' +
        '.pf-hero-avatar{width:78px;height:78px;margin:0 auto 18px;border-radius:24px;display:grid;place-items:center;font-size:1.8rem;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--pf-accent),var(--pf-accent-2));box-shadow:0 14px 34px rgba(99,102,241,.35);}' +
        '.pf-hero-name{font-size:clamp(2rem,5vw,3rem);font-weight:800;letter-spacing:-.5px;margin:0;background:linear-gradient(90deg,var(--pf-accent),var(--pf-accent-2),var(--pf-accent));background-size:220% auto;animation:pfShine 7s linear infinite;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;}' +
        '.pf-hero-role{color:var(--pf-accent);font-size:1.15rem;margin:8px 0 0;font-weight:600;}' +
        '.pf-hero-intro{color:var(--pf-muted);font-size:1.02rem;max-width:740px;margin:14px auto 0;line-height:1.7;}' +
        '.pf-hero-pills{display:flex;flex-wrap:wrap;gap:9px;justify-content:center;margin-top:20px;}' +
        '.pf-pill{display:inline-block;padding:8px 15px;border-radius:999px;border:1px solid var(--pf-border);color:var(--pf-text);text-decoration:none;font-size:.82rem;background:var(--pf-surface);transition:all .18s ease;}' +
        '.pf-pill:hover{border-color:var(--pf-accent);color:var(--pf-accent);transform:translateY(-1px);}' +
        '.pf-pill-accent{background:var(--pf-accent);color:#fff;border-color:transparent;}.pf-pill-accent:hover{color:#fff;}' +
        '.pf-section{padding:46px 22px;max-width:1060px;margin:0 auto;}' +
        '.pf-section-head{display:flex;align-items:center;gap:12px;margin-bottom:22px;}' +
        '.pf-section-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;flex:none;background:var(--pf-accent);color:#fff;font-size:1.05rem;box-shadow:0 6px 16px rgba(99,102,241,.25);}' +
        '.pf-index{font-size:.8rem;color:var(--pf-accent);font-weight:800;letter-spacing:.5px;}' +
        '.pf-section-title{font-size:1.6rem;font-weight:700;letter-spacing:-.2px;margin:0;}' +
        '.pf-section-title::after{content:"";display:block;width:46px;height:4px;border-radius:99px;background:linear-gradient(90deg,var(--pf-accent),var(--pf-accent-2));margin-top:6px;transition:width .8s cubic-bezier(.22,1,.36,1);}' +
        '.pf-section-head.visible .pf-section-title::after{width:108px;}' +
        '.pf-lines{display:grid;gap:8px;}' +
        '.pf-text{line-height:1.75;color:#334155;margin:0;}.pf-root.pf-dark .pf-text{color:#cbd5e1;}' +
        '.pf-lines p{line-height:1.75;color:#334155;margin:0;}.pf-root.pf-dark .pf-lines p{color:#cbd5e1;}' +
        '.pf-timeline{position:relative;padding-left:20px;}' +
        '.pf-timeline::before{content:"";position:absolute;left:6px;top:8px;bottom:8px;width:3px;background:linear-gradient(var(--pf-accent),var(--pf-accent-2));border-radius:99px;opacity:.35;}' +
        '.pf-entry{position:relative;background:var(--pf-surface);border:1px solid var(--pf-border);border-radius:var(--pf-radius);padding:18px 20px;margin:16px 0;box-shadow:var(--pf-shadow);transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease;}' +
        '.pf-entry::before{content:"";position:absolute;left:-20px;top:26px;width:13px;height:13px;border-radius:50%;background:var(--pf-accent);border:3px solid var(--pf-bg);box-shadow:0 0 0 2px var(--pf-accent);transition:transform .2s ease,box-shadow .2s ease;}' +
        '.pf-root .pf-entry.reveal.visible:hover{transform:translateY(-4px);border-color:var(--pf-accent);box-shadow:0 18px 38px rgba(15,23,42,.15);}' +
        '.pf-root .pf-entry.reveal.visible:hover::before{transform:scale(1.2);box-shadow:0 0 0 5px var(--pf-accent-soft);}' +
        '.pf-entry-top{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;}' +
        '.pf-entry-title{font-size:1.08rem;font-weight:700;margin:0;}' +
        '.pf-entry-sub{display:inline-block;color:var(--pf-muted);font-size:.9rem;}' +
        '.pf-entry-metas{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px;}' +
        '.pf-entry-meta{display:inline-block;padding:4px 11px;border-radius:999px;font-size:.75rem;font-weight:600;color:var(--pf-accent);background:var(--pf-accent-soft);border:1px solid var(--pf-border);}' +
        '.pf-entry-list{display:grid;gap:9px;margin:12px 0 0;padding:0;list-style:none;}' +
        '.pf-entry-list li{position:relative;padding-left:22px;line-height:1.62;color:#334155;}' +
        '.pf-root.pf-dark .pf-entry-list li{color:#cbd5e1;}' +
        '.pf-entry-list li::before{content:"";position:absolute;left:3px;top:.56em;width:8px;height:8px;border-radius:2px;background:linear-gradient(135deg,var(--pf-accent),var(--pf-accent-2));transform:rotate(45deg);}' +
        '.pf-entry-list li.pf-li-plain::before{transform:none;border-radius:50%;background:transparent;border:2px solid var(--pf-accent);width:7px;height:7px;top:.62em;}' +
        '.pf-entry-text{line-height:1.68;color:var(--pf-muted);margin:10px 0 0;}' +
        '.pf-entries-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));}' +
        '.pf-entries-grid .pf-entry{margin:0;border-left:3px solid var(--pf-accent);}' +
        '.pf-entries-grid .pf-entry::before{display:none;}' +
        '.pf-entry.is-compact{padding:15px 18px;}' +
        '.pf-entry.is-compact .pf-entry-title{display:flex;align-items:center;gap:10px;font-size:1rem;}' +
        '.pf-entry.is-compact .pf-entry-title::before{content:"\\2713";display:grid;place-items:center;flex:none;width:20px;height:20px;border-radius:50%;font-size:.66rem;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--pf-accent),var(--pf-accent-2));}' +
        '.pf-skills{display:grid;gap:16px;}' +
        '.pf-skill-group{position:relative;padding:16px 18px 16px 22px;overflow:hidden;background:var(--pf-surface);border:1px solid var(--pf-border);border-radius:var(--pf-radius);box-shadow:var(--pf-shadow);transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease;}' +
        '.pf-skill-group::after{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(var(--pf-accent),var(--pf-accent-2));}' +
        '.pf-skill-group-head{display:flex;align-items:center;gap:10px;margin-bottom:13px;}' +
        '.pf-skill-group-label{font-size:.76rem;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:var(--pf-accent);}' +
        '.pf-skill-group-count{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;font-size:.68rem;font-weight:800;color:var(--pf-accent);background:var(--pf-accent-soft);}' +
        '.pf-skill-group-rule{flex:1;height:1px;background:linear-gradient(90deg,var(--pf-border),transparent);}' +
        '.pf-skills > .pf-skill-group:only-child .pf-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));}' +
        '.pf-chips{display:flex;flex-wrap:wrap;gap:9px;}' +
        '.pf-chip{display:inline-flex;align-items:center;gap:8px;padding:8px 15px;border-radius:999px;font-size:.84rem;font-weight:600;color:var(--pf-text);background:var(--pf-surface);border:1px solid var(--pf-border);box-shadow:0 2px 8px rgba(15,23,42,.05);transition:transform .18s ease,border-color .18s ease,color .18s ease,background .18s ease;}' +
        '.pf-chip::before{content:"";flex:none;width:7px;height:7px;border-radius:50%;background:linear-gradient(135deg,var(--pf-accent),var(--pf-accent-2));}' +
        '.pf-chip:hover{border-color:var(--pf-accent);color:var(--pf-accent);background:var(--pf-accent-soft);}' +
        '.pf-footer{text-align:center;padding:38px 20px;color:var(--pf-muted);border-top:1px solid var(--pf-border);}' +
        '.pf-footer-brand{font-weight:700;color:var(--pf-text);margin:0 0 6px;font-size:1.05rem;}' +
        '.pf-footer-meta{font-size:.82rem;margin:0;}' +
        '.pf-scroll-top{display:inline-block;margin-top:12px;color:var(--pf-accent);text-decoration:none;font-size:.85rem;font-weight:600;}' +
        '.pf-root.pf-minimal .pf-section{max-width:820px;}.pf-root.pf-minimal .pf-entry{box-shadow:none;}.pf-root.pf-minimal .pf-hero{padding:60px 22px;}' +
        '.pf-root.pf-professional{font-size:1.02rem;}.pf-root.pf-professional .pf-section-title{text-transform:uppercase;letter-spacing:.6px;font-size:1.25rem;}.pf-root.pf-professional .pf-section{max-width:880px;}' +
        '.pf-root.pf-modern .pf-section-title{font-size:1.6rem;}' +
        '.pf-root .reveal{opacity:0;transform:translateY(24px);transition:opacity .6s cubic-bezier(.22,1,.36,1),transform .6s cubic-bezier(.22,1,.36,1);}' +
        '.pf-root .reveal.visible{opacity:1;transform:none;}' +
        '.pf-root .pf-chip.reveal{transform:translateY(14px) scale(.9);}.pf-root .pf-chip.reveal.visible{transform:none;}' +
        '.pf-root .pf-chip.reveal.visible:hover{transform:translateY(-3px);}' +
        '.pf-root .pf-skill-group.reveal.visible:hover{transform:translateY(-3px);border-color:var(--pf-accent);box-shadow:0 18px 38px rgba(15,23,42,.14);}' +
        '@keyframes pfFloat{0%,100%{transform:translate3d(0,0,0) scale(1);}50%{transform:translate3d(0,-26px,0) scale(1.07);}}' +
        '@keyframes pfShine{from{background-position:0% 50%;}to{background-position:200% 50%;}}' +
        '@media(max-width:640px){.pf-entries-grid{grid-template-columns:1fr;}.pf-skills > .pf-skill-group:only-child .pf-chips{grid-template-columns:repeat(auto-fill,minmax(128px,1fr));}.pf-hero{padding:52px 16px;}.pf-section{padding:30px 14px;}.pf-nav ul{justify-content:flex-start;}.pf-nav-name{display:none;}.pf-timeline{padding-left:14px;}.pf-entry{padding:16px;}}' +
        '@media(prefers-reduced-motion:reduce){.pf-root .reveal{opacity:1;transform:none;transition:none;}.pf-hero-bg span{animation:none;}}' +
        '@media print{.pf-nav,.pf-hero-bg{display:none;}}';

/* ---------- preview page controller (wired after the preview view shows) ---------- */
    let previewListeners = [];
    function listen(target, event, handler) {
        if (!target) return;
        target.addEventListener(event, handler);
        previewListeners.push(() => target.removeEventListener(event, handler));
    }

    function initPreviewPage() {
        previewListeners.forEach((remove) => remove());
        previewListeners = [];
        /* Controls are generated from the registries before anything binds
           to them, so the sidebar always matches the shipped designs/colors. */
        buildPicker();
        const frame = document.getElementById('portfolioPreview');
        const data = App.getData();
        if (!frame) return;
        if (!data || !data.sections) {
            frame.innerHTML = '<div class="preview-empty"><h2>No resume data found</h2>' +
                '<p>Upload a resume first to generate your portfolio.</p></div>';
            return;
        }
        const custom = App.getCustom();
        const previewView = document.getElementById('view-preview');
        if (previewView && !previewView.classList.contains('active')) App.show('view-preview');

        /* The disclosure works at every width; new previews start expanded. */
        const panelToggle = document.getElementById('panelToggle');
        const panelContent = document.getElementById('panelContent');
        function setPanelExpanded(expanded) {
            if (!panelToggle || !panelContent) return;
            panelContent.hidden = !expanded;
            panelToggle.setAttribute('aria-expanded', String(expanded));
            panelToggle.textContent = expanded ? 'Hide' : 'Show';
            panelToggle.setAttribute('aria-label', (expanded ? 'Hide' : 'Show') + ' customization options');
        }
        setPanelExpanded(true);
        listen(panelToggle, 'click', () => setPanelExpanded(panelContent.hidden));

        function paint() {
            const scrollRoot = frame.closest('.pf-preview-scroll') || frame;
            const previewTop = scrollRoot.scrollTop;
            const panelTop = panelContent ? panelContent.scrollTop : 0;
            const scrollBehavior = scrollRoot.style.scrollBehavior;
            try {
                // Replacing preview content must not animate a reset to the top.
                scrollRoot.style.scrollBehavior = 'auto';
                frame.innerHTML = buildPortfolioHtml(data, custom);
                scrollRoot.scrollTop = Math.min(previewTop, Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight));
                Animations.initReveal(frame);
                Animations.initPortfolioNav(scrollRoot, frame.querySelector('.pf-nav'));
                Animations.initScrollProgress(scrollRoot, frame.querySelector('.pf-progress span'));
                Animations.bindSmoothAnchors(scrollRoot);
            } catch (err) {
                console.error('Portfolio preview render error', err);
                frame.innerHTML = '<div class="preview-empty"><h2>Preview could not be rendered</h2>' +
                    '<p>' + esc(err && err.message ? err.message : 'unknown error') + '</p></div>';
            } finally {
                scrollRoot.style.scrollBehavior = scrollBehavior;
                if (panelContent) panelContent.scrollTop = panelTop;
            }
        }

        /* --- theme / color / layout --- */
        document.querySelectorAll('input[name="theme"]').forEach((r) => r.checked = (r.value === custom.theme));
        document.querySelectorAll('input[name="color"]').forEach((r) => r.checked = (r.value === custom.color));
        document.querySelectorAll('input[name="layout"]').forEach((r) => r.checked = (r.value === custom.layout));

        function bindRadios(name, apply) {
            const radios = document.querySelectorAll('input[name="' + name + '"]');
            radios.forEach((r) => listen(r, 'change', () => {
                if (!r.checked) return;
                apply(r.value);
                // Appearance is CSS-driven: keep content, focus, and reveal state intact.
                const root = frame.querySelector('.pf-root');
                if (root) root.className = appearanceClasses(custom);
                else paint();
                App.saveCustom(custom);
                syncPickerLabels();
            }));
        }
        bindRadios('theme', (v) => custom.theme = v);
        bindRadios('color', (v) => custom.color = v);
        bindRadios('layout', (v) => custom.layout = v);

        /* --- section visibility toggles (show / hide sections) --- */
        const toggleList = document.getElementById('sectionToggles');
        function buildToggles() {
            if (!toggleList) return;
            toggleList.innerHTML = '';
            data.sections.forEach((s, i) => {
                const id = 'toggle-' + i;
                const label = document.createElement('label');
                label.className = 'section-toggle';
                const hidden = (custom.hidden || []).indexOf(s.original) !== -1;
                label.innerHTML = '<input type="checkbox" id="' + id + '"' + (hidden ? '' : ' checked') + '>' +
                    '<span class="toggle"></span><span class="toggle-label"></span>';
                label.querySelector('.toggle-label').textContent = s.original;
                label.querySelector('input').addEventListener('change', (e) => {
                    custom.hidden = custom.hidden || [];
                    const i2 = custom.hidden.indexOf(s.original);
                    if (e.target.checked && i2 !== -1) custom.hidden.splice(i2, 1);
                    if (!e.target.checked && i2 === -1) custom.hidden.push(s.original);
                    App.saveCustom(custom);
                    paint();
                });
                toggleList.appendChild(label);
            });
        }
        buildToggles();

/* --- integrity indicator --- */
        const integrityEl = document.getElementById('integrityInfo');
        if (integrityEl) {
            const rep = validate(data);
            integrityEl.textContent = rep.total + ' sections preserved from your resume.' +
                (rep.empty.length ? ' (' + rep.empty.length + ' were empty and kept as-is)' : '');
        }

        /* --- edit extracted text modal --- */
        const editModal = document.getElementById('editModal');
        const editBody = document.getElementById('editModalBody');

        function buildEditForm() {
            const p = data.personalInfo || {};
            let h = '';
            const P = [['name', 'Full Name'], ['title', 'Title / Role'], ['email', 'Email'],
                ['phone', 'Phone'], ['location', 'Location'], ['linkedin', 'LinkedIn'],
                ['github', 'GitHub'], ['website', 'Website']];
            h += '<div class="edit-grid">';
            P.forEach(([k, lab]) => {
                h += '<label class="edit-field"><span>' + lab + '</span>' +
                    '<input type="text" data-personal="' + k + '" value="' + esc(p[k] || '') + '"></label>';
            });
            h += '</div>';

            data.sections.forEach((s, i) => {
                h += '<div class="edit-section" data-sec="' + i + '">';
                h += '<input class="edit-title" data-sec="' + i + '" data-title value="' + esc(s.original) + '">';
                h += '<textarea class="edit-content" data-sec="' + i + '" data-content rows="4">' +
                    esc(s.lines.map((line, index) => ((s.breakBefore || []).indexOf(index) !== -1 ? '\n' : '') + line).join('\n')) + '</textarea>';
                h += '</div>';
            });
            return h;
        }

        function saveEditForm() {
            data.personalInfo = data.personalInfo || {};
            document.querySelectorAll('#editModalBody [data-personal]').forEach((inp) => {
                data.personalInfo[inp.getAttribute('data-personal')] = inp.value.trim();
            });
            const rebuilt = [];
            Array.prototype.slice.call(editBody.querySelectorAll('.edit-section[data-sec]'))
                .sort((a, b) => parseInt(a.getAttribute('data-sec'), 10) - parseInt(b.getAttribute('data-sec'), 10))
                .forEach((group) => {
                    const title = group.querySelector('[data-title]');
                    const content = group.querySelector('[data-content]');
                    const typeInfo = data.sections[parseInt(group.getAttribute('data-sec'), 10)] || {};
                    rebuilt.push({
                        original: title ? title.value.trim() : (typeInfo.original || ''),
                        type: typeInfo.type || 'generic',
                        lines: content ? content.value.split(/\r?\n/) : []
                    });
                });
            data.sections = rebuilt;
            data.sections.forEach((s) => { s.type = ResumeAnalyzer.classify(s.original); });
            App.saveData(data);
            editModal.hidden = true;
            editModal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('modal-open');
            buildToggles();
            paint();
            App.toast('Edits saved. Your resume text is preserved.', 'success');
        }

        if (editModal) {
            const close = () => { editModal.hidden = true; editModal.setAttribute('aria-hidden', 'true'); document.body.classList.remove('modal-open'); };
            listen(document.getElementById('editDataBtn'), 'click', () => {
                editBody.innerHTML = buildEditForm();
                editModal.hidden = false;
                editModal.setAttribute('aria-hidden', 'false');
                document.body.classList.add('modal-open');
            });
            listen(document.getElementById('editModalClose'), 'click', close);
            listen(document.getElementById('editCancel'), 'click', close);
            listen(editModal, 'click', (e) => { if (e.target === editModal) close(); });
            listen(document, 'keydown', (e) => { if (e.key === 'Escape' && !editModal.hidden) close(); });
            listen(document.getElementById('editSave'), 'click', saveEditForm);
        }

        /* --- export standalone / back / reset --- */
        const exportHtml = () => {
            const blob = new Blob([buildStandalone(data, custom)], { type: 'text/html' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = ((data.personalInfo || {}).name || 'portfolio').toLowerCase().replace(/\s+/g, '-') + '-portfolio.html';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1500);
            App.toast('Portfolio downloaded!', 'success');
        };
        listen(document.getElementById('exportBtn'), 'click', exportHtml);
        listen(document.getElementById('downloadBtn'), 'click', exportHtml);
        listen(document.getElementById('backBtn'), 'click', () => {
            App.show('view-home');
        });
        listen(document.getElementById('resetBtn'), 'click', () => {
            if (confirm('Start over? Your uploaded resume data will be removed.')) {
                App.clearData();
                localStorage.removeItem(App.KEYS.CUSTOM);
                App.show('view-home');
            }
        });

        paint();
    }

    /* ---------- sidebar pickers (generated from the registries) ----------
       Building the controls from the same data that draws the portfolio
       removes any chance of the sidebar offering a design or a colour with
       no rule behind it. The sidebar intentionally lists only the featured
       templates; the gallery is where the full set lives. */
    function buildPicker() {
        const tplHost = document.getElementById('templateOptions');
        if (tplHost && !tplHost.querySelector('input')) {
            tplHost.innerHTML = FEATURED_TEMPLATES.map((t) =>
                '<label class="template-option"><input type="radio" name="layout" value="' + esc(t.id) + '">' +
                '<span class="template-card"><span class="template-thumb template-thumb-' + esc(t.id) +
                '" aria-hidden="true"><i></i><i></i><i></i></span>' +
                '<span><strong>' + esc(t.name) + '</strong><small>' + esc(t.tagline) + '</small></span></span></label>').join('');
        }
        const colorHost = document.getElementById('colorOptions');
        if (colorHost && !colorHost.querySelector('input')) {
            colorHost.innerHTML = COLORS.map((c) =>
                '<label class="color-option" data-v="' + esc(c.id) + '" title="' + esc(c.name) + '">' +
                '<input type="radio" name="color" value="' + esc(c.id) + '" aria-label="' + esc(c.name) + '">' +
                '<span style="background:' + esc(c.accent) + '"></span></label>').join('');
        }
        syncPickerLabels();
    }

    /* Reflect the saved customization in the sidebar. A template chosen from
       the gallery is not among the featured three, so the note states which
       design is actually in use instead of silently checking a stale tile. */
    function syncPickerLabels() {
        const custom = App.getCustom();
        const active = TEMPLATES.filter((t) => t.id === custom.layout)[0];
        const note = document.getElementById('templateActiveNote');
        if (note) {
            note.textContent = active
                ? 'In use: ' + active.name + (active.featured ? '' : ' (chosen from the gallery)')
                : 'Choose a design to apply it instantly.';
        }
        document.querySelectorAll('input[name="layout"]').forEach((r) => { r.checked = (r.value === custom.layout); });
        document.querySelectorAll('input[name="color"]').forEach((r) => { r.checked = (r.value === custom.color); });
    }

    /* ---------- public API ---------- */
    return {
        render: buildPortfolioHtml,
        buildStandalone: buildStandalone,
        initPreviewPage: initPreviewPage,
        validate: validate,
        classify: ResumeAnalyzer.classify,
        templates: TEMPLATES,
        templateIds: TEMPLATE_IDS,
        featuredTemplates: FEATURED_TEMPLATES,
        featuredIds: FEATURED_IDS,
        colors: COLORS,
        colorIds: COLOR_IDS,
        layoutCss: () => PORTFOLIO_LAYOUT_CSS,
        buildPicker: buildPicker,
        syncPickerLabels: syncPickerLabels,
        appearanceClasses: appearanceClasses
    };
})();

window.PortfolioGenerator = PortfolioGenerator;