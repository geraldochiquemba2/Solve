const bcrypt = require('bcryptjs');
bcrypt.compare('admin123', '$2b$10$TYYg7w1aACsE9a3IdUtYOejHiCJLUm51L2WvDjq71AcgmZH3ja33m').then(r => console.log('Match:', r));
