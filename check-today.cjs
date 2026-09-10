const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('E:\\solve acces arq\\solve-access.db', {open: true, readOnly: true});
const r = db.prepare("SELECT a.hora_acesso, a.tipo_acesso, a.resultado, c.nome FROM Acessos a LEFT JOIN Clientes c ON a.cliente_id=c.id_cliente WHERE a.data_acesso='2026-09-08' ORDER BY a.hora_acesso DESC LIMIT 10").all();
r.forEach(x => console.log(x.hora_acesso, x.tipo_acesso, x.resultado, x.nome));
db.close();
