const fs = require('fs');
const file = 'C:/Users/Geraldo/Downloads/Solve-Corporate-CRM/Solve-Corporate-CRM/artifacts/solve-crm/src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace all mojibake characters using regex
content = content.replace(/Ã§/g, 'ç');
content = content.replace(/Ã£/g, 'ã');
content = content.replace(/Ãµ/g, 'õ');
content = content.replace(/Ã¡/g, 'á');
content = content.replace(/Ã©/g, 'é');
content = content.replace(/Ã­/g, 'í');
content = content.replace(/Ã³/g, 'ó');
content = content.replace(/Ãº/g, 'ú');
content = content.replace(/Ã¢/g, 'â');
content = content.replace(/Ã´/g, 'ô');
content = content.replace(/Ã/g, 'À');

fs.writeFileSync(file, content, 'utf8');
console.log('Done! All encoding issues fixed.');
