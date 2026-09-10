import psycopg2
conn = psycopg2.connect("postgresql://neondb_owner:npg_bXxHCos9Z3Nl@ep-rapid-heart-a5mtx2z6-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require")
cur = conn.cursor()

print("=== DUPLICADOS (mesmo cliente, mesma hora, mesmo tipo) ===")
cur.execute("""
    SELECT customer_name, access_date, access_time, access_type, COUNT(*) as cnt
    FROM solve_access_logs
    GROUP BY customer_name, access_date, access_time, access_type
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 20
""")
for r in cur.fetchall():
    print(f"  {r[0]} | {r[1]} {r[2]} | {r[3]} | x{r[4]}")

print("\n=== HORAS SUSPEITAS (entre 00:00 e 04:00) ===")
cur.execute("""
    SELECT customer_name, access_date, access_time, access_type, result
    FROM solve_access_logs
    WHERE EXTRACT(HOUR FROM access_time::time) < 4
    ORDER BY access_date DESC, access_time DESC
    LIMIT 20
""")
for r in cur.fetchall():
    print(f"  {r[0]} | {r[1]} {r[2]} | {r[3]} | {r[4]}")

print("\n=== MESMO CLIENTE ENTRADA+SAIDA NA MESMA HORA ===")
cur.execute("""
    SELECT a.customer_name, a.access_date, a.access_time, a.access_type, a.result, b.access_type, b.result
    FROM solve_access_logs a
    JOIN solve_access_logs b ON a.customer_id = b.customer_id AND a.access_date = b.access_date
        AND ABS(EXTRACT(EPOCH FROM (a.access_time::time - b.access_time::time))) < 60
        AND a.access_type != b.access_type
        AND a.id != b.id
    WHERE a.access_type = 'entrada'
    ORDER BY a.access_date DESC, a.access_time DESC
    LIMIT 20
""")
for r in cur.fetchall():
    print(f"  {r[0]} | {r[1]} {r[2]} | {r[3]}({r[4]}) + {r[5]}({r[6]})")

print("\n=== ENTRADAS DUPLICADAS SEGUIDAS ===")
cur.execute("""
    SELECT customer_name, access_date, access_time, result, reason
    FROM solve_access_logs
    WHERE access_type = 'entrada' AND reason LIKE '%duplicad%'
    ORDER BY access_date DESC, access_time DESC
    LIMIT 20
""")
for r in cur.fetchall():
    print(f"  {r[0]} | {r[1]} {r[2]} | {r[3]} | {r[4]}")

print("\n=== SAIDAS DUPLICADAS SEGUIDAS ===")
cur.execute("""
    SELECT customer_name, access_date, access_time, result, reason
    FROM solve_access_logs
    WHERE access_type = 'saida' AND reason LIKE '%duplicad%'
    ORDER BY access_date DESC, access_time DESC
    LIMIT 20
""")
for r in cur.fetchall():
    print(f"  {r[0]} | {r[1]} {r[2]} | {r[3]} | {r[4]}")

print("\n=== CONTAS BLOQUEADAS ===")
cur.execute("""
    SELECT customer_name, access_date, access_time, result, reason
    FROM solve_access_logs
    WHERE reason LIKE '%bloquead%'
    ORDER BY access_date DESC, access_time DESC
    LIMIT 20
""")
for r in cur.fetchall():
    print(f"  {r[0]} | {r[1]} {r[2]} | {r[3]} | {r[4]}")

print("\n=== RESULTADO 'negado' SEM MOTIVO ===")
cur.execute("""
    SELECT customer_name, access_date, access_time, access_type, reason
    FROM solve_access_logs
    WHERE result = 'negado' AND (reason IS NULL OR reason = '')
    ORDER BY access_date DESC, access_time DESC
    LIMIT 10
""")
for r in cur.fetchall():
    print(f"  {r[0]} | {r[1]} {r[2]} | {r[3]} | motivo: '{r[4]}'")

print("\n=== IDs REMOTOS DUPLICADOS ===")
cur.execute("""
    SELECT remote_id, COUNT(*) as cnt
    FROM solve_access_logs
    GROUP BY remote_id
    HAVING COUNT(*) > 1
""")
for r in cur.fetchall():
    print(f"  remote_id={r[0]} | x{r[1]}")

print("\n=== RESUMO ===")
cur.execute("SELECT COUNT(*) FROM solve_access_logs")
total = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM solve_access_logs WHERE reason LIKE '%duplicad%'")
dup = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM solve_access_logs WHERE reason LIKE '%bloquead%'")
blocked = cur.fetchone()[0]
cur.execute("SELECT COUNT(DISTINCT customer_id) FROM solve_access_logs")
clients = cur.fetchone()[0]
print(f"  Total: {total} | Clientes: {clients} | Duplicados: {dup} | Bloqueados: {blocked}")

cur.close()
conn.close()
