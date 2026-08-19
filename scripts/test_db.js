const postgres = require('postgres');
const sql = postgres('postgresql://pramana:pramana@127.0.0.1:5433/pramana');

sql`SELECT current_user, current_database();`
  .then((res) => {
    console.log('SUCCESS:', res);
    process.exit(0);
  })
  .catch((err) => {
    console.error('ERROR:', err);
    process.exit(1);
  });
