const fs = require('fs');
const file = 'C:/Users/Geraldo/Downloads/Solve-Corporate-CRM/Solve-Corporate-CRM/artifacts/solve-crm/src/App.tsx';
let c = fs.readFileSync(file, 'utf8');

// Fix double-encoded UTF-8
c = c.replace(/Â·/g, '·');
c = c.replace(/Âº/g, 'º');
c = c.replace(/Â /g, ' ');
c = c.replace(/Ã£/g, 'ã');
c = c.replace(/Ã§/g, 'ç');
c = c.replace(/Ãµ/g, 'õ');
c = c.replace(/Ã¡/g, 'á');
c = c.replace(/Ã©/g, 'é');
c = c.replace(/Ã­/g, 'í');
c = c.replace(/Ã³/g, 'ó');
c = c.replace(/Ãº/g, 'ú');
c = c.replace(/Ã¢/g, 'â');
c = c.replace(/Ã´/g, 'ô');
c = c.replace(/Ã/g, 'À');
c = c.replace(/Àª/g, 'ê');
c = c.replace(/À /g, ' à');
c = c.replace(/Àš/g, 'Ú');
c = c.replace(/âŒ˜/g, '⌘');

// Fix â€" (em dash) - this is triple encoded
c = c.replace(/\u00E2\u0080\u009D/g, '—');
c = c.replace(/\u00e2\u0080\u009c/g, '—');
c = c.replace(/\u201C/g, '"');
c = c.replace(/\u201D/g, '"');

// Fix standalone Â followed by space
c = c.replace(/Â\s/g, ' ');

fs.writeFileSync(file, c, 'utf8');
console.log('Encoding fixed round 2');
