const fs = require('fs');
let schema = fs.readFileSync('api/_server/prisma/schema.prisma', 'utf8');
schema = schema.replace(/@db\.Text/g, '');
schema = schema.replace(/, map: "[^"]+"/g, '');
fs.writeFileSync('api/_server/prisma/schema.prisma', schema);
