const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        if (file === 'node_modules' || file === '.git' || file === 'dist' || file.startsWith('.')) return;
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walkDir(file));
        } else {
            results.push(file);
        }
    });
    return results;
}

const files = walkDir(process.cwd());

let changedCount = 0;
files.forEach(file => {
    if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.pdf')) return;
    try {
        let content = fs.readFileSync(file, 'utf8');
        let original = content;
        
        content = content.replace(/Akshara LearnQuest/g, 'Akshara LearnQuest');
        content = content.replace(/Learn. Play. Achieve./g, 'Learn. Play. Achieve.');
        content = content.replace(/Powered by Akshara Fine Arts/g, 'Powered Powered by Akshara Fine Arts');
        
        if (content !== original) {
            fs.writeFileSync(file, content, 'utf8');
            console.log('Updated:', path.relative(process.cwd(), file));
            changedCount++;
        }
    } catch (e) {
        console.error('Failed on', file, e.message);
    }
});

console.log('Total files updated:', changedCount);
