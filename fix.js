const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');
// Fix escaped backticks
content = content.replace(/\\`/g, '`');
// Fix escaped dollar signs
content = content.replace(/\\\$/g, '$');
// Fix double backslashes
content = content.replace(/\\\\/g, '\\');
fs.writeFileSync('src/App.jsx', content);
console.log('Fixed App.jsx');
