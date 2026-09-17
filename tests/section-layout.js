/* Focused resume-layout regression: node tests/section-layout.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const context = { console, document: { addEventListener() {} } };
context.window = context;
vm.createContext(context);
['app.js', 'resumeAnalyzer.js', 'portfolioGenerator.js'].forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
});
const render = (type, original, lines) => context.PortfolioGenerator.render({
    personalInfo: {}, sections: [{ type, original, lines }]
}, {}).split('<section ')[1].split('</section>')[0];
const skills = render('skills', 'Technical Skills', ['Languages: Java', 'Tools: Git', 'Languages: C']);
assert(skills.indexOf('>Java<') < skills.indexOf('>Git<'));
assert(skills.indexOf('>Git<') < skills.indexOf('>C<'));
assert.strictEqual((skills.match(/pf-skill-group-label/g) || []).length, 3);
const project = render('projects', 'Projects', ['Demo Project', 'Technologies: React, CSS', 'Built a site.', 'Tools: Git', 'Added tests.']);
assert(project.indexOf('>React<') < project.indexOf('Built a site.'));
assert(project.indexOf('Built a site.') < project.indexOf('>Git<'));
assert(project.indexOf('>Git<') < project.indexOf('Added tests.'));
const soft = render('skills', 'Soft Skills', ['Communication • Teamwork • Adaptability']);
assert(soft.includes('<ul class="pf-soft-skills">'));
assert.strictEqual((soft.match(/<li /g) || []).length, 3);
assert(!soft.includes('pf-chip'));
const certificates = render('certifications', 'Certifications', ['• Completed a course.', '• Received an award.']);
assert(certificates.includes('pf-stack'));
assert.strictEqual((certificates.match(/class="pf-entry reveal/g) || []).length, 2);
const personal = render('contact', 'Personal Details', ["Father’s Name Example Parent", 'Languages Known English, Telugu', 'Phone: +91 1234567890 — # Email: person@example.com', '<unknown>']);
assert(personal.includes('<dt>Father’s Name</dt><dd>Example Parent</dd>'));
assert(personal.includes('<dd>English, Telugu</dd>'));
assert(personal.includes('<dt>Email</dt><dd>person@example.com</dd>'));
assert(personal.includes('&lt;unknown&gt;'));
const declaration = render('declaration', 'Declaration', ['I declare this is correct.', 'Date: 02/09/2026 Example Person', 'Place: Sample City Signature']);
assert(declaration.includes('<dt>Date</dt><dd>02/09/2026</dd>'));
assert(declaration.includes('<dt>Place</dt><dd>Sample City</dd>'));
assert(declaration.includes('class="pf-signature-name">Example Person</span>'));
assert(declaration.includes('<span>Signature</span>'));
const uncertain = render('declaration', 'Declaration', ['Date: September 2026 Example Person', 'Place: Sample City']);
assert(uncertain.includes('<dd>September 2026 Example Person</dd>'));
assert(!uncertain.includes('class="pf-signature"'));
console.log('PASS: section layouts, source ordering, escaping, and conservative declaration fallback');
