/* resumeAnalyzer.js - pure resume-text understanding. */
'use strict';
var ResumeAnalyzer = (function () {
var KNOWN = [
['contact', ['contact information', 'contact details', 'contact info', 'contact', 'get in touch', 'reach me']],
['summary', ['career objective', 'objective', 'professional summary', 'summary', 'profile', 'about me', 'about', 'career summary']],
['experience', ['work experience', 'professional experience', 'employment history', 'experience']],
['internships', ['internship', 'internships']],
['education', ['education', 'educational background', 'academic background', 'academics', 'qualifications']],
['skills', ['technical skills', 'key skills', 'core skills', 'skills', 'technologies', 'tech stack', 'competencies']],
['projects', ['projects', 'personal projects', 'academic projects', 'selected projects']],
['certifications', ['certifications', 'certification', 'licenses', 'courses', 'training']],
['achievements', ['achievements', 'accomplishments', 'awards', 'honors', 'recognition']],
['languages', ['languages', 'language proficiency']],
['hobbies', ['hobbies', 'interests', 'personal interests']],
['links', ['social links', 'links', 'online presence', 'profiles', 'portfolio links', 'find me online']],
['activities', ['extra curricular activities', 'extracurricular activities', 'extra-curricular', 'activities', 'volunteering', 'community', 'leadership']]
];
var SORTED = KNOWN.map(function (k) {
return { type: k[0], names: k[1].slice().sort(function (a, b) { return b.length - a.length; }) };
});
/* Normalise a title for classification: collapse separators to spaces.
   The colon is PRESERVED (not stripped) so that "Languages: Java, Python"
   is NOT mistaken for the "Languages" section header. */
function norm(s) {
return String(s == null ? '' : s).toLowerCase().replace(/[|\u2013\u2014_]+/g, ' ').replace(/[-*\u2022\u00b7\u25e6\u25aa\u25a0]/g, ' ').replace(/\s+/g, ' ').trim();
}
/* Classify a line as a section type.  A line is only a section header
   when the normalised text matches a KNOWN name exactly or the name is
   followed only by whitespace/punctuation — NOT when the name is just
   a prefix of a labelled data line like "Languages: Java, Python". */
function classify(title) {
var n = norm(title);
var best = null, bestLen = -1;
SORTED.forEach(function (entry) {
entry.names.forEach(function (name) {
if (name.length > bestLen && n.indexOf(name) === 0) {
var rest = n.slice(name.length);
if (rest === '' || /^[:\s]+$/.test(rest)) { best = entry.type; bestLen = name.length; }
}
});
});
return best || 'generic';
}
var EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
var PHONE_RE = /(\+?\d[\d\s\-().]{6,}\d)/;
var URL_RE = /(https?:\/\/[^\s,;|]+|www\.[^\s,;|]+|[a-z0-9-]+\.(com|net|org|io|dev|design|in|me)(\/[^\s,;|]*)?)/i;
function isContactLine(line) {
var t = String(line || '').trim();
if (!t) return false;
if (EMAIL_RE.test(t) || PHONE_RE.test(t) || URL_RE.test(t)) return true;
if (/^(email|e-mail|phone|mobile|tel|linkedin|github|location|address|website|portfolio)\s*:/i.test(t)) return true;
/* City/State/Country address: "Bengaluru, Karnataka, India" */
if (/^[A-Z][A-Za-z .'&\-]{1,40}, ?[A-Z][A-Za-z .'&\-]{1,40}(, ?[A-Z][A-Za-z .'&\-]{1,40})?$/.test(t) && t.length <= 60) return true;
return false;
}
function findName(lines) {
for (var i = 0; i < Math.min(lines.length, 8); i++) {
var t = String(lines[i] || '').trim();
if (!t) continue;
if (classify(t) !== 'generic') continue;
if (isContactLine(t)) continue;
if (t.split(/\s+/).length > 6) continue;
if (t.indexOf('|') !== -1 && t.split(/\s+/).length > 4) continue;
return t;
}
return '';
}
/* Find the professional title/role — only from lines between the name
   and the first section heading (the header block). */
function findTitle(lines, name, headEnd) {
var idx = lines.indexOf(name);
var end = headEnd || lines.length;
var pool = idx >= 0 ? lines.slice(idx + 1, Math.min(idx + 4, end)) : lines.slice(0, Math.min(4, end));
for (var i = 0; i < pool.length; i++) {
var t = String(pool[i] || '').trim();
if (!t || t === name || isContactLine(t) || classify(t) !== 'generic') continue;
if (t.indexOf('|') !== -1 && t.length <= 60) return t;
if (/developer|engineer|designer|manager|analyst|consultant|architect|specialist|enthusiast|student|intern/i.test(t) && t.length <= 60) return t;
}
return '';
}
function analyze(rawText, fileName) {
var text = String(rawText == null ? '' : rawText).split('\r\n').join('\n').split('\r').join('\n');
var rawLines = text.split('\n');
var lines = [];
var prevBlank = false;
rawLines.forEach(function (l) {
var t = String(l).split('\t').join(' ');
while (t.length && t.charAt(t.length - 1) === ' ') t = t.slice(0, -1);
if (!t.trim()) { if (!prevBlank) lines.push(''); prevBlank = true; return; }
prevBlank = false;
lines.push(t.trim());
});
while (lines.length && !lines[0].trim()) lines.shift();
while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
var name = findName(lines);
/* Compute headEnd (first real section heading) BEFORE looking for the
   title, so the title is only taken from the header block. */
var headEnd = lines.length;
for (var h = 0; h < lines.length; h++) {
if (lines[h].trim() && classify(lines[h]) !== 'generic') { headEnd = h; break; }
}
var title = name ? findTitle(lines, name, headEnd) : '';
var email = '', phone = '', location = '', linkedin = '', github = '', website = '';
/* Extract contact info from the header block (lines before first section). */
lines.slice(0, headEnd).forEach(function (l) {
var m;
if (!email && (m = l.match(EMAIL_RE))) email = m[0];
if (!phone && (m = l.match(PHONE_RE))) phone = m[0].trim();
if (!location && l.indexOf(',') !== -1 && !EMAIL_RE.test(l) && !URL_RE.test(l) && l !== name && l !== title) location = l.trim();
var lower = l.toLowerCase();
if (!linkedin && lower.indexOf('linkedin') !== -1) { m = l.match(URL_RE); if (m) linkedin = m[0]; }
if (!github && lower.indexOf('github') !== -1) { m = l.match(URL_RE); if (m) github = m[0]; }
if (!website && (lower.indexOf('website') !== -1 || lower.indexOf('portfolio') !== -1)) { m = l.match(URL_RE); if (m) website = m[0]; }
});
/* Fallback: scan the *entire* text for contact info that appeared in a
   Contact Information section at the bottom of the resume rather than
   in the header.  For phone, only accept matches on lines that look
   like phone lines (contain '+' or a phone label) to avoid picking up
   date ranges like "2021 - 2025". */
if (!email) { var me = text.match(EMAIL_RE); if (me) email = me[0]; }
if (!phone) {
var _allLines = text.split('\n');
for (var _pi = 0; _pi < _allLines.length; _pi++) {
var _pl = _allLines[_pi];
var _pm = _pl.match(PHONE_RE);
if (_pm && (_pl.indexOf('+') !== -1 || /phone|tel|mobile/i.test(_pl))) {
phone = _pm[0].trim();
break;
}
}
}
/* Fallback location: a short comma-separated address line
   (e.g. "Bengaluru, Karnataka, India"), not institute names. */
if (!location) {
var _locLines = text.split('\n');
for (var _li = 0; _li < _locLines.length; _li++) {
var _lt = _locLines[_li].trim();
if (!_lt || _lt === name || _lt === title) continue;
if (EMAIL_RE.test(_lt) || URL_RE.test(_lt) || _lt.indexOf(',') === -1) continue;
var _parts = _lt.split(',');
if (_parts.length < 2) continue;
var _good = _parts.every(function (p) { return p.trim().split(/\s+/).length <= 3; });
if (_good) { location = _lt.replace(/^[^:]*:\s*/, '').trim(); break; }
}
}
/* Fallback: scan full text for social/profile links (linkedin/github/website)
   that appeared in a Contact Information or Social Links section. */
if (!linkedin || !github || !website) {
text.split('\n').forEach(function (l) {
var lower = l.toLowerCase();
var urlMatch = l.match(URL_RE);
var url = urlMatch ? urlMatch[0] : '';
if (!linkedin && lower.indexOf('linkedin') !== -1 && url) linkedin = url;
if (!github && lower.indexOf('github') !== -1 && url) github = url;
if (!website && (lower.indexOf('website') !== -1 || lower.indexOf('portfolio') !== -1 || lower.indexOf('personal') !== -1) && url) website = url;
});
}
var sections = [];
var current = null;
var preHeaderContact = [];
var seenHeader = false;
function pushCurrent() {
if (!current) return;
var content = current.lines.filter(function (l) { return l.trim(); });
if (content.length) sections.push({ original: current.original, type: current.type, lines: content });
current = null;
}
lines.forEach(function (line) {
var t = line.trim();
if (!t) return;
if (t === name || t === title) return;
var type = classify(t);
if (type !== 'generic' && t.length <= 60 && t.split(/\s+/).length <= 5) {
seenHeader = true;
pushCurrent();
current = { original: t, type: type, lines: [] };
} else if (!seenHeader && isContactLine(t)) {
preHeaderContact.push(t);
} else {
if (!current) current = { original: null, type: 'generic', lines: [] };
current.lines.push(t);
}
});
pushCurrent();
/* Merge pre-header contact lines into any existing contact section.
   Do NOT auto-create a titled "Contact Information" section — that
   would invent a heading that was not present in the original resume.
   If there is no contact section, keep the lines in an untitled section
   so they are still preserved (in the JSON and rendered) without
   appearing in the navigation or the titled-sections list. */
if (preHeaderContact.length) {
var mergedInto = null;
sections.forEach(function (s) {
if (s.type === 'contact') {
if (!mergedInto) mergedInto = s;
preHeaderContact.forEach(function (l) { if (s.lines.indexOf(l) === -1) s.lines.push(l); });
}
});
if (!mergedInto) {
sections.push({ original: null, type: 'contact', lines: preHeaderContact.slice() });
}
}
return {
rawText: text,
fileName: fileName || 'resume.txt',
importedAt: new Date().toISOString(),
personalInfo: { name: name, title: title, email: email, phone: phone, location: location, linkedin: linkedin, github: github, website: website },
sections: sections
};
}
function validate(parsed) {
var warnings = [];
if (!parsed) return { sectionCount: 0, warnings: ['No parsed data.'] };
(parsed.sections || []).forEach(function (s) {
if (!s.lines || !s.lines.length) warnings.push('Empty section: ' + (s.original || '(untitled)'));
});
return { sectionCount: (parsed.sections || []).length, warnings: warnings };
}
return { analyze: analyze, classify: classify, validate: validate };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ResumeAnalyzer;
if (typeof window !== 'undefined') window.ResumeAnalyzer = ResumeAnalyzer;