import psycopg2
conn = psycopg2.connect('postgresql://neondb_owner:npg_bXxHCos9Z3Nl@ep-rapid-heart-a5mtx2z6-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require')
cur = conn.cursor()
cur.execute('SELECT remote_id, customer_name, access_date, access_time, access_type, result FROM solve_access_logs ORDER BY remote_id DESC LIMIT 3')
for r in cur.fetchall():
    print(f'ID:{r[0]} | {r[1]} | {r[2]} {r[3]} | {r[4]} | {r[5]}')
cur.execute('SELECT COUNT(*) FROM solve_access_logs')
print(f'Total: {cur.fetchone()[0]}')
conn.close()
